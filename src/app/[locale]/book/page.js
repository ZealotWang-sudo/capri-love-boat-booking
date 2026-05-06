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
    contact: t("contact"),
    date: t("date"),
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
    message: t("message"),
    submit: t("submit"),
    tourOptions: [
      {
        value: "2-hour",
        label: t("tourTwoHour"),
        price: t("tourTwoHourPrice"),
        info: t("tourTwoHourInfo"),
      },
      {
        value: "3-hour",
        label: t("tourThreeHour"),
        price: t("tourThreeHourPrice"),
        info: t("tourThreeHourInfo"),
      },
      {
        value: "sunset",
        label: t("tourSunset"),
        price: t("tourSunsetPrice"),
        info: t("tourSunsetInfo"),
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
