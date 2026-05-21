import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BookingRequestSummary from "@/components/BookingRequestSummary";
import ManageBookingLink from "@/components/ManageBookingLink";
import SiteHeader from "@/components/SiteHeader";

export default async function ThankYouPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ThankYou");
  const common = await getTranslations("Common");
  const summaryLabels = {
    title: t("summaryTitle"),
    reference: t("summaryReference"),
    name: t("summaryName"),
    email: t("summaryEmail"),
    phone: t("summaryPhone"),
    guests: t("summaryGuests"),
    date: t("summaryDate"),
    tour: t("summaryTour"),
    time: t("summaryTime"),
    totalPrice: t("summaryTotalPrice"),
    reserveToday: t("summaryReserveToday"),
    originalReservationFee: t("summaryOriginalReservationFee"),
    promoCode: t("summaryPromoCode"),
    promoDiscount: t("summaryPromoDiscount"),
    payOnBoard: t("summaryPayOnBoard"),
    message: t("summaryMessage"),
    manageBookingPage: t("manageBookingPage"),
  };

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path="/thank-you" />

      <section className="mx-auto flex max-w-3xl items-center px-5  sm:px-8 ">
        <div className="w-full py-10 border-stone-300  text-center ">
     
          <h1 className="mt-3 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-8 text-stone-600">
            {t("message")}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href={`/${locale}`}
              className="border border-stone-950 bg-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
            >
              {t("home")}
            </Link>
            <ManageBookingLink labels={summaryLabels} />
          </div>
          <BookingRequestSummary labels={summaryLabels} locale={locale} />
       
        </div>
      </section>
    </main>
  );
}
