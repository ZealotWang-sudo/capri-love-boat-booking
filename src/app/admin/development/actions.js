"use server";

import { redirect } from "next/navigation";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { getAdminUser, isAllowedAdmin } from "../auth";

function getTelegramWebhookUrl(target) {
  if (target === "production") {
    const productionUrl =
      process.env.TELEGRAM_WEBHOOK_PRODUCTION_URL ||
      (process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/telegram/webhook`
        : "");

    return productionUrl;
  }

  if (target === "preview") {
    return process.env.TELEGRAM_WEBHOOK_PREVIEW_URL || "";
  }

  return "";
}

async function requireAdmin(nextPath = "/admin/development") {
  const user = await getAdminUser(nextPath);

  if (!isAllowedAdmin(user)) {
    throw new Error("Unauthorized Telegram settings request.");
  }

  return user;
}

export async function sendTelegramSettingsTestMessage() {
  await requireAdmin();

  try {
    await sendTelegramMessage({
      text: "hello here",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "hello back",
              callback_data: "telegram:test:hello_back",
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("[telegram settings test] Could not send message", {
      message: error?.message || "Unknown error.",
    });
    redirect("/admin/development?telegramTest=failed");
  }

  redirect("/admin/development?telegramTest=sent");
}

export async function setTelegramWebhook(formData) {
  await requireAdmin();

  const target =
    typeof formData.get("target") === "string" ? formData.get("target").trim() : "";
  const webhookUrl = getTelegramWebhookUrl(target);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!["production", "preview"].includes(target) || !webhookUrl || !botToken) {
    redirect(`/admin/development?telegramWebhook=${target || "unknown"}-missing`);
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });
    const telegramResponse = await response.json();

    if (!response.ok || telegramResponse?.ok === false) {
      const apiDescription =
        typeof telegramResponse?.description === "string" &&
        telegramResponse.description.trim()
          ? telegramResponse.description.trim()
          : "Unknown Telegram API error.";
      throw new Error(`Telegram setWebhook failed: ${apiDescription}`);
    }
  } catch (error) {
    console.error("[telegram settings webhook] Could not set webhook", {
      message: error?.message || "Unknown error.",
      target,
    });
    redirect(`/admin/development?telegramWebhook=${target}-failed`);
  }

  redirect(`/admin/development?telegramWebhook=${target}-set`);
}
