import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reconcileBookingPayments,
  retryMissingNotifications,
  sweepStripeAuthorizations,
  syncReleasedAuthorizations,
} from "@/lib/bookings/reconcilePayments";
import {
  INCIDENT_BOOKING_ID,
  createAttempt,
  createBookingRequest,
  createRecordingDeps,
} from "./helpers/bookingFixtures.mjs";
import {
  createCheckoutSession,
  createFakeStripe,
  createPaymentIntent,
} from "./helpers/fakeStripe.mjs";
import { createFakeSupabase } from "./helpers/fakeSupabase.mjs";

const NOW = new Date("2026-09-14T12:00:00.000Z");

function hoursBefore(hours) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

describe("reconcileBookingPayments", () => {
  it("recovers the production incident: webhook disabled and customer never returned", async () => {
    // Exactly the September 2026 state: Stripe holds an authorized, uncaptured
    // PaymentIntent carrying the booking metadata, and Supabase has no booking.
    const booking = createBookingRequest();
    const attempt = createAttempt({
      booking,
      overrides: { created_at: hoursBefore(24), expires_at: hoursBefore(23) },
    });
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [attempt],
      booking_email_events: [],
      bookings: [],
    });
    const { calls, deps } = createRecordingDeps({ supabase });
    const paymentIntent = createPaymentIntent({
      id: "pi_3UFWEbGni59g0iEs0F3D0doA",
      metadata: { booking_id: INCIDENT_BOOKING_ID },
    });
    const stripe = createFakeStripe({
      checkoutSessions: [
        createCheckoutSession({
          booking,
          overrides: { payment_intent: paymentIntent.id },
        }),
      ],
      paymentIntents: [paymentIntent],
    });

    const summary = await reconcileBookingPayments({ deps, now: NOW, stripe });

    assert.equal(summary.bookingsRecovered, 1);

    const [recovered] = supabase.rows("bookings");
    assert.equal(recovered.id, INCIDENT_BOOKING_ID);
    assert.equal(recovered.payment_status, "authorized");
    assert.equal(recovered.booking_status, "checking_with_captain");
    assert.deepEqual(calls.captain, [INCIDENT_BOOKING_ID]);
    assert.equal(calls.emails.length, 1);
    assert.deepEqual(summary.orphanedAuthorizations, []);
  });

  it("recovers an authorization whose attempt row was never written", async () => {
    // Covers bookings made before checkout attempts existed, and the window
    // where Supabase fails between the attempt insert and the Stripe call.
    const booking = createBookingRequest();
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [],
      booking_email_events: [],
      bookings: [],
    });
    const { deps } = createRecordingDeps({ supabase });
    const paymentIntent = createPaymentIntent({
      metadata: { booking_id: booking.id },
    });
    const stripe = createFakeStripe({
      checkoutSessions: [createCheckoutSession({ booking })],
      paymentIntents: [paymentIntent],
    });

    const summary = await sweepStripeAuthorizations({ deps, now: NOW, stripe });

    assert.equal(summary.bookingsRecovered, 1);
    assert.equal(supabase.rows("bookings").length, 1);
  });

  it("does not duplicate a booking that already exists", async () => {
    const booking = createBookingRequest({
      booking_status: "checking_with_captain",
      captain_status: "message_sent",
      payment_status: "authorized",
      stripe_payment_intent_id: "pi_test_authorized",
    });
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [],
      booking_email_events: [
        {
          booking_id: booking.id,
          event_type: "booking_authorized",
          status: "sent",
        },
      ],
      bookings: [booking],
    });
    const { calls, deps } = createRecordingDeps({ supabase });
    const stripe = createFakeStripe({
      checkoutSessions: [createCheckoutSession({ booking })],
      paymentIntents: [
        createPaymentIntent({ metadata: { booking_id: booking.id } }),
      ],
    });

    const summary = await reconcileBookingPayments({ deps, now: NOW, stripe });

    assert.equal(summary.bookingsRecovered, 0);
    assert.equal(supabase.rows("bookings").length, 1);
    assert.deepEqual(calls.captain, []);
    assert.deepEqual(calls.emails, []);
  });

  it("frees the slot when the customer abandons checkout", async () => {
    const booking = createBookingRequest();
    const attempt = createAttempt({
      booking,
      overrides: { created_at: hoursBefore(2), expires_at: hoursBefore(1) },
    });
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [attempt],
      bookings: [],
    });
    const { deps } = createRecordingDeps({ supabase });
    const stripe = createFakeStripe({
      checkoutSessions: [
        createCheckoutSession({
          booking,
          overrides: { payment_intent: null, status: "expired" },
        }),
      ],
    });

    await reconcileBookingPayments({ deps, now: NOW, stripe });

    const [stored] = supabase.rows("booking_checkout_attempts");
    assert.equal(stored.status, "expired");
    assert.equal(supabase.rows("bookings").length, 0);
  });

  it("reports an authorization it cannot repair instead of hiding it", async () => {
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [],
      bookings: [],
    });
    const { deps } = createRecordingDeps({ supabase });
    const stripe = createFakeStripe({
      checkoutSessions: [],
      paymentIntents: [
        createPaymentIntent({
          id: "pi_orphan",
          metadata: { booking_id: INCIDENT_BOOKING_ID },
        }),
      ],
    });

    const summary = await sweepStripeAuthorizations({ deps, now: NOW, stripe });

    assert.equal(summary.bookingsRecovered, 0);
    assert.equal(summary.orphanedAuthorizations.length, 1);
    assert.equal(
      summary.orphanedAuthorizations[0].paymentIntentId,
      "pi_orphan",
    );
  });

  it("retries a captain notification that previously failed", async () => {
    const booking = createBookingRequest({
      booking_status: "checking_with_captain",
      captain_status: "pending",
      payment_status: "authorized",
      updated_at: hoursBefore(1),
    });
    const supabase = createFakeSupabase({
      booking_email_events: [
        {
          booking_id: booking.id,
          event_type: "booking_authorized",
          status: "sent",
        },
      ],
      bookings: [booking],
    });
    const { calls, deps } = createRecordingDeps({ supabase });

    const summary = await retryMissingNotifications({ deps, now: NOW });

    assert.equal(summary.captainNotificationsRetried, 1);
    assert.deepEqual(calls.captain, [booking.id]);
    assert.equal(calls.emails.length, 0, "the email was already sent");
  });

  it("retries an authorization email that was never delivered", async () => {
    const booking = createBookingRequest({
      booking_status: "checking_with_captain",
      captain_status: "message_sent",
      payment_status: "authorized",
      updated_at: hoursBefore(1),
    });
    const supabase = createFakeSupabase({
      booking_email_events: [],
      bookings: [booking],
    });
    const { calls, deps } = createRecordingDeps({ supabase });

    const summary = await retryMissingNotifications({ deps, now: NOW });

    assert.equal(summary.emailsRetried, 1);
    assert.equal(calls.emails.length, 1);
    assert.deepEqual(calls.captain, [], "the captain was already told");
  });

  it("releases a booking whose authorization was cancelled in Stripe", async () => {
    const booking = createBookingRequest({
      booking_status: "checking_with_captain",
      payment_status: "authorized",
      stripe_payment_intent_id: "pi_cancelled",
    });
    const supabase = createFakeSupabase({ bookings: [booking] });
    const { deps } = createRecordingDeps({ supabase });
    const stripe = createFakeStripe({
      paymentIntents: [
        createPaymentIntent({
          amount_capturable: 0,
          id: "pi_cancelled",
          status: "canceled",
        }),
      ],
    });

    const summary = await syncReleasedAuthorizations({ deps, stripe });

    assert.equal(summary.releasedAuthorizationsSynced, 1);

    const [stored] = supabase.rows("bookings");
    assert.equal(stored.payment_status, "released");
    assert.equal(stored.booking_status, "cancelled");
  });

  it("recovers on the next pass when Supabase fails mid-pass", async () => {
    const booking = createBookingRequest();
    const attempt = createAttempt({
      booking,
      overrides: { created_at: hoursBefore(24), expires_at: hoursBefore(23) },
    });
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [attempt],
      booking_email_events: [],
      bookings: [],
    });
    const { deps } = createRecordingDeps({ supabase });
    const stripe = createFakeStripe({
      checkoutSessions: [createCheckoutSession({ booking })],
      paymentIntents: [
        createPaymentIntent({ metadata: { booking_id: booking.id } }),
      ],
    });

    // Two inserts fail: the attempt-driven path and the Stripe sweep fallback.
    supabase.failNext("bookings", "insert");
    supabase.failNext("bookings", "insert");

    const summary = await reconcileBookingPayments({ deps, now: NOW, stripe });

    assert.equal(summary.bookingsRecovered, 0);
    assert.ok(summary.errors.length >= 1, "the failure is reported, not hidden");
    assert.equal(supabase.rows("bookings").length, 0);

    const retrySummary = await reconcileBookingPayments({
      deps,
      now: NOW,
      stripe,
    });

    assert.equal(retrySummary.bookingsRecovered, 1);
    assert.equal(supabase.rows("bookings").length, 1);
  });

  it("survives Stripe being unavailable", async () => {
    const supabase = createFakeSupabase({
      booking_checkout_attempts: [],
      bookings: [],
    });
    const { deps } = createRecordingDeps({ supabase });
    const stripe = createFakeStripe();
    stripe.paymentIntents.list = async () => {
      throw new Error("Stripe is unavailable");
    };

    const summary = await reconcileBookingPayments({ deps, now: NOW, stripe });

    assert.ok(
      summary.errors.some((entry) => entry.scope === "list payment intents"),
    );
  });
});
