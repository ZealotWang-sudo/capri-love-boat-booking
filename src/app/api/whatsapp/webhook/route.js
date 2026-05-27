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
        let text = null;
        let buttonText = null;
        let buttonPayload = null;

        if (message.type === "text") {
          text = message.text?.body ?? null;
        } else if (message.type === "button") {
          buttonText = message.button?.text ?? null;
          buttonPayload = message.button?.payload ?? null;
        } else if (
          message.type === "interactive" &&
          message.interactive?.type === "button_reply"
        ) {
          buttonText = message.interactive.button_reply?.title ?? null;
          buttonPayload = message.interactive.button_reply?.id ?? null;
        }

        const normalizedMessage = {
          from: message.from,
          messageId: message.id,
          timestamp: message.timestamp,
          type: message.type,
          text,
          buttonText,
          buttonPayload,
        };

        console.log("[whatsapp normalized message]", normalizedMessage);
      });
    });
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
