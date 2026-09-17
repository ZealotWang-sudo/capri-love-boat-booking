import {
  AUTHORIZE_OUTCOMES,
  AUTHORIZED_BOOKING_SELECT,
  authorizeCheckoutSession,
  ensureAuthorizedSideEffects,
} from "@/lib/bookings/authorizeCheckout";
import {
  ATTEMPT_STATUSES,
  expireStaleAttempts,
  getUnresolvedAttempts,
  resolveAttempt,
} from "@/lib/bookings/checkoutAttempts";

// How long we let the webhook and the browser return do their job before the
// reconciler starts chasing an attempt itself.
const ATTEMPT_GRACE_MINUTES = 10;
const NOTIFICATION_GRACE_MINUTES = 2;
const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_PAGE_SIZE = 100;

function minutesAgo(now, minutes) {
  return new Date(now.getTime() - minutes * 60_000);
}

function createSummary() {
  return {
    attemptsChecked: 0,
    attemptsExpired: 0,
    bookingsRecovered: 0,
    captainNotificationsRetried: 0,
    emailsRetried: 0,
    errors: [],
    orphanedAuthorizations: [],
    paymentIntentsScanned: 0,
    releasedAuthorizationsSynced: 0,
  };
}

function recordError(summary, scope, error) {
  summary.errors.push({
    message: error?.message ?? String(error),
    scope,
  });
  console.error(`[reconcile payments] ${scope}`, {
    message: error?.message ?? String(error),
  });
}

async function findCheckoutSessionForPaymentIntent({ paymentIntentId, stripe }) {
  const sessions = await stripe.checkout.sessions.list({
    limit: 1,
    payment_intent: paymentIntentId,
  });

  return sessions?.data?.[0] ?? null;
}

async function reconcileAttempt({ attempt, deps, now, stripe, summary }) {
  summary.attemptsChecked += 1;

  let checkoutSession = null;

  if (attempt.stripe_checkout_session_id) {
    checkoutSession = await stripe.checkout.sessions.retrieve(
      attempt.stripe_checkout_session_id,
    );
  }

  if (!checkoutSession) {
    // No session was ever recorded. The Stripe sweep below is the safety net,
    // so the hold can be released.
    await resolveAttempt({
      attemptId: attempt.id,
      error: "No Stripe Checkout Session was recorded for this attempt.",
      now,
      status: ATTEMPT_STATUSES.expired,
      supabase: deps.supabase,
    });
    summary.attemptsExpired += 1;
    return;
  }

  if (checkoutSession.status === "expired") {
    await resolveAttempt({
      attemptId: attempt.id,
      now,
      status: ATTEMPT_STATUSES.expired,
      supabase: deps.supabase,
    });
    summary.attemptsExpired += 1;
    return;
  }

  if (checkoutSession.status !== "complete") {
    return;
  }

  const paymentIntent = checkoutSession.payment_intent
    ? await stripe.paymentIntents.retrieve(
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent.id,
      )
    : null;

  if (!paymentIntent || paymentIntent.status === "canceled") {
    await resolveAttempt({
      attemptId: attempt.id,
      now,
      paymentIntentId: paymentIntent?.id ?? null,
      status: ATTEMPT_STATUSES.cancelled,
      supabase: deps.supabase,
    });
    return;
  }

  const result = await authorizeCheckoutSession({
    ...deps,
    checkoutSession,
    now,
    paymentIntent,
    siteUrl: deps.siteUrl,
  });

  if (result.outcome === AUTHORIZE_OUTCOMES.authorized) {
    summary.bookingsRecovered += 1;
  }
}

/**
 * Asks Stripe what happened, instead of waiting to be told.
 *
 * This is the guarantee that an authorized payment can never stay invisible:
 * even with the webhook destination disabled and the customer never returning
 * to the site, the booking is created from Stripe on the next pass.
 */
