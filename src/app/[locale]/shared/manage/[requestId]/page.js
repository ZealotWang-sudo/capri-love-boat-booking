import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import MeetUpPhotoGallery from "@/components/MeetUpPhotoGallery";
import SiteHeader from "@/components/SiteHeader";
import { formatCustomerDate } from "@/lib/formatCustomerDate";
import { buildPageMetadata } from "@/lib/seo";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { handleSharedJoinCheckoutSessionCompleted } from "@/lib/stripe/sharedJoinRequests";

const REQUEST_SELECT =
  "id, booking_id, locale, customer_name, guest_count, gender_composition, original_shared_request_fee_eur, promo_code, promo_discount_eur, shared_request_fee_eur, payment_status, status, stripe_checkout_session_id, stripe_payment_intent_id, authorized_at, accepted_at, rejected_at, customer_manage_token, created_at, updated_at";
const BOOKING_SELECT =
  "id, locale, customer_name, customer_manage_token, guest_count, requested_date, tour_type, time_slot, time_window, total_price_eur, pay_on_board_eur, booking_status, payment_status, is_shared_open, shared_status";
const MEETING_POINT_MAP_URL =
  "https://www.google.com/maps/place/40°33'21.2%22N+14°14'24.8%22E/@40.5558895,14.2395912,63a,35y,70.31h,49.28t/data=!3m1!1e3!4m4!3m3!8m2!3d40.555894!4d14.240227?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D";
const MEET_UP_PHOTOS = [
  "/meet-up-point/meet-up-1.png",
  "/meet-up-point/meet-up-2.png",
  "/meet-up-point/meet-up-3.jpg",
  {
    alt: "Captain Renato",
    label: "Captain Renato",
    src: "/meet-up-point/capain-face.png",
  },
];
const CAPTAIN_PHONE = "+39 339 665 0836";
const CAPTAIN_PHONE_HREF = "tel:+393396650836";
const GENDER_COMPOSITION_LABEL_KEYS = {
  all_female: "genderCompositionAllFemale",
  all_male: "genderCompositionAllMale",
  mixed: "genderCompositionMixed",
  prefer_not_to_say: "genderCompositionPreferNotToSay",
};

