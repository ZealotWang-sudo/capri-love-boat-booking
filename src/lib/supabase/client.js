import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_AUTH_COOKIE_OPTIONS } from "./cookies";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }

  if (!supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable.",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey, {
    cookieOptions: SUPABASE_AUTH_COOKIE_OPTIONS,
  });
}
