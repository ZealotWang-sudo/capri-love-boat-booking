import { NextResponse } from "next/server";
import {
  ONLINE_BOOKING_CUTOFF_ERROR_MESSAGE,
  isOnlineBookingDateAllowed,
} from "@/lib/bookingCutoff";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { createReservationCheckoutSession } from "@/lib/stripe/createReservationCheckoutSession";

function jsonError(message, status = 400, details) {
  console.error("[stripe checkout]", message, details ?? "");

  return NextResponse.json({ error: message, success: false }, { status });
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const bookingId = getText(body?.booking_id);
  const token = getText(body?.token);

  if (!bookingId || !token) {
    return jsonError("Missing booking id or token.");
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, locale, customer_name, email, requested_date, tour_type, time_window, reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, customer_manage_token",
    )
    .eq("id", bookingId)
    .eq("customer_manage_token", token)
    .maybeSingle();

  if (error) {
    return jsonError("Could not load booking.", 500, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }

  if (!booking) {
    return jsonError("Invalid booking link.", 404);
  }

  const isLegacyPayment = booking.booking_status === "payment_pending";
  const isAuthorizationRetry =
    booking.booking_status === "requested" &&
    booking.payment_status === "authorization_pending";

  if (!isLegacyPayment && !isAuthorizationRetry) {
    return jsonError("This booking is not ready for payment.", 409);
  }

  if (!isOnlineBookingDateAllowed(booking.requested_date)) {
    return jsonError(ONLINE_BOOKING_CUTOFF_ERROR_MESSAGE, 409);
  }

  let session;

  try {
    session = await createReservationCheckoutSession({
      booking,
      captureMethod: isLegacyPayment ? "automatic" : "manual",
      token,
    });
  } catch (error) {
    return jsonError(error.message || "Could not create Stripe checkout session.");
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_status: isLegacyPayment
        ? "payment_link_sent"
        : "authorization_pending",
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    return jsonError("Could not save Stripe checkout session.", 500, {
      code: updateError.code,
      details: updateError.details,
      hint: updateError.hint,
      message: updateError.message,
    });
  }

  return NextResponse.json({ checkoutUrl: session.url, success: true });
}
