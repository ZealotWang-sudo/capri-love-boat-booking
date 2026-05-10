import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BookingForm from "@/components/BookingForm";
import { POLICY_ITEM_KEYS } from "@/components/PolicyContent";
import SiteHeader from "@/components/SiteHeader";
import {
  getDisplayTimeForTimeSlot,
  getValidTimeSlotsForTour,
} from "@/lib/bookingAvailability";
import { buildPageMetadata } from "@/lib/seo";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import {
  formatEuro,
  getActiveTourPrices,
  getTourPriceDisplayName,
  isTourPricesTableMissing,
} from "@/lib/tourPrices";

const TIME_SLOT_LABEL_KEYS = {
  afternoon_1330: "timeAfternoon1330",
  afternoon_1400: "timeAfternoon1400",
  morning_0930: "timeMorning0930",
  morning_1000: "timeMorning1000",
  sunset_1800: "timeSunset1800",
};

function buildTimeSlots(t, tourType) {
  return getValidTimeSlotsForTour(tourType).map((timeSlot) => ({
    label: t(TIME_SLOT_LABEL_KEYS[timeSlot]),
    value: timeSlot,
    window: getDisplayTimeForTimeSlot(timeSlot),
  }));
}

function buildTourOptions(tourPrices, locale, t) {
  return tourPrices
    .map((tourPrice) => ({
      label: getTourPriceDisplayName(tourPrice, locale),
      payOnBoard: formatEuro(tourPrice.pay_on_board_eur),
      price: formatEuro(tourPrice.total_price_eur),
      reserveToday: formatEuro(tourPrice.reservation_fee_eur),
      timeSlots: buildTimeSlots(t, tourPrice.tour_type),
      value: tourPrice.tour_type,
    }))
    .filter((option) => option.timeSlots.length > 0);
}

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("book", locale);
}

export default async function BookingPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");
  const policyT = await getTranslations("Policy");
  const common = await getTranslations("Common");
  const supabase = createSupabasePublicServerClient();
  const { data: tourPrices, error: tourPricesError } =
    await getActiveTourPrices(supabase);
  const tourOptions = buildTourOptions(tourPrices ?? [], locale, t);

  const labels = {
    name: t("name"),
    email: t("email"),
    confirmEmail: t("confirmEmail"),
    phone: t("phone"),
    phoneCountryCode: t("phoneCountryCode"),
    emailMismatch: t("emailMismatch"),
    date: t("date"),
    stepChooseDate: t("stepChooseDate"),
    stepChooseTour: t("stepChooseTour"),
    stepChooseTime: t("stepChooseTime"),
    stepPrice: t("stepPrice"),
    calendar: {
      locale,
      previous: t("calendarPrevious"),
      next: t("calendarNext"),
      previousMonth: t("calendarPreviousMonth"),
      nextMonth: t("calendarNextMonth"),
      available: t("calendarAvailable"),
      booked: t("calendarBooked"),
      partiallyBooked: t("calendarPartiallyBooked"),
      otherTourAvailable: t("calendarOtherTourAvailable"),
      unavailable: t("calendarUnavailable"),
      selectDate: t("calendarSelectDate"),
      today: t("calendarToday"),
      required: t("calendarRequired"),
      weekdays: [
        t("calendarSunday"),
        t("calendarMonday"),
        t("calendarTuesday"),
        t("calendarWednesday"),
        t("calendarThursday"),
        t("calendarFriday"),
        t("calendarSaturday"),
      ],
    },
    guests: t("guests"),
    tourType: t("tourType"),
    tourPlaceholder: t("tourPlaceholder"),
    tourInfoButton: t("tourInfoButton"),
    tourInfoTitle: t("tourInfoTitle"),
    tourInfoClose: t("tourInfoClose"),
    time: t("time"),
    timePlaceholder: t("timePlaceholder"),
    timeConfirmationNote: t("timeConfirmationNote"),
    timeUnavailable: t("timeUnavailable"),
    availabilityLoading: t("availabilityLoading"),
    allTimeSlotsBooked: t("allTimeSlotsBooked"),
    otherTourAvailableMessage: t.raw("otherTourAvailableMessage"),
    switchToTour: t("switchToTour"),
    timeNoLongerAvailable: t("timeNoLongerAvailable"),
    price: t("price"),
    pricePlaceholder: t("pricePlaceholder"),
    totalPrice: t("totalPrice"),
    reserveToday: t("reserveToday"),
    payOnBoard: t("payOnBoard"),
    message: t("message"),
    submit: t("submit"),
    submitting: t("submitting"),
    submitError: t("submitError"),
    policyModalTitle: t("policyModalTitle"),
    policyModalIntro: t("policyModalIntro"),
    policyModalAccept: t("policyModalAccept"),
    policyModalClose: t("policyModalClose"),
    policyRequired: t("policyRequired"),
    policy: {
      introTitle: policyT("introTitle"),
      introText: policyT("introText"),
      ...Object.fromEntries(
        POLICY_ITEM_KEYS.flatMap((itemKey) => [
          [`${itemKey}Title`, policyT(`${itemKey}Title`)],
          [`${itemKey}Text`, policyT(`${itemKey}Text`)],
        ]),
      ),
    },
    tourOptions,
  };

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path="/book" />

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <div className="border-t border-stone-300 pt-8">
          <Link
            href={`/${locale}`}
            className="text-xs uppercase tracking-[0.22em] text-stone-500 hover:text-stone-950"
          >
            {common("home")}
          </Link>
          <h1 className="mt-12 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 text-lg font-light leading-8 text-stone-600">
            {t("subtitle")}
          </p>
          <div className="mt-10 border-l border-stone-950 pl-5 text-sm leading-7 text-stone-600">
            {t("note")}
          </div>
          <div className="mt-10 border border-stone-300 bg-[#fbf8f3]">
            <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
              <Image
                src="/boat/boat-2.jpeg"
                alt={t("boatPreviewAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 36vw"
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                {t("boatPreviewEyebrow")}
              </p>
              <h2 className="mt-3 text-2xl font-light tracking-[-0.03em]">
                {t("boatPreviewTitle")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                {t("boatPreviewText")}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#fbf8f3] p-6 shadow-sm sm:p-10">
          {tourPricesError ? (
            <div className="mb-6 border border-red-900/30 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
              {isTourPricesTableMissing(tourPricesError)
                ? "Tour pricing is not configured yet. Please run the tour pricing SQL setup."
                : "Tour pricing could not be loaded. Please try again later."}
            </div>
          ) : null}
          <BookingForm locale={locale} labels={labels} />
        </div>
      </section>
    </main>
  );
}
