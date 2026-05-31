const CAPTAIN_TOUR_LABELS = {
  three_hours: "3 ore",
  four_hours: "4 ore",
  sunset_three_hours: "Sunset 3 ore",
  five_hours: "5 ore",
  two_hours: "2 ore",
  special_request: "Richiesta speciale",
};
export const CAPTAIN_MESSAGE_TYPES = {
  cancellation: "cancellation",
  finalConfirmation: "final_confirmation",
  timeConfirmation: "time_confirmation",
};
export const CAPTAIN_MESSAGE_TYPE_VALUES = new Set(
  Object.values(CAPTAIN_MESSAGE_TYPES),
);
export const CAPTAIN_MESSAGE_TYPE_LABELS = {
  [CAPTAIN_MESSAGE_TYPES.cancellation]: "Cancellation",
  [CAPTAIN_MESSAGE_TYPES.finalConfirmation]: "Final confirmation",
  [CAPTAIN_MESSAGE_TYPES.timeConfirmation]: "Time confirmation",
};

function formatValue(value) {
  return value || "—";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "—";
}

function formatCaptainTourType(value) {
  return CAPTAIN_TOUR_LABELS[value] ?? formatValue(value);
}

function formatReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "—";
}

function formatItalianDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    return formatValue(value);
  }

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

export function buildCaptainTimeConfirmationMessage(booking) {
  const customerMessage = booking.message?.trim();
  const messageLines = [
    "Ciao, puoi verificare la disponibilità per questa richiesta?",
    "",
    `Riferimento: ${formatReferenceCode(booking.id)}`,
    `Cliente: ${formatValue(booking.customer_name)}`,
    `Tour: ${formatCaptainTourType(booking.tour_type)}`,
    `Data: ${formatItalianDate(booking.requested_date)}`,
    `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Ospiti: ${formatValue(booking.guest_count)}`,
    "",
    "Non è ancora confermata: se confermi, incassiamo la quota e ti inviamo la conferma finale.",
  ];

  if (customerMessage) {
    messageLines.push("", "Messaggio del cliente:", customerMessage);
  }

  return messageLines.join("\n");
}

export function buildCaptainFinalConfirmationMessage(booking) {
  const customerMessage = booking.message?.trim();

  const messageLines = [
    "Ciao, la quota di prenotazione è stata pagata e questa prenotazione è confermata.",
    "",
    `Riferimento: ${formatReferenceCode(booking.id)}`,
    `Cliente: ${formatValue(booking.customer_name)}`,
    `Telefono: ${formatValue(booking.phone)}`,
    `Email: ${formatValue(booking.email)}`,
    "",
    `Tour: ${formatCaptainTourType(booking.tour_type)}`,
    `Data: ${formatItalianDate(booking.requested_date)}`,
    `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Ospiti: ${formatValue(booking.guest_count)}`,
    "",
    `Saldo da incassare a bordo: ${formatEuro(booking.pay_on_board_eur)}`,
  ];

  if (customerMessage) {
    messageLines.push("", "Messaggio del cliente:", customerMessage);
  }

  return messageLines.join("\n");
}

export function buildCaptainCancellationMessage(booking) {
  const cancellationReason =
    booking.customer_cancel_reason?.trim() || booking.cancellation_reason?.trim();

  const messageLines = [
    "Ciao, il cliente ha cancellato questa prenotazione.",
    "",
    `Riferimento: ${formatReferenceCode(booking.id)}`,
    `Cliente: ${formatValue(booking.customer_name)}`,
    "",
    `Tour: ${formatCaptainTourType(booking.tour_type)}`,
    `Data: ${formatItalianDate(booking.requested_date)}`,
    `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Ospiti: ${formatValue(booking.guest_count)}`,
    "",
    "Questa prenotazione non è più confermata, quindi non è necessario tenere questo orario riservato.",
  ];

  if (cancellationReason) {
    messageLines.push("", "Motivo della cancellazione:", cancellationReason);
  }

  return messageLines.join("\n");
}

export function buildCaptainMessageByType(booking, messageType) {
  if (messageType === CAPTAIN_MESSAGE_TYPES.cancellation) {
    return buildCaptainCancellationMessage(booking);
  }

  if (messageType === CAPTAIN_MESSAGE_TYPES.finalConfirmation) {
    return buildCaptainFinalConfirmationMessage(booking);
  }

  return buildCaptainTimeConfirmationMessage(booking);
}

export function getCaptainMessageType(booking) {
  if (booking.booking_status === "cancelled" || booking.booking_status === "not_available") {
    return CAPTAIN_MESSAGE_TYPES.cancellation;
  }

  if (
    booking.payment_status === "captured" ||
    booking.booking_status === "confirmed"
  ) {
    return CAPTAIN_MESSAGE_TYPES.finalConfirmation;
  }

  if (
    booking.booking_status === "requested" ||
    booking.booking_status === "checking_with_captain"
  ) {
    return CAPTAIN_MESSAGE_TYPES.timeConfirmation;
  }

  return null;
}

export function getCaptainMessageCopiedState(booking) {
  const messageType = getCaptainMessageType(booking);

  if (!messageType) {
    return {
      copied: false,
      copiedAt: null,
      label: "No captain message",
      messageType: null,
    };
  }

  const copied = booking.captain_message_copied_type === messageType;

  return {
    copied,
    copiedAt: copied ? booking.captain_message_copied_at : null,
    label: CAPTAIN_MESSAGE_TYPE_LABELS[messageType],
    messageType,
  };
}

export function buildCaptainMessage(booking) {
  const messageType = getCaptainMessageType(booking);
  return buildCaptainMessageByType(booking, messageType);
}
