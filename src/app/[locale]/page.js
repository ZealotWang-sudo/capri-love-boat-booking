import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";

export default async function HomePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");

  const whyCards = [
    ["whyLocalTitle", "whyLocalText"],
    ["whyPrivateTitle", "whyPrivateText"],
    ["whyEasyTitle", "whyEasyText"],
  ];

  const highlights = [
    {
      titleKey: "highlightOneTitle",
      textKey: "highlightOneText",
      imageSrc: "/assets/images/blue-water.jpg",
    },
    {
      titleKey: "highlightTwoTitle",
      textKey: "highlightTwoText",
      imageSrc: "/assets/images/blue-grotte.jpeg",
    },
    {
      titleKey: "highlightThreeTitle",
      textKey: "highlightThreeText",
      imageSrc: "/assets/images/capri-view.jpeg",
    },
  ];

  const steps = [
    ["stepOneTitle", "stepOneText"],
    ["stepTwoTitle", "stepTwoText"],
    ["stepThreeTitle", "stepThreeText"],
  ];

  const faqs = [
    ["faqOneQuestion", "faqOneAnswer"],
    ["faqTwoQuestion", "faqTwoAnswer"],
    ["faqThreeQuestion", "faqThreeAnswer"],
  ];

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <section className="relative min-h-screen overflow-hidden text-white">
        <div className="absolute inset-0 bg-stone-950">
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          >
            <source src="/assets/videos/capri-hero-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-6 border border-white/20" />
          <div className="absolute right-8 top-24 hidden text-right text-xs uppercase tracking-[0.3em] text-white/55 sm:block">
    
            
          </div>
        </div>

        <SiteHeader brand={common("brand")} locale={locale} />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-end px-10 pb-14 sm:pb-24">
          <div className="max-w-4xl min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/75 sm:text-xs sm:tracking-[0.35em]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-6 max-w-full break-words text-4xl font-light leading-[1.02] tracking-[-0.04em] sm:text-7xl sm:leading-[0.95] lg:text-8xl">
              {t("title")}
            </h1>
            <p className="mt-7 max-w-2xl text-base font-light leading-8 text-white/80 sm:mt-8 sm:text-xl">
              {t("subtitle")}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={`/${locale}/book`}
                className="w-full border border-white bg-white px-5 py-4 text-center text-xs font-medium uppercase tracking-[0.16em] text-stone-950 transition hover:bg-transparent hover:text-white sm:w-auto sm:px-8 sm:tracking-[0.22em]"
              >
                {t("cta")}
              </Link>
              <Link
                href="#tour"
                className="w-full border border-white/45 px-5 py-4 text-center text-xs font-medium uppercase tracking-[0.16em] text-white transition hover:border-white sm:w-auto sm:px-8 sm:tracking-[0.22em]"
              >
                {t("secondaryCta")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-stone-300/70 py-24 sm:py-32" id="tour">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("whyEyebrow")}
            </p>
            <div className="mt-14 max-w-sm border-y border-stone-300 py-8">
              <Image
                src="/assets/images/island-iternary.png"
                alt="Capri Love Boat"
                width={1200}
                height={700}
                className="h-auto w-full mix-blend-multiply"
              />
            </div>
          </div>
          <div>
            <h2 className="max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("whyTitle")}
            </h2>
            <p className="mt-8 max-w-2xl text-lg font-light leading-8 text-stone-600">
              {t("whySubtitle")}
            </p>
            <div className="mt-16 grid gap-10 md:grid-cols-3">
              {whyCards.map(([titleKey, textKey]) => (
                <article
                  key={titleKey}
                  className="border-t border-stone-300 pt-6"
                >
                  <h3 className="text-xl font-normal">{t(titleKey)}</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-600">
                    {t(textKey)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
            {t("highlightsEyebrow")}
          </p>
          <h2 className="mt-6 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("highlightsTitle")}
          </h2>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {highlights.map(({ titleKey, textKey, imageSrc }, index) => (
              <article
                key={titleKey}
                className="group"
              >
                <div className="relative mb-8 aspect-[4/5] overflow-hidden bg-stone-200">
                  <Image
                    src={imageSrc}
                    alt={t(titleKey)}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
                <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
                  0{index + 1}
                </p>
                <h3 className="mt-4 text-2xl font-normal">{t(titleKey)}</h3>
                <p className="mt-4 leading-7 text-stone-600">{t(textKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1f1b17] py-24 text-[#f3eee7] sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/45">
              {t("howEyebrow")}
            </p>
            <h2 className="mt-6 max-w-xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("howTitle")}
            </h2>
          </div>
          <div className="space-y-8">
            {steps.map(([titleKey, textKey], index) => (
              <article
                key={titleKey}
                className="grid gap-6 border-t border-white/15 pt-8 sm:grid-cols-[120px_1fr]"
              >
                <p className="text-xs uppercase tracking-[0.26em] text-white/45">
                  {t("stepLabel")} 0{index + 1}
                </p>
                <div>
                  <h3 className="text-2xl font-light">{t(titleKey)}</h3>
                  <p className="mt-4 leading-7 text-white/60">{t(textKey)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-stone-300/70 py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("faqEyebrow")}
            </p>
            <h2 className="mt-6 max-w-xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("faqTitle")}
            </h2>
          </div>
          <div className="space-y-8">
            {faqs.map(([questionKey, answerKey]) => (
              <article
                key={questionKey}
                className="border-t border-stone-300 pt-8"
              >
                <h3 className="text-xl font-normal">{t(questionKey)}</h3>
                <p className="mt-4 leading-7 text-stone-600">{t(answerKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
            {t("finalEyebrow")}
          </p>
          <h2 className="mt-6 text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("finalTitle")}
          </h2>
          <p className="mx-auto mt-8 max-w-2xl text-lg font-light leading-8 text-stone-600">
            {t("finalText")}
          </p>
          <Link
            href={`/${locale}/book`}
            className="mt-10 inline-block border border-stone-950 px-9 py-4 text-xs font-medium uppercase tracking-[0.22em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7]"
          >
            {t("cta")}
          </Link>
        </div>
      </section>
    </main>
  );
}
