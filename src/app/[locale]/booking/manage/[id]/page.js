import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CopySharedLinkButton from "@/components/CopySharedLinkButton";
import CustomerCancelBookingForm from "@/components/CustomerCancelBookingForm";
import MeetUpPhotoGallery from "@/components/MeetUpPhotoGallery";
import SharedJoinRequestHostActions from "@/components/SharedJoinRequestHostActions";
import SiteHeader from "@/components/SiteHeader";
import StripeCheckoutButton from "@/components/StripeCheckoutButton";
import { formatCustomerDate } from "@/lib/formatCustomerDate";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { buildPageMetadata } from "@/lib/seo";
import { handleCheckoutSessionCompleted } from "@/lib/stripe/confirmBookingPayment";

const CANCELLABLE_STATUSES = new Set([
  "requested",
  "checking_with_captain",
  "payment_pending",
]);
const TOUR_LABEL_KEYS = {
  five_hours: "tourFiveHour",
  four_hours: "tourFourHour",
  special_request: "tourSpecialRequest",
  sunset_three_hours: "tourSunsetThreeHour",
  three_hours: "tourThreeHour",
  two_hours: "tourTwoHour",
};
const NEXT_STEP_KEYS = {
  cancelled: "nextStepCancelled",
  checking_with_captain: "nextStepCheckingWithCaptain",
  completed: "nextStepCompleted",
  confirmed: "nextStepConfirmed",
  expired: "nextStepExpired",
  not_available: "nextStepNotAvailable",
  payment_pending: "nextStepPaymentPending",
  requested: "nextStepRequested",
};
const PAGE_TITLE_KEYS = {
  cancelled: "titleCancelled",
  completed: "titleCompleted",
  confirmed: "titleConfirmed",
};
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
const CUSTOMER_MANAGED_BOOKING_SELECT =
  "id, locale, customer_name, email, guest_count, requested_date, tour_type, time_slot, time_window, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, customer_cancelled_at, customer_cancel_reason, is_shared_open, shared_status, shared_public_token, shared_open_seats, shared_gender_preference";
const SHARED_JOIN_REQUEST_SELECT =
  "id, created_at, updated_at, customer_name, guest_count, gender_composition, payment_status, status";

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("manage", locale, { noIndex: true });
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

function getSharedPublicPath({ locale, token }) {
  if (!token) {
    return "";
  }

  return `/${locale}/shared/${token}`;
}

