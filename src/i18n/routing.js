import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh", "it", "de", "fr"],
  defaultLocale: "en",
  localeDetection: true,
});
