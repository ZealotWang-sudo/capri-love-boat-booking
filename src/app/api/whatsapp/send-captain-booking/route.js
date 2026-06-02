import { NextResponse } from "next/server";
import {
  CAPTAIN_MESSAGE_TYPE_VALUES,
  CAPTAIN_MESSAGE_TYPES,
  buildCaptainMessageByType,
} from "@/lib/admin/captainMessages";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

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

function buildCaptainAvailabilityReplyMarkup(bookingId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Disponibile", callback_data: `booking:accept:${bookingId}` },
        { text: "❌ Non disponibile", callback_data: `booking:decline:${bookingId}` },
      ],
    ],
  };
}

async function insertOutboundWhatsAppTracking({
  bookingId,
  metaMessageId,
  metaResponse,
  toPhone,
}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { error: insertError } = await supabase.from("whatsapp_messages").insert({
    booking_id: bookingId,
    direction: "outbound",
    message_type: "text",
    meta_message_id: metaMessageId,
    raw_payload: metaResponse,
    status: "sent",
    template_name: null,
    to_phone: toPhone,
  });

  if (!insertError || insertError.code === "23505") {
    return {
      inserted: true,
      error: null,
    };
  }

  return {
    inserted: false,
    error: insertError.message || "Unknown insert error.",
  };
}

export async function POST(request) {
  const body = await request.json();
  const bookingId = getText(body?.booking_id, "");
  const messageType = getText(body?.message_type, "");
  const captainGroupChatId = getText(process.env.TELEGRAM_CAPTAIN_GROUP_CHAT_ID, null);

  if (!messageType || !CAPTAIN_MESSAGE_TYPE_VALUES.has(messageType)) {
    return NextResponse.json(
      { error: "Missing or invalid message_type." },
      { status: 400 },
    );
  }

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceRoleServerClient();
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, customer_name, email, phone, guest_count, requested_date, tour_type, time_slot, time_window, pay_on_board_eur, message, cancellation_reason, customer_cancel_reason",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error("[captain telegram booking] Could not load booking", {
        bookingId,
        message: bookingError.message,
      });
      return NextResponse.json({ error: "Could not load booking." }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const captainMessage = buildCaptainMessageByType(booking, messageType);
    console.log("[captain telegram booking] Attempting Telegram send", {
      bookingId,
      messageType,
    });
    const replyMarkup =
      messageType === CAPTAIN_MESSAGE_TYPES.timeConfirmation
        ? buildCaptainAvailabilityReplyMarkup(bookingId)
        : undefined;
    const telegramResponse = await sendTelegramMessage({
      text: captainMessage,
      replyMarkup,
    });
    const telegramMessageId = getMessageId(telegramResponse?.result?.message_id);
    console.log("[captain telegram booking] Telegram sent", {
      bookingId,
      messageId: telegramMessageId,
    });
    const trackingResult = await insertOutboundWhatsAppTracking({
      bookingId,
      metaMessageId: telegramMessageId,
      metaResponse: telegramResponse,
      toPhone: captainGroupChatId,
    });

    if (!trackingResult.inserted) {
      console.error(
        "[captain telegram booking] Could not insert outbound message tracking",
        {
          bookingId,
          message: trackingResult.error,
          metaMessageId: telegramMessageId,
        },
      );
    }

    return NextResponse.json(
      {
        ...telegramResponse,
        tracking: trackingResult,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[captain telegram booking] Request failed", {
      bookingId,
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
