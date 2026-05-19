export const MIN_RESERVATION_FEE_EUR = 10;
export const PROMO_CODE_SELECT =
  "id, code, discount_eur, is_active, notes, created_at, updated_at";

export function normalizePromoCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function calculatePromoPricing({ discountEur = 0, originalReservationFeeEur }) {
  const safeDiscount = Math.max(Number.isInteger(discountEur) ? discountEur : 0, 0);
  const finalReservationFeeEur = Math.max(
    originalReservationFeeEur - safeDiscount,
    MIN_RESERVATION_FEE_EUR,
  );

  return {
    finalReservationFeeEur,
    promoDiscountEur: originalReservationFeeEur - finalReservationFeeEur,
  };
}

export async function getPromoCodeByCode(supabase, code) {
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    return { data: null, error: null };
  }

  return supabase
    .from("promo_codes")
    .select(PROMO_CODE_SELECT)
    .eq("code", normalizedCode)
    .maybeSingle();
}

export async function validatePromoCodeForReservation({
  code,
  originalReservationFeeEur,
  supabase,
}) {
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    return {
      finalReservationFeeEur: originalReservationFeeEur,
      promoCode: null,
      promoDiscountEur: 0,
      valid: true,
    };
  }

  const { data: promoCode, error } = await getPromoCodeByCode(supabase, normalizedCode);

  if (error) {
    return { error, valid: false };
  }

  if (!promoCode) {
    return { message: "Invalid promo code.", status: 404, valid: false };
  }

  if (!promoCode.is_active) {
    return {
      message: "This promo code is no longer active.",
      status: 409,
      valid: false,
    };
  }

  const pricing = calculatePromoPricing({
    discountEur: promoCode.discount_eur,
    originalReservationFeeEur,
  });

  return {
    code: promoCode.code,
    discountEur: promoCode.discount_eur,
    finalReservationFeeEur: pricing.finalReservationFeeEur,
    promoCode: promoCode.code,
    promoDiscountEur: pricing.promoDiscountEur,
    valid: true,
  };
}
