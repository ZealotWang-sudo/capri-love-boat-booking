import { NextResponse } from "next/server";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import {
  getManualBlockedTimeSlots,
  groupUnavailableSlotsByDate,
  isUnavailableSlotsTableMissing,
} from "@/lib/adminUnavailableSlots";
import {
  ACTIVE_BOOKING_STATUSES,
  getBlockedTimeSlots,
  getValidTimeSlotsForTour,
} from "@/lib/bookingAvailability";
import { getActiveTourPrices } from "@/lib/tourPrices";

function jsonError(message, status = 400, details) {
  console.error("[availability API]", message, details);

  return NextResponse.json({ success: false, error: message, details }, { status });
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function getMonthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month ?? "")) {
    return null;
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const endDate = `${year}-${String(monthNumber).padStart(2, "0")}-${String(
    lastDay,
  ).padStart(2, "0")}`;

  return { endDate, startDate };
}

function getBlockedSlotsForTour({
  date,
  existingBookings,
  tourType,
  unavailableSlotsByDate,
}) {
  const validTimeSlots = getValidTimeSlotsForTour(tourType);
  return Array.from(
    new Set([
      ...getBlockedTimeSlots(existingBookings, tourType, date),
      ...getManualBlockedTimeSlots({
        date,
        unavailableSlotsByDate,
        validTimeSlots,
      }),
    ]),
  );
}

function buildAvailability({
  activeTourTypes,
  dates,
  existingBookings,
  tourType,
  unavailableSlots,
}) {
  const validTimeSlots = getValidTimeSlotsForTour(tourType);
  const unavailableSlotsByDate = groupUnavailableSlotsByDate(unavailableSlots);
  const alternativeAvailableDates = [];
  const alternativeTourTypesByDate = {};
  const blockedSlotsByDate = {};
  const fullyBookedDates = [];
  const partiallyBookedDates = [];

  dates.forEach((date) => {
    const blockedTimeSlots = getBlockedSlotsForTour({
      date,
      existingBookings,
      tourType,
      unavailableSlotsByDate,
    });
    blockedSlotsByDate[date] = blockedTimeSlots;

    if (
      validTimeSlots.length > 0 &&
      blockedTimeSlots.length === validTimeSlots.length
    ) {
      fullyBookedDates.push(date);

      const alternativeTourTypes = activeTourTypes.filter(
        (alternativeTourType) => {
          if (alternativeTourType === tourType) {
            return false;
          }

          const alternativeValidTimeSlots =
            getValidTimeSlotsForTour(alternativeTourType);
          const alternativeBlockedTimeSlots = getBlockedSlotsForTour({
            date,
            existingBookings,
            tourType: alternativeTourType,
            unavailableSlotsByDate,
          });

          return (
            alternativeValidTimeSlots.length > 0 &&
            alternativeBlockedTimeSlots.length < alternativeValidTimeSlots.length
          );
        },
      );

      if (alternativeTourTypes.length > 0) {
        alternativeAvailableDates.push(date);
        alternativeTourTypesByDate[date] = alternativeTourTypes;
      }
    } else if (blockedTimeSlots.length > 0) {
      partiallyBookedDates.push(date);
    }
  });

  return {
    alternativeAvailableDates,
    alternativeTourTypesByDate,
    blockedSlotsByDate,
    fullyBookedDates,
    partiallyBookedDates,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const tourType = searchParams.get("tourType");
  const validTimeSlots = getValidTimeSlotsForTour(tourType);

  if (!tourType || validTimeSlots.length === 0) {
    return jsonError("Invalid tourType.");
  }

  const range = date
    ? isValidDateString(date)
      ? { endDate: date, startDate: date }
      : null
    : getMonthRange(month);

  if (!range) {
    return jsonError("Expected valid date=YYYY-MM-DD or month=YYYY-MM.");
  }

  const supabase = createSupabasePublicServerClient();
  const { data: activeTourPrices, error: activeTourPricesError } =
    await getActiveTourPrices(supabase);

  if (activeTourPricesError) {
    return jsonError("Could not load active tour prices.", 500, {
      message: activeTourPricesError.message,
    });
  }

  const activeTourTypes = (activeTourPrices ?? []).map(
    (tourPrice) => tourPrice.tour_type,
  );

  if (!activeTourTypes.includes(tourType)) {
    return jsonError("Invalid tourType.");
  }

  const { data: existingBookings, error } = await supabase
    .from("bookings")
    .select("requested_date, tour_type, time_slot, time_window, booking_status")
    .in("booking_status", Array.from(ACTIVE_BOOKING_STATUSES))
    .gte("requested_date", range.startDate)
    .lte("requested_date", range.endDate);

  if (error) {
    return jsonError("Could not load booking availability.", 500, {
      message: error.message,
    });
  }

  const { data: unavailableSlots, error: unavailableSlotsError } = await supabase
    .from("admin_unavailable_slots")
    .select("date, time_slot")
    .gte("date", range.startDate)
    .lte("date", range.endDate);

  if (unavailableSlotsError && !isUnavailableSlotsTableMissing(unavailableSlotsError)) {
    return jsonError("Could not load manual unavailable slots.", 500, {
      message: unavailableSlotsError.message,
    });
  }

  const dates = date
    ? [date]
    : Array.from(
        { length: new Date(`${range.endDate}T00:00:00.000Z`).getUTCDate() },
        (_, index) =>
          `${month}-${String(index + 1).padStart(2, "0")}`,
      );
  const availability = buildAvailability({
    activeTourTypes,
    dates,
    existingBookings: existingBookings ?? [],
    tourType,
    unavailableSlots: unavailableSlotsError ? [] : unavailableSlots,
  });

  return NextResponse.json({
    success: true,
    ...availability,
  });
}
