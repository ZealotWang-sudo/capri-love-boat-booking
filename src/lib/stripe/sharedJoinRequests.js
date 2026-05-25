import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import {
  getSharedGuestManagePath,
  getSharedHostManagePath,
  sendSharedJoinEmail,
} from "@/lib/email/sendSharedJoinEmail";
import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import {
  ACTIVE_SHARED_JOIN_REQUEST_STATUSES,
  MAX_BOAT_CAPACITY,
  isValidSharedBookingForJoin,
  isWithinJoinRequestCutoff,
} from "@/lib/sharedBoat";
import { formatBookingReferenceCode } from "@/lib/stripe/createReservationCheckoutSession";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

const SHARED_JOIN_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, phone, whatsapp, wechat, preferred_contact_method, guest_count, gender_composition, customer_manage_token, shared_request_fee_eur, payment_status, status, stripe_checkout_session_id, stripe_payment_intent_id, host_response_deadline_at";
const SHARED_BOOKING_SELECT =
  "id, locale, customer_name, email, phone, customer_manage_token, shared_public_token, requested_date, time_slot, time_window, tour_type, booking_status, payment_status, is_shared_open, shared_status";
const HOST_SHARED_JOIN_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, phone, whatsapp, wechat, preferred_contact_method, guest_count, gender_composition, customer_manage_token, shared_request_fee_eur, payment_status, status, stripe_payment_intent_id, host_response_deadline_at";
const SHARED_JOIN_CANCELLATION_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, phone, whatsapp, wechat, preferred_contact_method, guest_count, gender_composition, customer_manage_token, shared_request_fee_eur, payment_status, status, stripe_checkout_session_id, stripe_payment_intent_id";
const ADMIN_CONNECTED_SHARED_BOOKING_SELECT =
  "id, locale, customer_name, email, phone, contact_method, customer_manage_token, guest_count, requested_date, tour_type, time_slot, time_window, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, payment_status, captain_status, is_shared_open, shared_status, shared_open_seats, shared_gender_preference, shared_max_join_groups, shared_public_token, stripe_checkout_session_id, stripe_payment_intent_id, message, shared_primary_replacement";
const ADMIN_CONNECTED_SHARED_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, phone, whatsapp, wechat, preferred_contact_method, guest_count, gender_composition, message, customer_manage_token, original_shared_request_fee_eur, promo_code, promo_discount_eur, shared_request_fee_eur, payment_status, status, stripe_checkout_session_id, stripe_payment_intent_id";

function getPaymentIntentId(paymentIntent) {
  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

async function getPaymentIntent(paymentIntent) {
  const paymentIntentId = getPaymentIntentId(paymentIntent);

  if (!paymentIntentId) {
    return null;
  }

  if (typeof paymentIntent === "object") {
    return paymentIntent;
  }

  return getStripe().paymentIntents.retrieve(paymentIntentId);
}

async function getPaymentIntentIdFromCheckoutSession(checkoutSessionId) {
  if (!checkoutSessionId) {
    return null;
  }

  const checkoutSession =
    await getStripe().checkout.sessions.retrieve(checkoutSessionId);

  return getPaymentIntentId(checkoutSession.payment_intent);
}

async function getCheckoutSession({ session, sessionId }) {
  return (
    session ??
    (sessionId
      ? await getStripe().checkout.sessions.retrieve(sessionId)
      : null)
  );
}

function isPaymentIntentAuthorized(paymentIntent) {
  return Boolean(
    paymentIntent &&
      (paymentIntent.status === "requires_capture" ||
        (paymentIntent.amount_capturable ?? 0) > 0),
  );
}

function isHostDecisionExpired(request, now = new Date()) {
  if (
    request?.status !== "authorized_pending_host_decision" ||
    request.payment_status !== "authorized" ||
    !request.host_response_deadline_at
  ) {
    return false;
  }

  return new Date(request.host_response_deadline_at).getTime() <= now.getTime();
}

function getSharedLinkPath({ booking, sessionQuery }) {
  return `/${booking.locale}/shared/${booking.shared_public_token}${sessionQuery}`;
}

function getSharedManagePath({ request, sessionQuery = "" }) {
  return `/${request.locale}/shared/manage/${request.id}?token=${encodeURIComponent(
    request.customer_manage_token,
  )}${sessionQuery}`;
}

function getAbsoluteUrl(path, siteUrl) {
  return `${(siteUrl || getSiteUrl()).replace(/\/$/, "")}${path}`;
}

async function sendSharedJoinEmailWithLog(options) {
  const result = await sendSharedJoinEmail(options);

  if (!result.sent) {
    console.error("[shared join email] Email was not sent", {
      eventType: options.eventType,
      reason: result.reason,
      requestId: options.request?.id,
      to: options.to,
    });
  }

  return result;
}

export async function createSharedJoinRequestCheckoutSession({
  booking,
  joinRequest,
  siteUrl,
}) {
  const stripe = getStripe();
  const checkoutSiteUrl = (siteUrl || getSiteUrl()).replace(/\/$/, "");
  const successPath = getSharedManagePath({
    request: joinRequest,
    sessionQuery: "&payment=success&session_id={CHECKOUT_SESSION_ID}",
  });
  const cancelPath = getSharedLinkPath({
    booking,
    sessionQuery: "?join=cancelled",
  });
  const sharedReferenceCode = `${formatBookingReferenceCode(booking.id)}-shared`;
  const metadata = {
    booking_id: booking.id,
    booking_reference: formatBookingReferenceCode(booking.id),
    shared_booking_reference: sharedReferenceCode,
    shared_join_request_id: joinRequest.id,
    site_url: checkoutSiteUrl,
    type: "shared_join_request",
  };
  const description = `${sharedReferenceCode} · ${booking.requested_date} · ${
    booking.time_window || booking.time_slot
  }`;

  return stripe.checkout.sessions.create({
    cancel_url: `${checkoutSiteUrl}${cancelPath}`,
    customer_email: joinRequest.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            description,
            metadata,
            name: sharedReferenceCode,
          },
          unit_amount: joinRequest.shared_request_fee_eur * 100,
        },
        quantity: 1,
      },
    ],
    metadata,
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual",
      description,
      metadata,
    },
    success_url: `${checkoutSiteUrl}${successPath}`,
  });
}

