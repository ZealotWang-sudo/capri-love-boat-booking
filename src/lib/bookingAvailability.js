export const ACTIVE_BOOKING_STATUSES = new Set([
  "requested",
  "checking_with_captain",
  "payment_pending",
  "confirmed",
  "available", // Legacy rows from the earlier admin flow should still block.
]);
const NON_BLOCKING_PAYMENT_STATUSES = new Set([
  "failed",
  "released",
]);

export const TOUR_DURATIONS_MINUTES = {
  two_half_hours: 150,
  two_hours: 120,
  three_hours: 180,
  four_hours: 240,
  sunset_three_hours: 180,
  five_hours: 300,
};

export const TIME_SLOT_WINDOWS = {
  morning_0930: { start: "09:30", end: "09:30" },
  morning_1000: { start: "10:00", end: "10:00" },
  afternoon_1330: { start: "13:30", end: "13:30" },
  afternoon_1400: { start: "14:00", end: "14:00" },
  sunset_1800: { start: "18:00", end: "18:00" },
  morning: { start: "09:30", end: "10:00" },
  afternoon: { start: "13:30", end: "14:00" },
  sunset: { start: "18:00", end: "18:00" },
};

export const BOOKING_TIME_SLOT_ORDER = [
  "morning_0930",
  "morning_1000",
  "afternoon_1330",
  "afternoon_1400",
  "sunset_1800",
];

export const BOOKING_SCHEDULE_PERIODS = [
  {
    id: "morning",
    label: "Morning schedule",
    timeRange: "Starts at 09:30",
    timeSlots: ["morning_0930", "morning_1000"],
  },
  {
    id: "afternoon",
    label: "Afternoon schedule",
    timeRange: "Starts at 13:30",
    timeSlots: ["afternoon_1330", "afternoon_1400"],
  },
  {
    id: "sunset",
    label: "Sunset schedule",
    timeRange: "Starts at 18:00",
    timeSlots: ["sunset_1800"],
  },
];

export const TOUR_TIME_SLOTS = {
  two_half_hours: [
    "morning_0930",
    "morning_1000",
    "afternoon_1330",
    "afternoon_1400",
  ],
  two_hours: [
    "morning_0930",
    "morning_1000",
    "afternoon_1330",
    "afternoon_1400",
  ],
  three_hours: [
    "morning_0930",
    "morning_1000",
    "afternoon_1330",
    "afternoon_1400",
  ],
  four_hours: [
    "morning_0930",
    "morning_1000",
    "afternoon_1330",
    "afternoon_1400",
  ],
  sunset_three_hours: ["sunset_1800"],
  five_hours: ["morning_0930", "morning_1000"],
};

function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function parseTimeWindow(timeWindow) {
  const normalizedWindow = timeWindow?.replace(/[–—]/g, "-").trim();

  if (!normalizedWindow) {
    return null;
  }

  if (/^\d{1,2}:\d{2}$/.test(normalizedWindow)) {
    const minutes = parseTimeToMinutes(normalizedWindow);
    return minutes === null ? null : { endMinutes: minutes, startMinutes: minutes };
  }

  const [start, end] = normalizedWindow.split("-").map((part) => part.trim());
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  return { endMinutes, startMinutes };
}

function getWindowForBooking(booking) {
  const parsedWindow = parseTimeWindow(booking.time_window);

  if (parsedWindow) {
    return parsedWindow;
  }

  const timeSlotWindow = TIME_SLOT_WINDOWS[booking.time_slot];

  if (!timeSlotWindow) {
    return null;
  }

  return {
    endMinutes: parseTimeToMinutes(timeSlotWindow.end),
    startMinutes: parseTimeToMinutes(timeSlotWindow.start),
  };
}

export function isActiveBlockingStatus(bookingStatus) {
  return ACTIVE_BOOKING_STATUSES.has(bookingStatus);
}

export function isActiveBlockingBooking(booking) {
  return (
    isActiveBlockingStatus(booking.booking_status) &&
    !NON_BLOCKING_PAYMENT_STATUSES.has(booking.payment_status)
  );
}

export function getValidTimeSlotsForTour(tourType) {
  return TOUR_TIME_SLOTS[tourType] ?? [];
}

export function getDisplayTimeForTimeSlot(timeSlot) {
  const timeSlotWindow = TIME_SLOT_WINDOWS[timeSlot];

  if (!timeSlotWindow) {
    return "";
  }

  return timeSlotWindow.start === timeSlotWindow.end
    ? timeSlotWindow.start
    : `${timeSlotWindow.start}-${timeSlotWindow.end}`;
}

export function isValidTimeSlotForTour(tourType, timeSlot) {
  return getValidTimeSlotsForTour(tourType).includes(timeSlot);
}

export function getBookingInterval(booking) {
  const duration = TOUR_DURATIONS_MINUTES[booking.tour_type];
  const window = getWindowForBooking(booking);

  if (!booking.requested_date || !duration || !window) {
    return null;
  }

  return {
    date: booking.requested_date,
    endMinutes: window.endMinutes + duration,
    startMinutes: window.startMinutes,
  };
}

export function intervalsOverlap(firstInterval, secondInterval) {
  return (
    firstInterval.startMinutes < secondInterval.endMinutes &&
    secondInterval.startMinutes < firstInterval.endMinutes
  );
}

export function bookingOverlapsSelection(existingBooking, requestedSelection) {
  if (
    existingBooking.requested_date !== requestedSelection.requested_date ||
    !isActiveBlockingBooking(existingBooking)
  ) {
    return false;
  }

  const existingInterval = getBookingInterval(existingBooking);
  const requestedInterval = getBookingInterval(requestedSelection);

  if (!existingInterval || !requestedInterval) {
    return false;
  }

  return intervalsOverlap(existingInterval, requestedInterval);
}

export function getBlockedTimeSlots(existingBookings, tourType, requestedDate) {
  const validTimeSlots = getValidTimeSlotsForTour(tourType);

  return validTimeSlots.filter((timeSlot) =>
    existingBookings.some((existingBooking) =>
      bookingOverlapsSelection(existingBooking, {
        requested_date: requestedDate,
        time_slot: timeSlot,
        tour_type: tourType,
      }),
    ),
  );
}
