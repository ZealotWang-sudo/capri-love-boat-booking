import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminRealtimeRefresh from "@/components/admin/AdminRealtimeRefresh";
import AdminHeader from "../AdminHeader";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";

const TOUR_TYPES = [
  "three_hours",
  "four_hours",
  "sunset_three_hours",
  "five_hours",
  "two_hours",
  "special_request",
];
const TOUR_LABELS = {
  three_hours: "3 hours",
  four_hours: "4 hours",
  sunset_three_hours: "Sunset 3 hours",
  five_hours: "5 hours",
  two_hours: "2 hours",
  special_request: "Special request",
};
const LOCALES = ["en", "zh", "it", "de", "fr"];
function getMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(value, monthStart = getMonthStart()) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const nextMonthStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
  );

  return date >= monthStart && date < nextMonthStart;
}

function getTodayDateString() {
  return formatRomeDateString(new Date());
}

function formatRomeDateString(value) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  })
    .formatToParts(new Date(value))
    .reduce((dateParts, part) => {
      dateParts[part.type] = part.value;
      return dateParts;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatEuro(value) {
  return `€${Number(value || 0).toLocaleString("en", {
    maximumFractionDigits: 0,
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en");
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function formatTourType(value) {
  return TOUR_LABELS[value] ?? value ?? "Unknown";
}

function formatTimeSlot(booking) {
  return booking.time_window || booking.time_slot || "Unknown";
}

function sumBy(bookings, fieldName) {
  return bookings.reduce(
    (total, booking) => total + Number(booking[fieldName] || 0),
    0,
  );
}

function countBy(bookings, fieldName) {
  return bookings.reduce((counts, booking) => {
    const key = booking[fieldName] || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function countByTime(bookings) {
  return bookings.reduce((counts, booking) => {
    const key = formatTimeSlot(booking);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function countByPageViewField(pageViews, fieldName, fallback = "Unknown") {
  return pageViews.reduce((counts, pageView) => {
    const key = pageView[fieldName] || fallback;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function getReferrerLabel(referrer) {
  if (!referrer) {
    return "Direct / none";
  }

  try {
    const url = new URL(referrer);

    return url.hostname;
  } catch {
    return referrer;
  }
}

function countByReferrer(pageViews) {
  return pageViews.reduce((counts, pageView) => {
    const key = getReferrerLabel(pageView.referrer);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function getCount(counts, key) {
  return counts[key] ?? 0;
}

function buildCountRows({ counts, labels }) {
  return labels.map(({ label, value }) => ({
    count: getCount(counts, value),
    label,
  }));
}

function buildSortedCountRows(counts) {
  return Object.entries(counts)
    .map(([label, count]) => ({ count, label }))
    .sort((firstRow, secondRow) => {
      if (secondRow.count !== firstRow.count) {
        return secondRow.count - firstRow.count;
      }

      return firstRow.label.localeCompare(secondRow.label);
    });
}

function MetricCard({ label, value, note }) {
  return (
    <article className="border border-stone-300 bg-[#fbf8f3] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <p className="mt-4 text-3xl font-light tracking-[-0.03em] text-stone-950">
        {value}
      </p>
      {note ? <p className="mt-3 text-sm text-stone-600">{note}</p> : null}
    </article>
  );
}

function DataTable({ emptyMessage = "No data yet.", rows, title }) {
  return (
    <section className="border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6">
      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-950">
        {title}
      </h2>
      <div className="mt-5 overflow-x-auto">
        {rows.length > 0 ? (
          <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-stone-500">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 text-right">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="py-3 pr-4 text-stone-700">{row.label}</td>
                  <td className="py-3 text-right font-medium text-stone-950">
                    {formatNumber(row.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-stone-500">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function UpcomingTripsTable({ bookings }) {
  return (
    <section className="border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6">
      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-950">
        Upcoming confirmed trips
      </h2>
      <div className="mt-5 overflow-x-auto">
        {bookings.length > 0 ? (
          <table className="min-w-[720px] divide-y divide-stone-200 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-stone-500">
              <tr>
                <th className="py-3 pr-4">Reference</th>
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Time</th>
                <th className="py-3 pr-4">Tour</th>
                <th className="py-3 text-right">Guests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="py-3 pr-4 text-stone-950">
                    CAPRI-{booking.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="py-3 pr-4 text-stone-700">
                    {booking.requested_date}
                  </td>
                  <td className="py-3 pr-4 text-stone-700">
                    {formatTimeSlot(booking)}
                  </td>
                  <td className="py-3 pr-4 text-stone-700">
                    {formatTourType(booking.tour_type)}
                  </td>
                  <td className="py-3 text-right font-medium text-stone-950">
                    {formatNumber(booking.guest_count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-stone-500">
            No upcoming confirmed trips yet.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function AdminDataPage() {
  const user = await getAdminUser("/admin/data");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: bookingRows, error } = await supabase
    .from("bookings")
    .select(
      "id, created_at, updated_at, locale, guest_count, requested_date, tour_type, time_slot, time_window, reservation_fee_eur, pay_on_board_eur, booking_status, payment_status",
    )
    .order("created_at", { ascending: false });
  const { data: pageViewRows, error: pageViewsError } = await supabase
    .from("page_views")
    .select("created_at, path, locale, referrer, session_id")
    .order("created_at", { ascending: false })
    .limit(5000);
  const bookings = bookingRows ?? [];
  const pageViews = pageViewRows ?? [];
  const statusCounts = countBy(bookings, "booking_status");
  const tourCounts = countBy(bookings, "tour_type");
  const localeCounts = countBy(bookings, "locale");
  const timeRows = buildSortedCountRows(countByTime(bookings));
  const capturedBookings = bookings.filter(
    (booking) => booking.payment_status === "captured",
  );
  const confirmedBookings = bookings.filter(
    (booking) => booking.booking_status === "confirmed",
  );
  const totalRequests = bookings.length;
  const confirmedCount = getCount(statusCounts, "confirmed");
  const completedCount = getCount(statusCounts, "completed");
  const cancelledCount = getCount(statusCounts, "cancelled");
  const notAvailableCount = getCount(statusCounts, "not_available");
  const conversionRate =
    totalRequests > 0 ? (confirmedCount / totalRequests) * 100 : 0;
  const thisMonthRequests = bookings.filter((booking) =>
    isSameMonth(booking.created_at),
  ).length;
  const thisMonthCapturedBookings = capturedBookings.filter((booking) =>
    isSameMonth(booking.updated_at),
  );
  const expectedPayOnBoard = sumBy(confirmedBookings, "pay_on_board_eur");
  const averageReservationFee =
    confirmedBookings.length > 0
      ? sumBy(confirmedBookings, "reservation_fee_eur") / confirmedBookings.length
      : 0;
  const todayDateString = getTodayDateString();
  const pageViewsToday = pageViews.filter(
    (pageView) => formatRomeDateString(pageView.created_at) === todayDateString,
  );
  const pageViewsThisMonth = pageViews.filter((pageView) =>
    isSameMonth(pageView.created_at),
  );
  const uniqueSessionsThisMonth = new Set(
    pageViewsThisMonth
      .map((pageView) => pageView.session_id)
      .filter(Boolean),
  ).size;
  const topPageRows = buildSortedCountRows(countByPageViewField(pageViews, "path"));
  const topReferrerRows = buildSortedCountRows(countByReferrer(pageViews));
  const pageViewLocaleRows = buildCountRows({
    counts: countByPageViewField(pageViews, "locale", "unknown"),
    labels: LOCALES.map((locale) => ({ label: locale, value: locale })),
  });
  const upcomingConfirmedBookings = confirmedBookings
    .filter((booking) => booking.requested_date >= todayDateString)
    .sort((firstBooking, secondBooking) => {
      const dateComparison = firstBooking.requested_date.localeCompare(
        secondBooking.requested_date,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return formatTimeSlot(firstBooking).localeCompare(
        formatTimeSlot(secondBooking),
      );
    })
    .slice(0, 5);
  const tourRows = buildCountRows({
    counts: tourCounts,
    labels: TOUR_TYPES.map((tourType) => ({
      label: formatTourType(tourType),
      value: tourType,
    })),
  });
  const localeRows = buildCountRows({
    counts: localeCounts,
    labels: LOCALES.map((locale) => ({ label: locale, value: locale })),
  });
  const conversionRows = [
    { count: getCount(statusCounts, "requested"), label: "Requested" },
    {
      count:
        getCount(statusCounts, "payment_pending") +
        getCount(statusCounts, "available"),
      label: "Payment pending",
    },
    { count: confirmedCount, label: "Confirmed" },
    { count: cancelledCount, label: "Cancelled" },
  ];

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <AdminRealtimeRefresh />
      <section className="mx-auto max-w-7xl">
        <AdminHeader active="data" title="Data" userEmail={user.email} />

        {error ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm text-red-900">
            Could not load booking data: {error.message}
          </div>
        ) : null}
        {pageViewsError ? (
          <div className="mt-8 border border-amber-700/30 bg-amber-50 p-5 text-sm text-amber-950">
            Could not load page view data. Run{" "}
            <code className="font-mono">supabase/page-views.sql</code> in
            Supabase if the table has not been created yet.
          </div>
        ) : null}

        <section className="mt-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            Site visits
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Page views today"
              value={formatNumber(pageViewsToday.length)}
            />
            <MetricCard
              label="Page views this month"
              value={formatNumber(pageViewsThisMonth.length)}
            />
            <MetricCard
              label="Unique sessions this month"
              value={formatNumber(uniqueSessionsThisMonth)}
              note="Anonymous browser sessions"
            />
          </div>
        </section>

        <section className="mt-8">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            Booking overview
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Total requests" value={formatNumber(totalRequests)} />
            <MetricCard
              label="Requests this month"
              value={formatNumber(thisMonthRequests)}
            />
            <MetricCard
              label="Confirmed bookings"
              value={formatNumber(confirmedCount)}
            />
            <MetricCard
              label="Completed bookings"
              value={formatNumber(completedCount)}
            />
            <MetricCard
              label="Cancelled bookings"
              value={formatNumber(cancelledCount)}
            />
            <MetricCard
              label="Not available"
              value={formatNumber(notAvailableCount)}
            />
          </div>
        </section>

        <section className="mt-10">
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            Revenue
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Captured reservation fees"
              value={formatEuro(sumBy(capturedBookings, "reservation_fee_eur"))}
            />
            <MetricCard
              label="Captured this month"
              value={formatEuro(
                sumBy(thisMonthCapturedBookings, "reservation_fee_eur"),
              )}
              note="Based on booking updated date"
            />
            <MetricCard
              label="Expected pay on board"
              value={formatEuro(expectedPayOnBoard)}
              note="Confirmed bookings only"
            />
            <MetricCard
              label="Avg reservation fee"
              value={formatEuro(averageReservationFee)}
              note="Confirmed bookings only"
            />
          </div>
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-2">
          <DataTable rows={conversionRows} title="Conversion" />
          <section className="border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-950">
              Simple conversion rate
            </h2>
            <p className="mt-5 text-5xl font-light tracking-[-0.04em]">
              {formatPercent(conversionRate)}
            </p>
            <p className="mt-3 text-sm text-stone-600">
              Confirmed bookings divided by total booking requests.
            </p>
          </section>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <DataTable rows={tourRows} title="Tour demand" />
          <DataTable rows={localeRows} title="Language demand" />
          <DataTable rows={timeRows} title="Time demand" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <DataTable rows={topPageRows.slice(0, 8)} title="Top pages" />
          <DataTable rows={topReferrerRows.slice(0, 8)} title="Top referrers" />
          <DataTable rows={pageViewLocaleRows} title="Visits by locale" />
        </section>

        <section className="mt-6">
          <UpcomingTripsTable bookings={upcomingConfirmedBookings} />
        </section>
      </section>
    </main>
  );
}