export async function reconcileBookingPayments({
  deps,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  now = new Date(),
  pageSize = DEFAULT_PAGE_SIZE,
  stripe,
}) {
  const summary = createSummary();
  const { supabase } = deps;

  // Each attempt is checked against Stripe directly before its slot hold is
  // released, so an expiring hold never discards a real authorization.
  const staleAttempts = await getUnresolvedAttempts({
    limit: pageSize,
    olderThan: minutesAgo(now, ATTEMPT_GRACE_MINUTES),
    supabase,
  });

  for (const attempt of staleAttempts) {
    try {
      await reconcileAttempt({ attempt, deps, now, stripe, summary });
    } catch (error) {
      recordError(summary, `attempt ${attempt.id}`, error);
      await resolveAttempt({
        attemptId: attempt.id,
        error: error?.message ?? "Reconciliation failed.",
        now,
        status: ATTEMPT_STATUSES.pending,
        supabase,
      });
    }
  }

  try {
    const { expired } = await expireStaleAttempts({ now, supabase });
    summary.attemptsExpired += expired;
  } catch (error) {
    recordError(summary, "expire stale attempts", error);
  }

  await sweepStripeAuthorizations({
    deps,
    lookbackDays,
    now,
    pageSize,
    stripe,
    summary,
  });

  await retryMissingNotifications({ deps, now, summary });
  await syncReleasedAuthorizations({ deps, pageSize, stripe, summary });

  return summary;
}

/**
 * Finds money that exists in Stripe but not in Supabase.
 *
 * Covers attempts whose row was never written, and every booking created before
 * checkout attempts existed, which is what the September incident was.
 */
export async function sweepStripeAuthorizations({
  deps,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  now = new Date(),
  pageSize = DEFAULT_PAGE_SIZE,
  stripe,
  summary = createSummary(),
}) {
  const createdAfter = Math.floor(
    (now.getTime() - lookbackDays * 24 * 60 * 60 * 1000) / 1000,
  );

  let paymentIntents;

  try {
    paymentIntents = await stripe.paymentIntents.list({
      created: { gte: createdAfter },
      limit: pageSize,
    });
  } catch (error) {
    recordError(summary, "list payment intents", error);
    return summary;
  }

  const candidates = (paymentIntents?.data ?? []).filter((paymentIntent) => {
    summary.paymentIntentsScanned += 1;

    return (
      Boolean(paymentIntent.metadata?.booking_id) &&
      ["requires_capture", "succeeded"].includes(paymentIntent.status)
    );
  });

  if (candidates.length === 0) {
    return summary;
  }

  const bookingIds = candidates.map(
    (paymentIntent) => paymentIntent.metadata.booking_id,
  );
  const { data: existingBookings, error } = await deps.supabase
    .from("bookings")
    .select("id")
    .in("id", bookingIds);

  if (error) {
    recordError(summary, "load bookings for sweep", error);
    return summary;
  }

  const knownBookingIds = new Set(
    (existingBookings ?? []).map((booking) => booking.id),
  );

  for (const paymentIntent of candidates) {
    const bookingId = paymentIntent.metadata.booking_id;

    if (knownBookingIds.has(bookingId)) {
      continue;
    }

    try {
      const checkoutSession = await findCheckoutSessionForPaymentIntent({
        paymentIntentId: paymentIntent.id,
        stripe,
      });

      if (!checkoutSession) {
        summary.orphanedAuthorizations.push({
          amount: paymentIntent.amount,
          bookingId,
          paymentIntentId: paymentIntent.id,
          reason: "No Checkout Session found for this PaymentIntent.",
        });
        continue;
      }

      const result = await authorizeCheckoutSession({
        ...deps,
        checkoutSession,
        now,
        paymentIntent,
        siteUrl: deps.siteUrl,
      });

      if (result.outcome === AUTHORIZE_OUTCOMES.authorized) {
        summary.bookingsRecovered += 1;
      } else if (result.outcome === AUTHORIZE_OUTCOMES.missingMetadata) {
        summary.orphanedAuthorizations.push({
          amount: paymentIntent.amount,
          bookingId,
          paymentIntentId: paymentIntent.id,
          reason: "Checkout metadata is incomplete; manual recovery required.",
        });
      }
    } catch (error) {
      recordError(summary, `sweep booking ${bookingId}`, error);
      summary.orphanedAuthorizations.push({
        amount: paymentIntent.amount,
        bookingId,
        paymentIntentId: paymentIntent.id,
        reason: error?.message ?? "Recovery failed.",
      });
    }
  }

  return summary;
}

