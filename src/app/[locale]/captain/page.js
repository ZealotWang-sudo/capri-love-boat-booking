import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CalendarDaysIcon, ClockIcon,CheckIcon } from "lucide-react";
import {
  ACTIVE_BOOKING_STATUSES,
  getDisplayTimeForTimeSlot,
} from "@/lib/bookingAvailability";
import AdminClock from "@/app/admin/AdminClock";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";

const CAPTAIN_BOOKING_SELECT =
  "id, customer_name, email, phone, guest_count, requested_date, tour_type, time_slot, time_window, pay_on_board_eur, booking_status, message";
const CAPTAIN_TIME_ZONE = "Europe/Rome";
const CAPRI_HOURLY_FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.5532&longitude=14.2222&hourly=weather_code,temperature_2m,wind_speed_10m&timezone=Europe%2FRome";
const MAX_OPEN_METEO_FORECAST_DAYS = 16;
const MEETING_POINT = "Molo 21, Marina Grande, Capri";
const TOUR_LABELS = {
  two_half_hours: "2,5 ore",
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
  confirmed: <CheckIcon  className="text-white bg-green-500 rounded-sm p-1" />,
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
    return "Meteo tour: non ancora disponibile";
  }

  const temperature = formatRoundedNumber(forecast.temperature);
  const windSpeed = formatRoundedNumber(forecast.windSpeed);
  const parts = [getWeatherSummary(forecast.weatherCode)];

  if (forecast.forecastTime) {
    parts.push(forecast.forecastTime);
  }

  if (temperature !== null) {
    parts.push(`${temperature}°C`);
  }

  if (windSpeed !== null) {
    parts.push(`vento ${windSpeed} km/h`);
  }

  return `${parts.join(" · ")}`;
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

function parseBookingStartMinutes(booking) {
  const normalized = String(getTimeLabel(booking) || "")
    .replace(/[–—]/g, "-")
    .split("-")[0]
    .trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);

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

function getForecastHourForBooking(booking) {
  const startMinutes = parseBookingStartMinutes(booking);

  if (startMinutes === null) {
    return null;
  }

  return Math.min(23, Math.round(startMinutes / 60));
}

function getForecastKeyForBooking(booking) {
  const forecastHour = getForecastHourForBooking(booking);

  if (!booking.requested_date || forecastHour === null) {
    return "";
  }

  return `${booking.requested_date}T${String(forecastHour).padStart(2, "0")}:00`;
}

function formatForecastHour(forecastKey) {
  const forecastHour = /^(\d{4}-\d{2}-\d{2})T(\d{2}):00$/.exec(forecastKey)?.[2];

  return forecastHour ? `${forecastHour}:00` : "";
}

async function fetchWeatherForecastsByBookingTime(bookings) {
  if (bookings.length === 0) {
    return {};
  }

  const forecastDays = getForecastDays(bookings);

  try {
    const response = await fetch(
      `${CAPRI_HOURLY_FORECAST_URL}&forecast_days=${forecastDays}`,
      { next: { revalidate: 60 * 60 } },
    );

    if (!response.ok) {
      throw new Error("Could not load Open-Meteo forecast.");
    }

    const payload = await response.json();
    const hourly = payload?.hourly ?? {};
    const forecastTimes = hourly.time ?? [];

    return forecastTimes.reduce((forecastsByTime, forecastKey, index) => {
      forecastsByTime[forecastKey] = {
        forecastTime: formatForecastHour(forecastKey),
        temperature: hourly.temperature_2m?.[index],
        weatherCode: hourly.weather_code?.[index],
        windSpeed: hourly.wind_speed_10m?.[index],
      };

      return forecastsByTime;
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
         <div className="flex items-center gap-1">  
          <CalendarDaysIcon className="w-4 h-4" />
          <p className="text-sm font-semibold text-stone-950">
            {formatDateForCaptain(booking.requested_date)}
          </p>
          </div>
          <div className="flex items-center gap-1">  
          <ClockIcon className="w-4 h-4" />
          <p className="text-sm  font-semibold text-stone-700">{getTimeLabel(booking)}</p>
          </div>
        </div>
     
      </div>
      <p className="border-b border-stone-200 py-2 text-sm font-medium text-stone-800">
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
          <span className="font-medium">Email:</span>{" "}
          {booking.email ? (
            <a className="underline" href={`mailto:${booking.email}`}>
              {booking.email}
            </a>
          ) : (
            "—"
          )}
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
        {/* <p>
          <span className="font-medium">Punto d'incontro:</span> {MEETING_POINT}
        </p> */}
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

function BookingSection({ bookings, title, weatherForecastsByBookingTime }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-stone-300 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-700">
          {title}
        </h2>
        <span className="text-xs text-stone-500 bg-gray-500 text-white w-6 h-6 flex items-center justify-center rounded-xl">{bookings.length}</span>
      </div>
      {bookings.length > 0 ? (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              weatherForecast={
                weatherForecastsByBookingTime[getForecastKeyForBooking(booking)]
              }
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
  const weatherForecastsByBookingTime =
    await fetchWeatherForecastsByBookingTime(sortedBookings);

  return (
    <main className="min-h-screen bg-[#f3eee7] px-4 py-6 text-stone-950 sm:px-6">
      <section className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-4 " >
          <div className="flex  flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2 w-full">

              <div className="flex w= items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Capri Love Boat
              </p>
             

              <span className="block sm:hidden">
                <AdminClock compact={true} />
              </span>
              <span className="hidden sm:block">
                <AdminClock />
              </span>
         
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                Prenotazioni capitano         
              </h1>
              <p className="text-sm text-stone-600">
                Vista sola lettura delle prenotazioni confermate/attive.
              </p>
            </div>
     
      
         
          </div>
        </header>

        <BookingSection
          bookings={groupedBookings.today}
          title="Today"
          weatherForecastsByBookingTime={weatherForecastsByBookingTime}
        />
        <BookingSection
          bookings={groupedBookings.tomorrow}
          title="Tomorrow"
          weatherForecastsByBookingTime={weatherForecastsByBookingTime}
        />
        <BookingSection
          bookings={groupedBookings.upcoming}
          title="Upcoming"
          weatherForecastsByBookingTime={weatherForecastsByBookingTime}
        />
      </section>
    </main>
  );
}
