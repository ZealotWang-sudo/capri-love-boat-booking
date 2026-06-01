export async function sendTelegramMessage({ text, replyMarkup }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CAPTAIN_GROUP_CHAT_ID;

  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  }

  if (!chatId) {
    throw new Error("Missing TELEGRAM_CAPTAIN_GROUP_CHAT_ID environment variable.");
  }

  const payload = {
    chat_id: chatId,
    text,
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const telegramResponse = await response.json();

  if (!response.ok || telegramResponse?.ok === false) {
    const apiDescription =
      typeof telegramResponse?.description === "string" &&
      telegramResponse.description.trim()
        ? telegramResponse.description.trim()
        : "Unknown Telegram API error.";
    throw new Error(`Telegram sendMessage failed: ${apiDescription}`);
  }

  return telegramResponse;
}
