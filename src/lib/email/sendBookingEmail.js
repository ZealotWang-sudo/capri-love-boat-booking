import { Resend } from "resend";
import { DEFAULT_EMAIL_FROM } from "@/lib/contact";

const EMAIL_FROM = process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
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
const MANAGE_LINK_COPY = {
  en: "Manage booking",
  it: "Gestisci prenotazione",
  zh: "管理预约",
};
const EMAIL_LABELS = {
  en: {
    cancellationReason: "Cancellation reason",
    date: "Date",
    detailsTitle: "Booking details",
    greeting: "Hello",
    guests: "Guests",
    name: "Name",
    payOnBoard: "Pay on board",
    reservationFee: "Reservation fee",
    time: "Time",
    totalPrice: "Total price",
    tour: "Tour",
  },
  it: {
    cancellationReason: "Motivo della cancellazione",
    date: "Data",
    detailsTitle: "Dettagli prenotazione",
    greeting: "Ciao",
    guests: "Ospiti",
    name: "Nome",
    payOnBoard: "Da pagare a bordo",
    reservationFee: "Deposito",
    time: "Orario",
    totalPrice: "Prezzo totale",
    tour: "Tour",
  },
  zh: {
    cancellationReason: "取消原因",
    date: "日期",
    detailsTitle: "预约详情",
    greeting: "您好",
    guests: "人数",
    name: "姓名",
    payOnBoard: "船上支付",
    reservationFee: "预约订金",
    time: "时间",
    totalPrice: "总价",
    tour: "船游",
  },
};
const EMAIL_COPY = {
  booking_received: {
    en: {
      cta: "Manage request",
      intro:
        "Thank you for your request. We will check captain availability and get back to you shortly. Your booking is not confirmed yet.",
      subject: "Request received",
    },
    it: {
      cta: "Gestisci richiesta",
      intro:
        "Grazie per la richiesta. Verificheremo la disponibilita del capitano e ti risponderemo al piu presto. La prenotazione non e ancora confermata.",
      subject: "Richiesta ricevuta",
    },
    zh: {
      cta: "管理预约请求",
      intro: "感谢您的预约请求。我们会先确认船长档期，并尽快回复您。当前预约尚未确认。",
      subject: "我们已收到您的预约请求",
    },
  },
  payment_pending: {
    en: {
      cta: "Pay reservation fee",
      intro:
        "Good news, your selected time is available. Please pay the reservation fee within 24 hours to secure it.",
      subject: "Captain available - reserve your time",
    },
    it: {
      cta: "Paga il deposito",
      intro:
        "Buone notizie, l'orario scelto e disponibile. Paga il deposito entro 24 ore per bloccarlo.",
      subject: "Capitano disponibile - blocca l'orario",
    },
    zh: {
      cta: "支付预约订金",
      intro:
        "好消息，您选择的时间可以预约。请在 24 小时内支付预约订金以锁定该时间。",
      subject: "请锁定时间",
    },
  },
  booking_confirmed: {
    en: {
      cta: "View booking details",
      intro:
        "Your reservation fee has been received and your boat is reserved. Here are the departure and boat details for your confirmed tour.",
      showTourLogistics: true,
      subject: "Booking confirmed",
    },
    it: {
      cta: "Vedi dettagli",
      intro:
        "Abbiamo ricevuto il deposito e la barca è riservata. Ecco i dettagli di partenza e della barca per il tuo tour confermato.",
      showTourLogistics: true,
      subject: "Prenotazione confermata",
    },
    zh: {
      cta: "查看预约详情",
      intro: "我们已收到预约订金，船只已为您保留。以下是已确认行程的出发与船只信息。",
      showTourLogistics: true,
      subject: "预约已确认",
    },
  },
  not_available: {
    en: {
      cta: "Review request",
      intro:
        "We are sorry, the captain is not available for your selected time. We can help look for another option if you would like.",
      subject: "Selected time unavailable",
    },
    it: {
      cta: "Rivedi richiesta",
      intro:
        "Ci dispiace, il capitano non e disponibile per l'orario scelto. Se vuoi, possiamo aiutarti a trovare un'altra opzione.",
      subject: "Orario non disponibile",
    },
    zh: {
      cta: "查看预约请求",
      intro: "很抱歉，您选择的时间船长暂时不可用。如您愿意，我们可以帮您寻找其他可选时间。",
      subject: "所选时间暂不可预约",
    },
  },
  cancelled: {
    en: {
      cta: "View cancellation",
      intro:
        "Your booking request has been cancelled. If a reason was provided, it is shown below.",
      subject: "Booking cancelled",
    },
    it: {
      cta: "Vedi cancellazione",
      intro:
        "La richiesta di prenotazione e stata annullata. Se e stato indicato un motivo, lo trovi qui sotto.",
      subject: "Prenotazione annullata",
    },
    zh: {
      cta: "查看取消详情",
      intro: "您的预约请求已取消。如有取消原因，会显示在下方。",
      subject: "预约已取消",
    },
  },
  completed: {
    en: {
      cta: "View trip details",
      intro:
        "Thank you for spending the day with us in Capri. We hope you had a beautiful time on the water.",
      subject: "Thank you for joining us",
    },
    it: {
      cta: "Vedi dettagli tour",
      intro:
        "Grazie per aver trascorso la giornata con noi a Capri. Speriamo sia stata una splendida esperienza in mare.",
      subject: "Grazie per essere stati con noi",
    },
    zh: {
      cta: "查看行程详情",
      intro: "感谢您与我们一起在卡普里度过这一天。希望您享受了这次海上体验。",
      subject: "感谢您的加入",
    },
  },
};
export const SUPPORTED_EMAIL_LOCALES = ["en", "zh", "it"];
export const BOOKING_EMAIL_EVENTS = [
  { eventType: "booking_received", label: "Booking received" },
  { eventType: "payment_pending", label: "Payment pending" },
  { eventType: "booking_confirmed", label: "Booking confirmed" },
  { eventType: "not_available", label: "Captain not available" },
  { eventType: "cancelled", label: "Cancelled" },
  { eventType: "completed", label: "Completed" },
];
const CAPTAIN_PHONE = "+39 339 665 0836";
const CAPTAIN_PHONE_HREF = "tel:+393396650836";
const MEETING_POINT_MAP_URL =
  "https://www.google.com/maps/place/40°33'21.2%22N+14°14'24.8%22E/@40.5558895,14.2395912,63a,35y,70.31h,49.28t/data=!3m1!1e3!4m4!3m3!8m2!3d40.555894!4d14.240227?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D";
