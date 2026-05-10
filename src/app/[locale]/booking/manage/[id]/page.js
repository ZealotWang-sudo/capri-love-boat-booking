import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CustomerCancelBookingForm from "@/components/CustomerCancelBookingForm";
import MeetUpPhotoGallery from "@/components/MeetUpPhotoGallery";
import SiteHeader from "@/components/SiteHeader";
import StripeCheckoutButton from "@/components/StripeCheckoutButton";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import { buildPageMetadata } from "@/lib/seo";
import { confirmBookingPaymentFromSession } from "@/lib/stripe/confirmBookingPayment";

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
const STATUS_LABEL_KEYS = {
  cancelled: "statusCancelled",
  checking_with_captain: "statusCheckingWithCaptain",
  completed: "statusCompleted",
  confirmed: "statusConfirmed",
  expired: "statusExpired",
  not_available: "statusNotAvailable",
  payment_pending: "statusPaymentPending",
  requested: "statusRequested",
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
  "/meet-up-point/meet-up1.jpg",
  "/meet-up-point/meet-up2.jpg",
  "/meet-up-point/meet-up3.jpg",
];
const CAPTAIN_PHONE = "+39 339 665 0836";
const CAPTAIN_PHONE_HREF = "tel:+393396650836";

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("manage", locale, { noIndex: true });
}

function getSearchText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

function formatValue(value) {
  return value || "-";
}

function SummaryItem({ fullWidth = false, label, value }) {
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
    </div>
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

async function getManagedBooking({ bookingId, token }) {
  if (!bookingId || !token) {
    return null;
  }

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase
    .rpc("get_customer_managed_booking", {
      p_booking_id: bookingId,
      p_manage_token: token,
    })
    .maybeSingle();

  if (error) {
    console.error("[customer booking manage]", error.message);
    return null;
  }

  return data;
}

async function confirmReturnedStripePayment({ bookingId, sessionId, token }) {
  if (!bookingId || !sessionId || !token) {
    return;
  }

  try {
    await confirmBookingPaymentFromSession({
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
  setRequestLocale(locale);

  const t = await getTranslations("BookingManage");
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
    return (
      <main className="min-h-screen bg-[#f3eee7] text-stone-950">
        <SiteHeader brand={common("brand")} locale={locale} path={managePath} />
        <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-6 text-4xl font-light tracking-[-0.03em] sm:text-6xl">
            {t("invalidTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-8 text-stone-600">
            {t("invalidMessage")}
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

  const canCancel = CANCELLABLE_STATUSES.has(booking.booking_status);
  const tourLabelKey = TOUR_LABEL_KEYS[booking.tour_type];
  const tourLabel = tourLabelKey ? t(tourLabelKey) : formatValue(booking.tour_type);
  const statusLabelKey = STATUS_LABEL_KEYS[booking.booking_status];
  const statusLabel = statusLabelKey
    ? t(statusLabelKey)
    : formatValue(booking.booking_status);
  const nextStepKey = NEXT_STEP_KEYS[booking.booking_status];
  const pageTitleKey = PAGE_TITLE_KEYS[booking.booking_status] ?? "title";
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

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

          <h2 className="text-2xl font-light tracking-[-0.03em]">
            {t("summaryTitle")}
          </h2>
          <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
            <SummaryItem label={t("name")} value={booking.customer_name} />
            <SummaryItem label={t("date")} value={booking.requested_date} />
            <SummaryItem
              label={t("time")}
              value={booking.time_window || booking.time_slot}
            />
            <SummaryItem label={t("tour")} value={tourLabel} />
            <SummaryItem label={t("guests")} value={booking.guest_count} />
            <SummaryItem
              label={t("totalPrice")}
              value={formatEuro(booking.total_price_eur)}
            />
            <SummaryItem
              label={t("reservationFee")}
              value={formatEuro(booking.reservation_fee_eur)}
            />
            <SummaryItem
              label={t("payOnBoard")}
              value={formatEuro(booking.pay_on_board_eur)}
            />
            <SummaryItem fullWidth label={t("status")} value={statusLabel} />
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

          {booking.booking_status === "payment_pending" ? (
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

          {booking.booking_status === "confirmed" ? (
            <div className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("paymentTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {t("reservationFeeReceived")}
              </p>
            </div>
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
