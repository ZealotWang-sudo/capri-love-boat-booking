import { NextResponse } from "next/server";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import {
  ACTIVE_BOOKING_STATUSES,
  getBlockedTimeSlots,
  getValidTimeSlotsForTour,
} from "@/lib/bookingAvailability";

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

function buildAvailability(existingBookings, tourType, dates) {
  const validTimeSlots = getValidTimeSlotsForTour(tourType);
  const blockedSlotsByDate = {};
  const fullyBookedDates = [];

  dates.forEach((date) => {
    const blockedTimeSlots = getBlockedTimeSlots(existingBookings, tourType, date);
    blockedSlotsByDate[date] = blockedTimeSlots;

    if (
      validTimeSlots.length > 0 &&
      blockedTimeSlots.length === validTimeSlots.length
    ) {
      fullyBookedDates.push(date);
    }
  });

  return { blockedSlotsByDate, fullyBookedDates };
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

  const dates = date
    ? [date]
    : Array.from(
        { length: new Date(`${range.endDate}T00:00:00.000Z`).getUTCDate() },
        (_, index) =>
          `${month}-${String(index + 1).padStart(2, "0")}`,
      );
  const availability = buildAvailability(existingBookings ?? [], tourType, dates);

  return NextResponse.json({
    success: true,
    ...availability,
  });
}
