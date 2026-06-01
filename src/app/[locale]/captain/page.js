import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ACTIVE_BOOKING_STATUSES,
  getDisplayTimeForTimeSlot,
} from "@/lib/bookingAvailability";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";

const CAPTAIN_BOOKING_SELECT =
  "id, customer_name, phone, guest_count, requested_date, tour_type, time_slot, time_window, total_price_eur, reservation_fee_eur, pay_on_board_eur, payment_status, booking_status, message";
const CAPTAIN_TIME_ZONE = "Europe/Rome";
const MEETING_POINT = "Molo 21, Marina Grande, Capri";
const TOUR_LABELS = {
  three_hours: "3 ore",
  four_hours: "4 ore",
  sunset_three_hours: "Sunset 3 ore",
  five_hours: "5 ore",
  two_hours: "2 ore",
  special_request: "Richiesta speciale",
};

function getSearchToken(searchParams) {
  const token = searchParams?.token;
  return typeof token === "string" ? token.trim() : "";
}

function getDateStringInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString, daysToAdd) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "—";
}

function formatValue(value) {
  return value || "—";
}

function formatDateForCaptain(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    return formatValue(value);
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatTourType(value) {
  return TOUR_LABELS[value] ?? formatValue(value);
}

function getTimeLabel(booking) {
  return (
    booking.time_window ||
    getDisplayTimeForTimeSlot(booking.time_slot) ||
    booking.time_slot ||
    "—"
  );
}

function parseTimeWindowToMinutes(timeLabel) {
  const normalized = String(timeLabel || "")
    .split("-")[0]
    .trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function sortBookings(bookings) {
  return [...bookings].sort((firstBooking, secondBooking) => {
    const dateCompare = String(firstBooking.requested_date || "").localeCompare(
      String(secondBooking.requested_date || ""),
    );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const firstMinutes = parseTimeWindowToMinutes(getTimeLabel(firstBooking));
    const secondMinutes = parseTimeWindowToMinutes(getTimeLabel(secondBooking));

    if (firstMinutes !== secondMinutes) {
      return firstMinutes - secondMinutes;
    }

    return getTimeLabel(firstBooking).localeCompare(getTimeLabel(secondBooking));
  });
}

function groupBookings(bookings) {
  const today = getDateStringInTimeZone(new Date(), CAPTAIN_TIME_ZONE);
  const tomorrow = addDaysToDateString(today, 1);
  const groups = {
    today: [],
    tomorrow: [],
    upcoming: [],
  };

  for (const booking of bookings) {
    const bookingDate = booking.requested_date;

    if (bookingDate === today) {
      groups.today.push(booking);
      continue;
    }

    if (bookingDate === tomorrow) {
      groups.tomorrow.push(booking);
      continue;
    }

    groups.upcoming.push(booking);
  }

  return groups;
}

function BookingCard({ booking }) {
  return (
    <article className="space-y-3 border border-stone-300 bg-[#fbf8f3] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-950">
            {formatDateForCaptain(booking.requested_date)}
          </p>
          <p className="text-sm text-stone-700">{getTimeLabel(booking)}</p>
        </div>
        <div className="text-right text-xs text-stone-600">
          <p>{formatValue(booking.booking_status)}</p>
          <p>{formatValue(booking.payment_status)}</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm text-stone-800">
        <p>
          <span className="font-medium">Tour:</span> {formatTourType(booking.tour_type)}
        </p>
        <p>
          <span className="font-medium">Persone:</span> {formatValue(booking.guest_count)}
        </p>
        <p>
          <span className="font-medium">Cliente:</span> {formatValue(booking.customer_name)}
        </p>
        <p>
          <span className="font-medium">Telefono:</span>{" "}
          {booking.phone ? (
            <a className="underline" href={`tel:${booking.phone}`}>
              {booking.phone}
            </a>
          ) : (
            "—"
          )}
        </p>
        <p>
          <span className="font-medium">Totale:</span> {formatEuro(booking.total_price_eur)}
        </p>
        <p>
          <span className="font-medium">Caparra:</span>{" "}
          {formatEuro(booking.reservation_fee_eur)}
        </p>
        <p>
          <span className="font-medium">Da pagare a bordo:</span>{" "}
          {formatEuro(booking.pay_on_board_eur)}
        </p>
        <p>
          <span className="font-medium">Punto d'incontro:</span> {MEETING_POINT}
        </p>
      </div>

      <div className="border-t border-stone-200 pt-3">
        <p className="text-xs uppercase tracking-[0.14em] text-stone-500">Messaggio</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
          {formatValue(booking.message)}
        </p>
      </div>
    </article>
  );
}

function BookingSection({ bookings, title }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-stone-300 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-700">
          {title}
        </h2>
        <span className="text-xs text-stone-500">{bookings.length}</span>
      </div>
      {bookings.length > 0 ? (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-500">Nessuna prenotazione.</p>
      )}
    </section>
  );
}

export default async function CaptainBookingsPage({ params, searchParams }) {
  const { locale } = await params;
  const query = await searchParams;
  const dashboardToken = process.env.CAPTAIN_DASHBOARD_TOKEN;
  const token = getSearchToken(query);

  setRequestLocale(locale);

  if (!dashboardToken || token !== dashboardToken) {
    notFound();
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(CAPTAIN_BOOKING_SELECT)
    .in("booking_status", Array.from(ACTIVE_BOOKING_STATUSES))
    .order("requested_date", { ascending: true })
    .order("time_window", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#f3eee7] px-4 py-8 text-stone-950">
        <section className="mx-auto max-w-2xl border border-red-900/30 bg-red-50 p-4 text-sm text-red-900">
          Could not load bookings: {error.message}
        </section>
      </main>
    );
  }

  const sortedBookings = sortBookings(bookings ?? []);
  const groupedBookings = groupBookings(sortedBookings);

  return (
    <main className="min-h-screen bg-[#f3eee7] px-4 py-6 text-stone-950 sm:px-6">
      <section className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Capri Love Boat
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Prenotazioni capitano
          </h1>
          <p className="text-sm text-stone-600">
            Vista sola lettura delle prenotazioni confermate/attive.
          </p>
        </header>

        <BookingSection bookings={groupedBookings.today} title="Today" />
        <BookingSection bookings={groupedBookings.tomorrow} title="Tomorrow" />
        <BookingSection bookings={groupedBookings.upcoming} title="Upcoming" />
      </section>
    </main>
  );
}
