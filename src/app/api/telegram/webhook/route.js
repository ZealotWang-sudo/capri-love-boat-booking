import { NextResponse } from "next/server";

function getText(value, fallback = null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseBookingCallbackData(callbackData) {
  const rawData = getText(callbackData, "");
  const parts = rawData.split(":");

  if (parts.length !== 3 || parts[0] !== "booking") {
    return null;
  }

  const action = parts[1];
  const bookingId = getText(parts[2], null);

  if (!["accept", "decline"].includes(action) || !bookingId) {
    return null;
  }

  return { action, bookingId };
}

async function answerCallbackQuery(callbackQueryId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: "Risposta ricevuta",
      }),
    },
  );

  const telegramResponse = await response.json();

  if (!response.ok || telegramResponse?.ok === false) {
    const apiDescription =
      typeof telegramResponse?.description === "string" &&
      telegramResponse.description.trim()
        ? telegramResponse.description.trim()
        : "Unknown Telegram API error.";
    throw new Error(`Telegram answerCallbackQuery failed: ${apiDescription}`);
  }
}

export async function POST(request) {
  try {
    const update = await request.json();
    const callbackQuery = update?.callback_query;

    if (!callbackQuery) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const callbackQueryId = getText(callbackQuery.id, null);
    const callbackData = getText(callbackQuery.data, null);
    const telegramUserId = callbackQuery?.from?.id ?? null;
    const telegramFirstName = getText(callbackQuery?.from?.first_name, null);
    const chatId = callbackQuery?.message?.chat?.id ?? null;
    const messageId = callbackQuery?.message?.message_id ?? null;
    const parsed = parseBookingCallbackData(callbackData);

    if (parsed) {
      console.log("[telegram callback booking]", {
        action: parsed.action,
        bookingId: parsed.bookingId,
        telegramUserId,
        telegramFirstName,
        chatId,
        messageId,
      });
    } else {
      console.warn("[telegram callback booking] Invalid callback data format", {
        callbackData,
        telegramUserId,
        telegramFirstName,
        chatId,
        messageId,
      });
    }

    if (!callbackQueryId) {
      throw new Error("Missing callback_query.id in Telegram update.");
    }

    await answerCallbackQuery(callbackQueryId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[telegram webhook] Request failed", {
      message: error?.message || "Unknown error.",
    });
    return NextResponse.json(
      { ok: false, error: "Telegram webhook processing failed." },
      { status: 500 },
    );
  }
}
