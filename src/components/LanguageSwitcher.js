"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const languages = [
  { locale: "en", label: "English" },
  { locale: "zh", label: "中文" },
  { locale: "it", label: "Italiano" },
  { locale: "de", label: "Deutsch" },
  { locale: "fr", label: "Français" },
];

export default function LanguageSwitcher({ currentLocale, path = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const currentLanguage =
    languages.find((language) => language.locale === currentLocale) ??
    languages[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <nav
      aria-label="Language"
      ref={menuRef}
      className="relative z-50 min-w-0 text-[10px] uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.18em]"
    >
      <div className="hidden items-center justify-end gap-3 md:flex">
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
      </div>

      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          onClick={() => setIsOpen((open) => !open)}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-current/90 transition hover:text-current"
        >
          <span>{currentLanguage.label}</span>
          <span
            aria-hidden="true"
            className={`text-[9px] transition ${isOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        {isOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 min-w-36 border border-current/25 bg-[#f3eee7] py-2 text-stone-950 shadow-sm"
          >
            {languages.map((language) => {
              const isActive = language.locale === currentLocale;

              return (
                <Link
                  key={language.locale}
                  href={`/${language.locale}${path}`}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2 text-right transition ${
                    isActive
                      ? "text-stone-950"
                      : "text-stone-500 hover:text-stone-950"
                  }`}
                >
                  {language.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
