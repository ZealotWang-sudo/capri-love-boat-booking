import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CustomerCancelBookingForm from "@/components/CustomerCancelBookingForm";
import SiteHeader from "@/components/SiteHeader";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";

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

function getSearchText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

function formatValue(value) {
  return value || "-";
}

function SummaryItem({ label, value }) {
  return (
    <div className="border-b border-stone-200 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-stone-950">{formatValue(value)}</p>
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

export default async function ManageBookingPage({ params, searchParams }) {
  const { id, locale } = await params;
  const query = await searchParams;
  const token = getSearchText(query?.token);
  const isCancelled = getSearchText(query?.cancelled) === "1";
  const hasCancelError = getSearchText(query?.cancelError) === "1";
  setRequestLocale(locale);

  const t = await getTranslations("BookingManage");
  const common = await getTranslations("Common");
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

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path={managePath} />
      <section className="mx-auto grid max-w-5xl gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-8">
        <div className="border-t border-stone-300 pt-8">
    
          <p className="mt-12 text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("title")}
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
            <SummaryItem label={t("status")} value={statusLabel} />
          </div>

          {booking.booking_status === "payment_pending" ? (
            <div className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {t("paymentTitle")}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {t("paymentMockNote")}
              </p>
              <button
                type="button"
                disabled
                className="mt-5 w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-[#f3eee7] opacity-70 sm:w-auto"
              >
                {t("paymentButton")}
              </button>
            </div>
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
