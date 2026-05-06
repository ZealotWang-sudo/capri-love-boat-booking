import { Resend } from "resend";

const EMAIL_FROM = process.env.EMAIL_FROM || "bookings@your-domain.com";
const EMAIL_EVENTS_BY_STATUS = {
  requested: "booking_received",
  payment_pending: "payment_pending",
  confirmed: "booking_confirmed",
  not_available: "not_available",
  cancelled: "cancelled",
  completed: "completed",
};
const TOUR_LABELS = {
  two_hours: {
    en: "2 hours",
    it: "2 ore",
    zh: "2小时",
  },
  three_hours: {
    en: "3 hours",
    it: "3 ore",
    zh: "3小时",
  },
  four_hours: {
    en: "4 hours",
    it: "4 ore",
    zh: "4小时",
  },
  sunset_three_hours: {
    en: "Sunset 3 hours",
    it: "Tramonto 3 ore",
    zh: "日落 3小时",
  },
  five_hours: {
    en: "5 hours",
    it: "5 ore",
    zh: "5小时",
  },
};
const CANCELLATION_REASON_LABELS = {
  en: "Cancellation reason",
  it: "Motivo della cancellazione",
  zh: "取消原因",
};
const MANAGE_LINK_COPY = {
  en: "Manage or cancel your request:",
  it: "Gestisci o cancella la tua richiesta:",
  zh: "查看或取消你的预约请求：",
};
const EMAIL_COPY = {
  booking_received: {
    en: {
      intro:
        "We received your Capri boat request and will review captain availability.",
      subject: "We received your Capri boat request",
    },
    it: {
      intro:
        "Abbiamo ricevuto la tua richiesta per il tour in barca a Capri e verificheremo la disponibilita del capitano.",
      subject: "Abbiamo ricevuto la tua richiesta per il tour in barca a Capri",
    },
    zh: {
      intro: "我们已收到你的卡普里船游预约请求，并会确认船长是否有空档。",
      subject: "我们已收到你的卡普里船游预约请求",
    },
  },
  payment_pending: {
    en: {
      intro:
        "The captain is available for your selected time. Payment link will be added once Stripe is connected.",
      subject: "Captain available — reserve your boat",
    },
    it: {
      intro:
        "Il capitano e disponibile per l'orario scelto. Payment link will be added once Stripe is connected.",
      subject: "Capitano disponibile — blocca la tua barca",
    },
    zh: {
      intro:
        "船长在你选择的时间有空档。Payment link will be added once Stripe is connected.",
      subject: "船长已有空档，请支付预约订金锁定船只",
    },
  },
  booking_confirmed: {
    en: {
      intro: "Your Capri boat booking is confirmed.",
      subject: "Your Capri boat booking is confirmed",
    },
    it: {
      intro: "La tua prenotazione in barca a Capri e confermata.",
      subject: "La tua prenotazione in barca a Capri è confermata",
    },
    zh: {
      intro: "你的卡普里船游预约已确认。",
      subject: "你的卡普里船游预约已确认",
    },
  },
  not_available: {
    en: {
      intro:
        "The captain is not available for your selected time. We can help look for another option.",
      subject: "Captain not available for your selected time",
    },
    it: {
      intro:
        "Il capitano non e disponibile per l'orario scelto. Possiamo aiutarti a trovare un'altra opzione.",
      subject: "Il capitano non è disponibile per l’orario scelto",
    },
    zh: {
      intro: "你选择的时间船长暂时不可用。我们可以帮你寻找其他可选时间。",
      subject: "你选择的时间船长暂时不可用",
    },
  },
  cancelled: {
    en: {
      intro: "Your Capri boat booking request was cancelled.",
      subject: "Your Capri boat booking request was cancelled",
    },
    it: {
      intro: "La tua richiesta di prenotazione e stata annullata.",
      subject: "La tua richiesta di prenotazione è stata annullata",
    },
    zh: {
      intro: "你的卡普里船游预约请求已取消。",
      subject: "你的卡普里船游预约请求已取消",
    },
  },
  completed: {
    en: {
      intro: "Thank you for joining the Capri boat tour.",
      subject: "Thank you for joining the Capri boat tour",
    },
    it: {
      intro: "Grazie per aver partecipato al tour in barca a Capri.",
      subject: "Grazie per aver partecipato al tour in barca a Capri",
    },
    zh: {
      intro: "感谢你参加卡普里船游体验。",
      subject: "感谢你参加卡普里船游体验",
    },
  },
};

