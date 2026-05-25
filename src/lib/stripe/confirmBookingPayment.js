import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingOverlapsSelection,
} from "@/lib/bookingAvailability";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

const BOOKING_EMAIL_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, captain_status, customer_manage_token, stripe_checkout_session_id, stripe_payment_intent_id, is_shared_open, shared_status, shared_public_token";

function getPaymentIntentId(paymentIntent) {
  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getCustomerManageUrl(booking, siteUrl = getSiteUrl()) {
  if (!booking.customer_manage_token) {
    return null;
  }

  return `${siteUrl.replace(/\/$/, "")}/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(booking.customer_manage_token)}`;
}

function getMetadataText(metadata, key) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getMetadataInteger(metadata, key) {
  const value = getMetadataText(metadata, key);

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isInteger(numberValue) ? numberValue : null;
}

function getMetadataBoolean(metadata, key) {
  return getMetadataText(metadata, key) === "true";
}

function getCheckoutSiteUrl(checkoutSession) {
  return getMetadataText(checkoutSession?.metadata, "site_url") ?? getSiteUrl();
}

function getAuthorizedBookingFromMetadata({ checkoutSession, paymentIntent }) {
  const metadata = checkoutSession.metadata ?? {};
  const isSharedOpen = getMetadataBoolean(metadata, "is_shared_open");
  const bookingId = getMetadataText(metadata, "booking_id");
  const customerManageToken = getMetadataText(metadata, "customer_manage_token");

  if (!bookingId || !customerManageToken) {
    return null;
  }

  return {
    booking_status: "checking_with_captain",
    captain_status: "pending",
    contact_method: getMetadataText(metadata, "contact_method"),
    customer_manage_token: customerManageToken,
    customer_name: getMetadataText(metadata, "customer_name"),
    email: getMetadataText(metadata, "email"),
    final_reservation_fee_eur: getMetadataInteger(
      metadata,
      "final_reservation_fee_eur",
    ),
    guest_count: getMetadataInteger(metadata, "guest_count"),
    id: bookingId,
    is_shared_open: isSharedOpen,
    locale: getMetadataText(metadata, "locale") ?? "en",
    message: getMetadataText(metadata, "message"),
    original_reservation_fee_eur: getMetadataInteger(
      metadata,
      "original_reservation_fee_eur",
    ),
    pay_on_board_eur: getMetadataInteger(metadata, "pay_on_board_eur"),
    payment_status: "authorized",
    phone: getMetadataText(metadata, "phone"),
    promo_code: getMetadataText(metadata, "promo_code"),
    promo_discount_eur: getMetadataInteger(metadata, "promo_discount_eur") ?? 0,
    requested_date: getMetadataText(metadata, "requested_date"),
    reservation_fee_eur: getMetadataInteger(metadata, "reservation_fee_eur"),
    shared_gender_preference:
      getMetadataText(metadata, "shared_gender_preference") ?? "any",
    shared_max_join_groups: getMetadataInteger(metadata, "shared_max_join_groups"),
    shared_open_seats: isSharedOpen
      ? getMetadataInteger(metadata, "shared_open_seats")
      : null,
    shared_public_token: isSharedOpen
      ? getMetadataText(metadata, "shared_public_token")
      : null,
    shared_status: isSharedOpen ? "pending_captain_confirmation" : "none",
    stripe_checkout_session_id: checkoutSession.id,
    stripe_payment_intent_id: paymentIntent.id,
    time_slot: getMetadataText(metadata, "time_slot"),
    time_window: getMetadataText(metadata, "time_window"),
    total_price_eur: getMetadataInteger(metadata, "total_price_eur"),
    tour_type: getMetadataText(metadata, "tour_type"),
    updated_at: new Date().toISOString(),
  };
}

async function hasActiveBookingOverlap({ booking, supabase }) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, requested_date, tour_type, time_slot, time_window, booking_status, payment_status",
    )
    .in("booking_status", Array.from(ACTIVE_BOOKING_STATUSES))
    .eq("requested_date", booking.requested_date);

  if (error) {
    console.error("[stripe authorization] Could not recheck availability", {
      bookingId: booking.id,
      message: error.message,
    });
    throw new Error("Could not recheck booking availability.");
  }

  return (data ?? []).some(
    (existingBooking) =>
      existingBooking.id !== booking.id &&
      bookingOverlapsSelection(existingBooking, booking),
  );
}

