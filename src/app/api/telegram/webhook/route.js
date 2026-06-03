import { NextResponse } from "next/server";
import {
  CAPTAIN_MESSAGE_TYPES,
  buildCaptainMessageByType,
} from "@/lib/admin/captainMessages";
import {
  markCaptainAvailable,
  markCaptainUnavailable,
} from "@/lib/bookings/markCaptainAvailable";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

const FOLLOW_UP_BOOKING_SELECT =
  "id, customer_name, email, phone, guest_count, requested_date, tour_type, time_slot, time_window, pay_on_board_eur, message, cancellation_reason, customer_cancel_reason";

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

function parseTelegramTestCallbackData(callbackData) {
  const rawData = getText(callbackData, "");
  const parts = rawData.split(":");

  if (parts.length !== 3 || parts[0] !== "telegram" || parts[1] !== "test") {
    return null;
  }

  const action = getText(parts[2], null);

  if (!action) {
    return null;
  }

  return { action };
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

async function deleteTelegramMessage({ chatId, messageId }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/deleteMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
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
    throw new Error(`Telegram deleteMessage failed: ${apiDescription}`);
  }
}

async function loadBookingForFollowUpMessage(bookingId) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(FOLLOW_UP_BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[telegram webhook] Could not load booking for follow-up", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not load booking for Telegram follow-up.");
  }

  if (!booking) {
    throw new Error("Booking not found for Telegram follow-up.");
  }

  return booking;
}

function getSiteUrlFromRequest(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0];

  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL || "";
  }

  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
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
    const parsedTest = parseTelegramTestCallbackData(callbackData);

    if (parsed) {
      console.log("[telegram callback booking]", {
        action: parsed.action,
        bookingId: parsed.bookingId,
        telegramUserId,
        telegramFirstName,
        chatId,
        messageId,
      });

      const actor = {
        telegramFirstName,
        telegramUserId,
      };
      const siteUrl = getSiteUrlFromRequest(request);
      let decisionResult;

      if (parsed.action === "accept") {
        decisionResult = await markCaptainAvailable({
          bookingId: parsed.bookingId,
          source: "telegram",
          actor,
          siteUrl,
        });
      } else {
        decisionResult = await markCaptainUnavailable({
          bookingId: parsed.bookingId,
          source: "telegram",
          actor,
          siteUrl,
        });
      }

      if (decisionResult?.applied) {
        if (parsed.action === "accept") {
          try {
            const booking = await loadBookingForFollowUpMessage(parsed.bookingId);
            const followUpText = buildCaptainMessageByType(
              booking,
              CAPTAIN_MESSAGE_TYPES.finalConfirmation,
            );
            await sendTelegramMessage({ text: followUpText });
          } catch (error) {
            console.warn(
              `[telegram webhook] follow-up message warning: ${error?.message || "Unknown error."}`,
            );
          }
        }

        if (chatId && messageId) {
          try {
            await deleteTelegramMessage({
              chatId,
              messageId,
            });
          } catch (error) {
            console.warn(
              `[telegram webhook] deleteMessage warning: ${error?.message || "Unknown error."}`,
            );
          }
        }
      } else {
        console.log("[telegram callback booking] Skipped duplicate captain action", {
          action: parsed.action,
          bookingId: parsed.bookingId,
          reason: decisionResult?.reason || "booking already processed",
        });
      }
    } else if (parsedTest) {
      console.log("[telegram callback test]", {
        action: parsedTest.action,
        callbackData,
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

    try {
      await answerCallbackQuery(callbackQueryId);
    } catch (error) {
      console.warn(
        `[telegram webhook] answerCallbackQuery warning: ${error?.message || "Unknown error."}`,
      );
    }

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
