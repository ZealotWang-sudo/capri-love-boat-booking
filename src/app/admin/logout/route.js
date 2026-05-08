import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request) {
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}

export async function POST(request) {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
