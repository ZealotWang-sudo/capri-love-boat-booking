import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BookingForm from "@/components/BookingForm";
import SiteHeader from "@/components/SiteHeader";

export default async function BookingPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");
  const common = await getTranslations("Common");

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
    tourOptions: [
      {
        value: "three_hours",
        label: t("tourThreeHour"),
        price: t("tourThreeHourPrice"),
        totalPriceEur: 350,
        reserveToday: t("tourThreeHourReserveToday"),
        reservationFeeEur: 70,
        payOnBoard: t("tourThreeHourPayOnBoard"),
        payOnBoardEur: 280,
        timeSlots: [
          { value: "morning", label: t("timeMorning"), window: "09:30-10:00" },
          {
            value: "afternoon",
            label: t("timeAfternoon"),
            window: "13:30-14:00",
          },
        ],
      },
      {
        value: "four_hours",
        label: t("tourFourHour"),
        price: t("tourFourHourPrice"),
        totalPriceEur: 450,
        reserveToday: t("tourFourHourReserveToday"),
        reservationFeeEur: 90,
        payOnBoard: t("tourFourHourPayOnBoard"),
        payOnBoardEur: 360,
        timeSlots: [
          { value: "morning", label: t("timeMorning"), window: "09:30-10:00" },
          {
            value: "afternoon",
            label: t("timeAfternoon"),
            window: "13:30-14:00",
          },
        ],
      },
      {
        value: "sunset_three_hours",
        label: t("tourSunsetThreeHour"),
        price: t("tourSunsetThreeHourPrice"),
        totalPriceEur: 380,
        reserveToday: t("tourSunsetThreeHourReserveToday"),
        reservationFeeEur: 100,
        payOnBoard: t("tourSunsetThreeHourPayOnBoard"),
        payOnBoardEur: 280,
        timeSlots: [{ value: "sunset", label: t("timeSunset"), window: "18:00" }],
      },
      {
        value: "five_hours",
        label: t("tourFiveHour"),
        price: t("tourFiveHourPrice"),
        totalPriceEur: 570,
        reserveToday: t("tourFiveHourReserveToday"),
        reservationFeeEur: 120,
        payOnBoard: t("tourFiveHourPayOnBoard"),
        payOnBoardEur: 450,
        timeSlots: [
          { value: "morning", label: t("timeMorning"), window: "09:30-10:00" },
        ],
      },
    ],
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
        </div>

        <div className="bg-[#fbf8f3] p-6 shadow-sm sm:p-10">
          <BookingForm locale={locale} labels={labels} />
        </div>
      </section>
    </main>
  );
}
