import Link from "next/link";

const languages = [
  { locale: "en", label: "English" },
  { locale: "zh", label: "中文" },
  { locale: "it", label: "Italiano" },
];

export default function LanguageSwitcher({ currentLocale, path = "" }) {
  return (
    <nav className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[10px] uppercase tracking-[0.12em] sm:gap-3 sm:text-xs sm:tracking-[0.18em]">
      {languages.map((language) => {
        const isActive = language.locale === currentLocale;

        return (
          <Link
            key={language.locale}
            href={`/${language.locale}${path}`}
            className={`border-b pb-1 transition ${
              isActive
                ? "border-current text-current"
                : "border-transparent text-current/60 hover:text-current"
            }`}
          >
            {language.label}
          </Link>
        );
      })}
    </nav>
  );
}