const PAGE_COPY = {
  de: {
    acceptedIntro:
      "Deine Anfrage wurde akzeptiert, und das Boot ist für dich reserviert. Bitte sei pünktlich am Treffpunkt; der Restbetrag wird am Tag der Tour direkt an den Kapitän gezahlt.",
    awaitingIntro:
      "Deine Anfrage wurde vorautorisiert und wartet auf die Entscheidung der Hauptbuchung. Du wurdest noch nicht belastet.",
    mainGroupTitle: "Hauptgruppe",
    invalidMessage:
      "Dieser Link passt zu keiner aktiven Shared-Boat-Anfrage. Wenn du Hilfe brauchst, kontaktiere info@capriloveboat.com.",
    invalidTitle: "Ungültiger oder abgelaufener Link.",
    paymentSuccess: "Deine Vorautorisierung war erfolgreich.",
    rejectedIntro:
      "Die Hauptbuchung hat deine Anfrage nicht akzeptiert. Deine Autorisierung wurde freigegeben und du wurdest nicht belastet.",
    refundedIntro:
      "Die Hauptbuchung für diese geteilte Bootstour wurde storniert. Deine Reservierungsgebühr wurde zur Rückerstattung markiert.",
    requestTitle: "Deine Shared-Boat-Anfrage",
    statusAwaiting: "Wartet auf Entscheidung",
    statusAccepted: "Akzeptiert",
    statusRejected: "Nicht akzeptiert",
    statusReleased: "Freigegeben",
    statusRefunded: "Rückerstattung gestartet",
    subtitle: "Prüfe den Status deiner Anfrage und die Tourdetails.",
  },
  en: {
    acceptedIntro:
      "Your request has been accepted and the boat is now reserved for you. Please arrive on time; the remaining balance will be paid directly to the captain on the tour day.",
    awaitingIntro:
      "Your request has been pre-authorized and is waiting for the main booking contact’s decision. You have not been charged yet.",
    mainGroupTitle: "Main group",
    invalidMessage:
      "This link does not match an active shared boat request. If you need help, contact us at info@capriloveboat.com.",
    invalidTitle: "Invalid or expired request link.",
    paymentSuccess: "Your pre-authorization was successful.",
    rejectedIntro:
      "The main booking contact did not accept your request. Your authorization has been released and you were not charged.",
    refundedIntro:
      "The main booking for this shared boat tour was cancelled. Your reservation fee has been marked as refunded.",
    requestTitle: "Your shared boat request",
    statusAwaiting: "Waiting for host decision",
    statusAccepted: "Accepted",
    statusRejected: "Not accepted",
    statusReleased: "Released",
    statusRefunded: "Refund started",
    subtitle: "Review your request status and tour details.",
  },
  fr: {
    acceptedIntro:
      "Votre demande a été acceptée et le bateau est maintenant réservé pour vous. Merci d’arriver à l’heure ; le solde sera payé directement au capitaine le jour du tour.",
    awaitingIntro:
      "Votre demande a été préautorisée et attend la décision du contact principal. Vous n’avez pas encore été débité.",
    mainGroupTitle: "Groupe principal",
    invalidMessage:
      "Ce lien ne correspond à aucune demande active de bateau partagé. Si vous avez besoin d’aide, contactez info@capriloveboat.com.",
    invalidTitle: "Lien de demande invalide ou expiré.",
    paymentSuccess: "Votre préautorisation a réussi.",
    rejectedIntro:
      "Le contact principal n’a pas accepté votre demande. Votre autorisation a été libérée et vous n’avez pas été débité.",
    refundedIntro:
      "La réservation principale de ce tour partagé a été annulée. Vos frais de réservation ont été marqués comme remboursés.",
    requestTitle: "Votre demande de bateau partagé",
    statusAwaiting: "En attente de décision",
    statusAccepted: "Acceptée",
    statusRejected: "Non acceptée",
    statusReleased: "Libérée",
    statusRefunded: "Remboursement lancé",
    subtitle: "Consultez le statut de votre demande et les détails du tour.",
  },
  it: {
    acceptedIntro:
      "La tua richiesta è stata accettata e la barca è ora riservata per te. Ti chiediamo di arrivare puntuale; il saldo verrà pagato direttamente al capitano il giorno del tour.",
    awaitingIntro:
      "La tua richiesta è stata pre-autorizzata ed è in attesa della decisione del contatto principale. Non ti è stato ancora addebitato nulla.",
    mainGroupTitle: "Gruppo principale",
    invalidMessage:
      "Questo link non corrisponde a una richiesta attiva di barca condivisa. Se hai bisogno di aiuto, contattaci a info@capriloveboat.com.",
    invalidTitle: "Link richiesta non valido o scaduto.",
    paymentSuccess: "La pre-autorizzazione è andata a buon fine.",
    rejectedIntro:
      "Il contatto principale non ha accettato la tua richiesta. L’autorizzazione è stata rilasciata e non ti è stato addebitato nulla.",
    refundedIntro:
      "La prenotazione principale per questo tour condiviso è stata annullata. La tua quota di prenotazione è stata contrassegnata come rimborsata.",
    requestTitle: "La tua richiesta di barca condivisa",
    statusAwaiting: "In attesa della decisione",
    statusAccepted: "Accettata",
    statusRejected: "Non accettata",
    statusReleased: "Rilasciata",
    statusRefunded: "Rimborso avviato",
    subtitle: "Controlla lo stato della richiesta e i dettagli del tour.",
  },
  zh: {
    acceptedIntro:
      "你的申请已被接受，船只已为您锁定，请准时到达，剩余费用将在出海当天直接支付给船长。",
    awaitingIntro:
      "你的申请已完成预授权，正在等待主预订人决定。你现在还没有被正式扣款。",
    mainGroupTitle: "主预订组",
    invalidMessage:
      "这个链接不匹配任何有效的拼船申请。如需帮助，请联系 info@capriloveboat.com。",
    invalidTitle: "申请链接无效或已过期。",
    paymentSuccess: "你的预授权已成功。",
    rejectedIntro:
      "主预订人没有接受你的申请。你的预授权已释放，不会被扣款。",
    refundedIntro:
      "这次拼船的主预约已被取消。你的预付款已标记为退款。",
    requestTitle: "你的拼船申请",
    statusAwaiting: "等待主预订人决定",
    statusAccepted: "已接受",
    statusRejected: "未接受",
    statusReleased: "已释放",
    statusRefunded: "退款已开始",
    subtitle: "查看你的申请状态和行程信息。",
  },
};

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("manage", locale, { noIndex: true });
}

