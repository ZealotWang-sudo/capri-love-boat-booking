export const SITE_URL = "https://capriloveboat.com";
export const SITE_NAME = "Capri Love Boat";
export const OG_IMAGE = "/assets/images/capri-hero-image.jpg";

const LANGUAGE_ALTERNATES = {
  en: "/en",
  it: "/it",
  zh: "/zh",
};

const LOCALE_CODES = {
  en: "en_US",
  it: "it_IT",
  zh: "zh_CN",
};

const PAGE_SEO = {
  home: {
    en: {
      title: "Capri Private Boat Tours | Capri Love Boat",
      description:
        "Book a private boat tour around Capri with a local captain. Explore Faraglioni, Marina Piccola, Grotta Verde, sunset tours, swimming stops, and more.",
      path: "/en",
    },
    zh: {
      title: "卡普里私人船游预约 | Capri Love Boat",
      description:
        "预订卡普里岛私人包船体验，本地船长带你环岛游览 Faraglioni 巨石、Marina Piccola、绿洞、日落路线和游泳停靠点。",
      path: "/zh",
    },
    it: {
      title: "Tour privati in barca a Capri | Capri Love Boat",
      description:
        "Prenota un tour privato in barca a Capri con capitano locale. Scopri Faraglioni, Marina Piccola, Grotta Verde, tour al tramonto e soste per nuotare.",
      path: "/it",
    },
  },
  book: {
    en: {
      title: "Book a Capri Private Boat Tour | Capri Love Boat",
      description:
        "Request availability for a private Capri boat tour, choose your date, tour style, time, and group details.",
      path: "/en/book",
    },
    zh: {
      title: "预约卡普里私人船游 | Capri Love Boat",
      description:
        "提交卡普里私人船游预约请求，选择日期、行程类型、出发时间和同行人数。",
      path: "/zh/book",
    },
    it: {
      title: "Prenota un tour privato in barca a Capri | Capri Love Boat",
      description:
        "Richiedi disponibilita per un tour privato in barca a Capri e scegli data, stile del tour, orario e dettagli del gruppo.",
      path: "/it/book",
    },
  },
  policy: {
    en: {
      title: "Booking Policy | Capri Love Boat",
      description:
        "Read the Capri Love Boat booking policy, including reservation fee, balance payment, weather, cancellations, late arrival, and Blue Grotto notes.",
      path: "/en/policy",
    },
    zh: {
      title: "预约政策 | Capri Love Boat",
      description:
        "阅读 Capri Love Boat 预约政策，包括预订费、尾款支付、天气海况、取消、迟到和蓝洞说明。",
      path: "/zh/policy",
    },
    it: {
      title: "Politica di prenotazione | Capri Love Boat",
      description:
        "Leggi la politica di prenotazione di Capri Love Boat: quota di prenotazione, saldo, meteo, cancellazioni, ritardi e Grotta Azzurra.",
      path: "/it/policy",
    },
  },
  manage: {
    en: {
      title: "Manage Booking Request | Capri Love Boat",
      description: "Review or manage your Capri Love Boat booking request.",
      path: "/en/booking/manage",
    },
    zh: {
      title: "管理预约请求 | Capri Love Boat",
      description: "查看或管理您的 Capri Love Boat 预约请求。",
      path: "/zh/booking/manage",
    },
    it: {
      title: "Gestisci richiesta di prenotazione | Capri Love Boat",
      description: "Controlla o gestisci la tua richiesta Capri Love Boat.",
      path: "/it/booking/manage",
    },
  },
  contact: {
    en: {
      title: "Contact Capri Love Boat | Capri Private Boat Tours",
      description: "Contact Capri Love Boat for help with private boat tour requests in Capri.",
      path: "/en/contact",
    },
    zh: {
      title: "联系 Capri Love Boat | 卡普里私人船游",
      description: "联系 Capri Love Boat，获取卡普里私人船游预约帮助。",
      path: "/zh/contact",
    },
    it: {
      title: "Contatta Capri Love Boat | Tour privati in barca a Capri",
      description:
        "Contatta Capri Love Boat per ricevere aiuto con le richieste di tour privati in barca a Capri.",
      path: "/it/contact",
    },
  },
};

function getPageSeo(pageKey, locale) {
  return PAGE_SEO[pageKey]?.[locale] ?? PAGE_SEO[pageKey]?.en ?? PAGE_SEO.home.en;
}

function getAlternates(pageKey) {
  const pageSeo = PAGE_SEO[pageKey];

  if (!pageSeo || pageKey === "manage") {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(pageSeo).map(([locale, seo]) => [locale, seo.path]),
  );
}

export function buildPageMetadata(pageKey, locale, { noIndex = false } = {}) {
  const seo = getPageSeo(pageKey, locale);
  const url = new URL(seo.path, SITE_URL).toString();
  const images = [
    {
      url: OG_IMAGE,
      width: 1200,
      height: 630,
      alt: SITE_NAME,
    },
  ];

  return {
    title: seo.title,
    description: seo.description,
    alternates: noIndex
      ? undefined
      : {
          canonical: seo.path,
          languages: getAlternates(pageKey),
        },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url,
      siteName: SITE_NAME,
      images,
      locale: LOCALE_CODES[locale] ?? LOCALE_CODES.en,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [OG_IMAGE],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  };
}

export function getTourServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: SITE_NAME,
    serviceType: "Private boat tour",
    url: SITE_URL,
    areaServed: {
      "@type": "Place",
      name: "Capri, Italy",
    },
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    sameAs: [],
  };
}

export function getSitemapEntries() {
  const paths = [
    "",
    ...Object.values(LANGUAGE_ALTERNATES),
    "/en/book",
    "/zh/book",
    "/it/book",
    "/en/policy",
    "/zh/policy",
    "/it/policy",
    "/en/contact",
    "/zh/contact",
    "/it/contact",
  ];

  return paths.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    lastModified: new Date(),
    changeFrequency: path.includes("policy") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path.endsWith("/book") ? 0.9 : 0.7,
  }));
}
