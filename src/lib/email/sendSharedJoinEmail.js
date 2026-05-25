import { Resend } from "resend";
import { DEFAULT_EMAIL_FROM, PUBLIC_CONTACT_EMAIL } from "@/lib/contact";
import { formatCustomerDate } from "@/lib/formatCustomerDate";
import { getSiteUrl } from "@/lib/stripe/server";
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
const CAPTAIN_PHONE_HREF = "tel:+393396650836";
const MEETING_POINT_MAP_URL =
  "https://www.google.com/maps/place/40°33'21.2%22N+14°14'24.8%22E/@40.5558895,14.2395912,63a,35y,70.31h,49.28t/data=!3m1!1e3!4m4!3m3!8m2!3d40.555894!4d14.240227?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D";
const TOUR_LOGISTICS_HREFS = {
  captainPhone: CAPTAIN_PHONE_HREF,
  departurePoint: MEETING_POINT_MAP_URL,
};
export const SHARED_JOIN_EMAIL_EVENTS = [
  { eventType: "authorized_guest", label: "Shared request authorized - guest" },
  { eventType: "authorized_host", label: "Shared request authorized - host" },
  { eventType: "accepted_guest", label: "Shared request accepted - guest" },
  { eventType: "accepted_host", label: "Shared request accepted - host" },
  {
    eventType: "booking_rescheduled_guest",
    label: "Shared booking rescheduled - guest",
  },
  {
    eventType: "admin_cancelled_secondary_guest",
    label: "Shared secondary cancelled - guest",
  },
  {
    eventType: "admin_cancelled_secondary_host",
    label: "Shared secondary cancelled - host",
  },
  { eventType: "rejected_guest", label: "Shared request rejected - guest" },
  { eventType: "cancelled_guest", label: "Shared request cancelled - guest" },
];

