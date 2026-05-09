import { NextResponse } from "next/server";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";

const ALLOWED_LOCALES = new Set(["en", "zh", "it"]);
const MAX_TEXT_LENGTH = 1000;

function isPageViewsTableMissing(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function getOptionalText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text ? text.slice(0, maxLength) : null;
}

function getPath(value) {
  const path = getOptionalText(value, 300);

  if (!path || !path.startsWith("/")) {
    return null;
  }

  if (path.startsWith("/admin") || path.startsWith("/api")) {
    return null;
  }

  return path;
}

function getLocale(value) {
  const locale = getOptionalText(value, 10);

  return ALLOWED_LOCALES.has(locale) ? locale : null;
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON." },
      { status: 400 },
    );
  }

  const path = getPath(body?.path);

  if (!path) {
    return NextResponse.json(
      { success: false, error: "Invalid path." },
      { status: 400 },
    );
  }

  const supabase = createSupabasePublicServerClient();
  const { error } = await supabase.from("page_views").insert({
    path,
    locale: getLocale(body?.locale),
    referrer: getOptionalText(body?.referrer),
    session_id: getOptionalText(body?.session_id, 100),
    user_agent: getOptionalText(request.headers.get("user-agent")),
  });

  if (error) {
    if (isPageViewsTableMissing(error)) {
      return NextResponse.json({ skipped: true, success: true });
    }

    console.error("[page view analytics]", error.message);

    return NextResponse.json(
      { success: false, error: "Could not record page view." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
