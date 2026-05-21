"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleServerClient,
} from "@/lib/supabase/server";
import {
  getBookingEmailEventForStatus,
  sendBookingEmail,
} from "@/lib/email/sendBookingEmail";
import {
  captureAuthorizedBookingPayment,
  releaseAuthorizedBookingPayment,
} from "@/lib/stripe/adminBookingPayments";
import { getStripe } from "@/lib/stripe/server";

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
  const updatePayload = {
    ...updateFields,
    updated_at: new Date().toISOString(),
  };

  if (statusAction === "cancelled") {
    const { data: bookingForCancellation, error: bookingLoadError } = await supabase
      .from("bookings")
      .select(
        "id, payment_status, stripe_checkout_session_id, stripe_payment_intent_id",
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

    if (bookingForCancellation?.payment_status === "captured") {
      const refundedPaymentIntentId =
        await refundCapturedPaymentForCancellation(bookingForCancellation);

      if (refundedPaymentIntentId) {
        updatePayload.payment_status = "refunded";
        updatePayload.stripe_payment_intent_id = refundedPaymentIntentId;
      }
    }

    updatePayload.cancelled_at = new Date().toISOString();
    updatePayload.cancelled_by = "admin";
    updatePayload.cancellation_reason = cancellationReason || null;
    updatePayload.cancellation_type = cancellationType;
  }

  if (statusAction === "captain_not_available") {
    updatePayload.cancellation_reason = cancellationReason;
    updatePayload.cancellation_type = "captain_unavailable";
    updatePayload.cancelled_by = "captain";
  }

  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select(
      "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, booking_status, customer_manage_token, cancellation_reason",
    )
    .single();

  if (error) {
    console.error("[admin booking update]", error.message);
    throw new Error("Could not update booking status.");
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

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: statusAction }));
}

export async function captureAuthorizedBookingPaymentAction(formData) {
  const bookingId = getFormText(formData, "bookingId");

  if (!bookingId) {
    throw new Error("Invalid booking capture request.");
  }

  await getAdminSupabaseClient();
  await captureAuthorizedBookingPayment({ bookingId });

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
  await releaseAuthorizedBookingPayment({
    bookingId,
    cancellationReason,
    cancellationType,
    outcome,
  });

  revalidatePath("/admin");
  redirect(getAdminRedirectPath({ updated: outcome }));
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
