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

function getCaptainDashboardUrl() {
  const captainToken = process.env.CAPTAIN_DASHBOARD_TOKEN;
  const siteUrl = (
    process.env.CAPTAIN_DASHBOARD_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://capriloveboat.com"
  ).replace(/\/$/, "");

  if (!captainToken) {
    throw new Error("Missing CAPTAIN_DASHBOARD_TOKEN environment variable.");
  }

  return `${siteUrl}/it/captain?token=${encodeURIComponent(captainToken)}`;
}

export async function sendTelegramSettingsTestMessage() {
  await requireAdmin();

  try {
    await sendTelegramMessage({
      text: "Clicca qui per vedere tutte le prenotazioni confermate.",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📅 Apri prenotazioni",
              url: getCaptainDashboardUrl(),
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

export async function checkTelegramWebhook() {
  await requireAdmin();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    redirect("/admin/development?telegramWebhookInfo=missing");
  }

  let redirectPath = "/admin/development?telegramWebhookInfo=failed";

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
      {
        method: "GET",
      },
    );
    const telegramResponse = await response.json();

    if (!response.ok || telegramResponse?.ok === false) {
      const apiDescription =
        typeof telegramResponse?.description === "string" &&
        telegramResponse.description.trim()
          ? telegramResponse.description.trim()
          : "Unknown Telegram API error.";
      throw new Error(`Telegram getWebhookInfo failed: ${apiDescription}`);
    }

    const webhookInfo = telegramResponse?.result ?? {};
    const searchParams = new URLSearchParams({
      telegramWebhookInfo: "ok",
      telegramWebhookPending: String(webhookInfo.pending_update_count ?? 0),
      telegramWebhookUrl:
        typeof webhookInfo.url === "string" ? webhookInfo.url : "",
    });

    if (webhookInfo.last_error_message) {
      searchParams.set(
        "telegramWebhookLastError",
        String(webhookInfo.last_error_message).slice(0, 300),
      );
    }

    redirectPath = `/admin/development?${searchParams.toString()}`;
  } catch (error) {
    console.error("[telegram settings webhook] Could not get webhook info", {
      message: error?.message || "Unknown error.",
    });
  }

  redirect(redirectPath);
}
