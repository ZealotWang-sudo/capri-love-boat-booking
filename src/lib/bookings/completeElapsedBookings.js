import { getBookingInterval } from "@/lib/bookingAvailability";
import {
  getSharedGuestManagePath,
} from "@/lib/email/sendSharedJoinEmail";
import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";

const COMPLETABLE_BOOKING_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, customer_manage_token, is_shared_open, shared_status, shared_public_token";
const COMPLETED_SHARED_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, customer_manage_token, guest_count, shared_request_fee_eur, payment_status, status";
const CAPRI_TIME_ZONE = "Europe/Rome";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://capriloveboat.com"
  ).replace(/\/$/, "");
}

function getCapriDateTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: CAPRI_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    date: [
      String(values.year).padStart(4, "0"),
      String(values.month).padStart(2, "0"),
      String(values.day).padStart(2, "0"),
    ].join("-"),
    minutes: values.hour * 60 + values.minute,
  };
}

function isTourEnded(booking, capriNow) {
  const interval = getBookingInterval(booking);

  if (!interval) {
    return false;
  }

  if (interval.date < capriNow.date) {
    return true;
  }

  return interval.date === capriNow.date && interval.endMinutes <= capriNow.minutes;
}

function getCustomerManageUrl(booking) {
  if (!booking.customer_manage_token) {
    return null;
  }

  return `${getSiteUrl()}/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(
    booking.customer_manage_token,
  )}`;
}

function getSharedManageUrl(request) {
  const managePath = getSharedGuestManagePath(request);

  return managePath ? `${getSiteUrl()}${managePath}` : null;
}

async function sendCompletedSharedGuestEmails({ booking, supabase }) {
  if (!booking?.is_shared_open || booking.booking_status !== "completed") {
    return { attempted: 0, sent: 0 };
  }

  const { data: acceptedRequests, error } = await supabase
    .from("shared_join_requests")
    .select(COMPLETED_SHARED_REQUEST_SELECT)
    .eq("booking_id", booking.id)
    .eq("status", "accepted")
    .eq("payment_status", "captured");

  if (error) {
    console.error("[auto complete bookings] Could not load shared guests", {
      bookingId: booking.id,
      message: error.message,
    });
    return { attempted: 0, sent: 0 };
  }

  let sent = 0;

  for (const request of acceptedRequests ?? []) {
    const sharedPayOnBoard =
      typeof booking.pay_on_board_eur === "number"
        ? booking.pay_on_board_eur / 2
        : booking.pay_on_board_eur;
    const sharedTotal =
      typeof request.shared_request_fee_eur === "number" &&
      typeof sharedPayOnBoard === "number"
        ? request.shared_request_fee_eur + sharedPayOnBoard
        : booking.total_price_eur;
    const emailResult = await sendBookingEmail({
      booking: {
        ...booking,
        customer_manage_token: request.customer_manage_token,
        customer_name: request.customer_name,
        email: request.email,
        final_reservation_fee_eur: request.shared_request_fee_eur,
        guest_count: request.guest_count,
        locale: request.locale || booking.locale,
        manage_url: getSharedManageUrl(request),
        original_reservation_fee_eur: request.shared_request_fee_eur,
        pay_on_board_eur: sharedPayOnBoard,
        promo_code: null,
        promo_discount_eur: 0,
        reservation_fee_eur: request.shared_request_fee_eur,
        total_price_eur: sharedTotal,
      },
      checkDuplicate: false,
      eventType: "completed",
      supabase,
    });

    if (emailResult.sent) {
      sent += 1;
    } else {
      console.error("[auto complete bookings] Shared guest email was not sent", {
        bookingId: booking.id,
        reason: emailResult.reason,
        requestId: request.id,
      });
    }
  }

  return { attempted: acceptedRequests?.length ?? 0, sent };
}

async function completeBooking({ booking, supabase }) {
  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .update({
      booking_status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("booking_status", "confirmed")
    .select(COMPLETABLE_BOOKING_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[auto complete bookings] Could not complete booking", {
      bookingId: booking.id,
      message: error.message,
    });
    return { completed: false, emailSent: false, shared: { attempted: 0, sent: 0 } };
  }

  if (!updatedBooking) {
    return { completed: false, emailSent: false, shared: { attempted: 0, sent: 0 } };
  }

  const emailResult = await sendBookingEmail({
    booking: {
      ...updatedBooking,
      manage_url: getCustomerManageUrl(updatedBooking),
    },
    eventType: "completed",
    supabase,
  });

  if (!emailResult.sent) {
    console.error("[auto complete bookings] Completed email was not sent", {
      bookingId: updatedBooking.id,
      reason: emailResult.reason,
    });
  }

  const shared = await sendCompletedSharedGuestEmails({
    booking: updatedBooking,
    supabase,
  });

  return {
    completed: true,
    emailSent: emailResult.sent,
    shared,
  };
}

export async function completeElapsedBookings({ now = new Date() } = {}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const capriNow = getCapriDateTimeParts(now);
  const { data: confirmedBookings, error } = await supabase
    .from("bookings")
    .select(COMPLETABLE_BOOKING_SELECT)
    .eq("booking_status", "confirmed")
    .eq("payment_status", "captured")
    .lte("requested_date", capriNow.date);

  if (error) {
    console.error("[auto complete bookings] Could not load confirmed bookings", {
      message: error.message,
    });
    throw new Error("Could not load confirmed bookings for completion.");
  }

  const elapsedBookings = (confirmedBookings ?? []).filter((booking) =>
    isTourEnded(booking, capriNow),
  );
  const results = [];

  for (const booking of elapsedBookings) {
    const result = await completeBooking({ booking, supabase });
    results.push({
      bookingId: booking.id,
      ...result,
    });
  }

  return {
    checked: confirmedBookings?.length ?? 0,
    completed: results.filter((result) => result.completed).length,
    results,
  };
}
