import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PublicPageAutoRefresh from "@/components/PublicPageAutoRefresh";
import SiteHeader from "@/components/SiteHeader";
import { formatCustomerDate } from "@/lib/formatCustomerDate";
import {
  ACTIVE_SHARED_JOIN_REQUEST_STATUSES,
  getSharedBookingDisplayTime,
  getSharedJoinCapacity,
  isWithinJoinRequestCutoff,
  MAX_BOAT_CAPACITY,
} from "@/lib/sharedBoat";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { expireOverdueSharedJoinRequestsForBooking } from "@/lib/stripe/sharedJoinRequests";

const SHARED_LIST_SELECT =
  "id, requested_date, time_slot, time_window, tour_type, guest_count, booking_status, payment_status, is_shared_open, shared_status, shared_open_seats, shared_gender_preference, shared_public_token";
const TOUR_LABEL_KEYS = {
  five_hours: "tourLabels.five_hours",
  four_hours: "tourLabels.four_hours",
  special_request: "tourLabels.special_request",
  sunset_three_hours: "tourLabels.sunset_three_hours",
  three_hours: "tourLabels.three_hours",
  two_hours: "tourLabels.two_hours",
};
const GENDER_PREFERENCE_LABEL_KEYS = {
  any: "genderPreference.any",
  female_only: "genderPreference.female_only",
  male_only: "genderPreference.male_only",
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Shared" });

  return {
    title: `${t("browseTitle")} | Capri Love Boat`,
    robots: {
      follow: false,
      index: false,
    },
  };
}

function DetailItem({ label, value }) {
  return (
    <div className="border-b border-stone-200 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-stone-950">{value || "-"}</p>
    </div>
  );
}

async function getOpenSharedBookings() {
  const supabase = createSupabaseServiceRoleServerClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(SHARED_LIST_SELECT)
    .eq("booking_status", "confirmed")
    .eq("payment_status", "captured")
    .eq("is_shared_open", true)
    .in("shared_status", ["open", "active_request"])
    .not("shared_public_token", "is", null)
    .order("requested_date", { ascending: true });

  if (error) {
    console.error("[shared listing] Could not load open shared bookings", error.message);
    return [];
  }

  const refreshedBookings = [];

  for (const booking of bookings ?? []) {
    if (booking.shared_status !== "active_request") {
      refreshedBookings.push(booking);
      continue;
    }

    try {
      const result = await expireOverdueSharedJoinRequestsForBooking({
        bookingId: booking.id,
      });
      refreshedBookings.push(
        result.expired > 0 ? { ...booking, shared_status: "open" } : booking,
      );
    } catch (expiryError) {
      console.error("[shared listing] Could not expire overdue join request", {
        bookingId: booking.id,
        message: expiryError.message,
      });
      refreshedBookings.push(booking);
    }
  }

  const bookingIds = refreshedBookings.map((booking) => booking.id);
  let bookingIdsWithActiveRequests = new Set();

  if (bookingIds.length > 0) {
    const { data: activeRequests, error: activeRequestsError } = await supabase
      .from("shared_join_requests")
      .select("booking_id")
      .in("booking_id", bookingIds)
      .in("status", ACTIVE_SHARED_JOIN_REQUEST_STATUSES);

    if (activeRequestsError) {
      console.error(
        "[shared listing] Could not load active join requests",
        activeRequestsError.message,
      );
      bookingIdsWithActiveRequests = new Set(bookingIds);
    } else {
      bookingIdsWithActiveRequests = new Set(
        (activeRequests ?? []).map((request) => request.booking_id),
      );
    }
  }

  return refreshedBookings.filter(
    (booking) =>
      booking.shared_status === "open" &&
      !bookingIdsWithActiveRequests.has(booking.id) &&
      !isWithinJoinRequestCutoff(booking) &&
      getSharedJoinCapacity(booking) > 0,
  );
}

export default async function SharedBoatsPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const common = await getTranslations("Common");
  const t = await getTranslations("Shared");
  const bookings = await getOpenSharedBookings();

  return (
    <main className="min-h-screen bg-[#f3eee7] text-stone-950">
      <PublicPageAutoRefresh />
      <SiteHeader brand={common("brand")} locale={locale} path="/shared" />
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="border-t border-stone-300 pt-8">
          <Link
            href={`/${locale}/book`}
            className="text-xs uppercase tracking-[0.22em] text-stone-500 hover:text-stone-950"
          >
            {common("book")}
          </Link>
          <h1 className="mt-12 max-w-3xl text-4xl font-light leading-tight tracking-[-0.03em] sm:text-6xl">
            {t("browseTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-light leading-8 text-stone-600">
            {t("browseSubtitle")}
          </p>
        </div>

        {bookings.length > 0 ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {bookings.map((booking) => {
              const tourLabelKey = TOUR_LABEL_KEYS[booking.tour_type];
              const genderPreferenceLabelKey =
                GENDER_PREFERENCE_LABEL_KEYS[booking.shared_gender_preference] ??
                GENDER_PREFERENCE_LABEL_KEYS.any;

              return (
                <Link
                  key={booking.id}
                  href={`/${locale}/shared/${booking.shared_public_token}`}
                  className="block border border-stone-300 bg-[#fbf8f3] p-6 transition hover:border-stone-950"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {t("browseCardEyebrow")}
                  </p>
                  <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
                    <DetailItem
                      label={t("date")}
                      value={formatCustomerDate(booking.requested_date, locale)}
                    />
                    <DetailItem
                      label={t("time")}
                      value={getSharedBookingDisplayTime(booking)}
                    />
                    <DetailItem
                      label={t("tour")}
                      value={tourLabelKey ? t(tourLabelKey) : booking.tour_type}
                    />
                    <DetailItem
                      label={t("mainGroupGuests")}
                      value={booking.guest_count}
                    />
                    <DetailItem
                      label={t("openSeats")}
                      value={getSharedJoinCapacity(booking)}
                    />
                    <DetailItem
                      label={t("maxCapacity")}
                      value={MAX_BOAT_CAPACITY}
                    />
                    <DetailItem
                      label={t("genderPreferenceLabel")}
                      value={t(genderPreferenceLabelKey)}
                    />
                  </div>
                  <span className="mt-6 inline-flex border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition">
                    {t("browseOpenButton")}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 border border-stone-300 bg-[#fbf8f3] p-6">
            <h2 className="text-2xl font-light tracking-[-0.03em]">
              {t("browseEmptyTitle")}
            </h2>
            {/* <p className="mt-4 text-sm leading-7 text-stone-600">
              {t("browseEmptyBody")}
            </p> */}
            <Link
              href={`/${locale}/book`}
              className="mt-6 inline-flex border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
            >
              {common("book")}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
