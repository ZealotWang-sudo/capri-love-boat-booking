import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminRealtimeRefresh from "@/components/admin/AdminRealtimeRefresh";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_SCHEDULE_PERIODS,
  TIME_SLOT_WINDOWS,
  getBookingInterval,
  isActiveBlockingBooking,
} from "@/lib/bookingAvailability";
import AdminHeader from "../AdminHeader";
import AdminNotice from "../AdminNotice";
import AdminSubmitButton from "../AdminSubmitButton";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";
import AdminCalendarDayCard from "./AdminCalendarDayCard";
import AdminCalendarMonthNavigation from "./AdminCalendarMonthNavigation";
import { markDateRangeUnavailable } from "./actions";
const ADMIN_UNAVAILABLE_SLOTS_SQL = `-- Manual admin calendar unavailability.
-- Run this in the Supabase SQL editor.

create table if not exists public.admin_unavailable_slots (
  date date not null,
  time_slot text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (date, time_slot),
  constraint admin_unavailable_slots_time_slot_check
    check (
      time_slot in (
        'morning_0930',
        'morning_1000',
        'afternoon_1330',
        'afternoon_1400',
        'sunset_1800'
      )
    )
);

alter table public.admin_unavailable_slots enable row level security;

drop policy if exists "Public can read unavailable slots" on public.admin_unavailable_slots;
drop policy if exists "Admin can insert unavailable slots" on public.admin_unavailable_slots;
drop policy if exists "Admin can update unavailable slots" on public.admin_unavailable_slots;
drop policy if exists "Admin can delete unavailable slots" on public.admin_unavailable_slots;

create policy "Public can read unavailable slots"
  on public.admin_unavailable_slots
  for select
  to anon, authenticated
  using (true);

create policy "Admin can insert unavailable slots"
  on public.admin_unavailable_slots
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can update unavailable slots"
  on public.admin_unavailable_slots
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can delete unavailable slots"
  on public.admin_unavailable_slots
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

grant select on public.admin_unavailable_slots to anon, authenticated;
grant insert, update, delete on public.admin_unavailable_slots to authenticated;
grant all on public.admin_unavailable_slots to service_role;`;

function getCurrentMonth() {
  return getTodayDateString().slice(0, 7);
}

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
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

  return { endDate, lastDay, monthNumber, startDate, year };
}

function getMonthFromSearch(searchParams) {
  const requestedMonth = searchParams?.month;
  return /^\d{4}-\d{2}$/.test(requestedMonth ?? "")
    ? requestedMonth
    : getCurrentMonth();
}

function getNoticeText(searchParams, key) {
  const value = searchParams?.[key];

  return typeof value === "string" ? value : "";
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function formatWeekday(dateString) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(
    new Date(`${dateString}T00:00:00.000Z`),
  );
}

