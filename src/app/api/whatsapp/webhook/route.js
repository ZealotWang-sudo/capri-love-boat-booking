import { NextResponse } from "next/server";

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? "", {
      headers: {
        "Content-Type": "text/plain",
      },
      status: 200,
    });
  }

  return new Response("Forbidden", {
    headers: {
      "Content-Type": "text/plain",
    },
    status: 403,
  });
}

export async function POST(request) {
  const body = await request.json();
  const entries = Array.isArray(body.entry) ? body.entry : [];

  entries.forEach((entry) => {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    changes.forEach((change) => {
      const messages = Array.isArray(change.value?.messages)
        ? change.value.messages
        : [];

      messages.forEach((message) => {
        const normalizedMessage = {
          from: message.from,
          messageId: message.id,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text?.body ?? null,
        };

        console.log("[whatsapp normalized message]", normalizedMessage);
      });
    });
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
