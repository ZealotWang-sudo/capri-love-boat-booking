import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SiteHeader({ brand, locale, path = "" }) {
  return (
    <header className="relative z-10 mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-8">
      <Link
        href={`/${locale}`}
        className="shrink-0 text-xs uppercase tracking-[0.22em] sm:text-sm sm:tracking-[0.28em]"
      >
        {brand}
      </Link>
      <LanguageSwitcher currentLocale={locale} path={path} />
    </header>
  );
}