/**
 * Re-drives notifications straight from booking state, which removes the need
 * for a separate outbox table: a booking that still says the captain has not
 * been told is itself the retry queue.
 */
export async function retryMissingNotifications({
  deps,
  now = new Date(),
  summary = createSummary(),
}) {
  const { supabase } = deps;
  const staleBefore = minutesAgo(now, NOTIFICATION_GRACE_MINUTES).toISOString();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(AUTHORIZED_BOOKING_SELECT)
    .eq("payment_status", "authorized")
    .eq("booking_status", "checking_with_captain")
    .lt("updated_at", staleBefore)
    .limit(50);

  if (error) {
    recordError(summary, "load bookings needing notification", error);
    return summary;
  }

  if (!bookings?.length) {
    return summary;
  }

  const { data: sentEvents, error: eventsError } = await supabase
    .from("booking_email_events")
    .select("booking_id")
    .eq("event_type", "booking_authorized")
    .eq("status", "sent")
    .in(
      "booking_id",
      bookings.map((booking) => booking.id),
    );

  if (eventsError) {
    recordError(summary, "load sent email events", eventsError);
  }

  const bookingsWithEmail = new Set(
    (sentEvents ?? []).map((event) => event.booking_id),
  );

  for (const booking of bookings) {
    const needsEmail = !bookingsWithEmail.has(booking.id);
    const needsCaptain = booking.captain_status === "pending";

    if (!needsEmail && !needsCaptain) {
      continue;
    }

    try {
      const result = await ensureAuthorizedSideEffects({
        booking,
        notifyCaptain: needsCaptain ? deps.notifyCaptain : null,
        sendEmail: needsEmail ? deps.sendEmail : null,
        siteUrl: deps.siteUrl,
        supabase,
      });

      if (result.emailSent) {
        summary.emailsRetried += 1;
      }

      if (result.captainNotified) {
        summary.captainNotificationsRetried += 1;
      }
    } catch (error) {
      recordError(summary, `notifications for booking ${booking.id}`, error);
    }
  }

  return summary;
}

/**
 * Detects authorizations cancelled outside the application, so a released hold
 * never leaves a booking that Admin still believes is payable.
 */
export async function syncReleasedAuthorizations({
  deps,
  pageSize = 50,
  stripe,
  summary = createSummary(),
}) {
  const { supabase } = deps;
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, stripe_payment_intent_id")
    .eq("payment_status", "authorized")
    .not("stripe_payment_intent_id", "is", null)
    .limit(pageSize);

  if (error) {
    recordError(summary, "load authorized bookings", error);
    return summary;
  }

  for (const booking of bookings ?? []) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        booking.stripe_payment_intent_id,
      );

      if (paymentIntent?.status !== "canceled") {
        continue;
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          booking_status: "cancelled",
          cancellation_reason:
            "The Stripe authorization was cancelled, so the reservation was released.",
          cancellation_type: "other",
          cancelled_by: "system",
          payment_status: "released",
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("payment_status", "authorized");

      if (updateError) {
        throw new Error(updateError.message);
      }

      summary.releasedAuthorizationsSynced += 1;
    } catch (error) {
      recordError(summary, `sync authorization ${booking.id}`, error);
    }
  }

  return summary;
}
