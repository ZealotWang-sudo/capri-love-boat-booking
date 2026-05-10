import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminRealtimeRefresh from "@/components/admin/AdminRealtimeRefresh";
import AdminActionForm from "./AdminActionForm";
import AdminHeader from "./AdminHeader";
import AdminBookingDetails from "./AdminBookingDetails";
import { getAdminUser, isAllowedAdmin } from "./auth";
import UnauthorizedAdmin from "./UnauthorizedAdmin";

const TOUR_LABELS = {
  three_hours: "3 hours",
  four_hours: "4 hours",
  sunset_three_hours: "Sunset 3 hours",
  five_hours: "5 hours",
  two_hours: "2 hours",
  special_request: "Special request",
};
const CAPTAIN_TOUR_LABELS = {
  three_hours: "3 ore",
  four_hours: "4 ore",
  sunset_three_hours: "Sunset 3 ore",
  five_hours: "5 ore",
  two_hours: "2 ore",
  special_request: "Richiesta speciale",
};
const PRIMARY_STATUS_ACTIONS = {
  requested: {
    value: "checking_with_captain",
    label: "Contact captain",
    confirmMessage: "Mark this booking as checking with captain?",
    confirmTitle: "Update booking status?",
  },
  payment_pending: {
    value: "confirmed",
    label: "Confirm manually",
    confirmMessage: "Confirm this booking and mark payment as captured?",
    confirmTitle: "Confirm this booking?",
    variant: "primary",
  },
  confirmed: {
    value: "completed",
    label: "Trip completed",
    confirmMessage: "Mark this confirmed trip as completed?",
    confirmTitle: "Complete this trip?",
  },
};
const BOOKING_GROUPS = [
  {
    id: "needs_action",
    title: "Needs action",
    statuses: ["requested", "checking_with_captain"],
    defaultOpen: true,
    sort(bookings) {
      return sortByDateDesc(bookings, "created_at");
    },
  },
  {
    id: "waiting_for_customer",
    title: "Waiting for customer",
    statuses: ["payment_pending"],
    defaultOpen: true,
    sort(bookings) {
      return sortByDateDesc(bookings, "updated_at");
    },
  },
  {
    id: "confirmed_bookings",
    title: "Upcoming confirmed trips",
    statuses: ["confirmed"],
    defaultOpen: true,
    sort(bookings) {
      return [...bookings].sort(
        (firstBooking, secondBooking) =>
          getDateTime(firstBooking.requested_date) -
          getDateTime(secondBooking.requested_date),
      );
    },
  },
  {
    id: "completed_trips",
    title: "Completed trips",
    statuses: ["completed"],
    defaultOpen: false,
    sort(bookings) {
      return sortByDateDesc(bookings, "updated_at");
    },
  },
  {
    id: "closed",
    title: "Closed / cancelled",
    statuses: ["cancelled", "not_available", "expired"],
    defaultOpen: false,
    sort(bookings) {
      return sortByDateDesc(bookings, "updated_at");
    },
  },
];
const CLOSED_BOOKING_STATUSES = new Set([
  "cancelled",
  "not_available",
  "expired",
]);
const ADMIN_TIME_ZONE = "Europe/Rome";

function getDateTime(value) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function sortByDateDesc(bookings, fieldName) {
  return [...bookings].sort(
    (firstBooking, secondBooking) =>
      getDateTime(secondBooking[fieldName]) - getDateTime(firstBooking[fieldName]),
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: ADMIN_TIME_ZONE,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatValue(value) {
  return value || "—";
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "—";
}

function formatTourType(value) {
  return TOUR_LABELS[value] ?? formatValue(value);
}

function formatCaptainTourType(value) {
  return CAPTAIN_TOUR_LABELS[value] ?? formatValue(value);
}

function formatReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "—";
}

function formatBookingStatus(value) {
  return value === "available" ? "payment_pending" : formatValue(value);
}

function getSearchQuery(searchParams) {
  const query = searchParams?.q;

  return typeof query === "string" ? query.trim() : "";
}

function normalizeSearchValue(value) {
  return String(value ?? "").toLowerCase();
}

function bookingMatchesSearch(booking, searchQuery) {
  if (!searchQuery) {
    return true;
  }

  const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const searchableText = [
    booking.id,
    formatReferenceCode(booking.id),
    booking.customer_name,
    booking.email,
    booking.phone,
    booking.locale,
    booking.requested_date,
    booking.time_slot,
    booking.time_window,
    booking.tour_type,
    formatTourType(booking.tour_type),
    booking.booking_status,
    formatBookingStatus(booking.booking_status),
    booking.payment_status,
    booking.captain_status,
    booking.stripe_checkout_session_id,
    booking.stripe_payment_intent_id,
    booking.message,
  ]
    .map(normalizeSearchValue)
    .join(" ");

  return searchTerms.every((term) => searchableText.includes(term));
}

function getWhatsappHref(phone) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 6 || digits.length > 15) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

