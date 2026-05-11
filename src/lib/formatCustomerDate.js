const DATE_FORMAT_LOCALES = {
  de: "de-DE",
  en: "en-US",
  fr: "fr-FR",
  it: "it-IT",
  zh: "zh-CN",
};

export function formatCustomerDate(value, locale = "en") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    return value || "-";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.valueOf())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat(DATE_FORMAT_LOCALES[locale] ?? "en-US", {
    day: "numeric",
    month: locale === "zh" ? "numeric" : "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}
