import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import { isUnavailableSlotsTableMissing } from "@/lib/adminUnavailableSlots";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingOverlapsSelection,
  getDisplayTimeForTimeSlot,
  isValidTimeSlotForTour,
} from "@/lib/bookingAvailability";
import { sendBookingEmail } from "@/lib/email/sendBookingEmail";

const REQUIRED_FIELDS = [
  "customer_name",
  "email",
  "guest_count",
  "requested_date",
  "tour_type",
  "locale",
];

const ALLOWED_LOCALES = new Set(["en", "zh", "it"]);

const ALLOWED_TOUR_TYPES = new Set([
  "three_hours",
  "four_hours",
  "sunset_three_hours",
  "five_hours",
  "two_hours",
  "special_request",
]);

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

function getOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isInteger(number) ? number : NaN;
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
    return jsonError("Invalid locale. Expected en, zh, or it.");
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

  if (!ALLOWED_TOUR_TYPES.has(tourType)) {
    return jsonError("Invalid tour_type.");
  }

  const timeSlot = getText(body.time_slot);

  if (!timeSlot || !isValidTimeSlotForTour(tourType, timeSlot)) {
    return jsonError("Invalid time_slot for selected tour_type.");
  }

  const totalPriceEur = getOptionalInteger(body.total_price_eur);
  const reservationFeeEur = getOptionalInteger(body.reservation_fee_eur);
  const payOnBoardEur = getOptionalInteger(body.pay_on_board_eur);

  if (
    Number.isNaN(totalPriceEur) ||
    Number.isNaN(reservationFeeEur) ||
    Number.isNaN(payOnBoardEur)
  ) {
    return jsonError("Price fields must be integers when provided.");
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
    total_price_eur: totalPriceEur,
    reservation_fee_eur: reservationFeeEur,
    pay_on_board_eur: payOnBoardEur,
    message: getOptionalText(body.message),
    booking_status: "requested",
    customer_manage_token: customerManageToken,
    payment_status: "unpaid",
    captain_status: "pending",
  };

  const supabase = createSupabasePublicServerClient();
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
    return jsonError("Selected time is no longer available.", 409);
  }

  const hasOverlap = (existingBookings ?? []).some((existingBooking) =>
    bookingOverlapsSelection(existingBooking, bookingRequest),
  );

  if (hasOverlap) {
    return jsonError("Selected time is no longer available.", 409);
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
