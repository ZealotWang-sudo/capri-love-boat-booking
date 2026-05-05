import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh", "it"],
  defaultLocale: "en",
  localeDetection: true,
});
