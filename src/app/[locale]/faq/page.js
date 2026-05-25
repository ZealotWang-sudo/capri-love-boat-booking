import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import FaqAccordion from "@/components/FaqAccordion";
import SiteHeader from "@/components/SiteHeader";
import { buildPageMetadata } from "@/lib/seo";

const FAQ_ITEM_KEYS = [
  "bookingConfirmation",
  "blueGrotto",
  "tourIncluded",
  "weather",
  "reservationFee",
  "remainingBalance",
  "cancellation",
  "lateArrival",
  "route",
  "swimming",
  "afterSwimming",
  "meetingPoint",
  "whatToBring",
];

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("faq", locale);
}

export default async function FaqPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Faq");
  const common = await getTranslations("Common");

  const faqItems = FAQ_ITEM_KEYS.map((itemKey) => ({
    id: itemKey,
    question: t(`${itemKey}Question`),
    answer: t(`${itemKey}Answer`),
  }));

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path="/faq" />

      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="border-t border-stone-300 pt-8">
          <Link
            href={`/${locale}`}
            className="text-xs uppercase tracking-[0.22em] text-stone-500 hover:text-stone-950"
          >
            {common("home")}
          </Link>
          <p className="mt-12 text-xs uppercase tracking-[0.22em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-light leading-8 text-stone-600">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-12">
          <FaqAccordion
            items={faqItems}
            labels={{
              noResults: t("noResults"),
              searchLabel: t("searchLabel"),
              searchPlaceholder: t("searchPlaceholder"),
            }}
          />
        </div>

        <section className="mt-12 border-t border-stone-300 pt-8">
          <h2 className="text-2xl font-light tracking-[-0.03em]">
            {t("stillHaveQuestionsTitle")}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            {t("stillHaveQuestionsText")}
          </p>
          <Link
            href={`/${locale}/book`}
            className="mt-6 inline-block border border-stone-950 bg-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
          >
            {t("requestButton")}
          </Link>
        </section>
      </section>
    </main>
  );
}
