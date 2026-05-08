import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import RouteMap from "@/components/RouteMap.jsx";
import SectionLink from "@/components/SectionLink";
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

  const includedItems = [
    ["includedSoftDrinksTitle", "includedSoftDrinksText"],
    ["includedWineTitle", "includedWineText"],
    ["includedTowelsTitle", "includedTowelsText"],
    ["includedFuelTitle", "includedFuelText"],
    ["includedSnorkelingTitle", "includedSnorkelingText"],
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
  const routeMarkerContent = {
    gennarino: {
      title: t("routeMarkerOne"),
      description: t("routeMarkerOneDescription"),
    },
    saltoTiberio: {
      title: t("routeMarkerTwo"),
      description: t("routeMarkerTwoDescription"),
    },
    grottaBianca: {
      title: t("routeMarkerThree"),
      description: t("routeMarkerThreeDescription"),
    },
    arcoNaturale: {
      title: t("routeMarkerFour"),
      description: t("routeMarkerFourDescription"),
    },
    villaMalaparte: {
      title: t("routeMarkerFive"),
      description: t("routeMarkerFiveDescription"),
    },
    grottaTragara: {
      title: t("routeMarkerSix"),
      description: t("routeMarkerSixDescription"),
    },
    faraglioni: {
      title: t("routeMarkerSeven"),
      description: t("routeMarkerSevenDescription"),
    },
    marinaPiccola: {
      title: t("routeMarkerEight"),
      description: t("routeMarkerEightDescription"),
    },
    grottaVerde: {
      title: t("routeMarkerNine"),
      description: t("routeMarkerNineDescription"),
    },
    puntaCarena: {
      title: t("routeMarkerTen"),
      description: t("routeMarkerTenDescription"),
    },
    grottaCuore: {
      title: t("routeMarkerEleven"),
      description: t("routeMarkerElevenDescription"),
    },
    blueGrotto: {
      title: t("routeMarkerTwelve"),
      description: t("routeMarkerTwelveDescription"),
    },
  };

  const steps = [
    ["stepOneTitle", "stepOneText"],
    ["stepTwoTitle", "stepTwoText"],
    ["stepThreeTitle", "stepThreeText"],
  ];

  const faqs = [
    ["faqOneQuestion", "faqOneAnswer"],
    ["faqTwoQuestion", "faqTwoAnswer"],
    ["faqThreeQuestion", "faqThreeAnswer"],
    ["faqFourQuestion", "faqFourAnswer"],
  ];

  const sectionNavLinks = [
    { href: "#included", label: t("includedEyebrow") },
    { href: "#highlights", label: t("highlightsEyebrow") },
    { href: "#booking-steps", label: t("howEyebrow") },
    { href: "#faq", label: t("faqEyebrow") },
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
            poster="/assets/Videos/capri-hero-video-first-frame.png"
            aria-hidden="true"
          >
            <source src="/assets/Videos/capri-hero-video.mp4" type="video/mp4" />
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
              <SectionLink
                href="#tour"
                className="w-full border border-white/45 px-5 py-4 text-center text-xs font-medium uppercase tracking-[0.16em] text-white transition hover:border-white sm:w-auto sm:px-8 sm:tracking-[0.22em]"
              >
                {t("secondaryCta")}
              </SectionLink>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-stone-300/70 py-24 sm:py-32" id="tour">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                {t("whyEyebrow")}
              </p>
              <div className="mt-14 w-full border-stone-300 ">
                <Image
                  src="/assets/images/capri-why-choose-us-image.jpeg"
                  alt="Capri Love Boat"
                    width={2400}
                    height={2400}
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
          <nav
            aria-label="Page sections"
            className="mx-auto mt-20 grid max-w-5xl gap-3 sm:grid-cols-4 sm:gap-5"
          >
            {sectionNavLinks.map(({ href, label }) => (
              <SectionLink
                key={href}
                href={href}
                className="border border-stone-950/25 px-5 py-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-stone-950 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]"
              >
                {label}
              </SectionLink>
            ))}
          </nav>
        </div>
      </section>

      <section
        className="border-b border-stone-300/70 bg-[#fbf8f3] py-24 sm:py-32"
        id="included"
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("includedEyebrow")}
            </p>
            <h2 className="mt-6 max-w-xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("includedTitle")}
            </h2>
            <p className="mt-8 max-w-2xl text-lg font-light leading-8 text-stone-600">
              {t("includedSubtitle")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {includedItems.map(([titleKey, textKey], index) => (
              <article
                key={titleKey}
                className={`border border-stone-300 bg-[#f3eee7] p-6 ${
                  index === 0 ? "sm:col-span-2" : ""
                }`}
              >
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  0{index + 1}
                </p>
                <h3 className="mt-4 text-2xl font-normal">{t(titleKey)}</h3>
                <p className="mt-4 text-sm leading-7 text-stone-600">
                  {t(textKey)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32" id="highlights">
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
          <RouteMap
            eyebrow={t("routeEyebrow")}
            listLabel={t("routeListLabel")}
            mapUnavailable={t("routeMapUnavailable")}
            markerContent={routeMarkerContent}
            routeStopLabel={t("routeStopLabel")}
            subtitle={t("routeSubtitle")}
            title={t("routeTitle")}
          />
        </div>
      </section>

      <section
        className="bg-[#1f1b17] py-24 text-[#f3eee7] sm:py-32"
        id="booking-steps"
      >
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

      <section
        className="border-b border-stone-300/70 py-24 sm:py-32"
        id="faq"
      >
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
            <Link
              href={`/${locale}/faq`}
              className="inline-block border border-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7]"
            >
              {t("faqFullButton")}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32" id="request">
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