const COPY = {
  authorized_guest: {
    de: {
      subject: "Deine Shared-Boat-Anfrage wird geprüft",
      intro:
        "Deine Anfrage wurde vorautorisiert und zur Prüfung gesendet. Du wurdest noch nicht belastet. Die Belastung erfolgt nur, wenn der Hauptkontakt deine Anfrage akzeptiert.",
      cta: "Anfrage ansehen",
    },
    en: {
      subject: "Your shared boat request is under review",
      intro:
        "Your join request has been pre-authorized and sent for review. You have not been charged yet. You will only be charged if the main booking contact accepts your request.",
      cta: "View request",
    },
    zh: {
      subject: "你的拼船申请正在等待确认",
      intro:
        "你的加入申请已进入审核，只有主预订人接受你的申请后才会正式扣款。",
      cta: "查看申请",
    },
    fr: {
      subject: "Votre demande de bateau partagé est en cours d’examen",
      intro:
        "Votre demande a été préautorisée et envoyée pour examen. Vous n’avez pas encore été débité. Vous ne serez débité que si le contact principal accepte votre demande.",
      cta: "Voir la demande",
    },
    it: {
      subject: "La tua richiesta di condivisione è in revisione",
      intro:
        "La tua richiesta di partecipazione è stata pre-autorizzata e verrà esaminata. Non ti è stato ancora addebitato nulla. L’addebito avverrà solo se il contatto principale accetta la richiesta.",
      cta: "Vedi richiesta",
    },
  },
  authorized_host: {
    de: {
      subject: "Eine Shared-Boat-Anfrage wartet auf deine Entscheidung",
      intro:
        "Eine Reisegruppe hat die Vorautorisierung abgeschlossen und möchte an deiner bestätigten Bootstour teilnehmen. Bitte prüfe die Anfrage und akzeptiere oder lehne sie auf deiner Buchungsseite ab.",
      cta: "Anfrage prüfen",
    },
    en: {
      subject: "A shared boat request is waiting for your decision",
      intro:
        "A traveler group has completed pre-authorization and is asking to join your confirmed boat tour. Please review and accept or reject the request from your booking page.",
      cta: "Review request",
    },
    zh: {
      subject: "有一个拼船申请等待你确认",
      intro:
        "有一组游客申请加入你的拼船邀请。请在你的预约管理页面查看并选择接受或拒绝。",
      cta: "查看申请",
    },
    fr: {
      subject: "Une demande de bateau partagé attend votre décision",
      intro:
        "Un groupe a terminé la préautorisation et demande à rejoindre votre tour confirmé. Veuillez examiner la demande et l’accepter ou la refuser depuis votre page de réservation.",
      cta: "Examiner la demande",
    },
    it: {
      subject: "Una richiesta di condivisione attende la tua decisione",
      intro:
        "Un gruppo di viaggiatori ha completato la pre-autorizzazione e chiede di partecipare al tuo tour confermato. Puoi accettare o rifiutare dalla pagina della prenotazione.",
      cta: "Controlla richiesta",
    },
  },
  accepted_guest: {
    de: {
      subject: "Deine Shared-Boat-Anfrage wurde akzeptiert",
      intro:
        "Deine Anfrage wurde akzeptiert und die Reservierungsgebühr wurde jetzt belastet. Aus Datenschutzgründen teilen wir keine direkten Kontaktdaten zwischen den Gruppen.",
      cta: "Shared Booking ansehen",
    },
    en: {
      subject: "Your shared boat request was accepted",
      intro:
        "Your request was accepted and your reservation fee has now been charged. For privacy, we do not share direct contact details between groups.",
      cta: "View shared booking",
    },
    zh: {
      subject: "你的拼船申请已被接受",
      intro:
        "你的申请已被接受，预付款已正式扣款。为了保护隐私，我们不会在两组游客之间分享直接联系方式。",
      cta: "查看拼船预约",
    },
    fr: {
      subject: "Votre demande de bateau partagé a été acceptée",
      intro:
        "Votre demande a été acceptée et les frais de réservation ont maintenant été débités. Par confidentialité, nous ne partageons pas les coordonnées directes entre les groupes.",
      cta: "Voir la réservation partagée",
    },
    it: {
      subject: "La tua richiesta di condivisione è stata accettata",
      intro:
        "La tua richiesta è stata accettata e la quota di prenotazione è stata addebitata. Per privacy, non condividiamo i contatti diretti tra i gruppi.",
      cta: "Vedi prenotazione condivisa",
    },
  },
  accepted_host: {
    de: {
      subject: "Shared-Boat-Anfrage akzeptiert",
      intro:
        "Du hast die Anfrage akzeptiert. Die Reservierungsgebühr der teilnehmenden Gruppe wurde belastet. Aus Datenschutzgründen werden direkte Kontaktdaten nicht zwischen den Gruppen geteilt.",
      cta: "Buchung verwalten",
    },
    en: {
      subject: "Shared boat request accepted",
      intro:
        "You accepted the join request. The joining group’s reservation fee has been charged. For privacy, direct contact details are not shared between groups.",
      cta: "Manage booking",
    },
    zh: {
      subject: "拼船申请已接受",
      intro:
        "你已接受这个加入申请。加入方的预付款已正式扣款。为了保护隐私，我们不会在两组游客之间分享直接联系方式。",
      cta: "管理预约",
    },
    fr: {
      subject: "Demande de bateau partagé acceptée",
      intro:
        "Vous avez accepté la demande. Les frais de réservation du groupe participant ont été débités. Par confidentialité, les coordonnées directes ne sont pas partagées entre les groupes.",
      cta: "Gérer la réservation",
    },
    it: {
      subject: "Richiesta di condivisione accettata",
      intro:
        "Hai accettato la richiesta di partecipazione. La quota di prenotazione del gruppo partecipante è stata addebitata. Per privacy, i contatti diretti non vengono condivisi tra i gruppi.",
      cta: "Gestisci prenotazione",
    },
  },
  booking_rescheduled_guest: {
    de: {
      subject: "Deine Bootstour wurde verschoben",
      intro:
        "Die bestätigte geteilte Bootstour wurde aktualisiert. Bitte prüfe unten das neue Datum und die neue Uhrzeit.",
      cta: "Buchung ansehen",
    },
    en: {
      subject: "Your boat tour time has changed",
      intro:
        "Your confirmed shared boat tour has been updated. Please review the new date and time below.",
      cta: "View booking",
    },
    zh: {
      subject: "你的船游时间已更新",
      intro:
        "你的已确认拼船行程时间已更新。请查看下方新的日期和时间。",
      cta: "查看预约",
    },
    fr: {
      subject: "L'horaire de votre tour a changé",
      intro:
        "Votre tour partagé confirmé a été mis à jour. Veuillez vérifier la nouvelle date et le nouvel horaire ci-dessous.",
      cta: "Voir la réservation",
    },
    it: {
      subject: "L'orario del tour è cambiato",
      intro:
        "Il tuo tour condiviso confermato è stato aggiornato. Controlla qui sotto la nuova data e il nuovo orario.",
      cta: "Vedi prenotazione",
    },
  },
  admin_cancelled_secondary_guest: {
    de: {
      subject: "Deine Shared-Boat-Buchung wurde storniert",
      intro:
        "Deine Teilnahme an dieser geteilten Bootstour wurde von Capri Love Boat storniert. Deine Vorauszahlung wurde zur Rückerstattung markiert.",
      cta: "Anfrage ansehen",
    },
    en: {
      subject: "Your shared boat booking was cancelled",
      intro:
        "Your place on this shared boat tour was cancelled by Capri Love Boat. Your prepayment has been marked for refund.",
      cta: "View request",
    },
    zh: {
      subject: "你的拼船预约已取消",
      intro:
        "你在这次拼船中的加入名额已由 Capri Love Boat 取消，预付款退款已开始处理。",
      cta: "查看申请",
    },
    fr: {
      subject: "Votre réservation partagée a été annulée",
      intro:
        "Votre place sur ce tour partagé a été annulée par Capri Love Boat. Votre acompte a été marqué pour remboursement.",
      cta: "Voir la demande",
    },
    it: {
      subject: "La tua prenotazione condivisa è stata cancellata",
      intro:
        "Il tuo posto in questo tour condiviso è stato cancellato da Capri Love Boat. Il tuo acconto è stato contrassegnato per il rimborso.",
      cta: "Vedi richiesta",
    },
  },
  admin_cancelled_secondary_host: {
    de: {
      subject: "Teilnehmende Gruppe storniert",
      intro:
        "Die akzeptierte teilnehmende Gruppe wurde von Capri Love Boat storniert und ihre Rückerstattung wurde gestartet. Deine Buchung bleibt bestätigt und der Shared-Boat-Link ist wieder offen.",
      cta: "Buchung verwalten",
    },
    en: {
      subject: "Joining group cancelled",
      intro:
        "The accepted joining group was cancelled by Capri Love Boat and their refund has been started. Your booking remains confirmed and your shared boat link is open again.",
      cta: "Manage booking",
    },
    zh: {
      subject: "加入组已取消",
      intro:
        "已接受的加入组已由 Capri Love Boat 取消，其预付款退款已开始处理。你的预约仍然确认，拼船分享链接已重新开放。",
      cta: "管理预约",
    },
    fr: {
      subject: "Groupe participant annulé",
      intro:
        "Le groupe accepté a été annulé par Capri Love Boat et son remboursement a été lancé. Votre réservation reste confirmée et votre lien de bateau partagé est de nouveau ouvert.",
      cta: "Gérer la réservation",
    },
    it: {
      subject: "Gruppo partecipante cancellato",
      intro:
        "Il gruppo accettato è stato cancellato da Capri Love Boat e il rimborso è stato avviato. La tua prenotazione resta confermata e il link condiviso è di nuovo aperto.",
      cta: "Gestisci prenotazione",
    },
  },
  rejected_guest: {
    de: {
      subject: "Deine Shared-Boat-Anfrage wurde nicht akzeptiert",
      intro:
        "Der Hauptkontakt hat deine Anfrage nicht akzeptiert. Deine Autorisierung wurde freigegeben und du wurdest nicht belastet.",
      cta: "Anfrage ansehen",
    },
    en: {
      subject: "Your shared boat request was not accepted",
      intro:
        "The main booking contact did not accept your join request. Your authorization has been released and you were not charged.",
      cta: "View request",
    },
    zh: {
      subject: "你的拼船申请未被接受",
      intro:
        "主预订人没有接受你的加入申请。你的预授权已释放，不会被扣款。",
      cta: "查看申请",
    },
    fr: {
      subject: "Votre demande de bateau partagé n’a pas été acceptée",
      intro:
        "Le contact principal n’a pas accepté votre demande. Votre autorisation a été libérée et vous n’avez pas été débité.",
      cta: "Voir la demande",
    },
    it: {
      subject: "La tua richiesta di condivisione non è stata accettata",
      intro:
        "Il contatto principale non ha accettato la tua richiesta. La pre-autorizzazione è stata rilasciata e non ti è stato addebitato nulla.",
      cta: "Vedi richiesta",
    },
  },
  cancelled_guest: {
    de: {
      subject: "Deine Shared-Boat-Buchung wurde storniert",
      intro:
        "Die Hauptbuchung für diese geteilte Bootstour wurde storniert. Wenn deine Reservierungsgebühr bereits belastet wurde, wurde die Rückerstattung gestartet. Wenn sie nur vorautorisiert war, wurde die Autorisierung freigegeben.",
      cta: "Anfrage ansehen",
    },
    en: {
      subject: "Your shared boat booking was cancelled",
      intro:
        "The main booking for this shared boat tour was cancelled. If your reservation fee had already been charged, the refund has been started. If it was only pre-authorized, the authorization has been released.",
      cta: "View request",
    },
    zh: {
      subject: "你的拼船预约已取消",
      intro:
        "这次拼船的主预约已被取消。如果你的预付款已经扣款，退款已开始处理。如果只是预授权，预授权已释放。",
      cta: "查看申请",
    },
    fr: {
      subject: "Votre réservation de bateau partagé a été annulée",
      intro:
        "La réservation principale de ce tour partagé a été annulée. Si vos frais de réservation avaient déjà été débités, le remboursement a été lancé. S’ils étaient seulement préautorisés, l’autorisation a été libérée.",
      cta: "Voir la demande",
    },
    it: {
      subject: "La tua prenotazione condivisa è stata annullata",
      intro:
        "La prenotazione principale per questo tour condiviso è stata annullata. Se la quota di prenotazione era già stata addebitata, il rimborso è stato avviato. Se era solo pre-autorizzata, l’autorizzazione è stata rilasciata.",
      cta: "Vedi richiesta",
    },
  },
};

