import { NextResponse } from "next/server";
import { isAllowedAdmin } from "@/app/admin/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { releaseAuthorizedBookingPayment } from "@/lib/stripe/adminBookingPayments";

const RELEASE_OUTCOMES = new Set(["cancelled", "not_available"]);

function jsonError(message, status = 400) {
  console.error("[admin release authorization API]", message);

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
  const outcome =
    typeof body?.outcome === "string" ? body.outcome.trim() : "cancelled";

  if (!bookingId) {
    return jsonError("Missing booking_id.");
  }

  if (!RELEASE_OUTCOMES.has(outcome)) {
    return jsonError("Invalid release outcome.");
  }

  try {
    const result = await releaseAuthorizedBookingPayment({
      bookingId,
      cancellationReason:
        typeof body?.reason === "string" ? body.reason.trim() : "",
      cancellationType:
        typeof body?.cancellation_type === "string"
          ? body.cancellation_type.trim()
          : "admin_decision",
      outcome,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonError(error.message || "Could not release authorization.", 409);
  }
}
