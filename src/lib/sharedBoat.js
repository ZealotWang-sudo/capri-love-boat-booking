import { getDisplayTimeForTimeSlot } from "@/lib/bookingAvailability";

export const MAX_BOAT_CAPACITY = 6;
export const MIN_SHARED_REQUEST_FEE_EUR = 1;
export const JOIN_REQUEST_CUTOFF_HOURS = 48;
export const CAPRI_TIME_ZONE = "Europe/Rome";

export const ACTIVE_SHARED_JOIN_REQUEST_STATUSES = [
  "authorized_pending_host_decision",
  "sent_to_main_booker",
  "accepted",
  "connected",
];

export const SHARED_CONTACT_METHODS = new Set([
  "whatsapp",
  "wechat",
  "email",
  "phone",
]);

export const SHARED_GENDER_COMPOSITIONS = new Set([
  "all_female",
  "all_male",
  "mixed",
  "prefer_not_to_say",
]);

export function getSharedBookingDisplayTime(booking) {
  return booking.time_window || getDisplayTimeForTimeSlot(booking.time_slot);
}

function parseDisplayTime(value) {
  const match = /(\d{1,2}):(\d{2})/.exec(value ?? "");

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const zonedTimestamp = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return zonedTimestamp - date.getTime();
}

function getZonedDateAsUtc({ date, hours, minutes, timeZone }) {
  const [year, month, day] = date.split("-").map(Number);
  const initialDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const initialOffset = getTimeZoneOffsetMs(initialDate, timeZone);
  const adjustedDate = new Date(initialDate.getTime() - initialOffset);
  const adjustedOffset = getTimeZoneOffsetMs(adjustedDate, timeZone);

  return new Date(initialDate.getTime() - adjustedOffset);
}

export function isWithinJoinRequestCutoff(booking) {
  const displayTime = getSharedBookingDisplayTime(booking);
  const parsedTime = parseDisplayTime(displayTime);

  if (!booking.requested_date || !parsedTime) {
    return true;
  }

  const tourStart = getZonedDateAsUtc({
    date: booking.requested_date,
    hours: parsedTime.hours,
    minutes: parsedTime.minutes,
    timeZone: CAPRI_TIME_ZONE,
  });
  const cutoffMs = JOIN_REQUEST_CUTOFF_HOURS * 60 * 60 * 1000;

  return tourStart.getTime() - Date.now() < cutoffMs;
}

export function isValidSharedBookingForJoin(booking) {
  return Boolean(
    booking &&
      booking.is_shared_open === true &&
      booking.booking_status === "confirmed" &&
      booking.payment_status === "captured" &&
      booking.shared_status === "open",
  );
}

export function getSharedJoinCapacity(booking) {
  const openSeats = Number(booking?.shared_open_seats);
  const remainingCapacity = MAX_BOAT_CAPACITY - Number(booking?.guest_count ?? 0);

  if (!Number.isInteger(openSeats) || openSeats < 1) {
    return 0;
  }

  return Math.max(0, Math.min(openSeats, remainingCapacity));
}

export function isGenderCompositionAllowed({ booking, genderComposition }) {
  if (booking.shared_gender_preference === "female_only") {
    return genderComposition === "all_female";
  }

  if (booking.shared_gender_preference === "male_only") {
    return genderComposition === "all_male";
  }

  return SHARED_GENDER_COMPOSITIONS.has(genderComposition);
}