const LABELS = {
  de: {
    date: "Datum",
    genderComposition: "Geschlechterzusammensetzung",
    genderCompositionValues: {
      all_female: "Nur Frauen",
      all_male: "Nur Männer",
      mixed: "Gemischt",
      prefer_not_to_say: "Keine Angabe",
    },
    guests: "Gäste",
    name: "Name",
    requestDetails: "Anfragedetails",
    time: "Zeit",
    tour: "Tour",
  },
  en: {
    date: "Date",
    genderComposition: "Gender composition",
    genderCompositionValues: {
      all_female: "All female",
      all_male: "All male",
      mixed: "Mixed",
      prefer_not_to_say: "Prefer not to say",
    },
    guests: "Guests",
    name: "Name",
    requestDetails: "Request details",
    time: "Time",
    tour: "Tour",
  },
  zh: {
    date: "日期",
    genderComposition: "性别组成",
    genderCompositionValues: {
      all_female: "全女生",
      all_male: "全男生",
      mixed: "混合",
      prefer_not_to_say: "不想说明",
    },
    guests: "人数",
    name: "姓名",
    requestDetails: "申请信息",
    time: "时间",
    tour: "行程",
  },
  fr: {
    date: "Date",
    genderComposition: "Composition du groupe",
    genderCompositionValues: {
      all_female: "Femmes uniquement",
      all_male: "Hommes uniquement",
      mixed: "Mixte",
      prefer_not_to_say: "Préfère ne pas répondre",
    },
    guests: "Participants",
    name: "Nom",
    requestDetails: "Détails de la demande",
    time: "Heure",
    tour: "Tour",
  },
  it: {
    date: "Data",
    genderComposition: "Composizione del gruppo",
    genderCompositionValues: {
      all_female: "Solo donne",
      all_male: "Solo uomini",
      mixed: "Misto",
      prefer_not_to_say: "Preferisco non dirlo",
    },
    guests: "Ospiti",
    name: "Nome",
    requestDetails: "Dettagli richiesta",
    time: "Orario",
    tour: "Tour",
  },
};