const TOUR_LOGISTICS = {
  en: {
    items: [
      {
        href: MEETING_POINT_MAP_URL,
        label: "Departure point",
        value:
          "Molo 21, Marina Grande / Capri main port, about 5 minutes from the public ferry and hydrofoil arrival area.",
      },
      {
        href: CAPTAIN_PHONE_HREF,
        label: "Captain's cell",
        value: CAPTAIN_PHONE,
      },
      {
        label: "Toilet",
        value:
          "Public toilets are available at the arrival quay before departure. The boat also has a chemical toilet for basic needs.",
      },
      {
        label: "Boat model",
        value:
          "Aequa 7.50 by Fratelli Di Donna, a special model with a large 4 m × 2.60 m sunbathing area.",
      },
    ],
    title: "Tour information",
  },
  it: {
    items: [
      {
        href: MEETING_POINT_MAP_URL,
        label: "Punto di partenza",
        value:
          "Molo 21, Marina Grande / porto principale di Capri, a circa 5 minuti dall'area di arrivo di traghetti e aliscafi pubblici.",
      },
      {
        href: CAPTAIN_PHONE_HREF,
        label: "Cellulare del capitano",
        value: CAPTAIN_PHONE,
      },
      {
        label: "Toilette",
        value:
          "I bagni pubblici sono disponibili al molo di arrivo prima della partenza. La barca ha anche una toilette chimica per necessita di base.",
      },
      {
        label: "Modello barca",
        value:
          "Aequa 7.50 di Fratelli Di Donna, un modello speciale con un'ampia area prendisole di 4 m × 2,60 m.",
      },
    ],
    title: "Informazioni tour",
  },
  zh: {
    items: [
      {
        href: MEETING_POINT_MAP_URL,
        label: "出发地点",
        value:
          "Molo 21，Marina Grande / 卡普里主港，距离公共渡轮和水翼船抵达区域步行约 5 分钟。",
      },
      {
        href: CAPTAIN_PHONE_HREF,
        label: "船长电话",
        value: CAPTAIN_PHONE,
      },
      {
        label: "洗手间",
        value:
          "出发前可使用抵达码头的公共洗手间。船上也配有化学厕所，可满足基本需要。",
      },
      {
        label: "船型",
        value:
          "Fratelli Di Donna 的 Aequa 7.50 特别船型，配有宽敞的 4 m × 2.60 m 日光浴区域。",
      },
    ],
    title: "行程信息",
  },
};

function getLocale(locale) {
  return SUPPORTED_EMAIL_LOCALES.includes(locale) ? locale : "en";
}

function getEmailCopy(eventType, locale) {
  return EMAIL_COPY[eventType]?.[locale] ?? EMAIL_COPY[eventType]?.en;
}

function getEmailLabels(locale) {
  return EMAIL_LABELS[locale] ?? EMAIL_LABELS.en;
}

