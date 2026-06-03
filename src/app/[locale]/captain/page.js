import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ACTIVE_BOOKING_STATUSES,
  getDisplayTimeForTimeSlot,
} from "@/lib/bookingAvailability";
import AdminClock from "@/app/admin/AdminClock";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";

const CAPTAIN_BOOKING_SELECT =
  "id, customer_name, phone, guest_count, requested_date, tour_type, time_slot, time_window, pay_on_board_eur, booking_status, message";
const CAPTAIN_TIME_ZONE = "Europe/Rome";
const CAPRI_DAILY_FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.5532&longitude=14.2222&daily=weather_code,temperature_2m_max,wind_speed_10m_max&timezone=Europe%2FRome";
const MAX_OPEN_METEO_FORECAST_DAYS = 16;
const MEETING_POINT = "Molo 21, Marina Grande, Capri";
const TOUR_LABELS = {
  three_hours: "3 ore",
  four_hours: "4 ore",
  sunset_three_hours: "Sunset 3 ore",
  five_hours: "5 ore",
  two_hours: "2 ore",
  special_request: "Richiesta speciale",
};
const BOOKING_STATUS_LABELS = {
  cancelled: "🚫 cancellata",
  canceled: "🚫 cancellata",
  confirmed: "✅ confermata",
  declined: "❌ rifiutata",
  payment_pending: "⏳ pagamento in attesa",
  pending: "⏳ in attesa",
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

function formatStatus(value, labels) {
  if (!value) {
    return "ℹ️ —";
  }

  return labels[value] ?? `ℹ️ ${value}`;
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

function getWeatherSummary(weatherCode) {
  if (weatherCode === 0) {
    return "☀️ Sereno";
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return "🌤️ Poco nuvoloso";
  }

  if ([45, 48].includes(weatherCode)) {
    return "🌫️ Nebbia";
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return "🌧️ Pioggia";
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return "❄️ Neve";
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return "⛈️ Temporale";
  }

  return "🌦️ Meteo";
}

function formatRoundedNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function formatWeatherForecast(forecast) {
  if (!forecast) {
    return "Meteo previsto: non ancora disponibile";
  }

  const temperature = formatRoundedNumber(forecast.temperatureMax);
  const windSpeed = formatRoundedNumber(forecast.windSpeedMax);
  const parts = [getWeatherSummary(forecast.weatherCode)];

  if (temperature !== null) {
    parts.push(`${temperature}°C`);
  }

  if (windSpeed !== null) {
    parts.push(`vento ${windSpeed} km/h`);
  }

  return `Meteo previsto: ${parts.join(" · ")}`;
}

function getDaysBetweenDateStrings(startDateString, endDateString) {
  const startDate = new Date(`${startDateString}T00:00:00.000Z`);
  const endDate = new Date(`${endDateString}T00:00:00.000Z`);
  const differenceMs = endDate.getTime() - startDate.getTime();

  if (!Number.isFinite(differenceMs)) {
    return 0;
  }

  return Math.floor(differenceMs / 86_400_000);
}

function getForecastDays(bookings) {
  const today = getDateStringInTimeZone(new Date(), CAPTAIN_TIME_ZONE);
  const maxDaysAhead = bookings.reduce((maxDays, booking) => {
    const requestedDate = booking.requested_date;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? "")) {
      return maxDays;
    }

    return Math.max(maxDays, getDaysBetweenDateStrings(today, requestedDate));
  }, 0);

  return Math.min(Math.max(maxDaysAhead + 1, 1), MAX_OPEN_METEO_FORECAST_DAYS);
}

async function fetchWeatherForecastsByDate(bookings) {
  if (bookings.length === 0) {
    return {};
  }

  const forecastDays = getForecastDays(bookings);

  try {
    const response = await fetch(
      `${CAPRI_DAILY_FORECAST_URL}&forecast_days=${forecastDays}`,
      { next: { revalidate: 60 * 60 } },
    );

    if (!response.ok) {
      throw new Error("Could not load Open-Meteo forecast.");
    }

    const payload = await response.json();
    const daily = payload?.daily ?? {};
    const dates = daily.time ?? [];

    return dates.reduce((forecastsByDate, date, index) => {
      forecastsByDate[date] = {
        temperatureMax: daily.temperature_2m_max?.[index],
        weatherCode: daily.weather_code?.[index],
        windSpeedMax: daily.wind_speed_10m_max?.[index],
      };

      return forecastsByDate;
    }, {});
  } catch (error) {
    console.warn(
      `[captain weather] ${error?.message || "Could not load weather forecast."}`,
    );
    return {};
  }
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

function BookingCard({ booking, weatherForecast }) {
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
          <p>{formatStatus(booking.booking_status, BOOKING_STATUS_LABELS)}</p>
        </div>
      </div>
      <p className="border-y border-stone-200 py-2 text-sm font-medium text-stone-800">
        {formatWeatherForecast(weatherForecast)}
      </p>

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

function BookingSection({ bookings, title, weatherForecastsByDate }) {
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
            <BookingCard
              key={booking.id}
              booking={booking}
              weatherForecast={weatherForecastsByDate[booking.requested_date]}
            />
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
  const weatherForecastsByDate = await fetchWeatherForecastsByDate(sortedBookings);

  return (
    <main className="min-h-screen bg-[#f3eee7] px-4 py-6 text-stone-950 sm:px-6">
      <section className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Capri Love Boat
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                Prenotazioni capitano
              </h1>
              <p className="text-sm text-stone-600">
                Vista sola lettura delle prenotazioni confermate/attive.
              </p>
            </div>
            <div className="w-fit border border-stone-300 bg-[#fbf8f3]">
              <AdminClock />
            </div>
          </div>
        </header>

        <BookingSection
          bookings={groupedBookings.today}
          title="Today"
          weatherForecastsByDate={weatherForecastsByDate}
        />
        <BookingSection
          bookings={groupedBookings.tomorrow}
          title="Tomorrow"
          weatherForecastsByDate={weatherForecastsByDate}
        />
        <BookingSection
          bookings={groupedBookings.upcoming}
          title="Upcoming"
          weatherForecastsByDate={weatherForecastsByDate}
        />
      </section>
    </main>
  );
}
