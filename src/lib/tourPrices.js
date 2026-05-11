export const TOUR_PRICE_SELECT =
  "id, created_at, tour_type, season, display_name_en, display_name_zh, display_name_it, duration_hours, total_price_eur, reservation_fee_eur, pay_on_board_eur, captain_price_eur, is_active, sort_order, notes, updated_at";

const TOUR_PRICE_DISPLAY_NAMES = {
  de: {
    five_hours: "5 Stunden",
    four_hours: "4 Stunden",
    sunset_three_hours: "Sonnenuntergang 3 Stunden",
    three_hours: "3 Stunden",
    two_hours: "2 Stunden",
  },
  fr: {
    five_hours: "5 heures",
    four_hours: "4 heures",
    sunset_three_hours: "Coucher de soleil 3 heures",
    three_hours: "3 heures",
    two_hours: "2 heures",
  },
};

export function isTourPricesTableMissing(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

export function getTourPriceDisplayName(tourPrice, locale) {
  const localizedName = TOUR_PRICE_DISPLAY_NAMES[locale]?.[tourPrice.tour_type];

  if (localizedName) {
    return localizedName;
  }

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