function getTimeSlotStartMinutes(timeSlot) {
  const start = TIME_SLOT_WINDOWS[timeSlot]?.start;
  const [hours, minutes] = start?.split(":").map(Number) ?? [];

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function bookingOccupiesTimeSlot(booking, date, timeSlot) {
  if (booking.requested_date !== date || !isActiveBlockingBooking(booking)) {
    return false;
  }

  const bookingInterval = getBookingInterval(booking);
  const timeSlotMinutes = getTimeSlotStartMinutes(timeSlot);

  if (!bookingInterval || timeSlotMinutes === null) {
    return false;
  }

  return (
    bookingInterval.startMinutes <= timeSlotMinutes &&
    timeSlotMinutes < bookingInterval.endMinutes
  );
}

function groupUnavailableSlots(unavailableSlots) {
  return unavailableSlots.reduce((groupedSlots, slot) => {
    groupedSlots[slot.date] ??= {};
    groupedSlots[slot.date][slot.time_slot] = slot;
    return groupedSlots;
  }, {});
}

function getCalendarDates(monthRange, todayDate) {
  return Array.from({ length: monthRange.lastDay }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${monthRange.year}-${String(monthRange.monthNumber).padStart(
      2,
      "0",
    )}-${day}`;
  }).filter((date) => date >= todayDate);
}

function getPeriodState({ bookings, date, period, unavailableSlotsByDate }) {
  const slotBookings = bookings.filter((booking) =>
    period.timeSlots.some((timeSlot) =>
      bookingOccupiesTimeSlot(booking, date, timeSlot),
    ),
  );
  const unavailableSlots = period.timeSlots
    .map((timeSlot) => unavailableSlotsByDate[date]?.[timeSlot])
    .filter(Boolean);
  const isUnavailable =
    unavailableSlots.length > 0 &&
    unavailableSlots.length === period.timeSlots.length;
  const isPartiallyUnavailable =
    unavailableSlots.length > 0 && unavailableSlots.length < period.timeSlots.length;
  const hasBookings = slotBookings.length > 0;
  const status = hasBookings
    ? "booked"
    : isUnavailable
      ? "unavailable"
      : isPartiallyUnavailable
        ? "partly unavailable"
        : "available";

  return {
    bookings: slotBookings,
    isPartiallyUnavailable,
    isUnavailable,
    period,
    status,
    unavailableSlots,
  };
}

function SqlSetupPanel() {
  return (
    <details className="mt-8 border border-stone-300 bg-[#fbf8f3]">
      <summary className="cursor-pointer px-5 py-4 text-xs font-medium uppercase tracking-[0.18em] text-stone-700">
        Supabase setup SQL
      </summary>
      <div className="border-t border-stone-300 p-5">
        <p className="max-w-3xl text-sm leading-7 text-stone-600">
          Run this once in the Supabase SQL editor to enable manual unavailable
          slots for the admin calendar.
        </p>
        <pre className="mt-4 max-h-96 overflow-auto border border-stone-300 bg-stone-950 p-4 text-xs leading-6 text-[#f3eee7]">
          <code>{ADMIN_UNAVAILABLE_SLOTS_SQL}</code>
        </pre>
      </div>
    </details>
  );
}

export default async function AdminCalendarPage({ searchParams }) {
  const user = await getAdminUser("/admin/calendar");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const resolvedSearchParams = await searchParams;
  const month = getMonthFromSearch(resolvedSearchParams);
  const monthRange = getMonthRange(month) ?? getMonthRange(getCurrentMonth());
  const todayDate = getTodayDateString();
  const rangeStartDate =
    monthRange.startDate < todayDate ? todayDate : monthRange.startDate;
  const supabase = await createSupabaseServerClient();
  const { data: bookingRows, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      "id, customer_name, requested_date, tour_type, time_slot, time_window, booking_status, payment_status",
    )
    .in("booking_status", Array.from(ACTIVE_BOOKING_STATUSES))
    .gte("requested_date", rangeStartDate)
    .lte("requested_date", monthRange.endDate)
    .order("requested_date", { ascending: true });
  const { data: unavailableRows, error: unavailableError } = await supabase
    .from("admin_unavailable_slots")
    .select("date, time_slot, reason")
    .gte("date", rangeStartDate)
    .lte("date", monthRange.endDate)
    .order("date", { ascending: true });
  const bookings = bookingRows ?? [];
  const unavailableSlotsByDate = groupUnavailableSlots(unavailableRows ?? []);
  const dates = getCalendarDates(monthRange, todayDate);
  const updatedNotice = getNoticeText(resolvedSearchParams, "updated");
  const updatedRangeCount = getNoticeText(resolvedSearchParams, "range");
  const successNotice =
    updatedNotice === "available"
      ? "Time slot is available again."
      : updatedNotice === "unavailable"
        ? "Time slot marked unavailable."
        : updatedNotice === "unavailable_range"
          ? `Marked ${updatedRangeCount || "multiple"} day(s) unavailable.`
        : "";
  const errorNotice = getNoticeText(resolvedSearchParams, "error");

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <AdminRealtimeRefresh />
      <section className="mx-auto max-w-7xl">
        <AdminHeader active="calendar" title="Calendar" userEmail={user.email} />

        {successNotice ? <AdminNotice>{successNotice}</AdminNotice> : null}
        {errorNotice ? (
          <AdminNotice tone="error">{errorNotice}</AdminNotice>
        ) : null}

        <div className="mt-8 flex flex-col justify-between gap-4 border border-stone-300 bg-[#fbf8f3] p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
              Admin availability
            </p>
            <h2 className="mt-2 text-3xl font-light tracking-[-0.03em]">
              {formatMonthLabel(month)}
            </h2>
          </div>
          <AdminCalendarMonthNavigation month={month} />
        </div>

        <form
          action={markDateRangeUnavailable}
          className="mt-4 border border-stone-300 bg-[#fbf8f3] p-5"
        >
          <input type="hidden" name="month" value={month} />
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            Quick block
          </p>
          <h3 className="mt-2 text-xl font-light tracking-[-0.02em]">
            Mark multiple days unavailable
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                Start date
              </span>
              <input
                type="date"
                name="startDate"
                defaultValue={rangeStartDate}
                required
                className="mt-2 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-950"
              />
            </label>
            <label className="block">
              <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                End date
              </span>
              <input
                type="date"
                name="endDate"
                defaultValue={monthRange.endDate}
                required
                className="mt-2 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-950"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
                Reason (optional)
              </span>
              <input
                type="text"
                name="reason"
                placeholder="Vacation / maintenance / private event"
                className="mt-2 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-950"
              />
            </label>
          </div>
          <div className="mt-4">
            <AdminSubmitButton
              pendingLabel="Blocking days..."
              className="border border-stone-950 bg-stone-950 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60"
            >
              Mark range unavailable
            </AdminSubmitButton>
          </div>
        </form>

        {bookingsError || unavailableError ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm leading-7 text-red-900">
            {bookingsError ? (
              <p>Could not load bookings: {bookingsError.message}</p>
            ) : null}
            {unavailableError ? (
              <p>
                Could not load unavailable slots: {unavailableError.message}
              </p>
            ) : null}
          </div>
        ) : null}

       

        <div className="mt-8 grid gap-4 xl:grid-cols-6 lg:grid-cols-5 md:grid-cols-4 sm:grid-cols-3 grid-cols-2">
          {dates.length > 0 ? (
            dates.map((date) => {
              const periodStates = BOOKING_SCHEDULE_PERIODS.map((period) =>
                getPeriodState({ bookings, date, period, unavailableSlotsByDate }),
              );
              const unavailableSlotCount = Object.keys(
                unavailableSlotsByDate[date] ?? {},
              ).length;
              const isFullyUnavailable =
                unavailableSlotCount >=
                BOOKING_SCHEDULE_PERIODS.flatMap((period) => period.timeSlots).length;

              return (
                <AdminCalendarDayCard
                  key={date}
                  date={date}
                  dayNumber={Number(date.slice(-2))}
                  isFullyUnavailable={isFullyUnavailable}
                  month={month}
                  periodStates={periodStates}
                  weekday={formatWeekday(date)}
                />
              );
            })
          ) : (
            <div className="border border-stone-300 bg-[#fbf8f3] p-8 text-sm leading-7 text-stone-600 lg:col-span-3">
              No future days in this month.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
