import { SITE_URL } from "@/lib/seo";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/login", "/admin/data", "/api", "/*/booking/manage/*"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
