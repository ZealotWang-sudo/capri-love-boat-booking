"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isUnavailableSlotsTableMissing } from "@/lib/adminUnavailableSlots";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingOverlapsSelection,
  getDisplayTimeForTimeSlot,
  isValidTimeSlotForTour,
} from "@/lib/bookingAvailability";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleServerClient,
} from "@/lib/supabase/server";
import {
  getBookingEmailEventForStatus,
  sendBookingEmail,
} from "@/lib/email/sendBookingEmail";
import {
  getSharedGuestManagePath,
  sendSharedJoinEmail,
} from "@/lib/email/sendSharedJoinEmail";
import {
  releaseAuthorizedBookingPayment,
} from "@/lib/stripe/adminBookingPayments";
import {
  cancelAcceptedSharedJoinRequestFromAdmin,
  cancelPrimaryAndPromoteSharedJoinRequestFromAdmin,
  settleSharedJoinRequestsForBookingCancellation,
} from "@/lib/stripe/sharedJoinRequests";
import { getStripe } from "@/lib/stripe/server";
import {
  markCaptainAvailable,
  markCaptainUnavailable,
} from "@/lib/bookings/markCaptainAvailable";
import { sendCaptainCancellationTelegramNotification } from "@/lib/telegram/sendCaptainCancellationTelegramNotification";

const ADMIN_EMAIL = "wangkexin-personal@outlook.com";
const CLOSED_BOOKING_STATUSES = new Set([
  "completed",
  "cancelled",
  "not_available",
  "expired",
]);
const DELETABLE_PAYMENT_STATUSES = new Set(["authorization_pending", "failed"]);
const CANCELLATION_TYPES = new Set([
  "customer_requested",
  "captain_unavailable",
  "weather_or_safety",
  "admin_decision",
  "duplicate_or_test",
  "other",
]);
const CAPTAIN_MESSAGE_TYPES = new Set([
  "time_confirmation",
  "final_confirmation",
  "cancellation",
]);
const BOOKING_STATUS_UPDATES = {
  checking_with_captain: {
    booking_status: "checking_with_captain",
    captain_status: "pending",
    payment_status: "unpaid",
  },
  captain_available: {
    booking_status: "payment_pending",
    captain_status: "available",
    payment_status: "unpaid",
  },
  captain_not_available: {
    booking_status: "not_available",
    captain_status: "not_available",
    payment_status: "unpaid",
  },
  confirmed: {
    booking_status: "confirmed",
    captain_status: "available",
    payment_status: "captured",
  },
  completed: {
    booking_status: "completed",
  },
  cancelled: {
    booking_status: "cancelled",
  },
};
const RESCHEDULE_BOOKING_EMAIL_SELECT =
  "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, customer_manage_token, is_shared_open, shared_status, shared_public_token";
const RESCHEDULE_SHARED_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, customer_manage_token, guest_count, gender_composition, shared_request_fee_eur, payment_status, status";
const COMPLETED_SHARED_REQUEST_SELECT =
  "id, booking_id, locale, customer_name, email, customer_manage_token, guest_count, shared_request_fee_eur, payment_status, status";

