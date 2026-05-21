import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

const BOOKING_EMAIL_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, captain_status, customer_manage_token, stripe_checkout_session_id, stripe_payment_intent_id";

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

async function getCheckoutSession({ session, sessionId }) {
  return (
    session ??
    (sessionId
      ? await getStripe().checkout.sessions.retrieve(sessionId)
      : null)
  );
}

async function getPaymentIntent(paymentIntent) {
  const paymentIntentId = getPaymentIntentId(paymentIntent);

  if (!paymentIntentId) {
    return null;
  }

  if (typeof paymentIntent === "object") {
    return paymentIntent;
  }

  return getStripe().paymentIntents.retrieve(paymentIntentId);
}

async function getBookingForCheckoutSession({
  bookingId,
  checkoutSession,
  supabase,
  token,
}) {
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
    console.error("[stripe checkout] Could not load booking", error.message);
    throw new Error("Could not load booking for checkout session.");
  }

  if (booking) {
    return booking;
  }

  if (!checkoutSession.metadata?.booking_id) {
    return null;
  }

  if (bookingId && checkoutSession.metadata.booking_id !== bookingId) {
    return null;
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
      "[stripe checkout] Could not load booking from metadata",
      metadataError.message,
    );
    throw new Error("Could not load booking from checkout metadata.");
  }

  return metadataBooking;
}

async function sendBookingEmailWithManageUrl({ booking, eventType, logPrefix, supabase }) {
  const emailResult = await sendBookingEmail({
    booking: {
      ...booking,
      manage_url: getCustomerManageUrl(booking),
    },
    eventType,
    supabase,
  });

  if (!emailResult.sent) {
    console.error(`${logPrefix} Email was not sent`, {
      bookingId: booking.id,
      eventType,
      reason: emailResult.reason,
    });
  }
}

export async function recordBookingAuthorizationFromSession({
  bookingId,
  session,
  sessionId,
  token,
}) {
  const checkoutSession = await getCheckoutSession({ session, sessionId });

  if (!checkoutSession?.id) {
    return { authorized: false, reason: "checkout session not found" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const booking = await getBookingForCheckoutSession({
    bookingId,
    checkoutSession,
    supabase,
    token,
  });

  if (!booking) {
    return { authorized: false, reason: "booking not found" };
  }

  if (booking.payment_status === "authorized") {
    return { authorized: false, reason: "booking already authorized" };
  }

  if (["captured", "released", "refunded"].includes(booking.payment_status)) {
    return { authorized: false, reason: "booking payment already closed" };
  }

  const paymentIntent = await getPaymentIntent(checkoutSession.payment_intent);

  if (
    !paymentIntent ||
    (paymentIntent.status !== "requires_capture" &&
      (paymentIntent.amount_capturable ?? 0) <= 0)
  ) {
    return { authorized: false, reason: "payment intent is not authorized" };
  }

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({
      booking_status: "checking_with_captain",
      captain_status: "pending",
      payment_status: "authorized",
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("booking_status", "requested")
    .eq("payment_status", "authorization_pending")
    .select(BOOKING_EMAIL_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error(
      "[stripe authorization] Could not authorize booking",
      updateError.message,
    );
    throw new Error("Could not mark booking as authorized.");
  }

  if (!updatedBooking) {
    return { authorized: false, reason: "booking already processed" };
  }

  await sendBookingEmailWithManageUrl({
    booking: updatedBooking,
    eventType: "booking_authorized",
    logPrefix: "[stripe authorization]",
    supabase,
  });

  return { authorized: true };
}

export async function expireCheckoutSession({ session }) {
  if (!session?.id) {
    return { expired: false, reason: "checkout session not found" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .delete()
    .eq("stripe_checkout_session_id", session.id)
    .eq("booking_status", "requested")
    .eq("payment_status", "authorization_pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[stripe checkout expired] Could not expire booking", error.message);
    throw new Error("Could not expire incomplete checkout.");
  }

  return updatedBooking
    ? { expired: true }
    : { expired: false, reason: "checkout already processed" };
}

export async function handleCheckoutSessionCompleted({
  bookingId,
  session,
  sessionId,
  token,
}) {
  const checkoutSession = await getCheckoutSession({ session, sessionId });

  if (!checkoutSession?.id) {
    return { handled: false, reason: "checkout session not found" };
  }

  const paymentIntent = await getPaymentIntent(checkoutSession.payment_intent);
  const isManualAuthorization =
    checkoutSession.metadata?.payment_flow === "manual_authorization" ||
    paymentIntent?.status === "requires_capture" ||
    (paymentIntent?.amount_capturable ?? 0) > 0;

  if (!isManualAuthorization && checkoutSession.payment_status === "paid") {
    const result = await confirmBookingPaymentFromSession({
      bookingId,
      session: checkoutSession,
      token,
    });

    return { ...result, handled: result.confirmed };
  }

  const result = await recordBookingAuthorizationFromSession({
    bookingId,
    session: checkoutSession,
    token,
  });

  return { ...result, handled: result.authorized };
}

export async function confirmBookingPaymentFromSession({
  bookingId,
  session,
  sessionId,
  token,
}) {
  const checkoutSession = await getCheckoutSession({ session, sessionId });

  if (!checkoutSession?.id || checkoutSession.payment_status !== "paid") {
    return { confirmed: false, reason: "checkout session is not paid" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const bookingToConfirm = await getBookingForCheckoutSession({
    bookingId,
    checkoutSession,
    supabase,
    token,
  });

  if (!bookingToConfirm) {
    return { confirmed: false, reason: "booking not found" };
  }

  if (
    bookingToConfirm.booking_status === "confirmed" ||
    bookingToConfirm.payment_status === "captured"
  ) {
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

  await sendBookingEmailWithManageUrl({
    booking: updatedBooking,
    eventType: "booking_confirmed",
    logPrefix: "[stripe payment confirm]",
    supabase,
  });

  return { confirmed: true };
}