function getCopy(locale) {
  return PAGE_COPY[locale] ?? PAGE_COPY.en;
}

function getSearchText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatEuro(value) {
  if (typeof value !== "number") {
    return "-";
  }

  return Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;
}

function formatSharedPayOnBoardSplit(value) {
  if (typeof value !== "number") {
    return "-";
  }

  const splitAmount = value / 2;
  const formattedSplitAmount = Number.isInteger(splitAmount)
    ? splitAmount
    : splitAmount.toFixed(2);

  return `${formatEuro(value)} / 2 = €${formattedSplitAmount}`;
}

function formatValue(value) {
  return value || "-";
}

function SummaryItem({ fullWidth = true
  , label, note, value }) {
  return (
    <div
      className={[
        "border-b border-stone-200 py-3",
        fullWidth ? "sm:col-span-2" : "",
      ].join(" ")}
    >
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-stone-950">{formatValue(value)}</p>
      {note ? (
        <p className="mt-2 text-xs leading-5 text-stone-500">{note}</p>
      ) : null}
    </div>
  );
}

function PricingSection({ children, total, title }) {
  return (
    <details className="group mt-8 border border-stone-300 bg-[#f3eee7] p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
          {title}
        </span>
        <span className="flex items-center gap-3 text-lg text-stone-950">
          {formatValue(total)}
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-full border border-stone-300 text-stone-500 transition group-open:rotate-180"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
          </span>
        </span>
      </summary>
      <div className="mt-5 grid gap-x-6 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function TourLogisticsItem({ href, label, value }) {
  return (
    <div className="border-t border-stone-300 pt-4 first:border-t-0 first:pt-0">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-sm leading-6 text-stone-700 underline decoration-stone-400 underline-offset-4 transition hover:text-stone-950"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 text-sm leading-6 text-stone-700">{value}</p>
      )}
    </div>
  );
}

async function confirmReturnedStripePayment({ sessionId }) {
  if (!sessionId) {
    return null;
  }

  try {
    return await handleSharedJoinCheckoutSessionCompleted({ sessionId });
  } catch (error) {
    console.error("[shared request manage] Could not confirm Stripe return", {
      message: error.message,
      sessionId,
    });
    return null;
  }
}

