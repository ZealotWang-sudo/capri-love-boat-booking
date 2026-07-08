import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

const TELEGRAM_REMINDER_TEMPLATE_NAME = "telegram_tomorrow_reminder";
const REMINDER_BOOKING_SELECT =
  "id, customer_name, phone, guest_count, requested_date, tour_type, time_slot, time_window, pay_on_board_eur, message, booking_status";
const CAPRI_TIME_ZONE = "Europe/Rome";
const CAPTAIN_TOUR_LABELS = {
  two_half_hours: "2,5 ore",
  two_hours: "2 ore",
  three_hours: "3 ore",
  four_hours: "4 ore",
  sunset_three_hours: "Sunset 3 ore",
  five_hours: "5 ore",
  special_request: "Richiesta speciale",
};

function getCapriDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: CAPRI_TIME_ZONE,
    year: "numeric",
  }).format(now);
}

function getTomorrowCapriDateString(now = new Date()) {
  const todayCapri = getCapriDateString(now);
  const tomorrow = new Date(`${todayCapri}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function formatValue(value) {
  return value || "—";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "—";
}

function formatItalianDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    return formatValue(value);
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "—";
}

function getMessageId(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function buildBookingLines(booking) {
  const lines = [
    `Riferimento: ${formatReferenceCode(booking.id)}`,
    `Cliente: ${formatValue(booking.customer_name)}`,
    `Telefono: ${formatValue(booking.phone)}`,
    `Tour: ${CAPTAIN_TOUR_LABELS[booking.tour_type] ?? formatValue(booking.tour_type)}`,
    `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Ospiti: ${formatValue(booking.guest_count)}`,
    `Saldo da incassare a bordo: ${formatEuro(booking.pay_on_board_eur)}`,
  ];

  const customerMessage = booking.message?.trim();

  if (customerMessage) {
    lines.push(`Messaggio del cliente: ${customerMessage}`);
  }

  return lines;
}

function buildReminderMessage({ bookings, tomorrowDate }) {
  const dateLabel = formatItalianDate(tomorrowDate);
  const intro =
    bookings.length === 1
      ? `Ciao, promemoria: domani (${dateLabel}) c'è 1 prenotazione confermata.`
      : `Ciao, promemoria: domani (${dateLabel}) ci sono ${bookings.length} prenotazioni confermate.`;
  const bookingBlocks = bookings.map((booking) =>
    buildBookingLines(booking).join("\n"),
  );

  return [intro, ...bookingBlocks].join("\n\n");
}

async function hasReminderBeenSent({ bookingId, supabase }) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("direction", "outbound")
    .eq("template_name", TELEGRAM_REMINDER_TEMPLATE_NAME)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[telegram tomorrow reminder] Could not check duplicate state", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not verify Telegram reminder duplicate state.");
  }

  return Boolean(data);
}

async function saveReminderTracking({
  bookingId,
  includeMessageId,
  telegramResponse,
  supabase,
}) {
  const chatId = process.env.TELEGRAM_CAPTAIN_GROUP_CHAT_ID || null;
  const { error: insertError } = await supabase.from("whatsapp_messages").insert({
    booking_id: bookingId,
    direction: "outbound",
    message_type: "text",
    // meta_message_id is unique; one Telegram message covers several bookings,
    // so only the first tracking row keeps the id.
    meta_message_id: includeMessageId
      ? getMessageId(telegramResponse?.result?.message_id)
      : null,
    raw_payload: telegramResponse,
    status: "sent",
    template_name: TELEGRAM_REMINDER_TEMPLATE_NAME,
    to_phone: chatId,
  });

  if (insertError && insertError.code !== "23505") {
    console.error("[telegram tomorrow reminder] Could not save tracking row", {
      bookingId,
      message: insertError.message,
    });
  }
}

export async function sendCaptainTomorrowReminder({ now = new Date() } = {}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const tomorrowDate = getTomorrowCapriDateString(now);
  const { data: confirmedBookings, error } = await supabase
    .from("bookings")
    .select(REMINDER_BOOKING_SELECT)
    .eq("booking_status", "confirmed")
    .eq("requested_date", tomorrowDate)
    .order("time_window", { ascending: true });

  if (error) {
    console.error("[telegram tomorrow reminder] Could not load bookings", {
      message: error.message,
      tomorrowDate,
    });
    throw new Error("Could not load confirmed bookings for the reminder.");
  }

  const bookings = confirmedBookings ?? [];

  if (bookings.length === 0) {
    return { bookings: 0, reason: "no_bookings_tomorrow", sent: false, tomorrowDate };
  }

  const unnotifiedBookings = [];

  for (const booking of bookings) {
    const alreadySent = await hasReminderBeenSent({
      bookingId: booking.id,
      supabase,
    });

    if (!alreadySent) {
      unnotifiedBookings.push(booking);
    }
  }

  if (unnotifiedBookings.length === 0) {
    return { bookings: bookings.length, reason: "already_notified", sent: false, tomorrowDate };
  }

  const telegramResponse = await sendTelegramMessage({
    text: buildReminderMessage({ bookings: unnotifiedBookings, tomorrowDate }),
  });

  for (const [index, booking] of unnotifiedBookings.entries()) {
    await saveReminderTracking({
      bookingId: booking.id,
      includeMessageId: index === 0,
      telegramResponse,
      supabase,
    });
  }

  return {
    bookings: unnotifiedBookings.length,
    reason: null,
    sent: true,
    tomorrowDate,
  };
}