function getLocale(locale) {
  return ["en", "zh", "it", "de", "fr"].includes(locale) ? locale : "en";
}

function getCopy(eventType, locale) {
  return COPY[eventType]?.[locale] ?? COPY[eventType]?.en;
}

function getLabels(locale) {
  return LABELS[locale] ?? LABELS.en;
}

function getEmailMessages(locale) {
  return EMAIL_MESSAGES[locale] ?? EMAIL_MESSAGES.en;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value) {
  return value || "-";
}

function formatTourType(tourType, locale) {
  return getTourLabels(locale)[tourType] ?? formatValue(tourType);
}

function getManageUrl(path, siteUrl) {
  return `${(siteUrl || getSiteUrl()).replace(/\/$/, "")}${path}`;
}

function getGuestManagePath(request) {
  return `/${request.locale}/shared/manage/${request.id}?token=${encodeURIComponent(
    request.customer_manage_token,
  )}`;
}

function getHostManagePath(booking) {
  return `/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(
    booking.customer_manage_token,
  )}`;
}

function getTourRows({ booking, labels, locale }) {
  return [
    [labels.date, formatCustomerDate(booking.requested_date, locale)],
    [labels.time, formatValue(booking.time_window || booking.time_slot)],
    [labels.tour, formatTourType(booking.tour_type, locale)],
  ];
}

