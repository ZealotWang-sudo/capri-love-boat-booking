import {
  getBookingEmailEventForStatus,
  sendBookingEmail,
} from "@/lib/email/sendBookingEmail";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import {
  captureAuthorizedBookingPayment,
  releaseAuthorizedBookingPayment,
} from "@/lib/stripe/adminBookingPayments";

const CAPTAIN_DECISION_BOOKING_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, captain_status, customer_manage_token, is_shared_open, shared_status, shared_public_token";
const CLOSED_BOOKING_STATUSES = new Set([
  "confirmed",
  "declined",
  "cancelled",
  "not_available",
  "completed",
  "expired",
]);
const CLOSED_PAYMENT_STATUSES = new Set(["captured", "released", "refunded"]);

function getText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getManageUrl(booking, siteUrl) {
  if (!booking.customer_manage_token || !siteUrl) {
    return null;
  }

  return `${siteUrl.replace(/\/$/, "")}/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(booking.customer_manage_token)}`;
}

function getActorDeclineReason({ actor, source }) {
  const telegramFirstName = getText(actor?.telegramFirstName, "Captain");
  const telegramUserId = actor?.telegramUserId ?? "unknown";

  if (source === "telegram") {
    return `Captain marked not available via Telegram (${telegramFirstName}, id ${telegramUserId}).`;
  }

  return "Captain marked not available.";
}

async function loadBookingForCaptainDecision({ bookingId, supabase }) {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(CAPTAIN_DECISION_BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[captain decision] Could not load booking", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not load booking.");
  }

  if (!booking) {
    throw new Error("Booking not found.");
  }

  return booking;
}

function isAlreadyProcessed(booking) {
  return (
    CLOSED_BOOKING_STATUSES.has(booking.booking_status) ||
    CLOSED_PAYMENT_STATUSES.has(booking.payment_status)
  );
}

async function sendStatusEmailIfNeeded({ booking, siteUrl, supabase }) {
  const eventType = getBookingEmailEventForStatus(booking.booking_status);

  if (!eventType) {
    return;
  }

  const emailResult = await sendBookingEmail({
    booking: {
      ...booking,
      manage_url: getManageUrl(booking, siteUrl),
    },
    eventType,
    supabase,
  });

  if (!emailResult.sent) {
    console.error("[captain decision] Email was not sent", {
      bookingId: booking.id,
      eventType,
      reason: emailResult.reason,
    });
  }
}

export async function markCaptainAvailable({ bookingId, source, actor, siteUrl }) {
  if (!bookingId) {
    throw new Error("Missing bookingId.");
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const booking = await loadBookingForCaptainDecision({ bookingId, supabase });

  if (isAlreadyProcessed(booking)) {
    return { applied: false, reason: "booking already processed" };
  }

  if (booking.payment_status === "authorized") {
    const captureResult = await captureAuthorizedBookingPayment({ bookingId, siteUrl });
    return {
      applied: Boolean(captureResult?.captured),
      reason: captureResult?.reason || null,
    };
  }

  if (booking.booking_status === "payment_pending" && booking.captain_status === "available") {
    return { applied: false, reason: "booking already processed" };
  }

  const updatePayload = {
    booking_status: "payment_pending",
    captain_status: "available",
    payment_status: "unpaid",
    updated_at: new Date().toISOString(),
  };
  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select(CAPTAIN_DECISION_BOOKING_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error("[captain decision] Could not mark captain available", {
      bookingId,
      source,
      actor,
      message: updateError.message,
    });
    throw new Error("Could not update booking after captain acceptance.");
  }

  if (!updatedBooking) {
    return { applied: false, reason: "booking already processed" };
  }

  await sendStatusEmailIfNeeded({
    booking: updatedBooking,
    siteUrl,
    supabase,
  });

  return { applied: true, reason: null };
}

export async function markCaptainUnavailable({
  bookingId,
  source,
  actor,
  cancellationReason,
  siteUrl,
}) {
  if (!bookingId) {
    throw new Error("Missing bookingId.");
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const booking = await loadBookingForCaptainDecision({ bookingId, supabase });

  if (isAlreadyProcessed(booking)) {
    return { applied: false, reason: "booking already processed" };
  }

  const normalizedReason =
    getText(cancellationReason) || getActorDeclineReason({ actor, source });

  if (booking.payment_status === "authorized") {
    const releaseResult = await releaseAuthorizedBookingPayment({
      bookingId,
      cancelledBy: "captain",
      cancellationReason: normalizedReason,
      cancellationType: "captain_unavailable",
      outcome: "not_available",
      siteUrl,
    });

    return {
      applied: Boolean(releaseResult?.released),
      reason: releaseResult?.reason || null,
    };
  }

  if (booking.booking_status === "not_available" && booking.captain_status === "not_available") {
    return { applied: false, reason: "booking already processed" };
  }

  const updatePayload = {
    booking_status: "not_available",
    captain_status: "not_available",
    payment_status: "unpaid",
    cancellation_reason: normalizedReason,
    cancellation_type: "captain_unavailable",
    cancelled_by: "captain",
    ...(booking.is_shared_open ? { shared_status: "cancelled" } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select(CAPTAIN_DECISION_BOOKING_SELECT)
    .maybeSingle();

  if (updateError) {
    console.error("[captain decision] Could not mark captain unavailable", {
      bookingId,
      source,
      actor,
      message: updateError.message,
    });
    throw new Error("Could not update booking after captain decline.");
  }

  if (!updatedBooking) {
    return { applied: false, reason: "booking already processed" };
  }

  await sendStatusEmailIfNeeded({
    booking: updatedBooking,
    siteUrl,
    supabase,
  });

  return { applied: true, reason: null };
}
