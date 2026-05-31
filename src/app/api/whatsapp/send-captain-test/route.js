import { NextResponse } from "next/server";
import { sendWhatsAppText } from "@/lib/whatsapp/sendWhatsAppText";

const CAPTAIN_TEST_MESSAGE = `Ciao Renato, nuova richiesta da verificare.

Riferimento: CAPRI-TEST-001
Data: 19/05/2026
Orario: 09:30
Tour: 3 ore
Ospiti: 2

Puoi confermare la disponibilità?`;

export async function POST() {
  const recipientPhone = process.env.WHATSAPP_TEST_RECIPIENT_PHONE;

  if (!recipientPhone) {
    return NextResponse.json(
      {
        error: "Missing WHATSAPP_TEST_RECIPIENT_PHONE.",
      },
      { status: 500 },
    );
  }

  try {
    const metaResponse = await sendWhatsAppText({
      to: recipientPhone,
      body: CAPTAIN_TEST_MESSAGE,
    });

    console.log("[whatsapp captain test response]", metaResponse);

    return NextResponse.json(metaResponse, { status: 200 });
  } catch (error) {
    console.error("[whatsapp captain test] Request failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
