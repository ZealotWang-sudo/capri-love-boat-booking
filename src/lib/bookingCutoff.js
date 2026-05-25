export const BOOKING_CUTOFF_TIME_ZONE = "Europe/Rome";
export const ONLINE_BOOKING_CUTOFF_HOUR = 18;
export const ONLINE_BOOKING_CUTOFF_ERROR_MESSAGE =
  "Online booking is not available for this date because it is too close to the tour time. Please contact us directly for last-minute availability.";

function formatDateParts({ day, month, year }) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function getItalyDateTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BOOKING_CUTOFF_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    year: values.year,
  };
}

function addCalendarDays(dateParts, daysToAdd) {
  const date = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + daysToAdd),
  );

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

export function getEarliestOnlineBookingDate(now = new Date()) {
  const italyNow = getItalyDateTimeParts(now);
  const daysToAdd = italyNow.hour >= ONLINE_BOOKING_CUTOFF_HOUR ? 2 : 1;

  return formatDateParts(addCalendarDays(italyNow, daysToAdd));
}

export function isOnlineBookingDateAllowed(requestedDate, now = new Date()) {
  return (
    typeof requestedDate === "string" &&
    requestedDate >= getEarliestOnlineBookingDate(now)
  );
}