async function releaseUnavailableAuthorization({
  booking,
  paymentIntent,
  siteUrl,
  supabase,
}) {
  await getStripe().paymentIntents.cancel(paymentIntent.id);

  const closedBooking = {
    ...booking,
    booking_status: "not_available",
    cancellation_reason:
      "This time was no longer available when checkout authorization completed.",
    cancellation_type: "admin_decision",
    captain_status: "not_available",
    payment_status: "released",
    shared_status: booking.is_shared_open ? "cancelled" : booking.shared_status,
    updated_at: new Date().toISOString(),
  };
  const { data: insertedBooking, error } = await supabase
    .from("bookings")
    .insert(closedBooking)
    .select(BOOKING_EMAIL_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[stripe authorization] Could not save unavailable booking", {
      bookingId: booking.id,
      message: error.message,
    });
    throw new Error("Could not save unavailable booking.");
  }

  if (insertedBooking) {
    await sendBookingEmailWithManageUrl({
      booking: insertedBooking,
      eventType: "not_available",
      logPrefix: "[stripe authorization]",
      siteUrl,
      supabase,
    });
  }

  return { authorized: false, reason: "time no longer available", released: true };
}

async function createAuthorizedBookingFromSession({
  checkoutSession,
  paymentIntent,
  supabase,
}) {
  const booking = getAuthorizedBookingFromMetadata({
    checkoutSession,
    paymentIntent,
  });

  if (!booking) {
    return { authorized: false, reason: "checkout metadata missing booking" };
  }

  if (await hasActiveBookingOverlap({ booking, supabase })) {
    return releaseUnavailableAuthorization({
      booking,
      paymentIntent,
      siteUrl: getCheckoutSiteUrl(checkoutSession),
      supabase,
    });
  }

  const { data: insertedBooking, error } = await supabase
    .from("bookings")
    .insert(booking)
    .select(BOOKING_EMAIL_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { authorized: false, reason: "booking already created" };
    }

    console.error("[stripe authorization] Could not create authorized booking", {
      bookingId: booking.id,
      message: error.message,
    });
    throw new Error("Could not create authorized booking.");
  }

  if (!insertedBooking) {
    return { authorized: false, reason: "booking already processed" };
  }

  await sendBookingEmailWithManageUrl({
    booking: insertedBooking,
    eventType: "booking_authorized",
    logPrefix: "[stripe authorization]",
    siteUrl: getCheckoutSiteUrl(checkoutSession),
    supabase,
  });

  return { authorized: true };
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

async function sendBookingEmailWithManageUrl({
  booking,
  eventType,
  logPrefix,
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
  const siteUrl = getCheckoutSiteUrl(checkoutSession);
  const booking = await getBookingForCheckoutSession({
    bookingId,
    checkoutSession,
    supabase,
    token,
  });

  const paymentIntent = await getPaymentIntent(checkoutSession.payment_intent);

  if (
    !paymentIntent ||
    (paymentIntent.status !== "requires_capture" &&
      (paymentIntent.amount_capturable ?? 0) <= 0)
  ) {
    return { authorized: false, reason: "payment intent is not authorized" };
  }

  if (!booking) {
    return createAuthorizedBookingFromSession({
      checkoutSession,
      paymentIntent,
      supabase,
    });
  }

  if (booking.payment_status === "authorized") {
    return { authorized: false, reason: "booking already authorized" };
  }

  if (["captured", "released", "refunded"].includes(booking.payment_status)) {
    return { authorized: false, reason: "booking payment already closed" };
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
    siteUrl,
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
  const siteUrl = getCheckoutSiteUrl(checkoutSession);
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
    siteUrl,
    supabase,
  });

  return { confirmed: true };
}