function SummaryItem({ fullWidth = false, label, note, value }) {
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

function SharedJoinRequestCard({
  bookingStatus,
  bookingId,
  decisionCompleted = false,
  labels,
  locale,
  request,
  token,
}) {
  const canRespond =
    !decisionCompleted &&
    bookingStatus !== "cancelled" &&
    request.status === "authorized_pending_host_decision" &&
    request.payment_status === "authorized";

  return (
    <article className="mt-5 border border-stone-300 bg-[#fbf8f3] p-4">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <SummaryItem label={labels.name} value={request.customer_name} />
        <SummaryItem label={labels.guests} value={request.guest_count} />
        <SummaryItem
          label={labels.genderComposition}
          value={labels.genderCompositionValues[request.gender_composition] ?? request.gender_composition}
        />
      </div>
      {canRespond ? (
        <SharedJoinRequestHostActions
          acceptLabel={labels.acceptButton}
          acceptPendingLabel={labels.acceptPendingButton}
          bookingId={bookingId}
          locale={locale}
          rejectLabel={labels.rejectButton}
          rejectPendingLabel={labels.rejectPendingButton}
          requestId={request.id}
          token={token}
        />
      ) : null}
    </article>
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

function BoatPreviewCard({ labels }) {
  return (
    <div className="mt-10 border border-stone-300 bg-[#fbf8f3]">
      <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
        <Image
          src="/boat/boat-2.jpeg"
          alt={labels.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 36vw"
          className="object-cover"
        />
      </div>
      <div className="p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
          {labels.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-[-0.03em]">
          {labels.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          {labels.text}
        </p>
      </div>
    </div>
  );
}

async function getManagedBooking({ bookingId, token }) {
  if (!bookingId || !token || token.length < 32) {
    return null;
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(CUSTOMER_MANAGED_BOOKING_SELECT)
    .eq("id", bookingId)
    .eq("customer_manage_token", token)
    .maybeSingle();

  if (error) {
    console.error("[customer booking manage]", error.message);
    return null;
  }

  return data;
}

async function getSharedJoinRequests(bookingId) {
  if (!bookingId) {
    return [];
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data, error } = await supabase
    .from("shared_join_requests")
    .select(SHARED_JOIN_REQUEST_SELECT)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[customer booking manage] Could not load shared join requests", {
      bookingId,
      message: error.message,
    });
    return [];
  }

  return data ?? [];
}

async function confirmReturnedStripePayment({ bookingId, sessionId, token }) {
  if (!bookingId || !sessionId || !token) {
    return;
  }

  try {
    await handleCheckoutSessionCompleted({
      bookingId,
      sessionId,
      token,
    });
  } catch (error) {
    console.error("[customer booking manage] Could not confirm Stripe return", {
      bookingId,
      message: error.message,
    });
  }
}

export default async function ManageBookingPage({ params, searchParams }) {
  const { id, locale } = await params;
  const query = await searchParams;
  const token = getSearchText(query?.token);
  const paymentStatus = getSearchText(query?.payment);
  const stripeSessionId = getSearchText(query?.session_id);
  const isCancelled = getSearchText(query?.cancelled) === "1";
  const hasCancelError = getSearchText(query?.cancelError) === "1";
  const sharedAccepted = getSearchText(query?.sharedAccepted) === "1";
  const sharedRejected = getSearchText(query?.sharedRejected) === "1";
  const sharedError = getSearchText(query?.sharedError) === "1";
  setRequestLocale(locale);

  const t = await getTranslations("BookingManage");
  const bookingT = await getTranslations("Booking");
  const common = await getTranslations("Common");
  if (paymentStatus === "success") {
    await confirmReturnedStripePayment({
      bookingId: id,
      sessionId: stripeSessionId,
      token,
    });
  }

  const booking = await getManagedBooking({ bookingId: id, token });
  const managePath = `/booking/manage/${id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  if (!booking) {
    redirect(`/${locale}/book`);
  }

  const canCancel = CANCELLABLE_STATUSES.has(booking.booking_status);
  const sharedJoinRequests = await getSharedJoinRequests(booking.id);
  const visibleSharedJoinRequests = sharedJoinRequests.filter((request) =>
    [
      "accepted",
      "authorized_pending_host_decision",
      "connected",
      "sent_to_main_booker",
    ].includes(request.status),
  );
  const tourLabelKey = TOUR_LABEL_KEYS[booking.tour_type];
  const tourLabel = tourLabelKey ? t(tourLabelKey) : formatValue(booking.tour_type);
  const isAuthorizationPending =
    booking.payment_status === "authorization_pending";
  const nextStepKey = isAuthorizationPending
    ? "nextStepAuthorizationPending"
    : NEXT_STEP_KEYS[booking.booking_status];
  const pageTitleKey = PAGE_TITLE_KEYS[booking.booking_status] ?? "title";
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasPromoDiscount = (booking.promo_discount_eur ?? 0) > 0;
  const connectedSharedRequestExists = visibleSharedJoinRequests.some(
    (request) =>
      ["accepted", "connected"].includes(request.status) &&
      request.payment_status === "captured",
  );
  const closedSharedRequestExists = visibleSharedJoinRequests.some(
    (request) =>
      request.status === "released" ||
      request.payment_status === "released" ||
      request.payment_status === "refunded",
  );
  const finalReservationFee =
    booking.final_reservation_fee_eur ?? booking.reservation_fee_eur;
  const showSharedLink =
    booking.booking_status === "confirmed" &&
    booking.payment_status === "captured" &&
    booking.is_shared_open &&
    booking.shared_status === "open" &&
    booking.shared_public_token;
  const showSharedPending =
    booking.is_shared_open &&
    booking.shared_status === "pending_captain_confirmation";
  const showSharedConnected =
    booking.is_shared_open &&
    (booking.shared_status === "connected" ||
      connectedSharedRequestExists);
  const showSharedClosed =
    booking.is_shared_open &&
    !showSharedConnected &&
    (booking.booking_status === "cancelled" ||
      booking.shared_status === "cancelled" ||
      closedSharedRequestExists);
  const showSharedInfo = booking.is_shared_open;
  const sharedPublicPath = showSharedLink
    ? getSharedPublicPath({ locale, token: booking.shared_public_token })
    : "";
  const payOnBoardDue =
    showSharedConnected && typeof booking.pay_on_board_eur === "number"
      ? booking.pay_on_board_eur / 2
      : booking.pay_on_board_eur;
  const customerTotal =
    typeof finalReservationFee === "number" && typeof payOnBoardDue === "number"
      ? finalReservationFee + payOnBoardDue
      : null;
  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path={managePath} />
      <section className="mx-auto grid max-w-5xl gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-8">
        <div className="border-t border-stone-300 pt-8">
    
          <p className="mt-12 text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t(pageTitleKey)}
          </h1>
          <p className="mt-6 text-lg font-light leading-8 text-stone-600">
            {t("subtitle")}
          </p>
          <BoatPreviewCard
            labels={{
              alt: bookingT("boatPreviewAlt"),
              eyebrow: bookingT("boatPreviewEyebrow"),
              text: bookingT("boatPreviewText"),
              title: bookingT("boatPreviewTitle"),
            }}
          />
        </div>

        <div className="bg-[#fbf8f3] p-6 shadow-sm sm:p-10">
          {isCancelled ? (
            <div className="mb-6 border border-stone-950 bg-[#f3eee7] p-4 text-sm leading-6 text-stone-700">
              {t("cancelSuccess")}
            </div>
          ) : null}
          {hasCancelError ? (
            <div className="mb-6 border border-red-900/40 bg-[#f3eee7] p-4 text-sm leading-6 text-red-900">
              {t("cancelError")}
            </div>
          ) : null}
          {sharedAccepted ? (
            <div className="mb-6 border border-emerald-900/30 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              {t("sharedRequestAccepted")}
            </div>
          ) : null}
          {sharedRejected ? (
            <div className="mb-6 border border-stone-950 bg-[#f3eee7] p-4 text-sm leading-6 text-stone-700">
              {t("sharedRequestRejected")}
            </div>
          ) : null}
          {sharedError ? (
            <div className="mb-6 border border-red-900/40 bg-[#f3eee7] p-4 text-sm leading-6 text-red-900">
              {t("sharedRequestError")}
            </div>
          ) : null}

          <h2 className="text-2xl font-light tracking-[-0.03em]">
            {t("summaryTitle")}
          </h2>
          <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
            <SummaryItem label={t("name")} value={booking.customer_name} />
            <SummaryItem
              label={t("date")}
              value={formatCustomerDate(booking.requested_date, locale)}
            />
            <SummaryItem
              label={t("time")}
              value={booking.time_window || booking.time_slot}
            />
            <SummaryItem label={t("tour")} value={tourLabel} />
            <SummaryItem label={t("guests")} value={booking.guest_count} />
          </div>

          {nextStepKey ? (
            <section className="mt-8 border border-stone-300 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("nextStepTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {t(nextStepKey)}
              </p>
            </section>
          ) : null}

          <PricingSection
            title={t("pricingTitle")}
            total={formatEuro(customerTotal)}
          >
            <SummaryItem
              label={t("totalPrice")}
              value={formatEuro(customerTotal)}
            />
            {hasPromoDiscount ? (
              <SummaryItem
                label={t("promoDiscount")}
                value={`-${formatEuro(booking.promo_discount_eur)}`}
              />
            ) : null}
            <SummaryItem
              label={t("reservationFee")}
              value={formatEuro(finalReservationFee)}
            />
            <SummaryItem
              label={t("payOnBoard")}
              note={showSharedConnected ? t("sharedPayOnBoardNote") : null}
              value={
                showSharedConnected
                  ? formatSharedPayOnBoardSplit(booking.pay_on_board_eur)
                  : formatEuro(booking.pay_on_board_eur)
              }
            />
          </PricingSection>

          {booking.booking_status === "payment_pending" ||
          booking.payment_status === "authorization_pending" ? (
            <div className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("paymentTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {stripeConfigured
                  ? t("paymentReadyNote")
                  : t("paymentMissingLink")}
              </p>
              {stripeConfigured ? (
                <StripeCheckoutButton
                  bookingId={booking.id}
                  labels={{
                    default: t("paymentButton"),
                    error: t("paymentError"),
                    pending: t("paymentRedirecting"),
                  }}
                  token={token}
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-[#f3eee7] opacity-50 sm:w-auto"
                >
                  {t("paymentUnavailableButton")}
                </button>
              )}
            </div>
          ) : null}

          {booking.payment_status === "authorized" ? (
            <div className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("paymentTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {t("paymentAuthorized")}
              </p>
            </div>
          ) : null}

          {booking.payment_status === "released" ? (
            <div className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("paymentTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {t("paymentReleased")}
              </p>
            </div>
          ) : null}

          {booking.payment_status === "refunded" ? (
            <div className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("paymentTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {t("paymentRefunded")}
              </p>
            </div>
          ) : null}

          {showSharedInfo ? (
            <section className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("sharedLinkTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {showSharedLink
                  ? t("sharedLinkBody")
                  : showSharedPending
                    ? t("sharedLinkPending")
                    : showSharedConnected
                      ? t("sharedRequestConnectedBody")
                      : showSharedClosed
                        ? t("sharedRequestClosedBody")
                        : t("sharedRequestReviewBody")}
              </p>
              {showSharedLink ? (
                <CopySharedLinkButton
                  label={t("sharedLinkCopyButton")}
                  labels={{
                    close: t("sharedLinkQrClose"),
                    copied: t("sharedLinkCopied"),
                    copyFailed: t("sharedLinkCopyFailed"),
                    qrButton: t("sharedLinkQrButton"),
                    qrCopyButton: t("sharedLinkQrCopyButton"),
                    qrCopyCopied: t("sharedLinkQrCopyCopied"),
                    qrCopyFailed: t("sharedLinkQrCopyFailed"),
                    qrDescription: t("sharedLinkQrDescription"),
                    qrTitle: t("sharedLinkQrTitle"),
                  }}
                  path={sharedPublicPath}
                />
              ) : null}
              {visibleSharedJoinRequests.length > 0 ? (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {t("sharedRequestsTitle")}
                  </p>
                  {visibleSharedJoinRequests.map((request) => (
                    <SharedJoinRequestCard
                      key={request.id}
                      bookingStatus={booking.booking_status}
                      bookingId={booking.id}
                      labels={{
                        acceptButton: t("sharedRequestAcceptButton"),
                        acceptPendingButton: t("sharedRequestAcceptPendingButton"),
                        genderComposition: t("sharedRequestGenderComposition"),
                        genderCompositionValues: {
                          all_female: t("sharedRequestAllFemale"),
                          all_male: t("sharedRequestAllMale"),
                          mixed: t("sharedRequestMixed"),
                          prefer_not_to_say: t("sharedRequestPreferNotToSay"),
                        },
                        guests: t("guests"),
                        name: t("name"),
                        rejectButton: t("sharedRequestRejectButton"),
                        rejectPendingButton: t("sharedRequestRejectPendingButton"),
                      }}
                      locale={locale}
                      request={request}
                      token={token}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {booking.booking_status === "confirmed" ? (
            <section className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("tourLogisticsTitle")}
              </p>
              <div className="mt-5 space-y-4">
                <TourLogisticsItem
                  href={MEETING_POINT_MAP_URL}
                  label={t("departurePointTitle")}
                  value={t("departurePointText")}
                />
                <MeetUpPhotoGallery
                  photos={MEET_UP_PHOTOS}
                  labels={{
                    close: t("meetUpPhotoClose"),
                    hint: t("meetUpPhotoHint"),
                    next: t("meetUpPhotoNext"),
                    open: t("meetUpPhotoOpen"),
                    photoAlt: t("meetUpPhotoAlt"),
                    previous: t("meetUpPhotoPrevious"),
                    title: t("meetUpPhotosTitle"),
                  }}
                />
                <TourLogisticsItem
                  href={CAPTAIN_PHONE_HREF}
                  label={t("captainPhoneTitle")}
                  value={`${t("captainPhoneText")} ${CAPTAIN_PHONE}`}
                />
                <TourLogisticsItem
                  label={t("toiletTitle")}
                  value={t("toiletText")}
                />
                <TourLogisticsItem
                  label={t("boatModelTitle")}
                  value={t("boatModelText")}
                />
              </div>
            </section>
          ) : null}

          <div className="mt-8">
            {canCancel ? (
              <CustomerCancelBookingForm
                bookingId={booking.id}
                labels={{
                  cancelButton: t("cancelButton"),
                  cancelTitle: t("cancelTitle"),
                  cancellingButton: t("cancellingButton"),
                  confirmButton: t("confirmCancelButton"),
                  confirmMessage: t("cancelConfirmMessage"),
                  keepButton: t("keepBookingButton"),
                  reasonLabel: t("reasonLabel"),
                  reasonPlaceholder: t("reasonPlaceholder"),
                }}
                locale={locale}
                token={token}
              />
            ) : booking.booking_status === "confirmed" ? (
              <p className="border-l border-stone-950 pl-5 text-sm leading-7 text-stone-600">
                {t("confirmedMessage")}
              </p>
            ) : (
              <p className="border-l border-stone-950 pl-5 text-sm leading-7 text-stone-600">
                {t("cannotCancelMessage")}
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
