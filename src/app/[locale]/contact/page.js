import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/contact";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("contact", locale);
}

export default async function ContactPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  const common = await getTranslations("Common");

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path="/contact" />

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-24">
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
            {t("text")}
          </p>
        </div>

        <section className="mt-12 border border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            {t("emailLabel")}
          </p>
          <a
            href={`mailto:${PUBLIC_CONTACT_EMAIL}`}
            className="mt-4 inline-block text-2xl font-light tracking-[-0.03em] underline decoration-stone-400 underline-offset-8 transition hover:text-stone-600"
          >
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </section>

        <Link
          href={`/${locale}/book`}
          className="mt-8 inline-block border border-stone-950 bg-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
        >
          {t("backToBooking")}
        </Link>
      </section>
    </main>
  );
}