function formatGenderComposition(value, labels) {
  return labels.genderCompositionValues?.[value] ?? formatValue(value);
}

function getRequestRows({ labels, request }) {
  return [
    [labels.name, formatValue(request.customer_name)],
    [labels.guests, formatValue(request.guest_count)],
    [
      labels.genderComposition,
      formatGenderComposition(request.gender_composition, labels),
    ],
  ];
}

function shouldShowTourLogistics(eventType) {
  return eventType === "accepted_guest" || eventType === "booking_rescheduled_guest";
}

function buildTourLogisticsText({ eventType, locale }) {
  if (!shouldShowTourLogistics(eventType)) {
    return [];
  }

  const tourLogistics = getTourLogistics(locale);

  return [
    "",
    tourLogistics.title,
    ...tourLogistics.items.flatMap((item) => {
      const line = item.href
        ? `${item.label}: ${item.value} (${item.href})`
        : `${item.label}: ${item.value}`;

      return item.note ? [line, item.note] : [line];
    }),
  ];
}

function buildTourLogisticsHtml({ eventType, locale }) {
  if (!shouldShowTourLogistics(eventType)) {
    return "";
  }

  const tourLogistics = getTourLogistics(locale);

  return `
    <p style="margin:22px 0 8px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;">${escapeHtml(tourLogistics.title)}</p>
    ${tourLogistics.items
      .map(
        (item) => `
          <div style="margin:0 0 14px;">
            <p style="margin:0 0 4px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(item.label)}</p>
            <p style="margin:0;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">${
              item.href
                ? `<a href="${escapeHtml(item.href)}" style="color:#313131;text-decoration:underline;text-underline-offset:3px;">${escapeHtml(item.value)}</a>`
                : escapeHtml(item.value)
            }</p>
            ${
              item.note
                ? `<p style="margin:6px 0 0;color:#555;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;">${escapeHtml(item.note)}</p>`
                : ""
            }
          </div>
        `,
      )
      .join("")}
  `;
}

function buildText({ booking, eventType, locale, manageUrl, request }) {
  const copy = getCopy(eventType, locale);
  const labels = getLabels(locale);
  const tourRows = getTourRows({ booking, labels, locale });
  const requestRows = getRequestRows({ labels, request });
  const tourLogisticsRows = buildTourLogisticsText({ eventType, locale });

  return [
    copy.intro,
    "",
    `${copy.cta}: ${manageUrl}`,
    "",
    labels.requestDetails,
    ...tourRows.map(([label, value]) => `${label}: ${value}`),
    ...requestRows.map(([label, value]) => `${label}: ${value}`),
    ...tourLogisticsRows,
    "",
    "Capri Love Boat",
  ].join("\n");
}

