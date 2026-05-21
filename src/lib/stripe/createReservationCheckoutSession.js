import { getSiteUrl, getStripe } from "@/lib/stripe/server";

const MANUAL_CHECKOUT_EXPIRES_IN_SECONDS = 30 * 60;

function formatTourType(value) {
  return value ? value.replaceAll("_", " ") : "Capri boat tour";
}

export function formatBookingReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "CAPRI";
}

export function getReservationFeeEur(booking) {
  return booking.final_reservation_fee_eur ?? booking.reservation_fee_eur;
}

export async function createReservationCheckoutSession({
  booking,
  captureMethod = "manual",
  token,
}) {
  const checkoutReservationFeeEur = getReservationFeeEur(booking);

  if (
    !Number.isInteger(checkoutReservationFeeEur) ||
    checkoutReservationFeeEur <= 0
  ) {
    throw new Error("Invalid reservation fee.");
  }

  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const referenceCode = formatBookingReferenceCode(booking.id);
  const managePath = `/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(token)}`;
  const successUrl = `${siteUrl}${managePath}&payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}${managePath}&payment=cancelled`;
  const paymentDescription = `${referenceCode} · ${formatTourType(booking.tour_type)} · ${booking.requested_date} · ${booking.time_window}`;
  const stripeMetadata = {
    booking_id: booking.id,
    booking_reference: referenceCode,
    payment_flow:
      captureMethod === "manual" ? "manual_authorization" : "legacy_payment",
    requested_date: booking.requested_date,
    tour_type: booking.tour_type,
  };
  const isManualCapture = captureMethod === "manual";

  return stripe.checkout.sessions.create({
    cancel_url: cancelUrl,
    client_reference_id: referenceCode,
    customer_email: booking.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            description: paymentDescription,
            metadata: stripeMetadata,
            name: `${referenceCode} reservation fee`,
          },
          unit_amount: checkoutReservationFeeEur * 100,
        },
        quantity: 1,
      },
    ],
    metadata: stripeMetadata,
    mode: "payment",
    payment_intent_data: {
      capture_method: captureMethod,
      description: paymentDescription,
      metadata: stripeMetadata,
    },
    ...(isManualCapture
      ? {
          expires_at:
            Math.floor(Date.now() / 1000) + MANUAL_CHECKOUT_EXPIRES_IN_SECONDS,
        }
      : {}),
    success_url: successUrl,
  });
}
