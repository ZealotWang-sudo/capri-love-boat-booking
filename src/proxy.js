import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return updateSupabaseSession(request);
  }

  const response = handleI18nRouting(request);

  return updateSupabaseSession(request, response);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