function buildHtml({ booking, eventType, locale, manageUrl, request }) {
  const copy = getCopy(eventType, locale);
  const labels = getLabels(locale);
  const tourRows = getTourRows({ booking, labels, locale });
  const requestRows = getRequestRows({ labels, request });
  const tourLogisticsHtml = buildTourLogisticsHtml({ eventType, locale });
  const rowsHtml = [...tourRows, ...requestRows]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:7px 5px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${escapeHtml(label)}</td><td style="padding:7px 5px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-align:right;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `
    <div style="background:#f0f0f0;padding:0;margin:0;">
      <table width="100%" role="presentation" style="background:#f0f0f0;">
        <tr><td align="center">
          <table width="640" role="presentation" style="max-width:100%;background:#f3efe6;color:#313131;">
            <tr><td style="padding:24px;text-align:center;">
              <p style="margin:0 0 18px;font-family:'Times New Roman',Georgia,serif;font-size:12px;letter-spacing:.28em;text-transform:uppercase;">Capri Love Boat</p>
              <h1 style="margin:0;font-family:'Times New Roman',Georgia,serif;font-weight:400;font-size:24px;line-height:30px;">${escapeHtml(copy.subject)}</h1>
              <p style="margin:18px 0 0;font-family:'Times New Roman',Georgia,serif;font-size:16px;line-height:24px;">${escapeHtml(copy.intro)}</p>
              <p style="margin:22px 0 0;"><a href="${escapeHtml(manageUrl)}" style="background:#313131;color:#f3efe6;text-decoration:none;padding:8px 14px;font-family:'Times New Roman',Georgia,serif;">${escapeHtml(copy.cta)}</a></p>
            </td></tr>
            <tr><td style="padding:8px 34px 24px;">
              <p style="margin:0 0 8px;color:#313131;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;">${escapeHtml(labels.requestDetails)}</p>
              <table width="100%" role="presentation">${rowsHtml}</table>
              ${tourLogisticsHtml}
            </td></tr>
            <tr><td style="padding:18px 34px 30px;text-align:center;border-top:1px solid #bbb;">
              <p style="margin:0;color:#313131;font-family:'Times New Roman',Georgia,serif;font-size:14px;">Capri, Italy</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>
  `;
}

export async function sendSharedJoinEmail({
  booking,
  eventType,
  managePath,
  request,
  siteUrl,
  to,
}) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey || !to || !eventType) {
    return { sent: false };
  }

  const locale = getLocale(request.locale || booking.locale);
  const copy = getCopy(eventType, locale);

  if (!copy) {
    return { sent: false };
  }

  try {
    const manageUrl = getManageUrl(managePath, siteUrl);
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      bcc:
        to.toLowerCase() === PUBLIC_CONTACT_EMAIL.toLowerCase()
          ? undefined
          : [PUBLIC_CONTACT_EMAIL],
      from: EMAIL_FROM,
      html: buildHtml({ booking, eventType, locale, manageUrl, request }),
      subject: copy.subject,
      text: buildText({ booking, eventType, locale, manageUrl, request }),
      to,
    });

    if (error) {
      throw new Error(error.message ?? "Resend email failed.");
    }

    return { resendId: data?.id, sent: true };
  } catch (error) {
    console.error("[shared join email] Send failed", {
      eventType,
      message: error.message,
      to,
    });
    return { reason: error.message, sent: false };
  }
}

export function buildSharedJoinEmailPreview({
  booking,
  eventType,
  locale,
  manageUrl,
  request,
}) {
  const normalizedLocale = getLocale(locale);
  const copy = getCopy(eventType, normalizedLocale);

  if (!copy) {
    return null;
  }

  return {
    cta: copy.cta,
    eventType,
    html: buildHtml({
      booking,
      eventType,
      locale: normalizedLocale,
      manageUrl,
      request,
    }),
    locale: normalizedLocale,
    subject: copy.subject,
    text: buildText({
      booking,
      eventType,
      locale: normalizedLocale,
      manageUrl,
      request,
    }),
  };
}

export function getSharedGuestManagePath(request) {
  return getGuestManagePath(request);
}

export function getSharedHostManagePath(booking) {
  return getHostManagePath(booking);
}