function getTourLogistics(locale) {
  return TOUR_LOGISTICS[locale] ?? TOUR_LOGISTICS.en;
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
  const labels = getEmailLabels(locale);

  return [
    [labels.name, formatValue(booking.customer_name)],
    [labels.date, formatValue(booking.requested_date)],
    [labels.time, formatValue(booking.time_window || booking.time_slot)],
    [labels.tour, formatTourType(booking.tour_type, locale)],
    [labels.guests, formatValue(booking.guest_count)],
    [labels.totalPrice, formatEuro(booking.total_price_eur)],
    [labels.reservationFee, formatEuro(booking.reservation_fee_eur)],
    [labels.payOnBoard, formatEuro(booking.pay_on_board_eur)],
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

  const label = getEmailLabels(locale).cancellationReason;

  return `\n\n${label}: ${cancellationReason}`;
}

function getManageLinkLabel(copy, locale) {
  return copy.cta || MANAGE_LINK_COPY[locale] || MANAGE_LINK_COPY.en;
}

function getManageLinkText(booking, copy, locale) {
  if (!booking.manage_url) {
    return "";
  }

  const label = getManageLinkLabel(copy, locale);

  return `\n\n${label}: ${booking.manage_url}`;
}

function buildTextEmail({ booking, copy, locale }) {
  const details = getBookingDetails(booking, locale)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const cancellationReasonText = getCancellationReasonText(booking, locale);
  const manageLinkText = getManageLinkText(booking, copy, locale);
  const labels = getEmailLabels(locale);
  const tourLogistics = copy.showTourLogistics ? getTourLogistics(locale) : null;
  const tourLogisticsText = tourLogistics
    ? `\n\n${tourLogistics.title}\n${tourLogistics.items
        .map((item) =>
          item.href
            ? `${item.label}: ${item.value} (${item.href})`
            : `${item.label}: ${item.value}`,
        )
        .join("\n")}`
    : "";

  return `${labels.greeting} ${formatValue(booking.customer_name)},\n\n${copy.intro}${cancellationReasonText}${manageLinkText}\n\n${details}${tourLogisticsText}\n\nCapri Love Boat`;
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
  const labels = getEmailLabels(locale);
  const cancellationReason = getCancellationReason(booking);
  const cancellationReasonHtml = cancellationReason
    ? `
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:22px;">
          <tr>
            <td style="border-top:1px solid #bbb;border-bottom:1px solid #bbb;padding:16px 10px;text-align:center;">
              <p style="margin:0 0 8px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(labels.cancellationReason)}</p>
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
              <a href="${escapeHtml(booking.manage_url)}" style="background-color:#313131;border:1px solid #313131;border-radius:2px;color:#f3efe6;display:inline-block;font-family:'Times New Roman',Georgia,serif;font-size:14px;line-height:30px;text-align:center;text-decoration:none;padding:0 14px;">${escapeHtml(getManageLinkLabel(copy, locale))} <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;">&#8599;</span></a>
            </td>
          </tr>
        </table>
      `
    : "";
  const tourLogistics = copy.showTourLogistics ? getTourLogistics(locale) : null;
  const tourLogisticsHtml = tourLogistics
    ? `
        <tr>
          <td style="padding:0 34px 8px;">
            <p style="margin:0;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;line-height:22px;">${escapeHtml(tourLogistics.title)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 34px 12px;">
            <div style="border-top:1px solid #bbb;font-size:1px;line-height:1px;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 34px 22px;">
            ${tourLogistics.items
              .map(
                (item) => `
                  <div style="margin:0 0 14px;">
                    <p style="margin:0 0 4px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(item.label)}</p>
                    <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:16px;line-height:24px;">${
                      item.href
                        ? `<a href="${escapeHtml(item.href)}" style="color:#313131;text-decoration:underline;text-underline-offset:3px;">${escapeHtml(item.value)}</a>`
                        : escapeHtml(item.value)
                    }</p>
                  </div>
                `,
              )
              .join("")}
          </td>
        </tr>
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
                  <p style="margin:0 0 12px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;">${escapeHtml(labels.greeting)} ${escapeHtml(formatValue(booking.customer_name))},</p>
                  <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:16px;line-height:24px;">${escapeHtml(copy.intro)}</p>
                  ${cancellationReasonHtml}
                  ${manageLinkHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:28px 34px 5px;">
                  <p style="margin:0;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;line-height:22px;">${escapeHtml(labels.detailsTitle)}</p>
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
              ${tourLogisticsHtml}
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

export function buildBookingEmailPreview({ booking, eventType, locale }) {
  const normalizedLocale = getLocale(locale);
  const copy = getEmailCopy(eventType, normalizedLocale);

  if (!copy) {
    return null;
  }

  return {
    cta: getManageLinkLabel(copy, normalizedLocale),
    eventType,
    html: buildHtmlEmail({ booking, copy, locale: normalizedLocale }),
    locale: normalizedLocale,
    subject: copy.subject,
    text: buildTextEmail({ booking, copy, locale: normalizedLocale }),
  };
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
  const copy = getEmailCopy(eventType, locale);

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
