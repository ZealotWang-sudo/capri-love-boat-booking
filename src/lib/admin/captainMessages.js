const CAPTAIN_TOUR_LABELS = {
  three_hours: "3 ore",
  four_hours: "4 ore",
  sunset_three_hours: "Sunset 3 ore",
  five_hours: "5 ore",
  two_hours: "2 ore",
  special_request: "Richiesta speciale",
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
    "Ciao, abbiamo una nuova richiesta di prenotazione da verificare.",
    "",
    `Riferimento: ${formatReferenceCode(booking.id)}`,
    `Cliente: ${formatValue(booking.customer_name)}`,
    "",
    `Tour: ${formatCaptainTourType(booking.tour_type)}`,
    `Data: ${formatItalianDate(booking.requested_date)}`,
    `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Ospiti: ${formatValue(booking.guest_count)}`,
    "",
    "Puoi confermare se sei disponibile per questo orario?",
    "",
    "Nota: questa non è ancora una prenotazione confermata. Se confermi la disponibilità, incasseremo la quota di prenotazione e ti invieremo il messaggio finale di conferma.",
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

export function buildCaptainMessage(booking) {
  const isPaidBooking =
    booking.payment_status === "captured" ||
    booking.booking_status === "confirmed" ||
    booking.booking_status === "completed";

  return isPaidBooking
    ? buildCaptainFinalConfirmationMessage(booking)
    : buildCaptainTimeConfirmationMessage(booking);
}
