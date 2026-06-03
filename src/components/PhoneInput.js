"use client";

import { useId, useMemo, useState } from "react";
import countryTelephoneData from "country-telephone-data";

const COUNTRIES = countryTelephoneData.allCountries.map((country) => ({
  dialCode: `+${country.dialCode}`,
  iso2: country.iso2,
  name: country.name,
  searchText: `${country.name} +${country.dialCode} ${country.iso2}`.toLowerCase(),
}));

function getDefaultCountry(locale) {
  const defaultIso2 = locale === "zh" ? "cn" : "it";

  return (
    COUNTRIES.find((country) => country.iso2 === defaultIso2) ?? COUNTRIES[0]
  );
}

function getCountryLabel(country) {
  return `${country.name} ${country.dialCode}`;
}

function getCompactCountryLabel(country) {
  return `${country.iso2.toUpperCase()} ${country.dialCode}`;
}

function getFilteredCountries(query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return COUNTRIES;
  }

  return COUNTRIES.filter((country) =>
    country.searchText.includes(normalizedQuery),
  );
}

function getSearchPlaceholder(countryCodeLabel) {
  return `Search ${countryCodeLabel.toLowerCase()}`;
}

function getCountryButtonLabel(countryCodeLabel, country) {
  return `${countryCodeLabel}: ${getCountryLabel(country)}`;
}

function getCountryOptionId(listboxId, country) {
  return `${listboxId}-${country.iso2}-${country.dialCode.replace("+", "")}`;
}

function isChinaLocale(locale) {
  if (locale === "zh") {
    return true;
  }

  return false;
}

export default function PhoneInput({
  countryCodeLabel,
  label,
  locale,
  name = "phone",
}) {
  const listboxId = useId();
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(() =>
    getDefaultCountry(locale),
  );
  const [localNumber, setLocalNumber] = useState("");
  const filteredCountries = getFilteredCountries(countryQuery);
  const combinedPhone = useMemo(() => {
    const normalizedNumber = localNumber.trim();

    return normalizedNumber
      ? `${selectedCountry.dialCode} ${normalizedNumber}`
      : "";
  }, [localNumber, selectedCountry.dialCode]);

  function handleSelectCountry(country) {
    setSelectedCountry(country);
    setCountryOpen(false);
    setCountryQuery("");
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </label>
      <input type="hidden" name={name} value={combinedPhone} />
      <div className="mt-3 grid grid-cols-[1fr_2fr] border border-stone-300 transition focus-within:border-stone-950">
        <div className="relative border-r border-stone-300">
          <button
            type="button"
            aria-expanded={countryOpen}
            aria-controls={listboxId}
            aria-label={getCountryButtonLabel(countryCodeLabel, selectedCountry)}
            onClick={() => setCountryOpen((open) => !open)}
            className="flex h-full  items-center justify-between gap-2 bg-transparent px-2 py-4 text-left text-sm text-stone-950 outline-none"
          >
            <span>{getCompactCountryLabel(selectedCountry)}</span>
         
          </button>
          {countryOpen ? (
            <div className="absolute left-0 top-full z-30 mt-2 w-80 border border-stone-950 bg-[#fbf8f3] p-3 shadow-xl">
              <label className="sr-only" htmlFor={`${listboxId}-search`}>
                {countryCodeLabel}
              </label>
              <input
                id={`${listboxId}-search`}
                value={countryQuery}
                onChange={(event) => setCountryQuery(event.target.value)}
                placeholder={getSearchPlaceholder(countryCodeLabel)}
                className="w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-stone-950"
              />
              <div
                id={listboxId}
                role="listbox"
                aria-label={countryCodeLabel}
                className="mt-3 max-h-72 overflow-y-auto border-t border-stone-300 pt-2"
              >
                {filteredCountries.map((country) => {
                  const selected = country.iso2 === selectedCountry.iso2;

                  return (
                    <button
                      key={`${country.iso2}-${country.dialCode}-${country.name}`}
                      id={getCountryOptionId(listboxId, country)}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelectCountry(country)}
                      className={[
                        "flex w-full items-center justify-between gap-4 px-2 py-2 text-left text-sm transition hover:bg-stone-950 hover:text-[#f3eee7]",
                        selected ? "bg-stone-950 text-[#f3eee7]" : "text-stone-700",
                      ].join(" ")}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {country.name}
                      </span>
                      <span className="shrink-0 text-xs uppercase tracking-[0.12em]">
                        {country.dialCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <input
          type="tel"
          required
          value={localNumber}
          onChange={(event) => setLocalNumber(event.target.value)}
          inputMode="tel"
          dir={isChinaLocale(locale) ? "ltr" : undefined}
          className="w-full bg-transparent px-4 py-4 outline-none"
        />
      </div>
    </div>
  );
}
