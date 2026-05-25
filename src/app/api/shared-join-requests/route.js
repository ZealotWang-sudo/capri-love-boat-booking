import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { validatePromoCodeForReservation } from "@/lib/promoCodes";
import {
  ACTIVE_SHARED_JOIN_REQUEST_STATUSES,
  getSharedJoinCapacity,
  isGenderCompositionAllowed,
  isValidSharedBookingForJoin,
  isWithinJoinRequestCutoff,
  MIN_SHARED_REQUEST_FEE_EUR,
  SHARED_CONTACT_METHODS,
  SHARED_GENDER_COMPOSITIONS,
} from "@/lib/sharedBoat";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import {
  createSharedJoinRequestCheckoutSession,
  expireOverdueSharedJoinRequestsForBooking,
} from "@/lib/stripe/sharedJoinRequests";
import { getActiveTourPriceByType } from "@/lib/tourPrices";

const ALLOWED_LOCALES = new Set(["en", "zh", "it", "de", "fr"]);
const SHARED_BOOKING_SELECT =
  "id, locale, shared_public_token, requested_date, time_slot, time_window, tour_type, guest_count, booking_status, payment_status, is_shared_open, shared_status, shared_open_seats, shared_gender_preference";

function jsonError(message, status = 400, errorKey = "generic") {
  console.error("[shared join request API]", message);

  return NextResponse.json(
    { success: false, error: message, errorKey },
    { status },
  );
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalText(value) {
  const text = getText(value);

  return text || null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createManageToken() {
  return randomBytes(32).toString("base64url");
}

async function getSharedBooking({ supabase, token }) {
  const { data, error } = await supabase
    .from("bookings")
    .select(SHARED_BOOKING_SELECT)
    .eq("shared_public_token", token)
    .maybeSingle();

  if (error) {
    console.error("[shared join request API] Could not load booking", error.message);
    throw new Error("Could not load shared booking.");
  }

  return data;
}

async function hasActiveJoinRequest({ bookingId, supabase }) {
  const { data, error } = await supabase
    .from("shared_join_requests")
    .select("id")
    .eq("booking_id", bookingId)
    .in("status", ACTIVE_SHARED_JOIN_REQUEST_STATUSES)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[shared join request API] Could not check active request",
      error.message,
    );
    throw new Error("Could not check active shared join request.");
  }

  return Boolean(data);
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalidRequest");
  }

  const locale = getText(body?.locale);
  const token = getText(body?.token);
  const customerName = getText(body?.customer_name);
  const email = getText(body?.email).toLowerCase();
  const confirmEmail = getText(body?.confirm_email).toLowerCase();
  const preferredContactMethod = getText(body?.preferred_contact_method);
  const genderComposition = getText(body?.gender_composition);
  const guestCount = Number(body?.guest_count);
  const phone = getOptionalText(body?.phone);
  const promoCodeInput = getOptionalText(body?.promo_code);
  const wechat = getOptionalText(body?.wechat);

  if (!ALLOWED_LOCALES.has(locale) || !token) {
    return jsonError("Invalid shared join request.", 400, "invalidRequest");
  }

  if (!customerName || !email) {
    return jsonError("Missing required fields.", 400, "missingRequired");
  }

  if (!isValidEmail(email)) {
    return jsonError("Invalid email address.", 400, "invalidEmail");
  }

  if (email !== confirmEmail) {
    return jsonError("Email addresses must match.", 400, "emailMismatch");
  }

  if (!SHARED_CONTACT_METHODS.has(preferredContactMethod)) {
    return jsonError("Invalid preferred contact method.", 400, "invalidContactMethod");
  }

  if (!phone || (preferredContactMethod === "wechat" && !wechat)) {
    return jsonError(
      "Missing selected contact method details.",
      400,
      "missingPreferredContact",
    );
  }

  if (!SHARED_GENDER_COMPOSITIONS.has(genderComposition)) {
    return jsonError("Invalid gender composition.", 400, "invalidGenderComposition");
  }

  if (body?.consent_accepted !== true) {
    return jsonError("Consent is required.", 400, "consentRequired");
  }

  const supabase = createSupabaseServiceRoleServerClient();
  let booking;

  try {
    booking = await getSharedBooking({ supabase, token });
  } catch {
    return jsonError("Shared boat is not available.", 500, "generic");
  }

  if (booking?.shared_status === "active_request") {
    try {
      await expireOverdueSharedJoinRequestsForBooking({
        bookingId: booking.id,
        siteUrl: new URL(request.url).origin,
      });
      booking = await getSharedBooking({ supabase, token });
    } catch (error) {
      console.error(
        "[shared join request API] Could not expire overdue join requests",
        error.message,
      );
    }
  }

  if (
    !booking ||
    booking.shared_public_token !== token ||
    !isValidSharedBookingForJoin(booking)
  ) {
    return jsonError("Shared boat is not available.", 404, "bookingUnavailable");
  }

  if (isWithinJoinRequestCutoff(booking)) {
    return jsonError("Shared boat requests are closed.", 409, "cutoffClosed");
  }

  let activeRequestExists;

  try {
    activeRequestExists = await hasActiveJoinRequest({
      bookingId: booking.id,
      supabase,
    });
  } catch {
    return jsonError("Could not check shared join requests.", 500, "generic");
  }

  if (activeRequestExists) {
    return jsonError(
      "There is already an active join request.",
      409,
      "activeRequestExists",
    );
  }

  const maxJoinGuests = getSharedJoinCapacity(booking);

  if (
    !Number.isInteger(guestCount) ||
    guestCount < 1 ||
    guestCount > maxJoinGuests
  ) {
    return jsonError("Invalid guest count.", 400, "invalidGuestCount");
  }

  if (!isGenderCompositionAllowed({ booking, genderComposition })) {
    return jsonError(
      "This gender composition does not match the main group preference.",
      400,
      "genderPreferenceMismatch",
    );
  }

  const { data: tourPrice, error: tourPriceError } =
    await getActiveTourPriceByType(supabase, booking.tour_type);

  if (tourPriceError) {
    console.error(
      "[shared join request API] Could not load tour price",
      tourPriceError.message,
    );
    return jsonError("Could not load tour price.", 500, "generic");
  }

  const sharedRequestFeeEur = tourPrice?.reservation_fee_eur;

  if (
    !Number.isInteger(sharedRequestFeeEur) ||
    sharedRequestFeeEur <= 0
  ) {
    return jsonError("Shared request fee is not configured.", 409, "generic");
  }

  const promoResult = promoCodeInput
    ? await validatePromoCodeForReservation({
        code: promoCodeInput,
        minimumReservationFeeEur: MIN_SHARED_REQUEST_FEE_EUR,
        originalReservationFeeEur: sharedRequestFeeEur,
        supabase,
      })
    : {
        finalReservationFeeEur: sharedRequestFeeEur,
        promoCode: null,
        promoDiscountEur: 0,
        valid: true,
      };

  if (promoResult.error) {
    return jsonError("Could not validate promo code.", 500, "generic");
  }

  if (!promoResult.valid) {
    return jsonError(promoResult.message, promoResult.status, "invalidPromoCode");
  }

  const joinRequestPayload = {
    booking_id: booking.id,
    consent_accepted: true,
    customer_name: customerName,
    email,
    gender_composition: genderComposition,
    guest_count: guestCount,
    locale,
    customer_manage_token: createManageToken(),
    message: getOptionalText(body?.message),
    original_shared_request_fee_eur: sharedRequestFeeEur,
    payment_status: "authorization_pending",
    phone,
    preferred_contact_method: preferredContactMethod,
    promo_code: promoResult.promoCode,
    promo_discount_eur: promoResult.promoDiscountEur,
    shared_request_fee_eur: promoResult.finalReservationFeeEur,
    status: "authorization_pending",
    whatsapp: preferredContactMethod === "whatsapp" ? phone : null,
    wechat,
  };
  const { data: joinRequest, error: insertError } = await supabase
    .from("shared_join_requests")
    .insert(joinRequestPayload)
    .select("id, email, customer_manage_token, locale, shared_request_fee_eur")
    .single();

  if (insertError) {
    console.error(
      "[shared join request API] Could not create request",
      insertError.message,
    );

    return jsonError("Could not create shared join request.", 500, "generic");
  }

  let checkoutSession;

  try {
    checkoutSession = await createSharedJoinRequestCheckoutSession({
      booking: { ...booking, locale },
      joinRequest,
      siteUrl: new URL(request.url).origin,
    });
  } catch (error) {
    console.error(
      "[shared join request API] Could not create checkout session",
      error.message,
    );
    await supabase
      .from("shared_join_requests")
      .update({
        payment_status: "failed",
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", joinRequest.id);

    return jsonError("Could not open authorization checkout.", 500, "generic");
  }

  const { error: updateError } = await supabase
    .from("shared_join_requests")
    .update({
      stripe_checkout_session_id: checkoutSession.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", joinRequest.id);

  if (updateError) {
    console.error(
      "[shared join request API] Could not save checkout session",
      updateError.message,
    );

    return jsonError("Could not save authorization checkout.", 500, "generic");
  }

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
    success: true,
  });
}
