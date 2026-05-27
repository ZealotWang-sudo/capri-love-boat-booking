import { NextResponse } from "next/server";

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

  const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: recipientPhone,
    type: "text",
    text: {
      body: "Test message from Capri Love Boat backend.",
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const metaResponse = await response.json();

    console.log("[whatsapp send-test response]", metaResponse);

    return NextResponse.json(metaResponse, { status: response.status });
  } catch (error) {
    console.error("[whatsapp send-test] Request failed", error.message);
    return NextResponse.json(
      { error: "Failed to send WhatsApp test message." },
      { status: 500 },
    );
  }
}
