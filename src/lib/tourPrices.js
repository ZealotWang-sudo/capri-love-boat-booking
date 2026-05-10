export const TOUR_PRICE_SELECT =
  "id, created_at, tour_type, season, display_name_en, display_name_zh, display_name_it, duration_hours, total_price_eur, reservation_fee_eur, pay_on_board_eur, captain_price_eur, is_active, sort_order, notes, updated_at";

export function isTourPricesTableMissing(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

export function getTourPriceDisplayName(tourPrice, locale) {
  if (locale === "zh") {
    return tourPrice.display_name_zh;
  }

  if (locale === "it") {
    return tourPrice.display_name_it;
  }

  return tourPrice.display_name_en;
}

export async function getActiveTourPrices(supabase) {
  return supabase
    .from("tour_prices")
    .select(TOUR_PRICE_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export async function getActiveTourPriceByType(supabase, tourType) {
  return supabase
    .from("tour_prices")
    .select(TOUR_PRICE_SELECT)
    .eq("tour_type", tourType)
    .eq("is_active", true)
    .maybeSingle();
}
