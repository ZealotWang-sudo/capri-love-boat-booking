import { NextResponse } from "next/server";
import {
  CAPTAIN_MESSAGE_TYPE_VALUES,
  buildCaptainMessageByType,
} from "@/lib/admin/captainMessages";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp/sendWhatsAppText";

function getText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
  const toPhone =
    getText(body?.to_phone) ||
    process.env.WHATSAPP_CAPTAIN_PHONE ||
    process.env.WHATSAPP_TEST_RECIPIENT_PHONE;

  if (!toPhone) {
    return NextResponse.json(
      {
        error:
          "Missing to_phone, WHATSAPP_CAPTAIN_PHONE, and WHATSAPP_TEST_RECIPIENT_PHONE.",
      },
      { status: 400 },
    );
  }

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
      console.error("[whatsapp captain booking] Could not load booking", {
        bookingId,
        message: bookingError.message,
      });
      return NextResponse.json({ error: "Could not load booking." }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const captainMessage = buildCaptainMessageByType(booking, messageType);
    const metaResponse = await sendWhatsAppText({
      to: toPhone,
      body: captainMessage,
    });
    const metaMessageId = getText(metaResponse?.messages?.[0]?.id, null);
    const trackingResult = await insertOutboundWhatsAppTracking({
      bookingId,
      metaMessageId,
      metaResponse,
      toPhone,
    });

    if (!trackingResult.inserted) {
      console.error(
        "[whatsapp captain booking] Could not insert outbound message tracking",
        {
          bookingId,
          message: trackingResult.error,
          metaMessageId,
        },
      );
    }

    console.log("[whatsapp captain booking response]", metaResponse);

    return NextResponse.json(
      {
        ...metaResponse,
        tracking: trackingResult,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[whatsapp captain booking] Request failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