async function getManagedSharedRequest({ requestId, token }) {
  if (!requestId || !token || token.length < 32) {
    return null;
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data: request, error: requestError } = await supabase
    .from("shared_join_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .eq("customer_manage_token", token)
    .maybeSingle();

  if (requestError) {
    console.error("[shared request manage] Could not load request", requestError.message);
    return null;
  }

  if (!request) {
    return null;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", request.booking_id)
    .maybeSingle();

  if (bookingError) {
    console.error("[shared request manage] Could not load booking", bookingError.message);
    return null;
  }

  return { booking, request };
}

function getStatusCopy({ copy, request }) {
  if (request.payment_status === "refunded") {
    return { intro: copy.refundedIntro, label: copy.statusRefunded };
  }

  if (request.status === "accepted") {
    return { intro: copy.acceptedIntro, label: copy.statusAccepted };
  }

  if (request.status === "rejected") {
    return { intro: copy.rejectedIntro, label: copy.statusRejected };
  }

  if (request.status === "released") {
    return { intro: copy.rejectedIntro, label: copy.statusReleased };
  }

  return { intro: copy.awaitingIntro, label: copy.statusAwaiting };
}

export default async function SharedRequestManagePage({ params, searchParams }) {
  const { locale, requestId } = await params;
  const query = await searchParams;
  const token = getSearchText(query?.token);
  const paymentStatus = getSearchText(query?.payment);
  const stripeSessionId = getSearchText(query?.session_id);
  setRequestLocale(locale);

  const common = await getTranslations("Common");
  const bookingManage = await getTranslations("BookingManage");
  const shared = await getTranslations("Shared");
  const copy = getCopy(locale);
  let checkoutResult = null;

  if (paymentStatus === "success") {
    checkoutResult = await confirmReturnedStripePayment({ sessionId: stripeSessionId });
  }

  const managedRequest = await getManagedSharedRequest({ requestId, token });
  const managePath = `/shared/manage/${requestId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  if (!managedRequest?.request || !managedRequest?.booking) {
    return (
      <main className="min-h-screen bg-[#f3eee7] text-stone-950">
        <SiteHeader brand={common("brand")} locale={locale} path={managePath} />
        <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {shared("eyebrow")}
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-[-0.03em] sm:text-6xl">
            {copy.invalidTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-8 text-stone-600">
            {copy.invalidMessage}
          </p>
          <Link
            href={`/${locale}`}
            className="mt-10 inline-flex border border-stone-950 bg-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
          >
            {common("home")}
          </Link>
        </section>
      </main>
    );
  }

  const { booking, request } = managedRequest;
  if (
    request.status === "promoted_to_primary" &&
    booking.customer_manage_token === request.customer_manage_token
  ) {
    redirect(
      `/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(
        booking.customer_manage_token,
      )}`,
    );
  }

  const isCancelledRequest =
    booking.booking_status === "cancelled" ||
    request.payment_status === "refunded" ||
    (request.status === "released" && request.payment_status === "released");
  const statusCopy = getStatusCopy({ copy, request });
  const showMainGroupInfo = request.status === "accepted" && !isCancelledRequest;
  const hasPromoDiscount = (request.promo_discount_eur ?? 0) > 0;
  const tourLabel = shared.raw("tourLabels")?.[booking.tour_type] ?? booking.tour_type;
  const sharedPayOnBoard =
    typeof booking.pay_on_board_eur === "number" ? booking.pay_on_board_eur / 2 : null;
  const customerTotal =
    typeof request.shared_request_fee_eur === "number" &&
    typeof sharedPayOnBoard === "number"
      ? request.shared_request_fee_eur + sharedPayOnBoard
      : null;

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path={managePath} />
      <section className="mx-auto grid max-w-5xl gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-8">
        <div className="border-t border-stone-300 pt-8">
          <p className="mt-12 text-xs uppercase tracking-[0.22em] text-stone-500">
            {showMainGroupInfo || isCancelledRequest
              ? bookingManage("eyebrow")
              : shared("eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {isCancelledRequest
              ? bookingManage("titleCancelled")
              : showMainGroupInfo
                ? bookingManage("titleConfirmed")
                : copy.requestTitle}
          </h1>
          <p className="mt-6 text-lg font-light leading-8 text-stone-600">
            {showMainGroupInfo || isCancelledRequest
              ? bookingManage("subtitle")
              : copy.subtitle}
          </p>
        </div>

        <div className="bg-[#fbf8f3] p-6 shadow-sm sm:p-10">
          {checkoutResult?.authorized ? (
            <div className="mb-6 border border-emerald-900/30 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              {copy.paymentSuccess}
            </div>
          ) : null}

          <h2 className="text-2xl font-light tracking-[-0.03em]">
            {bookingManage("summaryTitle")}
          </h2>
          <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
            <SummaryItem label={bookingManage("name")} value={request.customer_name} />
            <SummaryItem
              label={shared("date")}
              value={formatCustomerDate(booking.requested_date, locale)}
            />
            <SummaryItem
              label={shared("time")}
              value={booking.time_window || booking.time_slot}
            />
            <SummaryItem label={shared("tour")} value={tourLabel} />
            <SummaryItem label={bookingManage("guests")} value={request.guest_count} />
            <SummaryItem
              label={shared("joinGenderComposition")}
              value={
                GENDER_COMPOSITION_LABEL_KEYS[request.gender_composition]
                  ? shared(GENDER_COMPOSITION_LABEL_KEYS[request.gender_composition])
                  : request.gender_composition
              }
            />
          </div>

          <section className="mt-8 border border-stone-300 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              {bookingManage("nextStepTitle")}
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {isCancelledRequest
                ? bookingManage("nextStepCancelled")
                : statusCopy.intro}
            </p>
          </section>

          <PricingSection
            title={bookingManage("pricingTitle")}
            total={formatEuro(customerTotal)}
          >
            <SummaryItem
              label={bookingManage("totalPrice")}
              value={formatEuro(customerTotal)}
            />
            {hasPromoDiscount ? (
              <SummaryItem
                label={bookingManage("promoDiscount")}
                value={`-${formatEuro(request.promo_discount_eur)}`}
              />
            ) : null}
            <SummaryItem
              label={bookingManage("reservationFee")}
              value={formatEuro(request.shared_request_fee_eur)}
            />
            <SummaryItem
              label={bookingManage("payOnBoard")}
              note={bookingManage("sharedPayOnBoardNote")}
              value={formatSharedPayOnBoardSplit(booking.pay_on_board_eur)}
            />
          </PricingSection>

          {showMainGroupInfo ? (
            <section className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {copy.mainGroupTitle}
              </p>
              <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
                <SummaryItem
                  label={bookingManage("name")}
                  value={booking.customer_name}
                />
                <SummaryItem
                  label={shared("mainGroupGuests")}
                  value={booking.guest_count}
                />
              </div>
            </section>
          ) : null}

          {showMainGroupInfo ? (
            <section className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {bookingManage("tourLogisticsTitle")}
              </p>
              <div className="mt-5 space-y-4">
                <TourLogisticsItem
                  href={MEETING_POINT_MAP_URL}
                  label={bookingManage("departurePointTitle")}
                  value={bookingManage("departurePointText")}
                />
                <TourLogisticsItem
                  href={CAPTAIN_PHONE_HREF}
                  label={bookingManage("captainPhoneTitle")}
                  value={`${bookingManage("captainPhoneText")} ${CAPTAIN_PHONE}`}
                />
                <TourLogisticsItem
                  label={bookingManage("toiletTitle")}
                  value={bookingManage("toiletText")}
                />
                <TourLogisticsItem
                  label={bookingManage("boatModelTitle")}
                  value={bookingManage("boatModelText")}
                />
              </div>
              <div className="mt-6">
                <MeetUpPhotoGallery
                  photos={MEET_UP_PHOTOS}
                  labels={{
                    close: bookingManage("meetUpPhotoClose"),
                    hint: bookingManage("meetUpPhotoHint"),
                    next: bookingManage("meetUpPhotoNext"),
                    open: bookingManage("meetUpPhotoOpen"),
                    photoAlt: bookingManage("meetUpPhotoAlt"),
                    previous: bookingManage("meetUpPhotoPrevious"),
                    title: bookingManage("meetUpPhotosTitle"),
                  }}
                />
              </div>
            </section>
          ) : null}

          {showMainGroupInfo ? (
            <div className="mt-8">
              <p className="border-l border-stone-950 pl-5 text-sm leading-7 text-stone-600">
                {bookingManage("confirmedMessage")}
              </p>
            </div>
          ) : null}

          {isCancelledRequest ? (
            <div className="mt-8">
              <p className="border-l border-stone-950 pl-5 text-sm leading-7 text-stone-600">
                {bookingManage("cannotCancelMessage")}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
