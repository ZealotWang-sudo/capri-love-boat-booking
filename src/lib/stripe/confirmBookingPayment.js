import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

const BOOKING_EMAIL_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, customer_manage_token";

function getPaymentIntentId(paymentIntent) {
  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getCustomerManageUrl(booking) {
  if (!booking.customer_manage_token) {
    return null;
  }

  return `${getSiteUrl()}/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(booking.customer_manage_token)}`;
}

export async function confirmBookingPaymentFromSession({
  bookingId,
  session,
  sessionId,
  token,
}) {
  const checkoutSession =
    session ??
    (sessionId
      ? await getStripe().checkout.sessions.retrieve(sessionId)
      : null);

  if (!checkoutSession?.id || checkoutSession.payment_status !== "paid") {
    return { confirmed: false, reason: "checkout session is not paid" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  let query = supabase
    .from("bookings")
    .select(BOOKING_EMAIL_SELECT)
    .eq("stripe_checkout_session_id", checkoutSession.id);

  if (bookingId) {
    query = query.eq("id", bookingId);
  }

  if (token) {
    query = query.eq("customer_manage_token", token);
  }

  const { data: booking, error } = await query.maybeSingle();

  if (error) {
    console.error("[stripe payment confirm] Could not load booking", error.message);
    throw new Error("Could not load booking for checkout session.");
  }

  let bookingToConfirm = booking;

  if (!bookingToConfirm && checkoutSession.metadata?.booking_id) {
    if (bookingId && checkoutSession.metadata.booking_id !== bookingId) {
      return { confirmed: false, reason: "checkout session booking mismatch" };
    }

    let metadataQuery = supabase
      .from("bookings")
      .select(BOOKING_EMAIL_SELECT)
      .eq("id", checkoutSession.metadata.booking_id);

    if (token) {
      metadataQuery = metadataQuery.eq("customer_manage_token", token);
    }

    const { data: metadataBooking, error: metadataError } =
      await metadataQuery.maybeSingle();

    if (metadataError) {
      console.error(
        "[stripe payment confirm] Could not load booking from metadata",
        metadataError.message,
      );
      throw new Error("Could not load booking from checkout metadata.");
    }

    bookingToConfirm = metadataBooking;
  }

  if (!bookingToConfirm) {
    return { confirmed: false, reason: "booking not found" };
  }

  if (bookingToConfirm.booking_status === "confirmed") {
    return { confirmed: false, reason: "booking already confirmed" };
  }

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({
      booking_status: "confirmed",
      payment_status: "captured",
      stripe_payment_intent_id: getPaymentIntentId(checkoutSession.payment_intent),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingToConfirm.id)
    .neq("booking_status", "confirmed")
    .select(BOOKING_EMAIL_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error("[stripe payment confirm] Could not confirm booking", updateError.message);
    throw new Error("Could not confirm booking.");
  }

  if (!updatedBooking) {
    return { confirmed: false, reason: "booking already confirmed" };
  }

  const emailResult = await sendBookingEmail({
    booking: {
      ...updatedBooking,
      manage_url: getCustomerManageUrl(updatedBooking),
    },
    eventType: "booking_confirmed",
    supabase,
  });

  if (!emailResult.sent) {
    console.error("[stripe payment confirm] Confirmation email was not sent", {
      bookingId: updatedBooking.id,
      reason: emailResult.reason,
    });
  }

  return { confirmed: true };
}
