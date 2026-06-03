import { Geist_Mono, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import PageViewAnalytics from "@/components/PageViewAnalytics";
import SiteFooter from "@/components/SiteFooter";
import StructuredData from "@/components/StructuredData";
import { SITE_URL, getTourServiceJsonLd } from "@/lib/seo";
import "../globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Capri Love Boat",
  description: "Capri private boat booking",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  themeColor: "#f3eee7",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const common = await getTranslations("Common");

  return (
    <html
      lang={locale}
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <PageViewAnalytics locale={locale} />
          <Analytics />
          <StructuredData data={getTourServiceJsonLd()} />
          {children}
          <SiteFooter
            labels={{
              brand: common("brand"),
              contact: common("contact"),
              policy: common("policy"),
            }}
            locale={locale}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
