import { NextResponse } from "next/server";

const CAPTAIN_TEST_MESSAGE = `Ciao Renato, nuova richiesta da verificare.

Riferimento: CAPRI-TEST-001
Data: 19/05/2026
Orario: 09:30
Tour: 3 ore
Ospiti: 2

Puoi confermare la disponibilità?`;

export async function POST() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipientPhone = process.env.WHATSAPP_TEST_RECIPIENT_PHONE;

  if (!accessToken || !phoneNumberId || !recipientPhone) {
    return NextResponse.json(
      {
        error:
          "Missing WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, or WHATSAPP_TEST_RECIPIENT_PHONE.",
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: {
          body: CAPTAIN_TEST_MESSAGE,
        },
      }),
    },
  );
  const metaResponse = await response.json();

  console.log("[whatsapp captain test response]", metaResponse);

  return NextResponse.json(metaResponse, { status: response.status });
}
