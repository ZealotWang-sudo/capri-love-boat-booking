import Link from "next/link";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import AutoImageCarousel from "@/components/AutoImageCarousel";
import HomeScrollReveal from "@/components/HomeScrollReveal";
import RouteMap from "@/components/RouteMap.jsx";
import SectionLink from "@/components/SectionLink";
import SiteHeader from "@/components/SiteHeader";
import { buildPageMetadata } from "@/lib/seo";

function OnBoardIcon({ type }) {
  const iconProps = {
    "aria-hidden": "true",
    className: "mx-auto h-6 w-6",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.5,
    viewBox: "0 0 24 24",
  };

  if (type === "wine") {
    return (
      <svg {...iconProps}>
        <path d="M8 3h8l-1 8a3 3 0 0 1-6 0L8 3Z" />
        <path d="M12 14v7" />
        <path d="M9 21h6" />
        <path d="M9 7h6" />
      </svg>
    );
  }

  if (type === "towel") {
    return (
      <svg {...iconProps}>
        <path d="M6 5h12v14H6z" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  if (type === "snorkeling") {
    return (
      <svg {...iconProps}>
        <path d="M4 15c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
        <path d="M4 19c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
        <path d="M9 4h6v5H9z" />
        <path d="M12 9v3" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <path d="M8 4h8l1 15H7L8 4Z" />
      <path d="M9 8h6" />
      <path d="M10 12h4" />
    </svg>
  );
}

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("home", locale);
}

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
    {
      icon: "softDrinks",
      titleKey: "includedSoftDrinksTitle",
    },
    {
      icon: "towel",
      titleKey: "includedTowelsTitle",
    },
    {
      icon: "wine",
      titleKey: "includedWineTitle",
    },
    {
      icon: "snorkeling",
      titleKey: "includedSnorkelingTitle",
    },
  ];
  const onBoardImages = [
    {
      altKey: "highlightOneTitle",
      src: "/carousel/carousel-1.jpeg",
    },
    {
      altKey: "highlightTwoTitle",
      src: "/carousel/carousel-2.JPG",
    },
    {
      altKey: "highlightThreeTitle",
      src: "/carousel/carousel-3.jpeg",
    },
    {
      altKey: "highlightOneTitle",
      src: "/carousel/carousel-4.jpg",
    },
    {
      altKey: "highlightTwoTitle",
      src: "/carousel/carousel-5.jpg",
    },
    {
      altKey: "highlightThreeTitle",
      src: "/carousel/carousel-6.jpg",
    },
    {
      altKey: "routeMarkerTen",
      src: "/carousel/carousel-7.jpg",
    },
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
  const onBoardCarouselImages = onBoardImages.map(({ altKey, src }) => ({
    alt: t(altKey),
    src,
  }));

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <HomeScrollReveal />
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
          <div
            className="max-w-4xl min-w-0 is-visible"
            data-scroll-reveal="fade"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/75 sm:text-xs sm:tracking-[0.35em]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-6 max-w-full break-words text-4xl font-extralight leading-[1.05] tracking-[-0.045em] sm:text-7xl sm:leading-[0.98] lg:text-[5.7rem]">
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

      <section
        className="relative isolate overflow-hidden border-b border-stone-300/70 py-24 sm:py-32"
        id="tour"
      >
        <div
          className="pointer-events-none absolute right-[0px] top-0 z-0 h-60 w-[40vw] "
          aria-hidden="true"
        >
          <Image
            src="/section-graphics/section-graphics-1.png"
            alt=""
            fill
            sizes="(max-width: 640px) 92vw, (max-width: 768px) 78vw, (max-width: 1024px) 52vw, (max-width: 1280px) 42vw, 36rem"
            className="object-contain object-right-top"
          />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
          <div data-scroll-reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("whyEyebrow")}
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("whyTitle")}
            </h2>
            <p className="mt-8 max-w-2xl text-lg font-light leading-8 text-stone-600">
              {t("whySubtitle")}
            </p>
            <div className="mt-16 grid gap-10 md:grid-cols-3">
              {whyCards.map(([titleKey, textKey], index) => (
                <article
                  key={titleKey}
                  className="border-t border-stone-300 pt-6"
                  data-scroll-reveal
                  style={{ "--reveal-delay": `${index * 90}ms` }}
                >
                  <h3 className="text-xl font-normal">{t(titleKey)}</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-600">
                    {t(textKey)}
                  </p>
                </article>
              ))}
            </div>
          </div>
          <nav
            aria-label="Page sections"
            className="mx-auto mt-20 grid max-w-5xl gap-3 sm:grid-cols-4 sm:gap-5"
            data-scroll-reveal
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
        className="relative isolate overflow-hidden border-b border-stone-300/70 bg-[#f3eee7] pb-24 sm:pb-32"
        id="highlights"
      >
        <AutoImageCarousel images={onBoardCarouselImages} />

        <div
          className="pointer-events-none absolute right-[-100px] top-[250px] z-10 h-56 w-[92vw] sm:top-[350px] sm:right-[-100px] md:top-[350px] md:right-[-100px] lg:top-[400px] "
          aria-hidden="true"
        >
          <Image
            src="/section-graphics/section-graphics-2.png"
            alt=""
            fill
            sizes="(max-width: 640px) 92vw, (max-width: 768px) 72vw, (max-width: 1024px) 52vw, (max-width: 1280px) 42vw, 34rem"
            className="object-contain object-right-top"
          />
        </div>

        <div className="relative z-0 mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-28">
          <div data-scroll-reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("highlightsEyebrow")}
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("highlightsTitle")}
            </h2>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {highlights.map(({ titleKey, textKey }, index) => (
              <article
                key={titleKey}
                className="border-t border-stone-300 pt-8"
                data-scroll-reveal
                style={{ "--reveal-delay": `${index * 90}ms` }}
              >
                <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
                  0{index + 1}
                </p>
                <h3 className="mt-4 text-2xl font-normal">{t(titleKey)}</h3>
                <p className="mt-4 leading-7 text-stone-600">{t(textKey)}</p>
              </article>
            ))}
          </div>

          <div data-scroll-reveal>
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
        </div>
      </section>

      <section
        className="border-b border-stone-300/70 bg-[#f3eee7] py-24 sm:py-32"
        id="included"
      >
        <div
          className="mx-auto max-w-6xl px-5 text-center sm:px-8"
          data-scroll-reveal
        >
          <div className="mx-auto max-w-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("includedEyebrow")}
            </p>
            <h2 className="mt-4 text-3xl font-light leading-tight tracking-[-0.03em] sm:text-5xl">
              {t("onBoardTitle")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-stone-700">
              {t("includedSubtitle")}
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {includedItems.map(({ icon, titleKey }, index) => (
              <article
                key={titleKey}
                className="text-center text-stone-950"
                data-scroll-reveal
                style={{ "--reveal-delay": `${index * 70}ms` }}
              >
                <OnBoardIcon type={icon} />
                <h3 className="mx-auto mt-4 max-w-[9rem] text-sm font-normal leading-5">
                  {t(titleKey)}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="bg-[#1f1b17] py-24 text-[#f3eee7] sm:py-32"
        id="booking-steps"
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-scroll-reveal>
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
                data-scroll-reveal
                style={{ "--reveal-delay": `${index * 90}ms` }}
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
          <div data-scroll-reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
              {t("faqEyebrow")}
            </p>
            <h2 className="mt-6 max-w-xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
              {t("faqTitle")}
            </h2>
          </div>
          <div className="space-y-8">
            {faqs.map(([questionKey, answerKey], index) => (
              <article
                key={questionKey}
                className="border-t border-stone-300 pt-8"
                data-scroll-reveal
                style={{ "--reveal-delay": `${index * 80}ms` }}
              >
                <h3 className="text-xl font-normal">{t(questionKey)}</h3>
                <p className="mt-4 leading-7 text-stone-600">{t(answerKey)}</p>
              </article>
            ))}
            <Link
              href={`/${locale}/faq`}
              className="inline-block border border-stone-950 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7]"
              data-scroll-reveal
            >
              {t("faqFullButton")}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32" id="request">
        <div className="mx-auto max-w-4xl text-center" data-scroll-reveal>
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