function getLocale(locale) {
  return ["en", "it", "zh"].includes(locale) ? locale : "en";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

function formatValue(value) {
  return value || "-";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTourType(tourType, locale) {
  return TOUR_LABELS[tourType]?.[locale] ?? formatValue(tourType);
}

function getBookingDetails(booking, locale) {
  const details = [
    ["Name", formatValue(booking.customer_name)],
    ["Date", formatValue(booking.requested_date)],
    ["Time", formatValue(booking.time_window || booking.time_slot)],
    ["Tour", formatTourType(booking.tour_type, locale)],
    ["Guests", formatValue(booking.guest_count)],
    ["Total price", formatEuro(booking.total_price_eur)],
    ["Reservation fee", formatEuro(booking.reservation_fee_eur)],
    ["Pay on board", formatEuro(booking.pay_on_board_eur)],
  ];

  const cancellationReason =
    booking.cancellation_reason || booking.customer_cancel_reason;

  if (cancellationReason) {
    details.push([
      CANCELLATION_REASON_LABELS[locale] ?? CANCELLATION_REASON_LABELS.en,
      cancellationReason,
    ]);
  }

  return details;
}

function getManageLinkText(booking, locale) {
  if (!booking.manage_url) {
    return "";
  }

  const label = MANAGE_LINK_COPY[locale] ?? MANAGE_LINK_COPY.en;

  return `\n\n${label} ${booking.manage_url}`;
}

function buildTextEmail({ booking, copy, locale }) {
  const details = getBookingDetails(booking, locale)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const manageLinkText = getManageLinkText(booking, locale);

  return `Hello ${formatValue(booking.customer_name)},\n\n${copy.intro}${manageLinkText}\n\n${details}\n\nCapri Love Boat`;
}

function buildHtmlEmail({ booking, copy, locale }) {
  const detailRows = getBookingDetails(booking, locale)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#78716c;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;text-align:right;color:#1c1917;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");
  const manageLinkHtml = booking.manage_url
    ? `
        <p style="font-size:16px;line-height:1.6;">
          ${escapeHtml(MANAGE_LINK_COPY[locale] ?? MANAGE_LINK_COPY.en)}
          <a href="${escapeHtml(booking.manage_url)}" style="color:#1c1917;">${escapeHtml(booking.manage_url)}</a>
        </p>
      `
    : "";

  return `
    <div style="font-family:Arial,sans-serif;background:#f3eee7;color:#1c1917;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#fbf8f3;border:1px solid #d6d3d1;padding:28px;">
        <p style="margin:0 0 18px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#78716c;">Capri Love Boat</p>
        <h1 style="margin:0 0 18px;font-size:28px;font-weight:300;">${escapeHtml(copy.subject)}</h1>
        <p style="font-size:16px;line-height:1.6;">Hello ${escapeHtml(formatValue(booking.customer_name))},</p>
        <p style="font-size:16px;line-height:1.6;">${escapeHtml(copy.intro)}</p>
        ${manageLinkHtml}
        <table style="width:100%;border-top:1px solid #d6d3d1;margin-top:24px;padding-top:16px;font-size:14px;">
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function hasSentEmailEvent({ bookingId, eventType, supabase }) {
  const { data, error } = await supabase
    .from("booking_email_events")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("event_type", eventType)
    .eq("status", "sent")
    .maybeSingle();

  if (error) {
    console.error("[booking email] Could not check duplicate email event", {
      eventType,
      message: error.message,
    });
    return false;
  }

  return Boolean(data);
}

async function logEmailEvent({ booking, errorMessage, eventType, resendId, status, subject, supabase }) {
  const { error } = await supabase.from("booking_email_events").insert({
    booking_id: booking.id,
    error_message: errorMessage ?? null,
    event_type: eventType,
    locale: getLocale(booking.locale),
    recipient_email: booking.email,
    resend_email_id: resendId ?? null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    status,
    subject,
  });

  if (error) {
    console.error("[booking email] Could not log email event", {
      eventType,
      message: error.message,
    });
  }
}

export function getBookingEmailEventForStatus(bookingStatus) {
  return EMAIL_EVENTS_BY_STATUS[bookingStatus] ?? null;
}

export async function sendBookingEmail({
  booking,
  checkDuplicate = true,
  eventType,
  supabase,
}) {
  if (!booking?.email || !eventType || !supabase) {
    return { reason: "missing booking email, event type, or Supabase client", sent: false };
  }

  const locale = getLocale(booking.locale);
  const copy = EMAIL_COPY[eventType]?.[locale] ?? EMAIL_COPY[eventType]?.en;

  if (!copy) {
    return { reason: "unknown email event type", sent: false };
  }

  if (checkDuplicate) {
    const alreadySent = await hasSentEmailEvent({
      bookingId: booking.id,
      eventType,
      supabase,
    });

    if (alreadySent) {
      return { reason: "duplicate email event", sent: false };
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    const errorMessage = "Missing RESEND_API_KEY environment variable.";
    console.error("[booking email]", errorMessage);
    await logEmailEvent({
      booking,
      errorMessage,
      eventType,
      status: "failed",
      subject: copy.subject,
      supabase,
    });
    return { reason: errorMessage, sent: false };
  }

  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      html: buildHtmlEmail({ booking, copy, locale }),
      subject: copy.subject,
      text: buildTextEmail({ booking, copy, locale }),
      to: booking.email,
    });

    if (error) {
      throw new Error(error.message ?? "Resend email failed.");
    }

    await logEmailEvent({
      booking,
      eventType,
      resendId: data?.id,
      status: "sent",
      subject: copy.subject,
      supabase,
    });

    return { resendId: data?.id, sent: true };
  } catch (error) {
    console.error("[booking email] Send failed", {
      eventType,
      message: error.message,
    });
    await logEmailEvent({
      booking,
      errorMessage: error.message,
      eventType,
      status: "failed",
      subject: copy.subject,
      supabase,
    });

    return { reason: error.message, sent: false };
  }
}
