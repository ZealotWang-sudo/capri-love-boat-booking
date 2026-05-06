import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminActionForm from "./AdminActionForm";
import AdminBookingDetails from "./AdminBookingDetails";

const ADMIN_EMAIL = "wangkexin-personal@outlook.com";
const TOUR_LABELS = {
  three_hours: "3 hours",
  four_hours: "4 hours",
  sunset_three_hours: "Sunset 3 hours",
  five_hours: "5 hours",
  two_hours: "2 hours",
  special_request: "Special request",
};
const PRIMARY_STATUS_ACTIONS = {
  requested: {
    value: "checking_with_captain",
    label: "Captain OKed",
    confirmMessage: "Mark this booking as checking with captain?",
    confirmTitle: "Update booking status?",
  },
  payment_pending: {
    value: "confirmed",
    label: "Confirm",
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
    id: "closed",
    title: "Closed / cancelled",
    statuses: ["completed", "cancelled", "not_available", "expired"],
    defaultOpen: false,
    sort(bookings) {
      return sortByDateDesc(bookings, "updated_at");
    },
  },
];
const CLOSED_BOOKING_STATUSES = new Set([
  "completed",
  "cancelled",
  "not_available",
  "expired",
]);

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
    dateStyle: "medium",
    timeStyle: "short",
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

function formatReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "—";
}

function formatBookingStatus(value) {
  return value === "available" ? "payment_pending" : formatValue(value);
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
  const customerContact = booking.phone || booking.email || "—";
  const customerMessage = booking.message?.trim();

  return [
    "New booking request:",
    "",
    `Date: ${formatValue(booking.requested_date)}`,
    `Time: ${formatValue(booking.time_window || booking.time_slot)}`,
    `Tour: ${formatTourType(booking.tour_type)}`,
    `Guests: ${formatValue(booking.guest_count)}`,
    `Customer: ${formatValue(booking.customer_name)}`,
    `Contact: ${customerContact}`,
    `Language: ${formatValue(booking.locale)}`,
    ...(customerMessage ? [`Message: ${customerMessage}`] : []),
    "",
    `Total price: ${formatEuro(booking.total_price_eur)}`,
    `Reservation fee: ${formatEuro(booking.reservation_fee_eur)}`,
    `Pay on board: ${formatEuro(booking.pay_on_board_eur)}`,
    "",
    "Can you confirm if you are available?",
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
  if (CLOSED_BOOKING_STATUSES.has(booking.booking_status)) {
    return {
      actionType: "delete",
      confirmLabel: "Delete booking",
      confirmMessage:
        "This permanently deletes the booking request and related email logs. This cannot be undone.",
      confirmTitle: "Delete this closed booking?",
      label: "Delete",
      variant: "danger",
    };
  }

  if (
    booking.booking_status === "checking_with_captain" &&
    booking.captain_status === "pending"
  ) {
    return {
      value: "captain_available",
      label: "Captain OK",
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

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return (
      <main className="min-h-screen bg-[#f3eee7] px-5 py-16 text-stone-950 sm:px-8">
        <section className="mx-auto max-w-3xl border-t border-stone-300 pt-10">
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
            Capri Love Boat Admin
          </p>
          <h1 className="mt-8 text-4xl font-light tracking-[-0.03em]">
            Unauthorized
          </h1>
          <p className="mt-6 text-stone-600">
            This account does not have access to the admin area.
          </p>
          <Link
            href="/admin/logout"
            className="mt-10 inline-block border border-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
          >
            Sign out
          </Link>
        </section>
      </main>
    );
  }

  const { data: bookingRows, error } = await supabase
    .from("bookings")
    .select(
      "id, created_at, updated_at, locale, customer_name, email, phone, contact_method, guest_count, requested_date, tour_type, time_slot, time_window, total_price_eur, reservation_fee_eur, pay_on_board_eur, booking_status, payment_status, captain_status, message, customer_cancelled_at, customer_cancel_reason",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  const bookings = bookingRows ?? [];
  const bookingGroups = getGroupedBookings(bookings);

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 border-b border-stone-300 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
              Capri Love Boat Admin
            </p>
            <h1 className="mt-5 text-4xl font-light tracking-[-0.03em]">
              Booking requests
            </h1>
            <p className="mt-3 text-sm text-stone-600">
              Signed in as {user.email}
            </p>
          </div>
          <Link
            href="/admin/logout"
            className="border border-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
          >
            Sign out
          </Link>
        </div>

        {error ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm text-red-900">
            Could not load bookings: {error.message}
          </div>
        ) : null}

        <div className="mt-8 space-y-6">
          {bookingGroups.map((group) => (
            <BookingGroup key={group.id} group={group} />
          ))}
        </div>
      </section>
    </main>
  );
}
