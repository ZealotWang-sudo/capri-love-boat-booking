import { getBookingMinutesRange } from "@/lib/bookingAvailability";
import {
  ATTEMPT_STATUSES,
  UNIQUE_VIOLATION,
  getAttemptById,
  isSlotTakenError,
  resolveAttempt,
} from "@/lib/bookings/checkoutAttempts";

export const AUTHORIZED_BOOKING_SELECT =
  "id, locale, customer_name, email, phone, message, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, captain_status, customer_manage_token, stripe_checkout_session_id, stripe_payment_intent_id, is_shared_open, shared_status, shared_public_token, tour_start_minutes, tour_end_minutes";

export const AUTHORIZE_OUTCOMES = {
  alreadyAuthorized: "already_authorized",
  authorized: "authorized",
  closed: "closed",
  missingMetadata: "missing_metadata",
  notAuthorized: "not_authorized",
  slotConflict: "slot_conflict",
};

// Outcomes that represent a settled decision. Anything else is treated as a
// transient failure so Stripe keeps retrying the webhook.
export const TERMINAL_AUTHORIZE_OUTCOMES = new Set([
  AUTHORIZE_OUTCOMES.alreadyAuthorized,
  AUTHORIZE_OUTCOMES.authorized,
  AUTHORIZE_OUTCOMES.closed,
  AUTHORIZE_OUTCOMES.missingMetadata,
  AUTHORIZE_OUTCOMES.slotConflict,
]);

const CLOSED_PAYMENT_STATUSES = new Set(["captured", "released", "refunded"]);

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

export function isPaymentIntentAuthorized(paymentIntent) {
  if (!paymentIntent) {
    return false;
  }

  return (
    paymentIntent.status === "requires_capture" ||
    (paymentIntent.amount_capturable ?? 0) > 0
  );
}

function withScheduleRange(booking) {
  if (
    Number.isInteger(booking.tour_start_minutes) &&
    Number.isInteger(booking.tour_end_minutes)
  ) {
    return booking;
  }

  const range = getBookingMinutesRange(booking);

  return range ? { ...booking, ...range } : booking;
}

// Legacy fallback for sessions created before checkout attempts existed: the
// whole booking is still mirrored in Stripe metadata.
export function buildBookingFromMetadata({ checkoutSession, paymentIntent }) {
  const metadata = checkoutSession.metadata ?? {};
  const bookingId = getMetadataText(metadata, "booking_id");
  const customerManageToken = getMetadataText(metadata, "customer_manage_token");

  if (!bookingId || !customerManageToken) {
    return null;
  }

  const isSharedOpen = getMetadataBoolean(metadata, "is_shared_open");

  return withScheduleRange({
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
    shared_max_join_groups: getMetadataInteger(
      metadata,
      "shared_max_join_groups",
    ),
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
  });
}

export function buildBookingFromAttempt({
  attempt,
  checkoutSession,
  paymentIntent,
}) {
  const payload = attempt?.booking_payload;

  if (!payload?.id) {
    return null;
  }

  return withScheduleRange({
    ...payload,
    booking_status: "checking_with_captain",
    captain_status: "pending",
    checkout_attempt_id: attempt.id,
    payment_status: "authorized",
    stripe_checkout_session_id: checkoutSession.id,
    stripe_payment_intent_id: paymentIntent.id,
    tour_end_minutes: attempt.tour_end_minutes,
    tour_start_minutes: attempt.tour_start_minutes,
  });
}

async function loadBooking({ bookingId, sessionId, supabase }) {
  if (bookingId) {
    const { data, error } = await supabase
      .from("bookings")
      .select(AUTHORIZED_BOOKING_SELECT)
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load booking: ${error.message}`);
    }

    if (data) {
      return data;
    }
  }

  if (!sessionId) {
    return null;
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(AUTHORIZED_BOOKING_SELECT)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load booking by session: ${error.message}`);
  }

  return data;
}

/**
 * Re-runs the notifications an authorized booking must have.
 *
 * Both are individually idempotent (the email log has a unique index on sent
 * events, the captain claim is a conditional update), so calling this on every
 * retry heals partial failures without duplicating anything.
 */
export async function ensureAuthorizedSideEffects({
  booking,
  notifyCaptain,
  sendEmail,
  siteUrl,
  supabase,
}) {
  const result = { captainNotified: false, emailSent: false };

  if (sendEmail) {
    try {
      const emailResult = await sendEmail({
        booking,
        eventType: "booking_authorized",
        siteUrl,
        supabase,
      });
      result.emailSent = Boolean(emailResult?.sent);
    } catch (error) {
      console.error("[authorize checkout] Authorized email failed", {
        bookingId: booking.id,
        message: error?.message,
      });
    }
  }

  if (notifyCaptain) {
    try {
      const captainResult = await notifyCaptain({ booking, supabase });
      result.captainNotified = Boolean(captainResult?.sent);
    } catch (error) {
      console.error("[authorize checkout] Captain notification failed", {
        bookingId: booking.id,
        message: error?.message,
      });
    }
  }

  return result;
}

