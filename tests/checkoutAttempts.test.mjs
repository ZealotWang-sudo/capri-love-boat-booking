import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTEMPT_STATUSES,
  attachCheckoutSession,
  attemptBlocksSelection,
  buildAttemptRow,
  createCheckoutAttempt,
  expireStaleAttempts,
  getCheckoutIdempotencyKey,
  getPendingAttemptsForDateRange,
} from "@/lib/bookings/checkoutAttempts";
import { createBookingRequest } from "./helpers/bookingFixtures.mjs";
import { createFakeSupabase } from "./helpers/fakeSupabase.mjs";

const NOW = new Date("2026-09-14T10:00:00.000Z");

describe("checkout attempts", () => {
  it("records the schedule range so the database can enforce overlap", () => {
    const booking = createBookingRequest();
    const attempt = buildAttemptRow({ booking, now: NOW });

    // 14:00 start, 2.5 hour tour.
    assert.equal(attempt.tour_start_minutes, 840);
    assert.equal(attempt.tour_end_minutes, 990);
    assert.equal(attempt.status, ATTEMPT_STATUSES.pending);
    assert.deepEqual(attempt.booking_payload, booking);
  });

  it("refuses a second checkout for an overlapping slot", async () => {
    const supabase = createFakeSupabase({ booking_checkout_attempts: [] });
    const first = await createCheckoutAttempt({
      attempt: buildAttemptRow({ booking: createBookingRequest(), now: NOW }),
      supabase,
    });

    assert.ok(first.attempt);

    // A five hour tour from 09:30 covers the 14:00 slot already being paid for.
    const overlapping = await createCheckoutAttempt({
      attempt: buildAttemptRow({
        booking: createBookingRequest({
          customer_manage_token: "c".repeat(43),
          id: "22222222-2222-4222-8222-222222222222",
          time_slot: "morning_0930",
          time_window: "09:30",
          tour_type: "five_hours",
        }),
        now: NOW,
      }),
      supabase,
    });

    assert.equal(overlapping.attempt, null);
    assert.equal(overlapping.reason, "slot_taken");
  });

  it("releases the slot once an abandoned checkout expires", async () => {
    const booking = createBookingRequest();
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [
        buildAttemptRow({
          booking,
          expiresAt: new Date(NOW.getTime() - 60_000),
          now: NOW,
        }),
      ],
    });

    const { expired } = await expireStaleAttempts({ now: NOW, supabase });
    assert.equal(expired, 1);

    const stillPending = await getPendingAttemptsForDateRange({
      endDate: booking.requested_date,
      startDate: booking.requested_date,
      supabase,
    });
    assert.deepEqual(stillPending, []);

    // The freed slot can be booked again.
    const retry = await createCheckoutAttempt({
      attempt: buildAttemptRow({
        booking: createBookingRequest({
          customer_manage_token: "d".repeat(43),
          id: "33333333-3333-4333-8333-333333333333",
        }),
        now: NOW,
      }),
      supabase,
    });
    assert.ok(retry.attempt);
  });

  it("does not let an unrelated slot block a booking", () => {
    const attempt = buildAttemptRow({ booking: createBookingRequest(), now: NOW });
    const morningBooking = createBookingRequest({
      id: "44444444-4444-4444-8444-444444444444",
      time_slot: "morning_0930",
      time_window: "09:30",
      tour_type: "two_hours",
    });

    assert.equal(attemptBlocksSelection(attempt, morningBooking), false);
  });

  it("derives a stable Stripe idempotency key from the attempt", () => {
    const booking = createBookingRequest();

    assert.equal(
      getCheckoutIdempotencyKey(booking.id),
      getCheckoutIdempotencyKey(booking.id),
    );
    assert.match(getCheckoutIdempotencyKey(booking.id), /^booking-checkout-/);
  });

  it("survives a failure to store the Stripe session id", async () => {
    const booking = createBookingRequest();
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [buildAttemptRow({ booking, now: NOW })],
    });
    supabase.failNext("booking_checkout_attempts", "update");

    const result = await attachCheckoutSession({
      attemptId: booking.id,
      sessionId: "cs_test_session",
      supabase,
    });

    // The customer still gets their Checkout URL; the Stripe sweep recovers the
    // authorization even without the session id stored locally.
    assert.equal(result.attached, false);
  });
});
