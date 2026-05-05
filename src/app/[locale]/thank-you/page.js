import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";

export default async function ThankYouPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ThankYou");
  const common = await getTranslations("Common");

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path="/thank-you" />

      <section className="mx-auto flex max-w-3xl items-center px-5 py-24 sm:px-8 sm:py-32">
        <div className="w-full border-y border-stone-300 py-14 text-center sm:py-20">
          <div className="mx-auto flex size-16 items-center justify-center border border-stone-950 text-xs uppercase tracking-[0.22em]">
            OK
          </div>
          <h1 className="mt-10 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
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
            <Link
              href={`/${locale}/book`}
              className="border border-stone-300 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            >
              {t("bookAgain")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
