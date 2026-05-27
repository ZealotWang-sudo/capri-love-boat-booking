import { NextResponse } from "next/server";
import { sendWhatsAppText } from "@/lib/whatsapp/sendWhatsAppText";

function getText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function POST(request) {
  const body = await request.json();
  const bookingReference = getText(body?.booking_reference, "-");
  const bookingDate = getText(body?.booking_date, "-");
  const bookingTime = getText(body?.booking_time, "-");
  const tourType = getText(body?.tour_type, "-");
  const guestCount = getText(String(body?.guest_count ?? ""), "-");
  const customerMessage = getText(body?.customer_message, "Nessun messaggio.");
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

  const messageBody = `Ciao Renato, nuova richiesta da verificare.

Riferimento: ${bookingReference}
Data: ${bookingDate}
Orario: ${bookingTime}
Tour: ${tourType}
Ospiti: ${guestCount}

Nota cliente:
${customerMessage}

Puoi confermare la disponibilità?`;

  try {
    const metaResponse = await sendWhatsAppText({
      to: toPhone,
      body: messageBody,
    });

    console.log("[whatsapp captain booking response]", metaResponse);

    return NextResponse.json(metaResponse, { status: 200 });
  } catch (error) {
    console.error("[whatsapp captain booking] Request failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
