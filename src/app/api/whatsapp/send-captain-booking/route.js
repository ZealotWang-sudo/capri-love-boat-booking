import { NextResponse } from "next/server";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp/sendWhatsAppText";

function getText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function POST(request) {
  const body = await request.json();
  const bookingId = getText(body?.booking_id, "");
  const captainMessage = getText(body?.captain_message, "");
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

  if (!captainMessage) {
    return NextResponse.json(
      { error: "Missing captain_message." },
      { status: 400 },
    );
  }

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
  }

  try {
    const metaResponse = await sendWhatsAppText({
      to: toPhone,
      body: captainMessage,
    });
    const metaMessageId = getText(metaResponse?.messages?.[0]?.id, null);
    const supabase = createSupabaseServiceRoleServerClient();
    const { error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        booking_id: bookingId,
        direction: "outbound",
        message_type: "text",
        meta_message_id: metaMessageId,
        raw_payload: metaResponse,
        status: "sent",
        template_name: null,
        to_phone: toPhone,
      });

    if (insertError && insertError.code !== "23505") {
      console.error(
        "[whatsapp captain booking] Could not insert outbound message tracking",
        {
          bookingId,
          message: insertError.message,
          metaMessageId,
        },
      );
    }

    console.log("[whatsapp captain booking response]", metaResponse);

    return NextResponse.json(metaResponse, { status: 200 });
  } catch (error) {
    console.error("[whatsapp captain booking] Request failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
