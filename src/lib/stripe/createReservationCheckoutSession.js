import { getSiteUrl, getStripe } from "@/lib/stripe/server";

const MAX_METADATA_VALUE_LENGTH = 500;

function formatTourType(value) {
  return value ? value.replaceAll("_", " ") : "Capri boat tour";
}

export function formatBookingReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "CAPRI";
}

export function getReservationFeeEur(booking) {
  return booking.final_reservation_fee_eur ?? booking.reservation_fee_eur;
}

function metadataValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);

  return stringValue.length > MAX_METADATA_VALUE_LENGTH
    ? stringValue.slice(0, MAX_METADATA_VALUE_LENGTH)
    : stringValue;
}

function getBookingMetadata(booking) {
  return Object.fromEntries(
    Object.entries({
      captain_status: booking.captain_status,
      contact_method: booking.contact_method,
      customer_manage_token: booking.customer_manage_token,
      customer_name: booking.customer_name,
      email: booking.email,
      final_reservation_fee_eur: booking.final_reservation_fee_eur,
      guest_count: booking.guest_count,
      is_shared_open: booking.is_shared_open,
      locale: booking.locale,
      message: booking.message,
      original_reservation_fee_eur: booking.original_reservation_fee_eur,
      pay_on_board_eur: booking.pay_on_board_eur,
      phone: booking.phone,
      promo_code: booking.promo_code,
      promo_discount_eur: booking.promo_discount_eur,
      requested_date: booking.requested_date,
      reservation_fee_eur: booking.reservation_fee_eur,
      shared_gender_preference: booking.shared_gender_preference,
      shared_max_join_groups: booking.shared_max_join_groups,
      shared_open_seats: booking.shared_open_seats,
      shared_public_token: booking.shared_public_token,
      shared_status: booking.shared_status,
      time_slot: booking.time_slot,
      time_window: booking.time_window,
      total_price_eur: booking.total_price_eur,
      tour_type: booking.tour_type,
    }).map(([key, value]) => [key, metadataValue(value)]),
  );
}

export async function createReservationCheckoutSession({
  booking,
  captureMethod = "manual",
  siteUrl,
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
  const checkoutSiteUrl = (siteUrl || getSiteUrl()).replace(/\/$/, "");
  const referenceCode = formatBookingReferenceCode(booking.id);
  const managePath = `/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(token)}`;
  const successUrl = `${checkoutSiteUrl}${managePath}&payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${checkoutSiteUrl}${managePath}&payment=cancelled`;
  const paymentDescription = `${referenceCode} · ${formatTourType(booking.tour_type)} · ${booking.requested_date} · ${booking.time_window}`;
  const stripeMetadata = {
    booking_id: booking.id,
    booking_reference: referenceCode,
    ...getBookingMetadata(booking),
    payment_flow:
      captureMethod === "manual" ? "manual_authorization" : "legacy_payment",
    site_url: checkoutSiteUrl,
  };

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
    success_url: successUrl,
  });
}