function getAdminRedirectPath(params = {}) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  return query ? `/admin?${query}` : "/admin";
}

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getPaymentIntentId(paymentIntent) {
  if (!paymentIntent) {
    return null;
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0];

  if (host) {
    const protocol =
      forwardedProto || (host.startsWith("localhost") ? "http" : "https");

    return `${protocol}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "";
}

async function getCustomerManageUrl(booking) {
  if (!booking.customer_manage_token) {
    return null;
  }

  const origin = await getRequestOrigin();

  if (!origin) {
    return null;
  }

  return `${origin}/${booking.locale}/booking/manage/${booking.id}?token=${encodeURIComponent(booking.customer_manage_token)}`;
}

async function getSharedGuestManageUrl(request) {
  const origin = await getRequestOrigin();
  const managePath = getSharedGuestManagePath(request);

  if (!origin || !managePath) {
    return null;
  }

  return `${origin}${managePath}`;
}

async function getStripePaymentIntentId(booking) {
  if (booking.stripe_payment_intent_id) {
    return booking.stripe_payment_intent_id;
  }

  if (!booking.stripe_checkout_session_id) {
    return null;
  }

  const checkoutSession = await getStripe().checkout.sessions.retrieve(
    booking.stripe_checkout_session_id,
  );

  return getPaymentIntentId(checkoutSession.payment_intent);
}

async function refundCapturedPaymentForCancellation(booking) {
  if (booking.payment_status !== "captured") {
    return null;
  }

  const paymentIntentId = await getStripePaymentIntentId(booking);

  if (!paymentIntentId) {
    console.error("[admin booking cancel] Captured booking has no Stripe payment", {
      bookingId: booking.id,
    });
    return null;
  }

  const refund = await getStripe().refunds.create(
    {
      payment_intent: paymentIntentId,
      metadata: {
        booking_id: booking.id,
        booking_reference: `CAPRI-${booking.id.slice(0, 8).toUpperCase()}`,
        refund_source: "admin_cancelled_booking",
      },
      reason: "requested_by_customer",
    },
    {
      idempotencyKey: `booking-${booking.id}-reservation-fee-refund-on-cancel`,
    },
  );

  if (!["pending", "requires_action", "succeeded"].includes(refund.status)) {
    throw new Error(`Stripe refund was not accepted: ${refund.status}`);
  }

  return paymentIntentId;
}

async function sendCompletedSharedGuestEmails({ booking }) {
  if (!booking?.is_shared_open || booking.booking_status !== "completed") {
    return;
  }

  const serviceSupabase = createSupabaseServiceRoleServerClient();
  const { data: acceptedRequests, error } = await serviceSupabase
    .from("shared_join_requests")
    .select(COMPLETED_SHARED_REQUEST_SELECT)
    .eq("booking_id", booking.id)
    .eq("status", "accepted")
    .eq("payment_status", "captured");

  if (error) {
    console.error("[admin booking completed] Could not load shared guests", {
      bookingId: booking.id,
      message: error.message,
    });
    return;
  }

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
    const manageUrl = await getSharedGuestManageUrl(request);
    const emailResult = await sendBookingEmail({
      booking: {
        ...booking,
        customer_manage_token: request.customer_manage_token,
        customer_name: request.customer_name,
        email: request.email,
        final_reservation_fee_eur: request.shared_request_fee_eur,
        guest_count: request.guest_count,
        locale: request.locale || booking.locale,
        manage_url: manageUrl,
        original_reservation_fee_eur: request.shared_request_fee_eur,
        pay_on_board_eur: sharedPayOnBoard,
        promo_code: null,
        promo_discount_eur: 0,
        reservation_fee_eur: request.shared_request_fee_eur,
        total_price_eur: sharedTotal,
      },
      checkDuplicate: false,
      eventType: "completed",
      supabase: serviceSupabase,
    });

    if (!emailResult.sent) {
      console.error("[admin booking completed] Shared guest email was not sent", {
        bookingId: booking.id,
        reason: emailResult.reason,
        requestId: request.id,
      });
    }
  }
}

async function getAdminSupabaseClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login?next=/admin");
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Unauthorized booking status update.");
  }

  return supabase;
}

export async function updateBookingOperationalStatus(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const cancellationReason = getFormText(formData, "cancellationReason");
  const submittedCancellationType = getFormText(formData, "cancellationType");
  const statusAction = getFormText(formData, "statusAction");
  const updateFields = BOOKING_STATUS_UPDATES[statusAction];
  const cancellationType =
    submittedCancellationType ||
    (statusAction === "cancelled" ? "admin_decision" : "");

  if (!bookingId || !updateFields) {
    throw new Error("Invalid booking status update.");
  }

  if (statusAction === "cancelled" && !CANCELLATION_TYPES.has(cancellationType)) {
    throw new Error("Cancellation type is required.");
  }

  if (statusAction === "captain_not_available" && !cancellationReason) {
    throw new Error("Not available reason is required.");
  }

  const supabase = await getAdminSupabaseClient();
  const siteUrl = await getRequestOrigin();

  if (statusAction === "captain_available") {
    await markCaptainAvailable({
      bookingId,
      source: "admin",
      actor: { adminEmail: ADMIN_EMAIL },
      siteUrl,
    });
    revalidatePath("/admin");
    redirect(getAdminRedirectPath({ updated: statusAction }));
  }

  if (statusAction === "captain_not_available") {
    await markCaptainUnavailable({
      bookingId,
      source: "admin",
      actor: { adminEmail: ADMIN_EMAIL },
      cancellationReason,
      siteUrl,
    });
    revalidatePath("/admin");
    redirect(getAdminRedirectPath({ updated: statusAction }));
  }

  const updatePayload = {
    ...updateFields,
    updated_at: new Date().toISOString(),
  };

  let bookingForLifecycleUpdate = null;

  if (statusAction === "cancelled") {
    const { data: bookingForCancellation, error: bookingLoadError } = await supabase
      .from("bookings")
      .select(
        "id, locale, customer_name, email, phone, customer_manage_token, requested_date, tour_type, time_slot, time_window, booking_status, is_shared_open, payment_status, stripe_checkout_session_id, stripe_payment_intent_id",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingLoadError) {
      console.error("[admin booking cancel] Could not load payment", {
        bookingId,
        message: bookingLoadError.message,
      });
      throw new Error("Could not load booking payment before cancellation.");
    }

    bookingForLifecycleUpdate = bookingForCancellation;
  }

  if (statusAction === "cancelled") {
    if (bookingForLifecycleUpdate?.is_shared_open) {
      updatePayload.shared_status = "cancelled";
    }

    if (bookingForLifecycleUpdate?.payment_status === "captured") {
      const refundedPaymentIntentId =
        await refundCapturedPaymentForCancellation(bookingForLifecycleUpdate);

      if (refundedPaymentIntentId) {
        updatePayload.payment_status = "refunded";
        updatePayload.stripe_payment_intent_id = refundedPaymentIntentId;
      }
    }

    if (bookingForLifecycleUpdate?.is_shared_open) {
      await settleSharedJoinRequestsForBookingCancellation({
        booking: bookingForLifecycleUpdate,
        siteUrl: await getRequestOrigin(),
      });
    }

    updatePayload.cancelled_at = new Date().toISOString();
    updatePayload.cancelled_by = "admin";
    updatePayload.cancellation_reason = cancellationReason || null;
    updatePayload.cancellation_type = cancellationType;
  }

  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select(
      "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, customer_manage_token, cancellation_reason, is_shared_open, shared_status, shared_public_token",
    )
    .single();

  if (error) {
    console.error("[admin booking update]", error.message);
    throw new Error("Could not update booking status.");
  }

  if (statusAction === "cancelled") {
    try {
      await sendCaptainCancellationTelegramNotification({
        bookingId: updatedBooking.id,
        cancelledBy: "admin",
        previousBookingStatus: bookingForLifecycleUpdate?.booking_status,
        reason: cancellationReason,
      });
    } catch (telegramError) {
      console.warn(
        `[admin booking update] Telegram cancellation warning: ${telegramError?.message || "Unknown error."}`,
      );
    }
  }

  const emailEventType = getBookingEmailEventForStatus(
    updatedBooking.booking_status,
  );

  if (emailEventType) {
    const manageUrl = await getCustomerManageUrl(updatedBooking);
    const emailResult = await sendBookingEmail({
      booking: {
        ...updatedBooking,
        manage_url: manageUrl,
      },
      eventType: emailEventType,
      supabase,
    });

    if (!emailResult.sent) {
      console.error("[admin booking update] Email was not sent", {
        bookingId,
        eventType: emailEventType,
        reason: emailResult.reason,
      });
    }
  }

  if (statusAction === "completed") {
    await sendCompletedSharedGuestEmails({ booking: updatedBooking });
  }

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: statusAction }));
}

export async function captureAuthorizedBookingPaymentAction(formData) {
  const bookingId = getFormText(formData, "bookingId");

  if (!bookingId) {
    throw new Error("Invalid booking capture request.");
  }

  await getAdminSupabaseClient();
  await markCaptainAvailable({
    bookingId,
    source: "admin",
    actor: { adminEmail: ADMIN_EMAIL },
    siteUrl: await getRequestOrigin(),
  });

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: "captured" }));
}

export async function releaseAuthorizedBookingPaymentAction(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const cancellationReason = getFormText(formData, "cancellationReason");
  const cancellationType =
    getFormText(formData, "cancellationType") || "admin_decision";
  const outcome = getFormText(formData, "releaseOutcome") || "cancelled";

  if (!bookingId) {
    throw new Error("Invalid booking release request.");
  }

  if (outcome === "cancelled" && !CANCELLATION_TYPES.has(cancellationType)) {
    throw new Error("Cancellation type is required.");
  }

  if (outcome === "not_available" && !cancellationReason) {
    throw new Error("Not available reason is required.");
  }

  await getAdminSupabaseClient();
  if (outcome === "not_available") {
    await markCaptainUnavailable({
      bookingId,
      source: "admin",
      actor: { adminEmail: ADMIN_EMAIL },
      cancellationReason,
      siteUrl: await getRequestOrigin(),
    });
  } else {
    await releaseAuthorizedBookingPayment({
      bookingId,
      cancellationReason,
      cancellationType,
      outcome,
      siteUrl: await getRequestOrigin(),
    });
  }

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: outcome }));
}

export async function cancelAcceptedSharedJoinRequestAction(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const requestId = getFormText(formData, "requestId");

  if (!bookingId || !requestId) {
    throw new Error("Invalid shared join cancellation request.");
  }

  await getAdminSupabaseClient();
  await cancelAcceptedSharedJoinRequestFromAdmin({
    bookingId,
    requestId,
    siteUrl: await getRequestOrigin(),
  });

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: "shared-secondary-cancelled" }));
}

export async function cancelPrimaryAndPromoteSharedJoinRequestAction(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const cancellationReason = getFormText(formData, "cancellationReason");
  const requestId = getFormText(formData, "requestId");

  if (!bookingId || !requestId) {
    throw new Error("Invalid primary cancellation promotion request.");
  }

  await getAdminSupabaseClient();
  await cancelPrimaryAndPromoteSharedJoinRequestFromAdmin({
    bookingId,
    cancellationReason,
    requestId,
    siteUrl: await getRequestOrigin(),
  });

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: "shared-primary-promoted" }));
}

export async function rescheduleBookingAction(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const requestedDate = getFormText(formData, "requestedDate");
  const timeSlot = getFormText(formData, "timeSlot");

  if (!bookingId || !isValidDateString(requestedDate) || !timeSlot) {
    throw new Error("Invalid booking reschedule request.");
  }

  await getAdminSupabaseClient();
  const serviceSupabase = createSupabaseServiceRoleServerClient();
  const { data: booking, error: loadError } = await serviceSupabase
    .from("bookings")
    .select(
      "id, requested_date, tour_type, time_slot, time_window, booking_status, payment_status",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (loadError) {
    console.error("[admin booking reschedule] Could not load booking", {
      bookingId,
      message: loadError.message,
    });
    throw new Error("Could not load booking before rescheduling.");
  }

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (!ACTIVE_BOOKING_STATUSES.has(booking.booking_status)) {
    throw new Error("Only active bookings can be rescheduled.");
  }

  if (!isValidTimeSlotForTour(booking.tour_type, timeSlot)) {
    throw new Error("Selected time is not valid for this tour type.");
  }

  const { data: unavailableSlot, error: unavailableSlotError } =
    await serviceSupabase
      .from("admin_unavailable_slots")
      .select("date")
      .eq("date", requestedDate)
      .eq("time_slot", timeSlot)
      .maybeSingle();

  if (
    unavailableSlotError &&
    !isUnavailableSlotsTableMissing(unavailableSlotError)
  ) {
    console.error(
      "[admin booking reschedule] Could not check manual unavailable slot",
      unavailableSlotError.message,
    );
    throw new Error("Could not check manual unavailable slots.");
  }

  const { data: existingBookings, error: availabilityError } =
    await serviceSupabase
      .from("bookings")
      .select(
        "id, requested_date, tour_type, time_slot, time_window, booking_status, payment_status",
      )
      .in("booking_status", Array.from(ACTIVE_BOOKING_STATUSES))
      .eq("requested_date", requestedDate)
      .neq("id", bookingId);

  if (availabilityError) {
    console.error(
      "[admin booking reschedule] Could not check booking availability",
      availabilityError.message,
    );
    throw new Error("Could not check booking availability.");
  }

  const requestedSelection = {
    ...booking,
    requested_date: requestedDate,
    time_slot: timeSlot,
    time_window: getDisplayTimeForTimeSlot(timeSlot),
  };
  const hasOverlap = (existingBookings ?? []).some((existingBooking) =>
    bookingOverlapsSelection(existingBooking, requestedSelection),
  );

  if (hasOverlap) {
    throw new Error("Selected date and time overlaps another active booking.");
  }

  const { data: updatedBooking, error: updateError } = await serviceSupabase
    .from("bookings")
    .update({
      requested_date: requestedDate,
      time_slot: timeSlot,
      time_window: getDisplayTimeForTimeSlot(timeSlot),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .select(RESCHEDULE_BOOKING_EMAIL_SELECT)
    .single();

  if (updateError) {
    console.error("[admin booking reschedule] Could not update booking", {
      bookingId,
      message: updateError.message,
    });
    throw new Error("Could not reschedule booking.");
  }

  if (unavailableSlot) {
    const { error: clearUnavailableError } = await serviceSupabase
      .from("admin_unavailable_slots")
      .delete()
      .eq("date", requestedDate)
      .eq("time_slot", timeSlot);

    if (clearUnavailableError) {
      console.error(
        "[admin booking reschedule] Booking moved but unavailable slot was not cleared",
        {
          bookingId,
          message: clearUnavailableError.message,
          requestedDate,
          timeSlot,
        },
      );
    }
  }

  const manageUrl = await getCustomerManageUrl(updatedBooking);
  const emailResult = await sendBookingEmail({
    booking: {
      ...updatedBooking,
      manage_url: manageUrl,
    },
    checkDuplicate: false,
    eventType: "booking_rescheduled",
    supabase: serviceSupabase,
  });

  if (!emailResult.sent) {
    console.error("[admin booking reschedule] Primary email was not sent", {
      bookingId,
      reason: emailResult.reason,
    });
  }

  if (updatedBooking.is_shared_open) {
    const { data: acceptedRequests, error: sharedRequestError } =
      await serviceSupabase
        .from("shared_join_requests")
        .select(RESCHEDULE_SHARED_REQUEST_SELECT)
        .eq("booking_id", bookingId)
        .eq("status", "accepted")
        .eq("payment_status", "captured");

    if (sharedRequestError) {
      console.error(
        "[admin booking reschedule] Could not load accepted shared requests",
        {
          bookingId,
          message: sharedRequestError.message,
        },
      );
    } else {
      const siteUrl = await getRequestOrigin();

      await Promise.allSettled(
        (acceptedRequests ?? []).map((request) =>
          sendSharedJoinEmail({
            booking: updatedBooking,
            eventType: "booking_rescheduled_guest",
            managePath: getSharedGuestManagePath(request),
            request,
            siteUrl,
            to: request.email,
          }),
        ),
      );
    }
  }

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: "rescheduled" }));
}

export async function markCaptainMessageCopiedAction({ bookingId, messageType }) {
  if (!bookingId || !CAPTAIN_MESSAGE_TYPES.has(messageType)) {
    throw new Error("Invalid captain message copy request.");
  }

  await getAdminSupabaseClient();
  const serviceSupabase = createSupabaseServiceRoleServerClient();
  const copiedAt = new Date().toISOString();
  const { error } = await serviceSupabase
    .from("bookings")
    .update({
      captain_message_copied_at: copiedAt,
      captain_message_copied_type: messageType,
      updated_at: copiedAt,
    })
    .eq("id", bookingId);

  if (error) {
    console.error("[admin captain message copied]", error.message);
    throw new Error("Could not mark captain message as copied.");
  }

  revalidatePath("/admin");
  return { copiedAt };
}

export async function sendCaptainWhatsappBookingAction({ bookingId, messageType }) {
  if (!bookingId) {
    throw new Error("Invalid captain WhatsApp request.");
  }

  if (messageType && !CAPTAIN_MESSAGE_TYPES.has(messageType)) {
    throw new Error("Invalid captain message type.");
  }

  const supabase = await getAdminSupabaseClient();
  const { data: booking, error: loadError } = await supabase
    .from("bookings")
    .select("id, booking_status, captain_status")
    .eq("id", bookingId)
    .maybeSingle();

  if (loadError) {
    console.error("[admin captain whatsapp] Could not load booking", {
      bookingId,
      message: loadError.message,
    });
    throw new Error("Could not load booking.");
  }

  if (!booking) {
    throw new Error("Booking not found.");
  }

  const shouldMarkCaptainMessageSent =
    messageType === "time_confirmation" &&
    ["requested", "checking_with_captain"].includes(booking.booking_status) &&
    booking.captain_status === "pending";
  const sentAt = new Date().toISOString();
  const updatePayload = {
    ...(shouldMarkCaptainMessageSent ? { captain_status: "message_sent" } : {}),
    ...(messageType ? { captain_message_copied_type: messageType } : {}),
    captain_message_copied_at: sentAt,
    captain_message_sent_at: sentAt,
    updated_at: sentAt,
  };
  let { error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId);

  if (
    updateError &&
    (updateError.message?.includes("captain_message_sent_at") ||
      updateError.message?.includes("column") ||
      updateError.code === "PGRST204")
  ) {
    const updateWithoutTimestamp = await supabase
      .from("bookings")
      .update({
        ...(shouldMarkCaptainMessageSent ? { captain_status: "message_sent" } : {}),
        ...(messageType ? { captain_message_copied_type: messageType } : {}),
        captain_message_copied_at: sentAt,
        updated_at: sentAt,
      })
      .eq("id", bookingId);

    updateError = updateWithoutTimestamp.error;
  }

  if (updateError) {
    console.error("[admin captain whatsapp] Could not update booking status", {
      bookingId,
      message: updateError.message,
    });

    if (updateError.message?.includes("bookings_captain_status_check")) {
      throw new Error(
        "Database constraint does not allow captain_status = message_sent yet.",
      );
    }

    throw new Error("WhatsApp was sent, but booking status update failed.");
  }

  revalidatePath("/admin");
  return { sentAt };
}

export async function deleteClosedBooking(formData) {
  const bookingId = getFormText(formData, "bookingId");

  if (!bookingId) {
    throw new Error("Invalid booking delete request.");
  }

  await getAdminSupabaseClient();
  const serviceSupabase = createSupabaseServiceRoleServerClient();
  const { data: booking, error: loadError } = await serviceSupabase
    .from("bookings")
    .select("id, booking_status, payment_status")
    .eq("id", bookingId)
    .maybeSingle();

  if (loadError) {
    console.error("[admin booking delete] Could not load booking", loadError.message);
    throw new Error("Could not load booking.");
  }

  if (!booking) {
    throw new Error("Booking not found.");
  }

  const canDelete =
    CLOSED_BOOKING_STATUSES.has(booking.booking_status) ||
    DELETABLE_PAYMENT_STATUSES.has(booking.payment_status);

  if (!canDelete) {
    throw new Error("Only closed, cancelled, or incomplete checkout bookings can be deleted.");
  }

  const { data: deletedBooking, error } = await serviceSupabase
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[admin booking delete]", error.message);
    throw new Error("Could not delete booking.");
  }

  if (!deletedBooking) {
    throw new Error("Booking could not be deleted.");
  }

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ deleted: "1" }));
}

export async function refundCapturedBookingPayment(formData) {
  const bookingId = getFormText(formData, "bookingId");

  if (!bookingId) {
    throw new Error("Invalid booking refund request.");
  }

  const supabase = await getAdminSupabaseClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, payment_status, reservation_fee_eur, final_reservation_fee_eur, stripe_checkout_session_id, stripe_payment_intent_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[admin booking refund]", error.message);
    throw new Error("Could not load booking for refund.");
  }

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (booking.payment_status !== "captured") {
    throw new Error("Only captured payments can be refunded.");
  }

  const stripe = getStripe();
  let paymentIntentId = booking.stripe_payment_intent_id;

  if (!paymentIntentId && booking.stripe_checkout_session_id) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(
      booking.stripe_checkout_session_id,
    );
    paymentIntentId = getPaymentIntentId(checkoutSession.payment_intent);
  }

  if (!paymentIntentId) {
    throw new Error("This booking does not have a Stripe payment record.");
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      metadata: {
        booking_id: booking.id,
        booking_reference: `CAPRI-${booking.id.slice(0, 8).toUpperCase()}`,
        refund_source: "admin_manual_action",
      },
      reason: "requested_by_customer",
    },
    {
      idempotencyKey: `booking-${booking.id}-reservation-fee-refund`,
    },
  );

  if (!["pending", "requires_action", "succeeded"].includes(refund.status)) {
    throw new Error(`Stripe refund was not accepted: ${refund.status}`);
  }

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_status: "refunded",
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("payment_status", "captured")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("[admin booking refund] Could not save refund", updateError.message);
    throw new Error("Refund was created in Stripe, but the booking was not updated.");
  }

  if (!updatedBooking) {
    throw new Error("Refund was created in Stripe, but the booking status changed.");
  }

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ refunded: "1" }));
}
