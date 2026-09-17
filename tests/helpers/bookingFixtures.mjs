import { getBookingMinutesRange } from "@/lib/bookingAvailability";
import { buildAttemptRow } from "@/lib/bookings/checkoutAttempts";

// The booking from the September 2026 production incident.
export const INCIDENT_BOOKING_ID = "433c4c03-3617-423c-b67e-b1493c7e4f06";

export function createBookingRequest(overrides = {}) {
  const booking = {
    captain_status: "pending",
    booking_status: "requested",
    contact_method: "email",
    customer_manage_token: "a".repeat(43),
    customer_name: "Incident Customer",
    email: "customer@example.com",
    final_reservation_fee_eur: 70,
    guest_count: 4,
    id: INCIDENT_BOOKING_ID,
    is_shared_open: false,
    locale: "en",
    message: null,
    original_reservation_fee_eur: 70,
    pay_on_board_eur: 200,
    payment_status: "authorization_pending",
    phone: "+391234567890",
    promo_code: null,
    promo_discount_eur: 0,
    requested_date: "2026-09-15",
    reservation_fee_eur: 70,
    shared_gender_preference: "any",
    shared_max_join_groups: 1,
    shared_open_seats: null,
    shared_public_token: null,
    shared_status: "none",
    time_slot: "afternoon_1400",
    time_window: "14:00",
    total_price_eur: 270,
    tour_type: "two_half_hours",
    ...overrides,
  };

  return { ...booking, ...getBookingMinutesRange(booking) };
}

export function createAttempt({ booking, overrides = {} } = {}) {
  const attemptBooking = booking ?? createBookingRequest();

  return {
    ...buildAttemptRow({
      booking: attemptBooking,
      reservationFeeEur: attemptBooking.final_reservation_fee_eur,
    }),
    stripe_checkout_session_id: "cs_test_session",
    ...overrides,
  };
}

/** Collects the side effects the authorization flow is supposed to trigger. */
export function createRecordingDeps({ supabase, overrides = {} } = {}) {
  const calls = { cancelledPaymentIntents: [], captain: [], emails: [] };

  return {
    calls,
    deps: {
      cancelPaymentIntent: async (paymentIntentId) => {
        calls.cancelledPaymentIntents.push(paymentIntentId);
      },
      notifyCaptain: async ({ booking }) => {
        calls.captain.push(booking.id);
        return { sent: true };
      },
      sendEmail: async ({ booking, eventType }) => {
        // Mirrors the unique index on sent email events.
        const { error } = await supabase
          .from("booking_email_events")
          .insert({
            booking_id: booking.id,
            event_type: eventType,
            status: "sent",
          })
          .maybeSingle();

        if (error) {
          return { reason: "duplicate email event", sent: false };
        }

        calls.emails.push({ bookingId: booking.id, eventType });

        return { sent: true };
      },
      siteUrl: "https://capriloveboat.com",
      supabase,
      ...overrides,
    },
  };
}
