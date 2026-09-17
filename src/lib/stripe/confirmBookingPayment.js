import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import {
  AUTHORIZE_OUTCOMES,
  AUTHORIZED_BOOKING_SELECT,
  TERMINAL_AUTHORIZE_OUTCOMES,
  authorizeCheckoutSession,
} from "@/lib/bookings/authorizeCheckout";
import {
  ATTEMPT_STATUSES,
  getAttemptBySessionId,
  resolveAttempt,
} from "@/lib/bookings/checkoutAttempts";
import { sendCaptainBookingRequest } from "@/lib/notifications/captainBookingRequest";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export { AUTHORIZE_OUTCOMES, TERMINAL_AUTHORIZE_OUTCOMES };

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

export function getCheckoutSiteUrl(checkoutSession) {
  return getMetadataText(checkoutSession?.metadata, "site_url") ?? getSiteUrl();
}

async function sendBookingEmailWithManageUrl({
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

  if (!emailResult.sent && emailResult.reason !== "duplicate email event") {
    console.error("[stripe authorization] Email was not sent", {
      bookingId: booking.id,
      eventType,
      reason: emailResult.reason,
    });
  }

  return emailResult;
}

/**
 * Real implementations of every side effect the authorization flow performs.
 * Reconciliation and tests swap these out.
 */
export function buildAuthorizationDeps({ supabase } = {}) {
  const client = supabase ?? createSupabaseServiceRoleServerClient();

  return {
    cancelPaymentIntent: (paymentIntentId) =>
      getStripe().paymentIntents.cancel(
        paymentIntentId,
        {},
        { idempotencyKey: `booking-authorization-release-${paymentIntentId}` },
      ),
    notifyCaptain: ({ booking }) =>
      sendCaptainBookingRequest({
        booking,
        sendTelegram: sendTelegramMessage,
        supabase: client,
      }),
    sendEmail: sendBookingEmailWithManageUrl,
    supabase: client,
  };
}

export async function getCheckoutSession({ session, sessionId }) {
  if (session) {
    return session;
  }

  if (!sessionId) {
    return null;
  }

  return getStripe().checkout.sessions.retrieve(sessionId);
}

export async function getPaymentIntent(paymentIntent) {
  const paymentIntentId = getPaymentIntentId(paymentIntent);

  if (!paymentIntentId) {
    return null;
  }

  if (typeof paymentIntent === "object") {
    return paymentIntent;
  }

  return getStripe().paymentIntents.retrieve(paymentIntentId);
}

// The manage page passes a session id straight from the query string, so a
// caller-supplied booking id and token must match the session before we act.
function isSessionOwnedByCaller({ bookingId, checkoutSession, token }) {
  const sessionBookingId = getMetadataText(
    checkoutSession?.metadata,
    "booking_id",
  );
  const sessionToken = getMetadataText(
    checkoutSession?.metadata,
    "customer_manage_token",
  );

  if (bookingId && sessionBookingId && sessionBookingId !== bookingId) {
    return false;
  }

  if (token && sessionToken && sessionToken !== token) {
    return false;
  }

  return true;
}

export async function handleCheckoutSessionCompleted({
  bookingId,
  deps,
  session,
  sessionId,
  token,
}) {
  const checkoutSession = await getCheckoutSession({ session, sessionId });

  if (!checkoutSession?.id) {
    return {
      handled: false,
      outcome: "checkout_session_not_found",
      terminal: true,
    };
  }

  if (isSessionOwnedByCaller({ bookingId, checkoutSession, token }) === false) {
    return { handled: false, outcome: "session_owner_mismatch", terminal: true };
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

    return { ...result, handled: result.confirmed, terminal: true };
  }

  const authorizationDeps = deps ?? buildAuthorizationDeps();
  const result = await authorizeCheckoutSession({
    ...authorizationDeps,
    checkoutSession,
    paymentIntent,
    siteUrl: getCheckoutSiteUrl(checkoutSession),
  });

  return {
    ...result,
    handled:
      result.outcome === AUTHORIZE_OUTCOMES.authorized ||
      result.outcome === AUTHORIZE_OUTCOMES.alreadyAuthorized,
    terminal: TERMINAL_AUTHORIZE_OUTCOMES.has(result.outcome),
  };
}

export async function expireCheckoutSession({ session, supabase }) {
  if (!session?.id) {
    return { expired: false, reason: "checkout session not found" };
  }

  const client = supabase ?? createSupabaseServiceRoleServerClient();
  const attempt = await getAttemptBySessionId({
    sessionId: session.id,
    supabase: client,
  });

  if (attempt && attempt.status === ATTEMPT_STATUSES.pending) {
    await resolveAttempt({
      attemptId: attempt.id,
      status: ATTEMPT_STATUSES.expired,
      supabase: client,
    });
  }

  // Legacy rows: the retry-checkout route still pre-creates bookings.
  const { data: removedBooking, error } = await client
    .from("bookings")
    .delete()
    .eq("stripe_checkout_session_id", session.id)
    .eq("booking_status", "requested")
    .eq("payment_status", "authorization_pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[stripe checkout expired] Could not expire booking",
      error.message,
    );
    throw new Error("Could not expire incomplete checkout.");
  }

  return {
    expired: Boolean(attempt) || Boolean(removedBooking),
  };
}

