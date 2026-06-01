import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";
import { sendCaptainCancellationTelegramNotification } from "@/lib/telegram/sendCaptainCancellationTelegramNotification";

const BOOKING_PAYMENT_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, captain_status, customer_manage_token, customer_cancelled_at, customer_cancel_reason, stripe_checkout_session_id, stripe_payment_intent_id, cancellation_reason, is_shared_open, shared_status, shared_public_token";

function getCustomerManageUrl(booking, siteUrl = getSiteUrl()) {
  if (!booking.customer_manage_token) {
    return null;
  }

  return `${siteUrl.replace(/\/$/, "")}/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(booking.customer_manage_token)}`;
}

async function loadBookingForPayment({ bookingId, manageToken, supabase }) {
  let query = supabase
    .from("bookings")
    .select(BOOKING_PAYMENT_SELECT)
    .eq("id", bookingId);

  if (manageToken) {
    query = query.eq("customer_manage_token", manageToken);
  }

  const { data: booking, error } = await query.maybeSingle();

  if (error) {
    console.error("[admin booking payment] Could not load booking", error.message);
    throw new Error("Could not load booking.");
  }

  if (!booking) {
    throw new Error("Booking not found.");
  }

  return booking;
}

async function sendEmailForUpdatedBooking({
  booking,
  eventType,
  siteUrl,
  supabase,
}) {
  const emailResult = await sendBookingEmail({
    booking: {
      ...booking,
      manage_url: getCustomerManageUrl(booking, siteUrl),
    },
    eventType,
    supabase,
  });

  if (!emailResult.sent) {
    console.error("[admin booking payment] Email was not sent", {
      bookingId: booking.id,
      eventType,
      reason: emailResult.reason,
    });
  }
}

export async function captureAuthorizedBookingPayment({ bookingId, siteUrl }) {
  const supabase = createSupabaseServiceRoleServerClient();
  const booking = await loadBookingForPayment({ bookingId, supabase });

  if (
    booking.booking_status === "confirmed" ||
    booking.payment_status === "captured"
  ) {
    return { captured: false, reason: "booking already captured" };
  }

  if (booking.payment_status !== "authorized") {
    throw new Error("Only authorized reservation fees can be captured.");
  }

  if (!booking.stripe_payment_intent_id) {
    throw new Error("This booking does not have a Stripe payment intent.");
  }

  const stripe = getStripe();
  let paymentIntent;

  try {
    paymentIntent = await stripe.paymentIntents.capture(
      booking.stripe_payment_intent_id,
      {},
      {
        idempotencyKey: `booking-${booking.id}-reservation-fee-capture`,
      },
    );
  } catch (error) {
    console.error("[admin booking capture] Stripe capture failed", {
      bookingId,
      message: error.message,
    });
    throw new Error(`Stripe capture failed: ${error.message}`);
  }

  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Stripe capture did not succeed: ${paymentIntent.status}`);
  }

  const captureUpdatePayload = {
    booking_status: "confirmed",
    captain_status: "available",
    payment_status: "captured",
    stripe_payment_intent_id: paymentIntent.id,
    updated_at: new Date().toISOString(),
    ...(booking.is_shared_open &&
    booking.shared_status === "pending_captain_confirmation"
      ? { shared_status: "open" }
      : {}),
  };
  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update(captureUpdatePayload)
    .eq("id", booking.id)
    .eq("payment_status", "authorized")
    .select(BOOKING_PAYMENT_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error("[admin booking capture] Could not update booking", {
      bookingId,
      message: updateError.message,
    });
    throw new Error("Payment was captured in Stripe, but booking was not updated.");
  }

  if (!updatedBooking) {
    return { captured: false, reason: "booking already processed" };
  }

  await sendEmailForUpdatedBooking({
    booking: updatedBooking,
    eventType: "booking_confirmed",
    siteUrl,
    supabase,
  });

  return { captured: true };
}

export async function releaseAuthorizedBookingPayment({
  bookingId,
  cancelledBy = "admin",
  cancellationReason = "",
  cancellationType = "admin_decision",
  manageToken,
  outcome = "cancelled",
  siteUrl,
}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const booking = await loadBookingForPayment({ bookingId, manageToken, supabase });

  if (
    ["released", "refunded"].includes(booking.payment_status) ||
    ["cancelled", "canceled", "declined", "concluded", "not_available", "expired"].includes(
      booking.booking_status,
    )
  ) {
    return { reason: "booking already closed", released: false };
  }

  if (booking.payment_status !== "authorized") {
    throw new Error("Only authorized reservation fees can be released.");
  }

  if (!booking.stripe_payment_intent_id) {
    throw new Error("This booking does not have a Stripe payment intent.");
  }

  const stripe = getStripe();
  let paymentIntent;

  try {
    paymentIntent = await stripe.paymentIntents.cancel(
      booking.stripe_payment_intent_id,
      {},
      {
        idempotencyKey: `booking-${booking.id}-reservation-fee-release-${outcome}`,
      },
    );
  } catch (error) {
    console.error("[admin booking release] Stripe cancel failed", {
      bookingId,
      message: error.message,
    });
    throw new Error(`Stripe authorization release failed: ${error.message}`);
  }

  if (paymentIntent.status !== "canceled") {
    throw new Error(
      `Stripe authorization release did not succeed: ${paymentIntent.status}`,
    );
  }

  const isNotAvailable = outcome === "not_available";
  const isCustomerCancelled = cancelledBy === "customer";
  const updatePayload = {
    booking_status: isNotAvailable ? "not_available" : "cancelled",
    cancellation_reason: cancellationReason || null,
    cancellation_type: isNotAvailable
      ? "captain_unavailable"
      : cancellationType,
    cancelled_at: isNotAvailable ? null : new Date().toISOString(),
    cancelled_by: isNotAvailable ? "captain" : cancelledBy,
    captain_status: isNotAvailable ? "not_available" : booking.captain_status,
    customer_cancelled_at: isCustomerCancelled ? new Date().toISOString() : null,
    customer_cancel_reason: isCustomerCancelled
      ? cancellationReason || null
      : booking.customer_cancel_reason,
    payment_status: "released",
    ...(booking.is_shared_open ? { shared_status: "cancelled" } : {}),
    stripe_payment_intent_id: paymentIntent.id,
    updated_at: new Date().toISOString(),
  };
  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", booking.id)
    .eq("payment_status", "authorized")
    .select(BOOKING_PAYMENT_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error("[admin booking release] Could not update booking", {
      bookingId,
      message: updateError.message,
    });
    throw new Error(
      "Authorization was released in Stripe, but booking was not updated.",
    );
  }

  if (!updatedBooking) {
    return { reason: "booking already processed", released: false };
  }

  await sendEmailForUpdatedBooking({
    booking: updatedBooking,
    eventType: isNotAvailable ? "not_available" : "cancelled",
    siteUrl,
    supabase,
  });

  try {
    await sendCaptainCancellationTelegramNotification({
      bookingId: updatedBooking.id,
      cancelledBy: updatedBooking.cancelled_by,
      previousBookingStatus: booking.booking_status,
      reason: updatedBooking.customer_cancel_reason || updatedBooking.cancellation_reason,
    });
  } catch (error) {
    console.warn(
      `[admin booking release] Telegram cancellation warning: ${error?.message || "Unknown error."}`,
    );
  }

  return { released: true };
}
