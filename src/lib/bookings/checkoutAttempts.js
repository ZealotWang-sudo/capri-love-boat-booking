import {
  getBookingMinutesRange,
  minuteRangesOverlap,
} from "@/lib/bookingAvailability";

// Slightly longer than the Stripe session so the local slot hold never expires
// while Checkout is still payable.
export const CHECKOUT_ATTEMPT_TTL_MINUTES = 35;

export const ATTEMPT_STATUSES = {
  authorized: "authorized",
  cancelled: "cancelled",
  conflict: "conflict",
  expired: "expired",
  failed: "failed",
  pending: "pending",
};

export const ATTEMPT_SELECT =
  "id, created_at, updated_at, status, locale, customer_email, requested_date, tour_type, time_slot, tour_start_minutes, tour_end_minutes, reservation_fee_eur, expires_at, booking_payload, stripe_checkout_session_id, stripe_payment_intent_id, resolved_at, reconciled_at, reconcile_attempts, last_error";

// Postgres reports a violated exclusion constraint; supabase-js surfaces the
// SQLSTATE untouched.
export const EXCLUSION_VIOLATION = "23P01";
export const UNIQUE_VIOLATION = "23505";

export function isSlotTakenError(error) {
  return error?.code === EXCLUSION_VIOLATION;
}

export function getCheckoutIdempotencyKey(attemptId) {
  return `booking-checkout-${attemptId}`;
}

export function buildAttemptRow({
  booking,
  expiresAt,
  now = new Date(),
  reservationFeeEur,
}) {
  const range = getBookingMinutesRange(booking);

  if (!range) {
    throw new Error("Could not resolve the tour schedule for this booking.");
  }

  return {
    booking_payload: booking,
    customer_email: booking.email ?? null,
    expires_at: (
      expiresAt ??
      new Date(now.getTime() + CHECKOUT_ATTEMPT_TTL_MINUTES * 60_000)
    ).toISOString(),
    id: booking.id,
    locale: booking.locale ?? null,
    requested_date: booking.requested_date,
    reservation_fee_eur: reservationFeeEur ?? null,
    status: ATTEMPT_STATUSES.pending,
    time_slot: booking.time_slot,
    tour_end_minutes: range.tour_end_minutes,
    tour_start_minutes: range.tour_start_minutes,
    tour_type: booking.tour_type,
  };
}

// Pending attempts hold their slot. The exclusion constraint cannot reference
// now(), so stale holds are released here before any availability decision.
export async function expireStaleAttempts({ now = new Date(), supabase }) {
  const { data, error } = await supabase
    .from("booking_checkout_attempts")
    .update({
      resolved_at: now.toISOString(),
      status: ATTEMPT_STATUSES.expired,
      updated_at: now.toISOString(),
    })
    .eq("status", ATTEMPT_STATUSES.pending)
    .lt("expires_at", now.toISOString())
    .select("id");

  if (error) {
    console.error("[checkout attempts] Could not expire stale attempts", {
      message: error.message,
    });
    return { expired: 0 };
  }

  return { expired: data?.length ?? 0 };
}

export async function getPendingAttemptsForDateRange({
  endDate,
  startDate,
  supabase,
}) {
  const { data, error } = await supabase
    .from("booking_checkout_attempts")
    .select(
      "id, requested_date, tour_type, time_slot, tour_start_minutes, tour_end_minutes",
    )
    .eq("status", ATTEMPT_STATUSES.pending)
    .gte("requested_date", startDate)
    .lte("requested_date", endDate);

  if (error) {
    console.error("[checkout attempts] Could not load pending attempts", {
      message: error.message,
    });
    return [];
  }

  return data ?? [];
}

export function attemptBlocksSelection(attempt, selection) {
  if (attempt.requested_date !== selection.requested_date) {
    return false;
  }

  if (attempt.id === selection.id) {
    return false;
  }

  const selectionRange = getBookingMinutesRange(selection);

  if (!selectionRange) {
    return false;
  }

  return minuteRangesOverlap(
    {
      tour_end_minutes: attempt.tour_end_minutes,
      tour_start_minutes: attempt.tour_start_minutes,
    },
    selectionRange,
  );
}

export async function createCheckoutAttempt({ attempt, supabase }) {
  const { data, error } = await supabase
    .from("booking_checkout_attempts")
    .insert(attempt)
    .select(ATTEMPT_SELECT)
    .maybeSingle();

  if (error) {
    if (isSlotTakenError(error)) {
      return { attempt: null, reason: "slot_taken" };
    }

    if (error.code === UNIQUE_VIOLATION) {
      return { attempt: null, reason: "duplicate_attempt" };
    }

    console.error("[checkout attempts] Could not create attempt", {
      attemptId: attempt.id,
      message: error.message,
    });

    return { attempt: null, reason: "insert_failed" };
  }

  return { attempt: data, reason: null };
}

export async function attachCheckoutSession({
  attemptId,
  now = new Date(),
  sessionId,
  supabase,
}) {
  const { error } = await supabase
    .from("booking_checkout_attempts")
    .update({
      stripe_checkout_session_id: sessionId,
      updated_at: now.toISOString(),
    })
    .eq("id", attemptId);

  if (error) {
    // Recoverable: reconciliation re-derives the session from the idempotency
    // key, so the customer is not blocked on this write.
    console.error("[checkout attempts] Could not attach checkout session", {
      attemptId,
      message: error.message,
    });
    return { attached: false };
  }

  return { attached: true };
}

export async function resolveAttempt({
  attemptId,
  error: lastError = null,
  now = new Date(),
  paymentIntentId = null,
  status,
  supabase,
}) {
  const timestamp = now.toISOString();
  const { error } = await supabase
    .from("booking_checkout_attempts")
    .update({
      last_error: lastError,
      reconciled_at: timestamp,
      resolved_at:
        status === ATTEMPT_STATUSES.pending ? null : timestamp,
      status,
      updated_at: timestamp,
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq("id", attemptId);

  if (error) {
    console.error("[checkout attempts] Could not resolve attempt", {
      attemptId,
      message: error.message,
      status,
    });
    return { resolved: false };
  }

  return { resolved: true };
}

export async function getAttemptById({ attemptId, supabase }) {
  const { data, error } = await supabase
    .from("booking_checkout_attempts")
    .select(ATTEMPT_SELECT)
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    console.error("[checkout attempts] Could not load attempt", {
      attemptId,
      message: error.message,
    });
    return null;
  }

  return data;
}

export async function getAttemptBySessionId({ sessionId, supabase }) {
  const { data, error } = await supabase
    .from("booking_checkout_attempts")
    .select(ATTEMPT_SELECT)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[checkout attempts] Could not load attempt by session", {
      message: error.message,
      sessionId,
    });
    return null;
  }

  return data;
}

export async function getUnresolvedAttempts({
  limit = 100,
  olderThan,
  supabase,
}) {
  let query = supabase
    .from("booking_checkout_attempts")
    .select(ATTEMPT_SELECT)
    .eq("status", ATTEMPT_STATUSES.pending)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (olderThan) {
    query = query.lt("created_at", olderThan.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("[checkout attempts] Could not load unresolved attempts", {
      message: error.message,
    });
    return [];
  }

  return data ?? [];
}
