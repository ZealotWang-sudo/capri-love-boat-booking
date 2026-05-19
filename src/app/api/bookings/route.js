import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createSupabasePublicServerClient,
  createSupabaseServiceRoleServerClient,
} from "@/lib/supabase/server";
import { isUnavailableSlotsTableMissing } from "@/lib/adminUnavailableSlots";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingOverlapsSelection,
  getDisplayTimeForTimeSlot,
  isValidTimeSlotForTour,
} from "@/lib/bookingAvailability";
import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import { validatePromoCodeForReservation } from "@/lib/promoCodes";
import { getActiveTourPriceByType } from "@/lib/tourPrices";

const REQUIRED_FIELDS = [
  "customer_name",
  "email",
  "guest_count",
  "requested_date",
  "tour_type",
  "locale",
];

const ALLOWED_LOCALES = new Set(["en", "zh", "it", "de", "fr"]);

const TIME_NO_LONGER_AVAILABLE_MESSAGE =
  "This time is no longer available. Please choose another time.";

function jsonError(message, status = 400, details) {
  console.error("[bookings API]", message, details);

  return NextResponse.json({ success: false, error: message, details }, { status });
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasRequiredValue(value) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

function getOptionalText(value) {
  const text = getText(value);

  return text || null;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function createCustomerManageUrl({ bookingId, locale, request, token }) {
  const path = `/${locale}/booking/manage/${bookingId}?token=${encodeURIComponent(token)}`;

  return new URL(path, request.url).toString();
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const value = body?.[field];

    return !hasRequiredValue(value);
  });

  if (missingFields.length > 0) {
    return jsonError("Missing required fields.", 400, { missingFields });
  }

  const locale = getText(body.locale);

  if (!ALLOWED_LOCALES.has(locale)) {
    return jsonError("Invalid locale. Expected en, zh, it, de, or fr.");
  }

  const guestCount = Number(body.guest_count);

  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 6) {
    return jsonError("Invalid guest_count. Expected an integer between 1 and 6.");
  }

  const requestedDate = getText(body.requested_date);

  if (!isValidDateString(requestedDate)) {
    return jsonError("Invalid requested_date. Expected YYYY-MM-DD.");
  }

  const tourType = getText(body.tour_type);

  const timeSlot = getText(body.time_slot);

  if (!timeSlot || !isValidTimeSlotForTour(tourType, timeSlot)) {
    return jsonError("Invalid time_slot for selected tour_type.");
  }

  const supabase = createSupabasePublicServerClient();
  const { data: tourPrice, error: tourPriceError } =
    await getActiveTourPriceByType(supabase, tourType);

  if (tourPriceError) {
    return jsonError("Could not load selected tour price.", 500, {
      message: tourPriceError.message,
    });
  }

  if (!tourPrice) {
    return jsonError("Invalid or inactive tour_type.");
  }

  const originalReservationFeeEur = tourPrice.reservation_fee_eur;
  const promoCodeInput = getOptionalText(body.promo_code);
  const promoResult = promoCodeInput
    ? await validatePromoCodeForReservation({
        code: promoCodeInput,
        originalReservationFeeEur,
        supabase: createSupabaseServiceRoleServerClient(),
      })
    : {
        finalReservationFeeEur: originalReservationFeeEur,
        promoCode: null,
        promoDiscountEur: 0,
        valid: true,
      };

  if (promoResult.error) {
    return jsonError("Could not validate promo code.", 500, {
      message: promoResult.error.message,
    });
  }

  if (!promoResult.valid) {
    return jsonError(promoResult.message, promoResult.status);
  }

  const bookingId = randomUUID();
  const customerManageToken = randomBytes(32).toString("base64url");
  const customerManageUrl = createCustomerManageUrl({
    bookingId,
    locale,
    request,
    token: customerManageToken,
  });
  const bookingRequest = {
    id: bookingId,
    locale,
    customer_name: getText(body.customer_name),
    email: getText(body.email).toLowerCase(),
    phone: getOptionalText(body.phone),
    contact_method: getOptionalText(body.contact_method),
    guest_count: guestCount,
    requested_date: requestedDate,
    tour_type: tourType,
    time_slot: timeSlot,
    time_window: getDisplayTimeForTimeSlot(timeSlot) || getOptionalText(body.time_window),
    total_price_eur: tourPrice.total_price_eur,
    reservation_fee_eur: originalReservationFeeEur,
    pay_on_board_eur: tourPrice.pay_on_board_eur,
    promo_code: promoResult.promoCode,
    promo_discount_eur: promoResult.promoDiscountEur,
    original_reservation_fee_eur: originalReservationFeeEur,
    final_reservation_fee_eur: promoResult.finalReservationFeeEur,
    message: getOptionalText(body.message),
    booking_status: "requested",
    customer_manage_token: customerManageToken,
    payment_status: "unpaid",
    captain_status: "pending",
  };

  const { data: existingBookings, error: availabilityError } = await supabase
    .from("bookings")
    .select("requested_date, tour_type, time_slot, time_window, booking_status")
    .in("booking_status", Array.from(ACTIVE_BOOKING_STATUSES))
    .eq("requested_date", requestedDate);

  if (availabilityError) {
    return jsonError("Could not check booking availability.", 500, {
      message: availabilityError.message,
    });
  }

  const { data: unavailableSlot, error: unavailableSlotError } = await supabase
    .from("admin_unavailable_slots")
    .select("date")
    .eq("date", requestedDate)
    .eq("time_slot", timeSlot)
    .maybeSingle();

  if (unavailableSlotError && !isUnavailableSlotsTableMissing(unavailableSlotError)) {
    return jsonError("Could not check manual unavailable slots.", 500, {
      message: unavailableSlotError.message,
    });
  }

  if (unavailableSlot) {
    return jsonError(TIME_NO_LONGER_AVAILABLE_MESSAGE, 409);
  }

  const hasOverlap = (existingBookings ?? []).some((existingBooking) =>
    bookingOverlapsSelection(existingBooking, bookingRequest),
  );

  if (hasOverlap) {
    return jsonError(TIME_NO_LONGER_AVAILABLE_MESSAGE, 409);
  }

  const { error } = await supabase.from("bookings").insert(bookingRequest);

  if (error) {
    return jsonError("Could not create booking request.", 500, {
      message: error.message,
    });
  }

  await sendBookingEmail({
    booking: {
      ...bookingRequest,
      manage_url: customerManageUrl,
    },
    checkDuplicate: false,
    eventType: "booking_received",
    supabase,
  });

  return NextResponse.json(
    { success: true, bookingId },
    { status: 201 },
  );
}
