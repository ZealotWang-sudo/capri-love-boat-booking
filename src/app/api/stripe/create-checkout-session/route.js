import { NextResponse } from "next/server";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

function jsonError(message, status = 400, details) {
  console.error("[stripe checkout]", message, details ?? "");

  return NextResponse.json({ error: message, success: false }, { status });
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatTourType(value) {
  return value ? value.replaceAll("_", " ") : "Capri boat tour";
}

function formatReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "CAPRI";
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
      "id, locale, customer_name, email, requested_date, tour_type, time_window, reservation_fee_eur, final_reservation_fee_eur, booking_status, customer_manage_token",
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

  if (booking.booking_status !== "payment_pending") {
    return jsonError("This booking is not ready for payment.", 409);
  }

  const checkoutReservationFeeEur =
    booking.final_reservation_fee_eur ?? booking.reservation_fee_eur;

  if (!Number.isInteger(checkoutReservationFeeEur) || checkoutReservationFeeEur <= 0) {
    return jsonError("Invalid reservation fee.", 400);
  }

  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const referenceCode = formatReferenceCode(booking.id);
  const managePath = `/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(token)}`;
  const successUrl = `${siteUrl}${managePath}&payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}${managePath}&payment=cancelled`;
  const paymentDescription = `${referenceCode} · ${formatTourType(booking.tour_type)} · ${booking.requested_date} · ${booking.time_window}`;
  const stripeMetadata = {
    booking_id: booking.id,
    booking_reference: referenceCode,
    requested_date: booking.requested_date,
    tour_type: booking.tour_type,
  };
  const session = await stripe.checkout.sessions.create({
    client_reference_id: referenceCode,
    customer_email: booking.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${referenceCode} reservation fee`,
            description: paymentDescription,
            metadata: stripeMetadata,
          },
          unit_amount: checkoutReservationFeeEur * 100,
        },
        quantity: 1,
      },
    ],
    metadata: stripeMetadata,
    payment_intent_data: {
      description: paymentDescription,
      metadata: stripeMetadata,
    },
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_status: "payment_link_sent",
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
