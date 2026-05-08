export function isUnavailableSlotsTableMissing(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.message?.includes("Could not find the table") ||
    error?.message?.includes("admin_unavailable_slots")
  );
}

export function groupUnavailableSlotsByDate(unavailableSlots) {
  return (unavailableSlots ?? []).reduce((groupedSlots, slot) => {
    groupedSlots[slot.date] ??= new Set();
    groupedSlots[slot.date].add(slot.time_slot);
    return groupedSlots;
  }, {});
}

export function getManualBlockedTimeSlots({
  date,
  unavailableSlotsByDate,
  validTimeSlots,
}) {
  const unavailableTimeSlots = unavailableSlotsByDate[date];

  if (!unavailableTimeSlots) {
    return [];
  }

  return validTimeSlots.filter((timeSlot) => unavailableTimeSlots.has(timeSlot));
}
