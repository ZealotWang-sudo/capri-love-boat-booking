import {
  CAPTAIN_MESSAGE_TYPES,
  buildCaptainMessageByType,
} from "@/lib/admin/captainMessages";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

const TELEGRAM_CANCELLATION_TEMPLATE_NAME = "telegram_cancellation";
const CANCELLATION_BOOKING_SELECT =
  "id, customer_name, email, phone, guest_count, requested_date, tour_type, time_slot, time_window, pay_on_board_eur, message, cancellation_reason, customer_cancel_reason, cancelled_by, booking_status";
const CANCELLATION_STATUSES = new Set([
  "cancelled",
  "canceled",
  "declined",
  "concluded",
  "not_available",
]);
const PREVIOUSLY_CLOSED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "declined",
  "concluded",
  "not_available",
  "completed",
  "expired",
]);

function getText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getMessageId(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

async function loadBookingForCancellationNotification({ bookingId, supabase }) {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(CANCELLATION_BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[telegram cancellation notify] Could not load booking", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not load booking for cancellation notification.");
  }

  if (!booking) {
    throw new Error("Booking not found for cancellation notification.");
  }

  return booking;
}

async function hasCancellationNotificationBeenSent({ bookingId, supabase }) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("direction", "outbound")
    .eq("template_name", TELEGRAM_CANCELLATION_TEMPLATE_NAME)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[telegram cancellation notify] Could not check duplicate state", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not verify Telegram cancellation duplicate state.");
  }

  return Boolean(data);
}

async function saveCancellationNotificationTracking({
  bookingId,
  telegramResponse,
  supabase,
}) {
  const chatId = getText(process.env.TELEGRAM_CAPTAIN_GROUP_CHAT_ID, null);
  const { error: insertError } = await supabase.from("whatsapp_messages").insert({
    booking_id: bookingId,
    direction: "outbound",
    message_type: "text",
    meta_message_id: getMessageId(telegramResponse?.result?.message_id),
    raw_payload: telegramResponse,
    status: "sent",
    template_name: TELEGRAM_CANCELLATION_TEMPLATE_NAME,
    to_phone: chatId,
  });

  if (insertError && insertError.code !== "23505") {
    console.error("[telegram cancellation notify] Could not save tracking row", {
      bookingId,
      message: insertError.message,
    });
  }
}

export async function sendCaptainCancellationTelegramNotification({
  bookingId,
  booking,
  previousBookingStatus,
  reason,
  cancelledBy,
}) {
  const effectiveBookingId = getText(bookingId, booking?.id || "");

  if (!effectiveBookingId) {
    throw new Error("Missing booking id for cancellation notification.");
  }

  if (PREVIOUSLY_CLOSED_STATUSES.has(previousBookingStatus)) {
    return { reason: "already_closed_before_action", sent: false };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const alreadySent = await hasCancellationNotificationBeenSent({
    bookingId: effectiveBookingId,
    supabase,
  });

  if (alreadySent) {
    return { reason: "already_notified", sent: false };
  }

  const loadedBooking =
    booking && booking.id === effectiveBookingId
      ? {
          ...booking,
          id: effectiveBookingId,
        }
      : await loadBookingForCancellationNotification({
          bookingId: effectiveBookingId,
          supabase,
        });

  if (!CANCELLATION_STATUSES.has(loadedBooking.booking_status)) {
    return { reason: "booking_not_cancelled", sent: false };
  }

  const cancellationMessage = buildCaptainMessageByType(
    {
      ...loadedBooking,
      cancellation_reason:
        getText(reason, "") || loadedBooking.cancellation_reason || null,
      cancelled_by: getText(cancelledBy, "") || loadedBooking.cancelled_by || null,
    },
    CAPTAIN_MESSAGE_TYPES.cancellation,
  );
  const telegramResponse = await sendTelegramMessage({
    text: cancellationMessage,
  });

  await saveCancellationNotificationTracking({
    bookingId: effectiveBookingId,
    telegramResponse,
    supabase,
  });

  return { reason: null, sent: true };
}
