import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTHORIZE_OUTCOMES,
  TERMINAL_AUTHORIZE_OUTCOMES,
  authorizeCheckoutSession,
} from "@/lib/bookings/authorizeCheckout";
import {
  createAttempt,
  createBookingRequest,
  createRecordingDeps,
} from "./helpers/bookingFixtures.mjs";
import {
  createCheckoutSession,
  createPaymentIntent,
} from "./helpers/fakeStripe.mjs";
import { createFakeSupabase } from "./helpers/fakeSupabase.mjs";

function setup({ attempts, bookings = [] } = {}) {
  const booking = createBookingRequest();
  const attempt = createAttempt({ booking });
  const supabase = createFakeSupabase({
    booking_checkout_attempts: attempts ?? [attempt],
    booking_email_events: [],
    bookings,
  });
  const { calls, deps } = createRecordingDeps({ supabase });

  return {
    attempt,
    booking,
    calls,
    checkoutSession: createCheckoutSession({ booking }),
    deps,
    paymentIntent: createPaymentIntent(),
    supabase,
  };
}

describe("authorizeCheckoutSession", () => {
  it("creates the booking when the customer never returns to the site", async () => {
    const { calls, checkoutSession, deps, paymentIntent, supabase } = setup();

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent,
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.authorized);

    const [stored] = supabase.rows("bookings");
    assert.equal(stored.booking_status, "checking_with_captain");
    assert.equal(stored.payment_status, "authorized");
    assert.equal(stored.stripe_payment_intent_id, paymentIntent.id);
    assert.deepEqual(calls.captain, [stored.id]);
    assert.equal(calls.emails.length, 1);

    const [attempt] = supabase.rows("booking_checkout_attempts");
    assert.equal(attempt.status, "authorized");
  });

  it("is idempotent across repeated webhook deliveries", async () => {
    const { calls, checkoutSession, deps, paymentIntent, supabase } = setup();

    const first = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent,
    });
    const second = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent,
    });
    const third = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent,
    });

    assert.equal(first.outcome, AUTHORIZE_OUTCOMES.authorized);
    assert.equal(second.outcome, AUTHORIZE_OUTCOMES.alreadyAuthorized);
    assert.equal(third.outcome, AUTHORIZE_OUTCOMES.alreadyAuthorized);
    assert.equal(supabase.rows("bookings").length, 1);
    assert.equal(calls.emails.length, 1, "only one authorization email");
  });

  it("creates a single booking when the webhook and the browser return race", async () => {
    const { checkoutSession, deps, paymentIntent, supabase } = setup();

    const results = await Promise.all([
      authorizeCheckoutSession({ ...deps, checkoutSession, paymentIntent }),
      authorizeCheckoutSession({ ...deps, checkoutSession, paymentIntent }),
    ]);

    assert.equal(supabase.rows("bookings").length, 1);
    assert.equal(
      results.filter(
        (result) => result.outcome === AUTHORIZE_OUTCOMES.authorized,
      ).length,
      1,
      "exactly one caller creates the booking",
    );
    assert.ok(
      results.every((result) =>
        TERMINAL_AUTHORIZE_OUTCOMES.has(result.outcome),
      ),
    );
  });

  it("still succeeds when the checkout attempt row is missing", async () => {
    // Legacy sessions, and any attempt whose row was lost, fall back to the
    // booking mirrored in Stripe metadata.
    const { checkoutSession, deps, paymentIntent, supabase } = setup({
      attempts: [],
    });

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent,
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.authorized);
    assert.equal(supabase.rows("bookings").length, 1);
  });

  it("does not create a booking before the authorization lands", async () => {
    const { checkoutSession, deps, supabase } = setup();

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent: createPaymentIntent({
        amount_capturable: 0,
        status: "requires_payment_method",
      }),
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.notAuthorized);
    assert.equal(
      TERMINAL_AUTHORIZE_OUTCOMES.has(result.outcome),
      false,
      "the webhook must be retried rather than acknowledged",
    );
    assert.equal(supabase.rows("bookings").length, 0);
  });

  it("releases the authorization when the slot was taken first", async () => {
    const { calls, checkoutSession, deps, paymentIntent, supabase } = setup({
      bookings: [
        createBookingRequest({
          booking_status: "confirmed",
          customer_manage_token: "b".repeat(43),
          id: "11111111-1111-4111-8111-111111111111",
          payment_status: "captured",
          stripe_checkout_session_id: "cs_other",
          stripe_payment_intent_id: "pi_other",
        }),
      ],
    });

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      paymentIntent,
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.slotConflict);
    assert.deepEqual(calls.cancelledPaymentIntents, [paymentIntent.id]);

    const released = supabase
      .rows("bookings")
      .find((booking) => booking.id === checkoutSession.metadata.booking_id);
    assert.equal(released.booking_status, "not_available");
    assert.equal(released.payment_status, "released");
    assert.deepEqual(calls.captain, [], "the captain is not asked about it");
  });

  it("keeps the booking when the captain notification fails", async () => {
    const { checkoutSession, deps, paymentIntent, supabase } = setup();

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession,
      notifyCaptain: async () => {
        throw new Error("Telegram is unavailable");
      },
      paymentIntent,
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.authorized);

    const [stored] = supabase.rows("bookings");
    assert.equal(stored.payment_status, "authorized");
    assert.equal(
      stored.captain_status,
      "pending",
      "left in the state reconciliation retries",
    );
  });

  it("surfaces a Supabase outage so the webhook is retried", async () => {
    const { checkoutSession, deps, paymentIntent, supabase } = setup();
    supabase.failNext("bookings", "insert");

    await assert.rejects(
      authorizeCheckoutSession({ ...deps, checkoutSession, paymentIntent }),
      /Could not create authorized booking/,
    );
    assert.equal(supabase.rows("bookings").length, 0);
  });

  it("upgrades a legacy pre-created booking row in place", async () => {
    const legacyBooking = createBookingRequest({
      stripe_checkout_session_id: "cs_test_session",
    });
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [],
      booking_email_events: [],
      bookings: [legacyBooking],
    });
    const { calls, deps } = createRecordingDeps({ supabase });

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession: createCheckoutSession({ booking: legacyBooking }),
      paymentIntent: createPaymentIntent(),
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.authorized);
    assert.equal(supabase.rows("bookings").length, 1);
    assert.equal(supabase.rows("bookings")[0].payment_status, "authorized");
    assert.deepEqual(calls.captain, [legacyBooking.id]);
  });

  it("leaves an already captured booking untouched", async () => {
    const captured = createBookingRequest({
      booking_status: "confirmed",
      payment_status: "captured",
      stripe_checkout_session_id: "cs_test_session",
    });
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [],
      booking_email_events: [],
      bookings: [captured],
    });
    const { calls, deps } = createRecordingDeps({ supabase });

    const result = await authorizeCheckoutSession({
      ...deps,
      checkoutSession: createCheckoutSession({ booking: captured }),
      paymentIntent: createPaymentIntent(),
    });

    assert.equal(result.outcome, AUTHORIZE_OUTCOMES.closed);
    assert.deepEqual(calls.captain, []);
    assert.deepEqual(calls.emails, []);
  });
});
