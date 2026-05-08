import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabaseConfig() {
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

  return { supabaseKey, supabaseUrl };
}

export async function updateSupabaseSession(request, response) {
  let supabaseResponse = response ?? NextResponse.next({ request });
  const { supabaseKey, supabaseUrl } = getSupabaseConfig();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        if (!response) {
          supabaseResponse = NextResponse.next({ request });
        }

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    console.info("[supabase middleware] Admin session refresh", {
      hasUser: Boolean(user),
      path: request.nextUrl.pathname,
      userEmail: user?.email ?? null,
      error: error?.message ?? null,
    });
  }

  return supabaseResponse;
}
