import { NextResponse } from "next/server";
import { isAllowedAdmin } from "@/app/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { captureAuthorizedBookingPayment } from "@/lib/stripe/adminBookingPayments";

function jsonError(message, status = 400) {
  console.error("[admin capture payment API]", message);

  return NextResponse.json({ error: message, success: false }, { status });
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user && isAllowedAdmin(user));
}

export async function POST(request) {
  if (!(await requireAdmin())) {
    return jsonError("Unauthorized.", 401);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const bookingId =
    typeof body?.booking_id === "string" ? body.booking_id.trim() : "";

  if (!bookingId) {
    return jsonError("Missing booking_id.");
  }

  try {
    const result = await captureAuthorizedBookingPayment({ bookingId });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonError(error.message || "Could not capture payment.", 409);
  }
}
