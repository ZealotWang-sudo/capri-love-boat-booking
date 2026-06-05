import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CapriIslandGuideMap from "@/components/CapriIslandGuideMap.jsx";
import SiteHeader from "@/components/SiteHeader";
import { buildPageMetadata } from "@/lib/seo";

const GUIDE_PATH = "/guides/capri-one-day-travel-guide";

const GUIDE_STOP_KEYS = [
  "ferryToCapri",
  "walkToBoat",
  "privateBoat",
  "marinaGrandeLunch",
  "busToAnacapri",
  "monteSolaro",
  "villaSanMichele",
  "taxiToCapriTown",
  "capriTownWalk",
  "funicularToPort",
  "ferryToNaples",
];

const GUIDE_MAP_MARKERS = [
  {
    coordinates: [14.2388, 40.5569],
    descriptionKey: "marinaGrandeDescription",
    id: "marinaGrande",
    titleKey: "marinaGrandeTitle",
  },
  {
    coordinates: [14.2221, 40.5555],
    descriptionKey: "piazzaVittoriaDescription",
    id: "piazzaVittoria",
    titleKey: "piazzaVittoriaTitle",
  },
  {
    coordinates: [14.2137, 40.5446],
    descriptionKey: "monteSolaroDescription",
    id: "monteSolaro",
    titleKey: "monteSolaroTitle",
  },
  {
    coordinates: [14.2255, 40.5572],
    descriptionKey: "villaSanMicheleDescription",
    id: "villaSanMichele",
    titleKey: "villaSanMicheleTitle",
  },
  {
    coordinates: [14.2452, 40.5507],
    descriptionKey: "viaCamerelleDescription",
    id: "viaCamerelle",
    titleKey: "viaCamerelleTitle",
  },
  {
    coordinates: [14.2421, 40.5483],
    descriptionKey: "gardensDescription",
    id: "gardens",
    titleKey: "gardensTitle",
  },
];

function TimelineItem({ body, ctaHref, ctaLabel, index, time }) {
  return (
    <li className="relative pl-7">
      <span className="absolute left-[0px] top-0 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-[#9f462f] bg-[#b95535] text-[10px]  leading-none text-[#f8f1e7]">
        {index}
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b95535]">
        {time}
      </p>
      <p className="mt-2 max-w-[34rem] whitespace-pre-line leading-6 tracking-[0.08em] text-stone-950 sm:text-base sm:leading-7">
        {body}
      </p>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-4 inline-block border border-stone-950 bg-stone-950 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </li>
  );
}

export async function generateMetadata({ params }) {
  const { locale } = await params;

  return buildPageMetadata("capriIslandGuide", locale);
}

export default async function CapriIslandGuidePage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CapriIslandGuide");
  const common = await getTranslations("Common");

  const guideStops = GUIDE_STOP_KEYS.map((key, index) => ({
    body: t(`stops.${key}.body`),
    ctaHref: key === "privateBoat" ? `/${locale}/book` : undefined,
    ctaLabel: key === "privateBoat" ? t("bookingCta") : undefined,
    id: key,
    index: index + 1,
    time: t(`stops.${key}.time`),
  }));

  const mapMarkers = GUIDE_MAP_MARKERS.map((marker) => ({
    coordinates: marker.coordinates,
    description: t(`mapMarkers.${marker.descriptionKey}`),
    id: marker.id,
    title: t(`mapMarkers.${marker.titleKey}`),
  }));

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <SiteHeader brand={common("brand")} locale={locale} path={GUIDE_PATH} />

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-12">
        <div className="border-t border-stone-300 pt-8">
          <Link
            href={`/${locale}`}
            className="text-xs uppercase tracking-[0.22em] text-stone-500 hover:text-stone-950"
          >
            {common("home")}
          </Link>
          <p className="mt-10 text-xs uppercase tracking-[0.28em] text-stone-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-light leading-7 text-stone-600 sm:text-base">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] lg:items-start">
          <ol className="relative space-y-8 before:absolute before:left-0 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[#b95535] sm:space-y-10">
            {guideStops.map((stop) => (
              <TimelineItem
                key={stop.id}
                body={stop.body}
                ctaHref={stop.ctaHref}
                ctaLabel={stop.ctaLabel}
                index={stop.index}
                time={stop.time}
              />
            ))}
          </ol>

          <div className="lg:sticky lg:top-8">
            <CapriIslandGuideMap
              ariaLabel={t("mapAriaLabel")}
              mapLoading={t("mapLoading")}
              mapUnavailable={t("mapUnavailable")}
              markers={mapMarkers}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
