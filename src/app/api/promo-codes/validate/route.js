import { NextResponse } from "next/server";
import { MIN_SHARED_REQUEST_FEE_EUR } from "@/lib/sharedBoat";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { validatePromoCodeForReservation } from "@/lib/promoCodes";

function jsonError(message, status = 400, details) {
  console.error("[promo code validate]", message, details ?? "");

  return NextResponse.json({ error: message, success: false }, { status });
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const code = getText(body?.code);
  const originalReservationFeeEur = Number(body?.original_reservation_fee_eur);
  const pricingContext = getText(body?.pricing_context);
  const minimumReservationFeeEur =
    pricingContext === "shared_join_request" ? MIN_SHARED_REQUEST_FEE_EUR : undefined;

  if (!code) {
    return jsonError("Invalid promo code.");
  }

  if (
    !Number.isInteger(originalReservationFeeEur) ||
    originalReservationFeeEur <= 0
  ) {
    return jsonError("Invalid reservation fee.");
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const result = await validatePromoCodeForReservation({
    code,
    minimumReservationFeeEur,
    originalReservationFeeEur,
    supabase,
  });

  if (result.error) {
    return jsonError("Could not validate promo code.", 500, {
      message: result.error.message,
    });
  }

  if (!result.valid) {
    return jsonError(result.message, result.status);
  }

  return NextResponse.json({
    code: result.promoCode,
    discountEur: result.discountEur,
    finalReservationFeeEur: result.finalReservationFeeEur,
    promoDiscountEur: result.promoDiscountEur,
    success: true,
  });
}
