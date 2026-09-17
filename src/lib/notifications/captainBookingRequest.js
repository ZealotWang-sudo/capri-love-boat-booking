import {
  CAPTAIN_MESSAGE_TYPES,
  buildCaptainMessageByType,
} from "@/lib/admin/captainMessages";

const CLAIMABLE_BOOKING_STATUSES = ["requested", "checking_with_captain"];

export function buildCaptainAvailabilityReplyMarkup(bookingId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Disponibile", callback_data: `booking:accept:${bookingId}` },
        {
          text: "❌ Non disponibile",
          callback_data: `booking:decline:${bookingId}`,
        },
      ],
    ],
  };
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

async function insertOutboundTelegramTracking({
  bookingId,
  supabase,
  telegramResponse,
}) {
  const chatId = process.env.TELEGRAM_CAPTAIN_GROUP_CHAT_ID || null;
  const { error } = await supabase.from("whatsapp_messages").insert({
    booking_id: bookingId,
    direction: "outbound",
    message_type: "text",
    meta_message_id: getMessageId(telegramResponse?.result?.message_id),
    raw_payload: telegramResponse,
    status: "sent",
    template_name: null,
    to_phone: chatId,
  });

  if (!error || error.code === "23505") {
    return;
  }

  console.error("[captain request] Could not save telegram tracking", {
    bookingId,
    message: error.message,
  });
}

/**
 * Sends the captain availability request exactly once per booking.
 *
 * `captain_status` is claimed with a conditional update *before* the Telegram
 * call, so concurrent webhook/redirect/reconciler runs cannot double-send. If
 * the send then fails the claim is released, which leaves the booking in the
 * state reconciliation looks for.
 */
export async function sendCaptainBookingRequest({
  booking,
  now = new Date(),
  sendTelegram,
  supabase,
}) {
  if (!booking?.id) {
    return { reason: "missing booking", sent: false };
  }

  if (!CLAIMABLE_BOOKING_STATUSES.includes(booking.booking_status)) {
    return { reason: "booking is not awaiting the captain", sent: false };
  }

  const claimedAt = now.toISOString();
  const { data: claimedBooking, error: claimError } = await supabase
    .from("bookings")
    .update({
      captain_message_copied_type: CAPTAIN_MESSAGE_TYPES.timeConfirmation,
      captain_status: "message_sent",
      updated_at: claimedAt,
    })
    .eq("id", booking.id)
    .eq("captain_status", "pending")
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("[captain request] Could not claim captain notification", {
      bookingId: booking.id,
      message: claimError.message,
    });
    return { reason: "could not claim notification", sent: false };
  }

  if (!claimedBooking) {
    return { reason: "already notified", sent: false };
  }

  try {
    const telegramResponse = await sendTelegram({
      replyMarkup: buildCaptainAvailabilityReplyMarkup(booking.id),
      text: buildCaptainMessageByType(
        booking,
        CAPTAIN_MESSAGE_TYPES.timeConfirmation,
      ),
    });

    await insertOutboundTelegramTracking({
      bookingId: booking.id,
      supabase,
      telegramResponse,
    });

    await supabase
      .from("bookings")
      .update({
        captain_message_copied_at: claimedAt,
        captain_message_sent_at: claimedAt,
      })
      .eq("id", booking.id);

    return { sent: true };
  } catch (error) {
    // Release the claim so reconciliation retries this booking.
    await supabase
      .from("bookings")
      .update({
        captain_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("captain_status", "message_sent");

    console.error("[captain request] Telegram send failed", {
      bookingId: booking.id,
      message: error?.message,
    });

    return { reason: error?.message || "Telegram send failed", sent: false };
  }
}
