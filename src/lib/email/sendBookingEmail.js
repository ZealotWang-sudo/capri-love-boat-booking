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
  en: "Manage your request",
  it: "Gestisci la tua richiesta",
  zh: "管理你的预约请求",
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
        "Your selected time slot is available. Please use the link below to pay the deposit and lock the time slot reservation. Otherwise, the reservation hold will expire within 24 hours.",
      subject: "Time slot available — reserve your boat",
    },
    it: {
      intro:
        "L'orario scelto e disponibile. Usa il link qui sotto per pagare il deposito e bloccare la prenotazione dell'orario. In caso contrario, il blocco della prenotazione scadra entro 24 ore.",
      subject: "Orario disponibile — blocca la tua barca",
    },
    zh: {
      intro:
        "你选择的时间可预约。请使用下方链接支付订金并锁定该时间段预约，否则预约保留将在 24 小时内过期。",
      subject: "时间可预约，请支付预约订金锁定船只",
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
  return [
    ["Name", formatValue(booking.customer_name)],
    ["Date", formatValue(booking.requested_date)],
    ["Time", formatValue(booking.time_window || booking.time_slot)],
    ["Tour", formatTourType(booking.tour_type, locale)],
    ["Guests", formatValue(booking.guest_count)],
    ["Total price", formatEuro(booking.total_price_eur)],
    ["Reservation fee", formatEuro(booking.reservation_fee_eur)],
    ["Pay on board", formatEuro(booking.pay_on_board_eur)],
  ];
}

function getCancellationReason(booking) {
  return booking.cancellation_reason || booking.customer_cancel_reason || "";
}

function getCancellationReasonText(booking, locale) {
  const cancellationReason = getCancellationReason(booking);

  if (!cancellationReason) {
    return "";
  }

  const label = CANCELLATION_REASON_LABELS[locale] ?? CANCELLATION_REASON_LABELS.en;

  return `\n\n${label}: ${cancellationReason}`;
}

function getManageLinkText(booking, locale) {
  if (!booking.manage_url) {
    return "";
  }

  const label = MANAGE_LINK_COPY[locale] ?? MANAGE_LINK_COPY.en;

  return `\n\n${label}: ${booking.manage_url}`;
}

function buildTextEmail({ booking, copy, locale }) {
  const details = getBookingDetails(booking, locale)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const cancellationReasonText = getCancellationReasonText(booking, locale);
  const manageLinkText = getManageLinkText(booking, locale);

  return `Hello ${formatValue(booking.customer_name)},\n\n${copy.intro}${cancellationReasonText}${manageLinkText}\n\n${details}\n\nCapri Love Boat`;
}

function buildHtmlEmail({ booking, copy, locale }) {
  const detailRows = getBookingDetails(booking, locale)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:7px 5px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;text-align:left;">${escapeHtml(label)}</td>
          <td style="padding:7px 5px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;text-align:right;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");
  const cancellationReason = getCancellationReason(booking);
  const cancellationReasonHtml = cancellationReason
    ? `
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:22px;">
          <tr>
            <td style="border-top:1px solid #bbb;border-bottom:1px solid #bbb;padding:16px 10px;text-align:center;">
              <p style="margin:0 0 8px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(CANCELLATION_REASON_LABELS[locale] ?? CANCELLATION_REASON_LABELS.en)}</p>
              <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:18px;line-height:25px;">${escapeHtml(cancellationReason)}</p>
            </td>
          </tr>
        </table>
      `
    : "";
  const manageLinkHtml = booking.manage_url
    ? `
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:22px;">
          <tr>
            <td align="center">
              <a href="${escapeHtml(booking.manage_url)}" style="background-color:#313131;border:1px solid #313131;border-radius:2px;color:#f3efe6;display:inline-block;font-family:'Times New Roman',Georgia,serif;font-size:14px;line-height:30px;text-align:center;text-decoration:none;padding:0 14px;">${escapeHtml(MANAGE_LINK_COPY[locale] ?? MANAGE_LINK_COPY.en)}</a>
            </td>
          </tr>
        </table>
      `
    : "";

  return `
    <div style="background-color:#f0f0f0;margin:0;padding:0;color:#313131;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f0f0f0;">
        <tr>
          <td align="center">
            <table width="640" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:640px;max-width:100%;background-color:#f3efe6;color:#313131;margin:0 auto;">
              <tr>
                <td style="padding:22px 24px 10px;text-align:center;">
                  <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;">Capri Love Boat</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 34px 10px;text-align:center;">
                  <h1 style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:24px;font-weight:400;line-height:30px;">${escapeHtml(copy.subject)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 34px 8px;text-align:center;">
                  <p style="margin:0 0 12px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;">Hello ${escapeHtml(formatValue(booking.customer_name))},</p>
                  <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:16px;line-height:24px;">${escapeHtml(copy.intro)}</p>
                  ${cancellationReasonHtml}
                  ${manageLinkHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:28px 34px 5px;">
                  <p style="margin:0;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;line-height:22px;">Booking details</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 34px 12px;">
                  <div style="border-top:1px solid #bbb;font-size:1px;line-height:1px;">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 29px 22px;">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                    <tbody>${detailRows}</tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 30px;text-align:center;border-top:1px solid #bbb;">
                  <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:14px;line-height:20px;">Capri, Italy</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