/**
 * Keeps the booking in step when an authorization is cancelled outside the app
 * (Stripe Dashboard, authorization expiry, or our own release path).
 */
export async function syncCancelledPaymentIntent({ paymentIntent, supabase }) {
  const paymentIntentId = getPaymentIntentId(paymentIntent);

  if (!paymentIntentId) {
    return { synced: false, reason: "missing payment intent" };
  }

  const client = supabase ?? createSupabaseServiceRoleServerClient();
  const now = new Date().toISOString();
  const { data: updatedBooking, error } = await client
    .from("bookings")
    .update({
      booking_status: "cancelled",
      cancellation_reason:
        "The Stripe authorization was cancelled, so the reservation was released.",
      cancellation_type: "other",
      cancelled_at: now,
      cancelled_by: "system",
      payment_status: "released",
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .in("payment_status", ["authorized", "authorization_pending"])
    .select(AUTHORIZED_BOOKING_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not sync cancelled payment intent: ${error.message}`,
    );
  }

  await client
    .from("booking_checkout_attempts")
    .update({
      resolved_at: now,
      status: ATTEMPT_STATUSES.cancelled,
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", ATTEMPT_STATUSES.pending);

  return { booking: updatedBooking ?? null, synced: Boolean(updatedBooking) };
}

export async function syncRefundedCharge({ charge, supabase }) {
  const paymentIntentId = getPaymentIntentId(charge?.payment_intent);

  if (!paymentIntentId) {
    return { synced: false, reason: "missing payment intent" };
  }

  const client = supabase ?? createSupabaseServiceRoleServerClient();
  const now = new Date().toISOString();
  const { data: updatedBooking, error } = await client
    .from("bookings")
    .update({
      payment_status: "refunded",
      updated_at: now,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("payment_status", "captured")
    .select(AUTHORIZED_BOOKING_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not sync refunded charge: ${error.message}`);
  }

  return { booking: updatedBooking ?? null, synced: Boolean(updatedBooking) };
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

  if (isSessionOwnedByCaller({ bookingId, checkoutSession, token }) === false) {
    return { confirmed: false, reason: "session owner mismatch" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const siteUrl = getCheckoutSiteUrl(checkoutSession);
  const { data: bookingToConfirm, error: loadError } = await supabase
    .from("bookings")
    .select(AUTHORIZED_BOOKING_SELECT)
    .eq("stripe_checkout_session_id", checkoutSession.id)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Could not load booking: ${loadError.message}`);
  }

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
      stripe_payment_intent_id: getPaymentIntentId(
        checkoutSession.payment_intent,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingToConfirm.id)
    .neq("booking_status", "confirmed")
    .select(AUTHORIZED_BOOKING_SELECT)
    .maybeSingle();

  if (updateError) {
    throw new Error(`Could not confirm booking: ${updateError.message}`);
  }

  if (!updatedBooking) {
    return { confirmed: false, reason: "booking already confirmed" };
  }

  await sendBookingEmailWithManageUrl({
    booking: updatedBooking,
    eventType: "booking_confirmed",
    siteUrl,
    supabase,
  });

  return { confirmed: true };
}
