import { Resend } from "resend";
import { DEFAULT_EMAIL_FROM, PUBLIC_CONTACT_EMAIL } from "@/lib/contact";
import { formatCustomerDate } from "@/lib/formatCustomerDate";
import deMessages from "../../../messages/de.json";
import enMessages from "../../../messages/en.json";
import frMessages from "../../../messages/fr.json";
import itMessages from "../../../messages/it.json";
import zhMessages from "../../../messages/zh.json";

const EMAIL_FROM = process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
const EMAIL_MESSAGES = {
  de: deMessages.Email,
  en: enMessages.Email,
  fr: frMessages.Email,
  it: itMessages.Email,
  zh: zhMessages.Email,
};
const EMAIL_EVENTS_BY_STATUS = {
  requested: "booking_received",
  payment_pending: "payment_pending",
  confirmed: "booking_confirmed",
  not_available: "not_available",
  cancelled: "cancelled",
  completed: "completed",
};
export const SUPPORTED_EMAIL_LOCALES = ["en", "zh", "it", "de", "fr"];
export const BOOKING_EMAIL_EVENTS = [
  { eventType: "booking_received", label: "Booking received" },
  { eventType: "payment_pending", label: "Payment pending" },
  { eventType: "booking_confirmed", label: "Booking confirmed" },
  { eventType: "not_available", label: "Captain not available" },
  { eventType: "cancelled", label: "Cancelled" },
  { eventType: "completed", label: "Completed" },
];
const CAPTAIN_PHONE_HREF = "tel:+393396650836";
const MEETING_POINT_MAP_URL =
  "https://www.google.com/maps/place/40°33'21.2%22N+14°14'24.8%22E/@40.5558895,14.2395912,63a,35y,70.31h,49.28t/data=!3m1!1e3!4m4!3m3!8m2!3d40.555894!4d14.240227?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D";
const TOUR_LOGISTICS_HREFS = {
  captainPhone: CAPTAIN_PHONE_HREF,
  departurePoint: MEETING_POINT_MAP_URL,
};

function getLocale(locale) {
  return SUPPORTED_EMAIL_LOCALES.includes(locale) ? locale : "en";
}

function getEmailMessages(locale) {
  return EMAIL_MESSAGES[locale] ?? EMAIL_MESSAGES.en;
}

function getEmailCopy(eventType, locale) {
  return (
    getEmailMessages(locale).copy[eventType] ?? EMAIL_MESSAGES.en.copy[eventType]
  );
}

function getEmailLabels(locale) {
  return getEmailMessages(locale).labels ?? EMAIL_MESSAGES.en.labels;
}

function getTourLabels(locale) {
  return getEmailMessages(locale).tourLabels ?? EMAIL_MESSAGES.en.tourLabels;
}

function getTourLogistics(locale) {
  const tourLogistics =
    getEmailMessages(locale).tourLogistics ?? EMAIL_MESSAGES.en.tourLogistics;

  return {
    ...tourLogistics,
    items: tourLogistics.items.map((item) => ({
      ...item,
      href: TOUR_LOGISTICS_HREFS[item.key],
    })),
  };
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
  return getTourLabels(locale)[tourType] ?? formatValue(tourType);
}

function getBookingDetails(booking, locale) {
  const labels = getEmailLabels(locale);
  const promoDiscountEur = booking.promo_discount_eur ?? 0;
  const reservationRows =
    promoDiscountEur > 0
      ? [
          [
            labels.originalReservationFee,
            formatEuro(booking.original_reservation_fee_eur),
          ],
          [labels.promoCode, formatValue(booking.promo_code)],
          [labels.promoDiscount, `-${formatEuro(promoDiscountEur)}`],
          [labels.reservationFee, formatEuro(booking.final_reservation_fee_eur)],
        ]
      : [[labels.reservationFee, formatEuro(booking.reservation_fee_eur)]];

  return [
    [labels.name, formatValue(booking.customer_name)],
    [labels.date, formatCustomerDate(booking.requested_date, locale)],
    [labels.time, formatValue(booking.time_window || booking.time_slot)],
    [labels.tour, formatTourType(booking.tour_type, locale)],
    [labels.guests, formatValue(booking.guest_count)],
    [labels.totalPrice, formatEuro(booking.total_price_eur)],
    ...reservationRows,
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
  return copy.cta || getEmailLabels(locale).manageBooking || "Manage booking";
}

function getManageLinkText(booking, copy, locale) {
  if (!booking.manage_url) {
    return "";
  }

  const label = getManageLinkLabel(copy, locale);

  return `\n\n${label}: ${booking.manage_url}`;
}

function getAdminNotificationRecipients({ recipientEmail }) {
  if (recipientEmail?.toLowerCase() === PUBLIC_CONTACT_EMAIL.toLowerCase()) {
    return undefined;
  }

  return [PUBLIC_CONTACT_EMAIL];
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
    const adminNotificationRecipients = getAdminNotificationRecipients({
      recipientEmail: booking.email,
    });
    const { data, error } = await resend.emails.send({
      ...(adminNotificationRecipients
        ? { bcc: adminNotificationRecipients }
        : {}),
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