async function getSharedJoinRequestForSession({ checkoutSession, supabase }) {
  const requestId = checkoutSession.metadata?.shared_join_request_id;

  let query = supabase
    .from("shared_join_requests")
    .select(SHARED_JOIN_REQUEST_SELECT);

  if (requestId) {
    query = query.eq("id", requestId);
  } else {
    query = query.eq("stripe_checkout_session_id", checkoutSession.id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[shared join authorization] Could not load request", error.message);
    throw new Error("Could not load shared join request.");
  }

  return data;
}

async function hasActiveJoinRequest({ bookingId, requestId, supabase }) {
  let query = supabase
    .from("shared_join_requests")
    .select("id")
    .eq("booking_id", bookingId)
    .in("status", ACTIVE_SHARED_JOIN_REQUEST_STATUSES)
    .limit(1);

  if (requestId) {
    query = query.neq("id", requestId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(
      "[shared join authorization] Could not check active request",
      error.message,
    );
    throw new Error("Could not check active shared join request.");
  }

  return Boolean(data);
}

async function releaseSharedJoinAuthorization({
  joinRequest,
  paymentIntent,
  reason,
  supabase,
}) {
  if (isPaymentIntentAuthorized(paymentIntent)) {
    try {
      await getStripe().paymentIntents.cancel(paymentIntent.id);
    } catch (error) {
      console.error("[shared join authorization] Could not release intent", {
        paymentIntentId: paymentIntent.id,
        reason,
        message: error.message,
      });
      throw error;
    }
  }

  const { error } = await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "released",
      status: "released",
      stripe_payment_intent_id: paymentIntent?.id ?? joinRequest.stripe_payment_intent_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", joinRequest.id);

  if (error) {
    console.error(
      "[shared join authorization] Could not mark request released",
      error.message,
    );
    throw new Error("Could not release shared join request.");
  }

  return { handled: true, released: true, reason };
}

async function reopenBookingAfterReleasedRequest({ bookingId, supabase }) {
  const { error } = await supabase
    .from("bookings")
    .update({
      shared_status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("shared_status", "active_request");

  if (error) {
    console.error("[shared join authorization] Could not reopen shared booking", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not reopen shared booking.");
  }
}

export async function expireOverdueSharedJoinRequestsForBooking({
  bookingId,
  siteUrl,
} = {}) {
  if (!bookingId) {
    return { expired: 0 };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const now = new Date().toISOString();
  const { data: overdueRequests, error } = await supabase
    .from("shared_join_requests")
    .select(SHARED_JOIN_REQUEST_SELECT)
    .eq("booking_id", bookingId)
    .eq("status", "authorized_pending_host_decision")
    .eq("payment_status", "authorized")
    .lt("host_response_deadline_at", now);

  if (error) {
    console.error("[shared join expiry] Could not load overdue requests", {
      bookingId,
      message: error.message,
    });
    throw new Error("Could not load overdue shared join requests.");
  }

  if (!overdueRequests?.length) {
    return { expired: 0 };
  }

  const booking = await getParentBooking({ bookingId, supabase });
  let expired = 0;

  for (const request of overdueRequests) {
    const paymentIntent = await getPaymentIntent(request.stripe_payment_intent_id);
    const result = await releaseSharedJoinAuthorization({
      joinRequest: request,
      paymentIntent,
      reason: "host response deadline expired",
      supabase,
    });

    if (result.released) {
      expired += 1;
      if (booking) {
        try {
          await sendSharedJoinEmailWithLog({
            booking,
            eventType: "rejected_guest",
            managePath: getSharedGuestManagePath(request),
            request: {
              ...request,
              payment_status: "released",
              status: "released",
            },
            siteUrl,
            to: request.email,
          });
        } catch (emailError) {
          console.error("[shared join expiry] Expiry email failed", {
            message: emailError.message,
            requestId: request.id,
          });
        }
      }
    }
  }

  if (expired > 0) {
    await reopenBookingAfterReleasedRequest({ bookingId, supabase });
  }

  return { expired };
}

async function getParentBooking({ bookingId, supabase }) {
  const { data, error } = await supabase
    .from("bookings")
    .select(SHARED_BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[shared join authorization] Could not load booking", error.message);
    throw new Error("Could not load shared booking.");
  }

  return data;
}

async function getHostManagedSharedRequest({
  bookingId,
  manageToken,
  requestId,
  supabase,
}) {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, locale, customer_name, email, phone, customer_manage_token, booking_status, payment_status, is_shared_open, shared_status, requested_date, time_slot, time_window, tour_type")
    .eq("id", bookingId)
    .eq("customer_manage_token", manageToken)
    .maybeSingle();

  if (bookingError) {
    console.error("[shared join host decision] Could not load booking", bookingError.message);
    throw new Error("Could not load managed booking.");
  }

  if (
    !booking ||
    booking.booking_status !== "confirmed" ||
    booking.payment_status !== "captured" ||
    !booking.is_shared_open
  ) {
    throw new Error("Shared booking is not available for host decision.");
  }

  const { data: joinRequest, error: requestError } = await supabase
    .from("shared_join_requests")
    .select(HOST_SHARED_JOIN_REQUEST_SELECT)
    .eq("id", requestId)
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (requestError) {
    console.error(
      "[shared join host decision] Could not load join request",
      requestError.message,
    );
    throw new Error("Could not load shared join request.");
  }

  if (!joinRequest) {
    throw new Error("Shared join request not found.");
  }

  if (isHostDecisionExpired(joinRequest)) {
    await expireOverdueSharedJoinRequestsForBooking({ bookingId: booking.id });
    throw new Error("Shared join request host response deadline has expired.");
  }

  return { booking, joinRequest };
}

async function markSharedJoinRequestAccepted({ bookingId, joinRequest, paymentIntent }) {
  const supabase = createSupabaseServiceRoleServerClient();
  const now = new Date().toISOString();
  const { data: updatedRequest, error: updateRequestError } = await supabase
    .from("shared_join_requests")
    .update({
      accepted_at: now,
      payment_status: "captured",
      status: "accepted",
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: now,
    })
    .eq("id", joinRequest.id)
    .eq("status", "authorized_pending_host_decision")
    .eq("payment_status", "authorized")
    .select(HOST_SHARED_JOIN_REQUEST_SELECT)
    .maybeSingle();

  if (updateRequestError) {
    console.error(
      "[shared join host decision] Could not mark request accepted",
      updateRequestError.message,
    );
    throw new Error("Could not mark shared join request accepted.");
  }

  if (!updatedRequest) {
    throw new Error("Shared join request status changed before acceptance.");
  }

  const { data: updatedBooking, error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      shared_status: "connected",
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("shared_status", "active_request")
    .select("id")
    .maybeSingle();

  if (updateBookingError) {
    console.error(
      "[shared join host decision] Could not mark booking connected",
      updateBookingError.message,
    );
    throw new Error("Could not update shared booking.");
  }

  if (!updatedBooking) {
    throw new Error("Shared booking status changed before acceptance.");
  }

  return updatedRequest;
}

async function markCapturedJoinRequestRefundedAfterFailure({
  joinRequest,
  paymentIntentId,
  reason,
}) {
  await refundCapturedPaymentIntent({
    idempotencyKey: `shared-join-${joinRequest.id}-capture-compensation-refund`,
    metadata: {
      refund_source: "shared_accept_state_update_failed",
      shared_join_request_id: joinRequest.id,
    },
    paymentIntentId,
  });

  const supabase = createSupabaseServiceRoleServerClient();
  await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "refunded",
      status: "released",
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", joinRequest.id);

  console.error("[shared join host decision] Refunded captured request after failure", {
    message: reason,
    paymentIntentId,
    requestId: joinRequest.id,
  });
}

async function sendSharedJoinAuthorizationEmails({ booking, request, siteUrl }) {
  await Promise.allSettled([
    sendSharedJoinEmailWithLog({
      booking,
      eventType: "authorized_guest",
      managePath: getSharedGuestManagePath(request),
      request,
      siteUrl,
      to: request.email,
    }),
    sendSharedJoinEmailWithLog({
      booking,
      eventType: "authorized_host",
      managePath: getSharedHostManagePath(booking),
      request,
      siteUrl,
      to: booking.email,
    }),
  ]);
}

async function sendSharedJoinDecisionEmails({
  booking,
  decision,
  request,
  siteUrl,
}) {
  if (decision === "accepted") {
    await Promise.allSettled([
      sendSharedJoinEmailWithLog({
        booking,
        eventType: "accepted_guest",
        managePath: getSharedGuestManagePath(request),
        request,
        siteUrl,
        to: request.email,
      }),
      sendSharedJoinEmailWithLog({
        booking,
        eventType: "accepted_host",
        managePath: getSharedHostManagePath(booking),
        request,
        siteUrl,
        to: booking.email,
      }),
    ]);
    return;
  }

  await sendSharedJoinEmailWithLog({
    booking,
    eventType: "rejected_guest",
    managePath: getSharedGuestManagePath(request),
    request,
    siteUrl,
    to: request.email,
  });
}

async function getSharedJoinRequestsForBookingCancellation({ bookingId, supabase }) {
  const { data, error } = await supabase
    .from("shared_join_requests")
    .select(SHARED_JOIN_CANCELLATION_REQUEST_SELECT)
    .eq("booking_id", bookingId)
    .in("status", ["authorized_pending_host_decision", "accepted"])
    .in("payment_status", ["authorized", "captured"]);

  if (error) {
    console.error(
      "[shared join cancellation] Could not load shared join requests",
      {
        bookingId,
        message: error.message,
      },
    );
    throw new Error("Could not load shared join requests for cancellation.");
  }

  return data ?? [];
}

async function settleSharedJoinRequestForBookingCancellation({
  booking,
  request,
  supabase,
}) {
  const now = new Date().toISOString();
  const paymentIntentId =
    request.stripe_payment_intent_id ||
    (await getPaymentIntentIdFromCheckoutSession(request.stripe_checkout_session_id));

  if (!paymentIntentId) {
    throw new Error("Shared join request does not have a Stripe payment intent.");
  }

  const stripe = getStripe();

  if (request.payment_status === "captured") {
    const refund = await stripe.refunds.create(
      {
        metadata: {
          booking_id: booking.id,
          refund_source: "admin_cancelled_shared_booking",
          shared_join_request_id: request.id,
        },
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
      },
      {
        idempotencyKey: `shared-join-${request.id}-fee-refund-on-booking-cancel`,
      },
    );

    if (!["pending", "requires_action", "succeeded"].includes(refund.status)) {
      throw new Error(`Stripe shared join refund was not accepted: ${refund.status}`);
    }

    const { data: updatedRequest, error } = await supabase
      .from("shared_join_requests")
      .update({
        payment_status: "refunded",
        status: "released",
        stripe_payment_intent_id: paymentIntentId,
        updated_at: now,
      })
      .eq("id", request.id)
      .select(SHARED_JOIN_CANCELLATION_REQUEST_SELECT)
      .maybeSingle();

    if (error) {
      console.error("[shared join cancellation] Could not mark request refunded", {
        message: error.message,
        requestId: request.id,
      });
      throw new Error("Could not mark shared join request refunded.");
    }

    return updatedRequest;
  }

  const paymentIntent = await stripe.paymentIntents.cancel(
    paymentIntentId,
    {},
    {
      idempotencyKey: `shared-join-${request.id}-authorization-release-on-booking-cancel`,
    },
  );

  if (paymentIntent.status !== "canceled") {
    throw new Error(
      `Stripe shared join authorization release did not succeed: ${paymentIntent.status}`,
    );
  }

  const { data: updatedRequest, error } = await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "released",
      status: "released",
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: now,
    })
    .eq("id", request.id)
    .select(SHARED_JOIN_CANCELLATION_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[shared join cancellation] Could not mark request released", {
      message: error.message,
      requestId: request.id,
    });
    throw new Error("Could not mark shared join request released.");
  }

  return updatedRequest;
}

export async function settleSharedJoinRequestsForBookingCancellation({
  booking,
  siteUrl,
}) {
  if (!booking?.id) {
    return { settled: 0 };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const requests = await getSharedJoinRequestsForBookingCancellation({
    bookingId: booking.id,
    supabase,
  });
  const settledRequests = [];

  for (const request of requests) {
    const updatedRequest = await settleSharedJoinRequestForBookingCancellation({
      booking,
      request,
      supabase,
    });

    if (updatedRequest) {
      settledRequests.push(updatedRequest);
      await sendSharedJoinEmailWithLog({
        booking,
        eventType: "cancelled_guest",
        managePath: getSharedGuestManagePath(updatedRequest),
        request: updatedRequest,
        siteUrl,
        to: updatedRequest.email,
      });
    }
  }

  return { settled: settledRequests.length };
}

async function refundCapturedPaymentIntent({
  idempotencyKey,
  metadata,
  paymentIntentId,
}) {
  if (!paymentIntentId) {
    throw new Error("Captured payment does not have a Stripe payment intent.");
  }

  const refund = await getStripe().refunds.create(
    {
      metadata,
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
    },
    { idempotencyKey },
  );

  if (!["pending", "requires_action", "succeeded"].includes(refund.status)) {
    throw new Error(`Stripe refund was not accepted: ${refund.status}`);
  }

  return refund;
}

async function loadAdminConnectedSharedBooking({
  bookingId,
  requestId,
  supabase,
}) {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(ADMIN_CONNECTED_SHARED_BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("[admin shared cancellation] Could not load booking", {
      bookingId,
      message: bookingError.message,
    });
    throw new Error("Could not load shared booking.");
  }

  if (!booking) {
    throw new Error("Shared booking not found.");
  }

  const { data: request, error: requestError } = await supabase
    .from("shared_join_requests")
    .select(ADMIN_CONNECTED_SHARED_REQUEST_SELECT)
    .eq("id", requestId)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (requestError) {
    console.error("[admin shared cancellation] Could not load request", {
      message: requestError.message,
      requestId,
    });
    throw new Error("Could not load shared join request.");
  }

  if (!request) {
    throw new Error("Shared join request not found.");
  }

  if (
    booking.booking_status !== "confirmed" ||
    booking.payment_status !== "captured" ||
    booking.shared_status !== "connected" ||
    !booking.is_shared_open
  ) {
    throw new Error("Booking is not a connected shared booking.");
  }

  if (request.status !== "accepted" || request.payment_status !== "captured") {
    throw new Error("Shared join request is not an accepted captured request.");
  }

  return { booking, request };
}

async function getBookingPaymentIntentId(booking) {
  return (
    booking.stripe_payment_intent_id ||
    (await getPaymentIntentIdFromCheckoutSession(booking.stripe_checkout_session_id))
  );
}

function getPromotedBookingPayload({ booking, now, paymentIntentId, request }) {
  const remainingCapacity = Math.max(
    0,
    MAX_BOAT_CAPACITY - Number(request.guest_count ?? 0),
  );

  return {
    contact_method: request.preferred_contact_method,
    customer_manage_token: request.customer_manage_token,
    customer_name: request.customer_name,
    email: request.email,
    final_reservation_fee_eur: request.shared_request_fee_eur,
    guest_count: request.guest_count,
    locale: request.locale || booking.locale,
    message: request.message,
    original_reservation_fee_eur:
      request.original_shared_request_fee_eur ?? request.shared_request_fee_eur,
    phone: request.phone,
    promo_code: request.promo_code,
    promo_discount_eur: request.promo_discount_eur ?? 0,
    reservation_fee_eur:
      request.original_shared_request_fee_eur ?? request.shared_request_fee_eur,
    shared_gender_preference: "any",
    shared_open_seats: remainingCapacity,
    shared_primary_replacement: {
      promoted_at: now,
      promoted_request_id: request.id,
      replaced_primary: {
        contact_method: booking.contact_method,
        customer_manage_token: booking.customer_manage_token,
        customer_name: booking.customer_name,
        email: booking.email,
        final_reservation_fee_eur: booking.final_reservation_fee_eur,
        guest_count: booking.guest_count,
        locale: booking.locale,
        original_reservation_fee_eur: booking.original_reservation_fee_eur,
        phone: booking.phone,
        promo_code: booking.promo_code,
        promo_discount_eur: booking.promo_discount_eur,
        reservation_fee_eur: booking.reservation_fee_eur,
        stripe_checkout_session_id: booking.stripe_checkout_session_id,
        stripe_payment_intent_id: booking.stripe_payment_intent_id,
      },
    },
    shared_status: remainingCapacity > 0 ? "open" : "closed",
    stripe_checkout_session_id: request.stripe_checkout_session_id,
    stripe_payment_intent_id: paymentIntentId,
    updated_at: now,
  };
}

async function sendAdminSecondaryCancellationEmails({
  booking,
  request,
  siteUrl,
}) {
  await Promise.allSettled([
    sendSharedJoinEmailWithLog({
      booking,
      eventType: "admin_cancelled_secondary_guest",
      managePath: getSharedGuestManagePath(request),
      request,
      siteUrl,
      to: request.email,
    }),
    sendSharedJoinEmailWithLog({
      booking,
      eventType: "admin_cancelled_secondary_host",
      managePath: getSharedHostManagePath(booking),
      request,
      siteUrl,
      to: booking.email,
    }),
  ]);
}

async function sendAdminPrimaryPromotionEmails({
  cancellationReason,
  originalBooking,
  promotedBooking,
  request,
  siteUrl,
  supabase,
}) {
  const promotedManageUrl = getAbsoluteUrl(
    getSharedHostManagePath(promotedBooking),
    siteUrl,
  );

  await Promise.allSettled([
    sendBookingEmail({
      booking: {
        ...originalBooking,
        cancellation_reason:
          cancellationReason ||
          "The primary group was cancelled by admin and the accepted shared group now holds the booking.",
        manage_url: null,
      },
      eventType: "shared_primary_cancelled_promoted",
      supabase,
    }),
    sendBookingEmail({
      booking: {
        ...promotedBooking,
        manage_url: promotedManageUrl,
      },
      eventType: "shared_promoted_primary",
      supabase,
    }),
  ]);
}

export async function cancelAcceptedSharedJoinRequestFromAdmin({
  bookingId,
  requestId,
  siteUrl,
}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { booking, request } = await loadAdminConnectedSharedBooking({
    bookingId,
    requestId,
    supabase,
  });
  const now = new Date().toISOString();
  const paymentIntentId =
    request.stripe_payment_intent_id ||
    (await getPaymentIntentIdFromCheckoutSession(request.stripe_checkout_session_id));

  await refundCapturedPaymentIntent({
    idempotencyKey: `shared-join-${request.id}-admin-secondary-cancel-refund`,
    metadata: {
      booking_id: booking.id,
      refund_source: "admin_cancelled_secondary_shared_request",
      shared_join_request_id: request.id,
    },
    paymentIntentId,
  });

  const { data: updatedRequest, error: requestUpdateError } = await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "refunded",
      status: "cancelled_by_admin",
      stripe_payment_intent_id: paymentIntentId,
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("status", "accepted")
    .eq("payment_status", "captured")
    .select(ADMIN_CONNECTED_SHARED_REQUEST_SELECT)
    .maybeSingle();

  if (requestUpdateError) {
    console.error(
      "[admin shared cancellation] Could not mark secondary cancelled",
      {
        message: requestUpdateError.message,
        requestId: request.id,
      },
    );
    throw new Error("Could not update shared join request after refund.");
  }

  if (!updatedRequest) {
    throw new Error("Shared join request status changed after refund.");
  }

  const { data: updatedBooking, error: bookingUpdateError } = await supabase
    .from("bookings")
    .update({
      shared_status: "open",
      updated_at: now,
    })
    .eq("id", booking.id)
    .eq("shared_status", "connected")
    .select(ADMIN_CONNECTED_SHARED_BOOKING_SELECT)
    .maybeSingle();

  if (bookingUpdateError) {
    console.error("[admin shared cancellation] Could not reopen booking", {
      bookingId: booking.id,
      message: bookingUpdateError.message,
    });
    throw new Error("Could not reopen shared booking after refund.");
  }

  if (!updatedBooking) {
    throw new Error("Secondary was refunded, but the shared booking was not reopened.");
  }

  await sendAdminSecondaryCancellationEmails({
    booking: updatedBooking,
    request: updatedRequest,
    siteUrl,
  });

  return { booking: updatedBooking, request: updatedRequest };
}

export async function cancelPrimaryAndPromoteSharedJoinRequestFromAdmin({
  bookingId,
  cancellationReason,
  requestId,
  siteUrl,
}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { booking, request } = await loadAdminConnectedSharedBooking({
    bookingId,
    requestId,
    supabase,
  });
  const now = new Date().toISOString();
  const primaryPaymentIntentId = await getBookingPaymentIntentId(booking);
  const promotedPaymentIntentId =
    request.stripe_payment_intent_id ||
    (await getPaymentIntentIdFromCheckoutSession(request.stripe_checkout_session_id));

  await refundCapturedPaymentIntent({
    idempotencyKey: `booking-${booking.id}-admin-primary-cancel-promote-refund`,
    metadata: {
      booking_id: booking.id,
      booking_reference: formatBookingReferenceCode(booking.id),
      refund_source: "admin_cancelled_primary_promoted_secondary",
      shared_join_request_id: request.id,
    },
    paymentIntentId: primaryPaymentIntentId,
  });

  const { data: promotedBooking, error: bookingUpdateError } = await supabase
    .from("bookings")
    .update(
      getPromotedBookingPayload({
        booking,
        now,
        paymentIntentId: promotedPaymentIntentId,
        request,
      }),
    )
    .eq("id", booking.id)
    .eq("booking_status", "confirmed")
    .eq("payment_status", "captured")
    .eq("shared_status", "connected")
    .select(ADMIN_CONNECTED_SHARED_BOOKING_SELECT)
    .maybeSingle();

  if (bookingUpdateError) {
    console.error("[admin shared cancellation] Could not promote secondary", {
      bookingId: booking.id,
      message: bookingUpdateError.message,
      requestId: request.id,
    });
    throw new Error("Primary refund was started, but secondary could not be promoted.");
  }

  if (!promotedBooking) {
    throw new Error("Primary refund was started, but booking status changed.");
  }

  const { data: updatedRequest, error: requestUpdateError } = await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "captured",
      status: "promoted_to_primary",
      stripe_payment_intent_id: promotedPaymentIntentId,
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("status", "accepted")
    .eq("payment_status", "captured")
    .select(ADMIN_CONNECTED_SHARED_REQUEST_SELECT)
    .maybeSingle();

  if (requestUpdateError) {
    console.error(
      "[admin shared cancellation] Could not mark request promoted",
      {
        message: requestUpdateError.message,
        requestId: request.id,
      },
    );
    throw new Error("Secondary was promoted, but request status was not updated.");
  }

  let promotedRequest = updatedRequest;

  if (!promotedRequest) {
    const { data: repairedRequest, error: repairRequestError } = await supabase
      .from("shared_join_requests")
      .update({
        payment_status: "captured",
        status: "promoted_to_primary",
        stripe_payment_intent_id: promotedPaymentIntentId,
        updated_at: now,
      })
      .eq("id", request.id)
      .select(ADMIN_CONNECTED_SHARED_REQUEST_SELECT)
      .maybeSingle();

    if (repairRequestError || !repairedRequest) {
      console.error(
        "[admin shared cancellation] Could not repair promoted request status",
        {
          message: repairRequestError?.message,
          requestId: request.id,
        },
      );
      throw new Error("Secondary was promoted, but request status changed.");
    }

    promotedRequest = repairedRequest;
  }

  await sendAdminPrimaryPromotionEmails({
    cancellationReason,
    originalBooking: booking,
    promotedBooking,
    request: promotedRequest,
    siteUrl,
    supabase,
  });

  return { booking: promotedBooking, request: promotedRequest };
}

export async function acceptSharedJoinRequestForHost({
  bookingId,
  manageToken,
  requestId,
  siteUrl,
}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { booking, joinRequest } = await getHostManagedSharedRequest({
    bookingId,
    manageToken,
    requestId,
    supabase,
  });

  if (joinRequest.payment_status === "captured") {
    if (joinRequest.status === "accepted") {
      return joinRequest;
    }

    const acceptedRequest = await markSharedJoinRequestAccepted({
      bookingId,
      joinRequest,
      paymentIntent: { id: joinRequest.stripe_payment_intent_id },
    });
    await sendSharedJoinDecisionEmails({
      booking,
      decision: "accepted",
      request: acceptedRequest,
      siteUrl,
    });
    return acceptedRequest;
  }

  if (
    joinRequest.status !== "authorized_pending_host_decision" ||
    joinRequest.payment_status !== "authorized"
  ) {
    throw new Error("Shared join request is not awaiting host decision.");
  }

  const paymentIntent = await getPaymentIntent(joinRequest.stripe_payment_intent_id);

  if (!paymentIntent) {
    throw new Error("Shared join request payment authorization was not found.");
  }

  const capturedPaymentIntent =
    paymentIntent.status === "succeeded"
      ? paymentIntent
      : await getStripe().paymentIntents.capture(
          paymentIntent.id,
          {},
          {
            idempotencyKey: `shared-join-${joinRequest.id}-host-accept-capture`,
          },
        );

  let acceptedRequest;

  try {
    acceptedRequest = await markSharedJoinRequestAccepted({
      bookingId,
      joinRequest,
      paymentIntent: capturedPaymentIntent,
    });
  } catch (error) {
    await markCapturedJoinRequestRefundedAfterFailure({
      joinRequest,
      paymentIntentId: capturedPaymentIntent.id,
      reason: error.message,
    });
    await reopenBookingAfterReleasedRequest({ bookingId, supabase });
    throw error;
  }

  await sendSharedJoinDecisionEmails({
    booking,
    decision: "accepted",
    request: acceptedRequest,
    siteUrl,
  });
  return acceptedRequest;
}

export async function rejectSharedJoinRequestForHost({
  bookingId,
  manageToken,
  requestId,
  siteUrl,
}) {
  const supabase = createSupabaseServiceRoleServerClient();
  const { booking, joinRequest } = await getHostManagedSharedRequest({
    bookingId,
    manageToken,
    requestId,
    supabase,
  });

  if (
    joinRequest.status !== "authorized_pending_host_decision" ||
    joinRequest.payment_status !== "authorized"
  ) {
    throw new Error("Shared join request is not awaiting host decision.");
  }

  const paymentIntent = await getPaymentIntent(joinRequest.stripe_payment_intent_id);

  if (isPaymentIntentAuthorized(paymentIntent)) {
    await getStripe().paymentIntents.cancel(
      paymentIntent.id,
      {},
      {
        idempotencyKey: `shared-join-${joinRequest.id}-host-reject-release`,
      },
    );
  }

  const now = new Date().toISOString();
  const { data: updatedRequest, error: updateRequestError } = await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "released",
      rejected_at: now,
      status: "rejected",
      stripe_payment_intent_id:
        paymentIntent?.id ?? joinRequest.stripe_payment_intent_id,
      updated_at: now,
    })
    .eq("id", joinRequest.id)
    .eq("status", "authorized_pending_host_decision")
    .eq("payment_status", "authorized")
    .select(HOST_SHARED_JOIN_REQUEST_SELECT)
    .maybeSingle();

  if (updateRequestError) {
    console.error(
      "[shared join host decision] Could not mark request rejected",
      updateRequestError.message,
    );
    throw new Error("Could not reject shared join request.");
  }

  if (!updatedRequest) {
    throw new Error("Shared join request status changed before rejection.");
  }

  const { error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      shared_status: "open",
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("shared_status", "active_request");

  if (updateBookingError) {
    console.error(
      "[shared join host decision] Could not reopen shared booking",
      updateBookingError.message,
    );
    throw new Error("Could not reopen shared booking.");
  }

  await sendSharedJoinDecisionEmails({
    booking,
    decision: "rejected",
    request: updatedRequest,
    siteUrl,
  });

  return updatedRequest;
}

export async function handleSharedJoinCheckoutSessionCompleted({
  session,
  sessionId,
}) {
  const checkoutSession = await getCheckoutSession({ session, sessionId });

  if (!checkoutSession?.id) {
    return { handled: false, reason: "checkout session not found" };
  }

  if (checkoutSession.metadata?.type !== "shared_join_request") {
    return { handled: false, reason: "not a shared join request session" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const siteUrl = checkoutSession.metadata?.site_url;
  const joinRequest = await getSharedJoinRequestForSession({
    checkoutSession,
    supabase,
  });

  if (!joinRequest) {
    return { handled: false, reason: "shared join request not found" };
  }

  if (ACTIVE_SHARED_JOIN_REQUEST_STATUSES.includes(joinRequest.status)) {
    if (isHostDecisionExpired(joinRequest)) {
      const paymentIntent = await getPaymentIntent(
        joinRequest.stripe_payment_intent_id || checkoutSession.payment_intent,
      );

      await releaseSharedJoinAuthorization({
        joinRequest,
        paymentIntent,
        reason: "host response deadline expired",
        supabase,
      });
      await reopenBookingAfterReleasedRequest({
        bookingId: joinRequest.booking_id,
        supabase,
      });

      return { handled: true, released: true, reason: "host response deadline expired" };
    }

    if (joinRequest.status === "authorized_pending_host_decision") {
      const { error: repairError } = await supabase
        .from("bookings")
        .update({
          shared_status: "active_request",
          updated_at: new Date().toISOString(),
        })
        .eq("id", joinRequest.booking_id)
        .eq("shared_status", "open");

      if (repairError) {
        console.error(
          "[shared join authorization] Could not repair parent booking status",
          repairError.message,
        );
        throw new Error("Could not repair shared booking status.");
      }
    }

    return { handled: true, authorized: false, reason: "request already active" };
  }

  if (["released", "captured", "refunded"].includes(joinRequest.payment_status)) {
    return { handled: true, authorized: false, reason: "request already closed" };
  }

  const paymentIntent = await getPaymentIntent(checkoutSession.payment_intent);

  if (!isPaymentIntentAuthorized(paymentIntent)) {
    return { handled: false, reason: "payment intent is not authorized" };
  }

  const booking = await getParentBooking({
    bookingId: joinRequest.booking_id,
    supabase,
  });

  if (
    !isValidSharedBookingForJoin(booking) ||
    isWithinJoinRequestCutoff(booking)
  ) {
    return releaseSharedJoinAuthorization({
      joinRequest,
      paymentIntent,
      reason: "shared booking no longer joinable",
      supabase,
    });
  }

  const alreadyHasActiveRequest = await hasActiveJoinRequest({
    bookingId: joinRequest.booking_id,
    requestId: joinRequest.id,
    supabase,
  });

  if (alreadyHasActiveRequest) {
    return releaseSharedJoinAuthorization({
      joinRequest,
      paymentIntent,
      reason: "another active request already exists",
      supabase,
    });
  }

  const now = new Date();
  const hostResponseDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: updatedRequest, error: updateRequestError } = await supabase
    .from("shared_join_requests")
    .update({
      authorized_at: now.toISOString(),
      host_response_deadline_at: hostResponseDeadline.toISOString(),
      payment_status: "authorized",
      status: "authorized_pending_host_decision",
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: now.toISOString(),
    })
    .eq("id", joinRequest.id)
    .eq("payment_status", "authorization_pending")
    .eq("status", "authorization_pending")
    .select(SHARED_JOIN_REQUEST_SELECT)
    .maybeSingle();

  if (updateRequestError) {
    if (updateRequestError.code === "23505") {
      return releaseSharedJoinAuthorization({
        joinRequest,
        paymentIntent,
        reason: "another active request won the race",
        supabase,
      });
    }

    console.error(
      "[shared join authorization] Could not activate request",
      updateRequestError.message,
    );
    throw new Error("Could not activate shared join request.");
  }

  if (!updatedRequest) {
    return { handled: true, authorized: false, reason: "request already processed" };
  }

  const { data: updatedBooking, error: updateBookingError } = await supabase
    .from("bookings")
    .update({
      shared_status: "active_request",
      updated_at: now.toISOString(),
    })
    .eq("id", joinRequest.booking_id)
    .eq("shared_status", "open")
    .select("id")
    .maybeSingle();

  if (updateBookingError) {
    console.error(
      "[shared join authorization] Could not update parent booking",
      updateBookingError.message,
    );
    throw new Error("Could not update shared booking status.");
  }

  if (!updatedBooking) {
    return releaseSharedJoinAuthorization({
      joinRequest: updatedRequest,
      paymentIntent,
      reason: "parent booking status changed",
      supabase,
    });
  }

  await sendSharedJoinAuthorizationEmails({
    booking,
    request: updatedRequest,
    siteUrl,
  });

  return { authorized: true, handled: true };
}

export async function expireSharedJoinCheckoutSession({ session }) {
  if (session?.metadata?.type !== "shared_join_request") {
    return { expired: false, reason: "not a shared join request session" };
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const { data, error } = await supabase
    .from("shared_join_requests")
    .update({
      payment_status: "failed",
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", session.id)
    .eq("payment_status", "authorization_pending")
    .eq("status", "authorization_pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[shared join expired] Could not expire request", error.message);
    throw new Error("Could not expire shared join request checkout.");
  }

  return data
    ? { expired: true }
    : { expired: false, reason: "request already processed" };
}