async function releaseConflictingAuthorization({
  attempt,
  booking,
  cancelPaymentIntent,
  now,
  paymentIntent,
  sendEmail,
  siteUrl,
  supabase,
}) {
  await cancelPaymentIntent(paymentIntent.id);

  const timestamp = now.toISOString();
  const { data: closedBooking, error } = await supabase
    .from("bookings")
    .insert({
      ...booking,
      booking_status: "not_available",
      cancellation_reason:
        "This time was no longer available when checkout authorization completed.",
      cancellation_type: "admin_decision",
      captain_status: "not_available",
      payment_status: "released",
      shared_status: booking.is_shared_open ? "cancelled" : booking.shared_status,
      updated_at: timestamp,
    })
    .select(AUTHORIZED_BOOKING_SELECT)
    .maybeSingle();

  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("[authorize checkout] Could not record released booking", {
      bookingId: booking.id,
      message: error.message,
    });
  }

  if (attempt) {
    await resolveAttempt({
      attemptId: attempt.id,
      error: "Slot was taken before the authorization was reconciled.",
      now,
      paymentIntentId: paymentIntent.id,
      status: ATTEMPT_STATUSES.conflict,
      supabase,
    });
  }

  if (closedBooking) {
    try {
      await sendEmail({
        booking: closedBooking,
        eventType: "not_available",
        siteUrl,
        supabase,
      });
    } catch (emailError) {
      console.error("[authorize checkout] Not-available email failed", {
        bookingId: booking.id,
        message: emailError?.message,
      });
    }
  }

  return {
    bookingId: booking.id,
    outcome: AUTHORIZE_OUTCOMES.slotConflict,
  };
}

/**
 * Turns a completed Stripe Checkout Session into an authorized booking.
 *
 * Safe to call any number of times, from the webhook, the browser return, or
 * reconciliation, including concurrently.
 */
export async function authorizeCheckoutSession({
  cancelPaymentIntent,
  checkoutSession,
  notifyCaptain,
  now = new Date(),
  paymentIntent,
  sendEmail,
  siteUrl,
  supabase,
}) {
  const bookingId =
    getMetadataText(checkoutSession?.metadata, "booking_id") ?? null;

  if (!isPaymentIntentAuthorized(paymentIntent)) {
    return {
      bookingId,
      outcome: AUTHORIZE_OUTCOMES.notAuthorized,
    };
  }

  const existingBooking = await loadBooking({
    bookingId,
    sessionId: checkoutSession.id,
    supabase,
  });

  if (existingBooking) {
    if (CLOSED_PAYMENT_STATUSES.has(existingBooking.payment_status)) {
      return {
        booking: existingBooking,
        bookingId: existingBooking.id,
        outcome: AUTHORIZE_OUTCOMES.closed,
      };
    }

    if (existingBooking.payment_status === "authorized") {
      const sideEffects = await ensureAuthorizedSideEffects({
        booking: existingBooking,
        notifyCaptain,
        sendEmail,
        siteUrl,
        supabase,
      });

      return {
        booking: existingBooking,
        bookingId: existingBooking.id,
        outcome: AUTHORIZE_OUTCOMES.alreadyAuthorized,
        sideEffects,
      };
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        booking_status: "checking_with_captain",
        payment_status: "authorized",
        stripe_checkout_session_id: checkoutSession.id,
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: now.toISOString(),
      })
      .eq("id", existingBooking.id)
      .in("payment_status", ["authorization_pending", "unpaid"])
      .select(AUTHORIZED_BOOKING_SELECT)
      .maybeSingle();

    if (updateError) {
      throw new Error(
        `Could not mark booking as authorized: ${updateError.message}`,
      );
    }

    const booking = updatedBooking ?? existingBooking;
    const sideEffects = await ensureAuthorizedSideEffects({
      booking,
      notifyCaptain,
      sendEmail,
      siteUrl,
      supabase,
    });

    return {
      booking,
      bookingId: booking.id,
      outcome: updatedBooking
        ? AUTHORIZE_OUTCOMES.authorized
        : AUTHORIZE_OUTCOMES.alreadyAuthorized,
      sideEffects,
    };
  }

  const attempt = bookingId
    ? await getAttemptById({ attemptId: bookingId, supabase })
    : null;
  const bookingToInsert =
    buildBookingFromAttempt({ attempt, checkoutSession, paymentIntent }) ??
    buildBookingFromMetadata({ checkoutSession, paymentIntent });

  if (!bookingToInsert) {
    return {
      bookingId,
      outcome: AUTHORIZE_OUTCOMES.missingMetadata,
    };
  }

  const { data: insertedBooking, error: insertError } = await supabase
    .from("bookings")
    .insert({ ...bookingToInsert, updated_at: now.toISOString() })
    .select(AUTHORIZED_BOOKING_SELECT)
    .maybeSingle();

  if (insertError) {
    if (isSlotTakenError(insertError)) {
      return releaseConflictingAuthorization({
        attempt,
        booking: bookingToInsert,
        cancelPaymentIntent,
        now,
        paymentIntent,
        sendEmail,
        siteUrl,
        supabase,
      });
    }

    if (insertError.code === UNIQUE_VIOLATION) {
      // A concurrent run won the race; converge on its row.
      const winner = await loadBooking({
        bookingId: bookingToInsert.id,
        sessionId: checkoutSession.id,
        supabase,
      });

      if (winner) {
        const sideEffects = await ensureAuthorizedSideEffects({
          booking: winner,
          notifyCaptain,
          sendEmail,
          siteUrl,
          supabase,
        });

        return {
          booking: winner,
          bookingId: winner.id,
          outcome: AUTHORIZE_OUTCOMES.alreadyAuthorized,
          sideEffects,
        };
      }
    }

    throw new Error(
      `Could not create authorized booking: ${insertError.message}`,
    );
  }

  if (attempt) {
    await resolveAttempt({
      attemptId: attempt.id,
      now,
      paymentIntentId: paymentIntent.id,
      status: ATTEMPT_STATUSES.authorized,
      supabase,
    });
  }

  const sideEffects = await ensureAuthorizedSideEffects({
    booking: insertedBooking,
    notifyCaptain,
    sendEmail,
    siteUrl,
    supabase,
  });

  return {
    booking: insertedBooking,
    bookingId: insertedBooking.id,
    outcome: AUTHORIZE_OUTCOMES.authorized,
    sideEffects,
  };
}