function buildCaptainMessage(booking) {
  const customerMessage = booking.message?.trim();
  const isPaidBooking =
    booking.payment_status === "captured" ||
    booking.booking_status === "confirmed" ||
    booking.booking_status === "completed";

  if (!isPaidBooking) {
    return [
      "Ciao Capitano, abbiamo una nuova richiesta di prenotazione da verificare.",
      "",
      `Tour: ${formatCaptainTourType(booking.tour_type)}`,
      `Data: ${formatValue(booking.requested_date)}`,
      `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
      `Ospiti: ${formatValue(booking.guest_count)}`,
      "",
      "Puoi confermare se sei disponibile per questo orario?",
    ].join("\n");
  }

  return [
    "Ciao Capitano, la quota di prenotazione è stata pagata e questa prenotazione è confermata.",
    "",
    `Riferimento: ${formatReferenceCode(booking.id)}`,
    `Cliente: ${formatValue(booking.customer_name)}`,
    `Telefono: ${formatValue(booking.phone)}`,
    `Email: ${formatValue(booking.email)}`,
    `Lingua cliente: ${formatValue(booking.locale)}`,
    `Metodo di contatto: ${formatValue(booking.contact_method)}`,
    "",
    `Tour: ${formatCaptainTourType(booking.tour_type)}`,
    `Data: ${formatValue(booking.requested_date)}`,
    `Orario: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Ospiti: ${formatValue(booking.guest_count)}`,
    "",
    `Prezzo totale: ${formatEuro(booking.total_price_eur)}`,
    `Quota di prenotazione pagata: ${formatEuro(booking.reservation_fee_eur)}`,
    `Saldo da incassare a bordo: ${formatEuro(booking.pay_on_board_eur)}`,
    "",
    "Messaggio del cliente:",
    customerMessage || "Nessun messaggio.",
  ].join("\n");
}

function StatusBadge({ label, value }) {
  return (
    <div className="border border-stone-300 bg-[#f3eee7] px-2.5 py-1.5">
      <p className="text-[0.6rem] uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium text-stone-950">
        {formatValue(value)}
      </p>
    </div>
  );
}

function StatusBadges({ booking }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge
        label="Booking"
        value={formatBookingStatus(booking.booking_status)}
      />
      <StatusBadge label="Payment" value={booking.payment_status} />
      <StatusBadge label="Captain" value={booking.captain_status} />
    </div>
  );
}

function getPrimaryStatusAction(booking) {
  if (
    CLOSED_BOOKING_STATUSES.has(booking.booking_status) ||
    booking.booking_status === "completed"
  ) {
    return null;
  }

  if (
    booking.booking_status === "checking_with_captain" &&
    booking.captain_status === "pending"
  ) {
    return {
      value: "captain_available",
      label: "Captain available",
      confirmMessage:
        "Mark the captain as available and move this booking to payment pending?",
      confirmTitle: "Captain confirmed time?",
    };
  }

  if (booking.booking_status === "available") {
    return PRIMARY_STATUS_ACTIONS.payment_pending;
  }

  return PRIMARY_STATUS_ACTIONS[booking.booking_status] ?? null;
}

function StatusActionForm({ action, bookingId }) {
  return (
    <AdminActionForm
      actionType={action.actionType}
      bookingId={bookingId}
      confirmLabel={action.confirmLabel}
      confirmMessage={action.confirmMessage}
      confirmTitle={action.confirmTitle}
      label={action.label}
      statusAction={action.value}
      variant={action.variant ?? "primary"}
    />
  );
}

function ContactSummary({ booking }) {
  const whatsappHref = getWhatsappHref(booking.phone);

  return (
    <div className="space-y-1 text-stone-600">

<p>{booking.customer_name}</p>
      <p>
        
        {formatValue(booking.email)}
      </p>
      <p>
       
        {formatValue(booking.phone)}
        {whatsappHref ? (
          <>
            {" "}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-stone-400 underline-offset-4 hover:text-stone-950"
            >
              WhatsApp
            </a>
          </>
        ) : null}
      </p>
    
    </div>
  );
}

function TripBlock({ booking }) {
  return (
    <div>
      <p>{booking.requested_date}</p>
      <p className="mt-1 text-stone-600">
        {formatTourType(booking.tour_type)} · {booking.guest_count} guests
      </p>
      <p className="mt-1 text-stone-600">
        {formatValue(booking.time_window || booking.time_slot)}
      </p>
    </div>
  );
}

function RequestBlock({ booking }) {
  return (
    <div>
      <p className="font-medium text-stone-950">{formatReferenceCode(booking.id)}</p>
       <p className="mt-1 text-stone-600">
        {formatDateTime(booking.created_at)}
      </p>
    
     
      {/* <p className="mt-1 text-stone-600">Language: {formatValue(booking.locale)}</p> */}
    </div>
  );
}

function NextAction({ booking }) {
  const primaryAction = getPrimaryStatusAction(booking);

  if (!primaryAction) {
    return <p className="text-sm text-stone-500">No next action</p>;
  }

  return <StatusActionForm action={primaryAction} bookingId={booking.id} />;
}

function BookingDetailsButton({ booking }) {
  const bookingWithTourLabel = {
    ...booking,
    booking_status_display: formatBookingStatus(booking.booking_status),
    reference_code: formatReferenceCode(booking.id),
    tour_label: formatTourType(booking.tour_type),
  };

  return (
    <AdminBookingDetails
      booking={bookingWithTourLabel}
      captainMessage={buildCaptainMessage(booking)}
    />
  );
}

function getBookingGroupId(booking) {
  const bookingStatus = booking.booking_status;

  if (bookingStatus === "available") {
    return "waiting_for_customer";
  }

  const group = BOOKING_GROUPS.find((groupDefinition) =>
    groupDefinition.statuses.includes(bookingStatus),
  );

  return group?.id ?? "needs_action";
}

function getGroupedBookings(bookings) {
  return BOOKING_GROUPS.map((groupDefinition) => {
    const groupBookings = bookings.filter(
      (booking) => getBookingGroupId(booking) === groupDefinition.id,
    );

    return {
      ...groupDefinition,
      bookings: groupDefinition.sort(groupBookings),
    };
  });
}

function BookingCard({ booking }) {
  return (
    <article className="border border-stone-300 bg-[#fbf8f3] p-5">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-4">
        <RequestBlock booking={booking} />
        <StatusBadges booking={booking} />
      </div>
      <div className="mt-5 space-y-5 text-sm">
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Customer
          </p>
          <ContactSummary booking={booking} />
        </section>
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Trip
          </p>
          <div className="mt-2">
            <TripBlock booking={booking} />
          </div>
        </section>
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Next
          </p>
          <div className="mt-2">
            <NextAction booking={booking} />
          </div>
        </section>
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Details
          </p>
          <div className="mt-2">
            <BookingDetailsButton booking={booking} />
          </div>
        </section>
      </div>
    </article>
  );
}

function BookingDesktopTable({ bookings }) {
  return (
    <div className="hidden overflow-x-auto border border-stone-300 bg-[#fbf8f3] lg:block">
      <table className="min-w-[980px] divide-y divide-stone-300 text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.16em] text-stone-500">
          <tr>
            <th className="px-4 py-3">Request</th>
            <th className="px-4 py-3">Trip</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Next</th>
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {bookings.map((booking) => (
            <tr key={booking.id} className="align-top">
              <td className="px-4 py-4">
                <RequestBlock booking={booking} />
              </td>
              <td className="px-4 py-4">
                <TripBlock booking={booking} />
              </td>
              <td className="px-4 py-4">
                <ContactSummary booking={booking} />
              </td>
              <td className="px-4 py-4">
                <StatusBadges booking={booking} />
              </td>
              <td className="w-[180px] px-4 py-4">
                <NextAction booking={booking} />
              </td>
              <td className="px-4 py-4">
                <BookingDetailsButton booking={booking} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookingGroup({ group }) {
  return (
    <details
      className="border border-stone-300 bg-[#fbf8f3]"
      open={group.defaultOpen}
    >
      <summary className="cursor-pointer list-none border-b border-stone-300 px-4 py-4 text-sm font-medium uppercase tracking-[0.18em] text-stone-950 marker:hidden">
        {group.title} ({group.bookings.length})
      </summary>
      {group.bookings.length > 0 ? (
        <div>
          <div className="space-y-4 p-4 lg:hidden">
            {group.bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
          <BookingDesktopTable bookings={group.bookings} />
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-stone-500">
          No bookings in this group.
        </div>
      )}
    </details>
  );
}

function BookingSearchForm({ resultCount, searchQuery, totalCount }) {
  return (
    <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-4 sm:p-5">
      <form className="flex flex-col gap-3 sm:flex-row" action="/admin">
        <label className="sr-only" htmlFor="admin-booking-search">
          Search bookings
        </label>
        <input
          id="admin-booking-search"
          name="q"
          type="search"
          defaultValue={searchQuery}
          placeholder="Search reference, name, email, phone, date, tour, status..."
          className="min-h-12 flex-1 border border-stone-300 bg-transparent px-4 text-sm outline-none transition focus:border-stone-950"
        />
        <button
          type="submit"
          className="border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
        >
          Search
        </button>
        {searchQuery ? (
          <Link
            href="/admin"
            className="border border-stone-300 px-5 py-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
          >
            Clear
          </Link>
        ) : null}
      </form>
      {searchQuery ? (
        <p className="mt-3 text-sm text-stone-600">
          Showing {resultCount} of {totalCount} loaded bookings for “{searchQuery}”.
        </p>
      ) : null}
    </section>
  );
}

export default async function AdminPage({ searchParams }) {
  const user = await getAdminUser("/admin");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const queryParams = await searchParams;
  const searchQuery = getSearchQuery(queryParams);
  const supabase = await createSupabaseServerClient();
  const { data: bookingRows, error } = await supabase
    .from("bookings")
    .select(
      "id, created_at, updated_at, locale, customer_name, email, phone, contact_method, guest_count, requested_date, tour_type, time_slot, time_window, total_price_eur, reservation_fee_eur, pay_on_board_eur, booking_status, payment_status, captain_status, stripe_checkout_session_id, stripe_payment_intent_id, message, customer_cancelled_at, customer_cancel_reason, cancelled_at, cancelled_by, cancellation_type, cancellation_reason",
    )
    .order("created_at", { ascending: false })
    .limit(searchQuery ? 200 : 50);
  const loadedBookings = bookingRows ?? [];
  const bookings = loadedBookings.filter((booking) =>
    bookingMatchesSearch(booking, searchQuery),
  );
  const bookingGroups = getGroupedBookings(bookings);

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <AdminRealtimeRefresh />
      <section className="mx-auto max-w-7xl">
        <AdminHeader
          active="bookings"
          title="Booking requests"
          userEmail={user.email}
        />

        {error ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm text-red-900">
            Could not load bookings: {error.message}
          </div>
        ) : null}

        <BookingSearchForm
          resultCount={bookings.length}
          searchQuery={searchQuery}
          totalCount={loadedBookings.length}
        />

        <div className="mt-8 space-y-6">
          {bookingGroups.map((group) => (
            <BookingGroup key={group.id} group={group} />
          ))}
        </div>
      </section>
    </main>
  );
}
