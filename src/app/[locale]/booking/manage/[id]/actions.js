"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import {
  createSupabasePublicServerClient,
  createSupabaseServiceRoleServerClient,
} from "@/lib/supabase/server";
import { releaseAuthorizedBookingPayment } from "@/lib/stripe/adminBookingPayments";
import {
  acceptSharedJoinRequestForHost,
  rejectSharedJoinRequestForHost,
  settleSharedJoinRequestsForBookingCancellation,
} from "@/lib/stripe/sharedJoinRequests";
import { sendCaptainCancellationTelegramNotification } from "@/lib/telegram/sendCaptainCancellationTelegramNotification";

const ALLOWED_LOCALES = new Set(["en", "zh", "it", "de", "fr"]);

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

function getLocale(value) {
  return ALLOWED_LOCALES.has(value) ? value : "en";
}

function getManagePath({ bookingId, locale, token }, params = {}) {
  const searchParams = new URLSearchParams({
    token,
    ...params,
  });

  return `/${locale}/booking/manage/${bookingId}?${searchParams.toString()}`;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0];

  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL || "";
  }

  const protocol =
    forwardedProto || (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function cancelCustomerBooking(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const customerCancelReason = getFormText(formData, "customerCancelReason");
  const locale = getLocale(getFormText(formData, "locale"));
  const token = getFormText(formData, "token");

  if (!bookingId || !token) {
    redirect(`/${locale}/booking/manage/${bookingId || "invalid"}?cancelError=1`);
  }

  const serviceSupabase = createSupabaseServiceRoleServerClient();
  const { data: booking, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select(
      "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, promo_code, promo_discount_eur, original_reservation_fee_eur, final_reservation_fee_eur, customer_manage_token, booking_status, is_shared_open, shared_status, shared_public_token, payment_status",
    )
    .eq("id", bookingId)
    .eq("customer_manage_token", token)
    .maybeSingle();

  if (bookingError) {
    console.error("[customer booking cancel] Could not load booking", {
      bookingId,
      message: bookingError.message,
    });
    redirect(getManagePath({ bookingId, locale, token }, { cancelError: "1" }));
  }

  if (
    booking?.booking_status === "checking_with_captain" &&
    booking.payment_status === "authorized"
  ) {
    try {
      await releaseAuthorizedBookingPayment({
        bookingId,
        cancelledBy: "customer",
        cancellationReason: customerCancelReason,
        cancellationType: "customer_requested",
        manageToken: token,
        outcome: "cancelled",
        siteUrl: await getRequestOrigin(),
      });
    } catch (error) {
      console.error("[customer booking cancel] Could not release authorization", {
        bookingId,
        message: error.message,
      });
      redirect(getManagePath({ bookingId, locale, token }, { cancelError: "1" }));
    }

    redirect(getManagePath({ bookingId, locale, token }, { cancelled: "1" }));
  }

  const supabase = createSupabasePublicServerClient();
  const { data: cancelledBooking, error } = await supabase
    .rpc("customer_cancel_booking", {
      p_booking_id: bookingId,
      p_cancel_reason: customerCancelReason || null,
      p_manage_token: token,
    })
    .maybeSingle();

  if (error) {
    console.error("[customer booking cancel]", error.message);
    redirect(getManagePath({ bookingId, locale, token }, { cancelError: "1" }));
  }

  if (!cancelledBooking) {
    redirect(getManagePath({ bookingId, locale, token }, { cancelError: "1" }));
  }

  try {
    await sendCaptainCancellationTelegramNotification({
      bookingId,
      cancelledBy: "customer",
      previousBookingStatus: booking?.booking_status,
      reason: customerCancelReason,
    });
  } catch (telegramError) {
    console.warn(
      `[customer booking cancel] Telegram cancellation warning: ${telegramError?.message || "Unknown error."}`,
    );
  }

  if (booking?.is_shared_open) {
    const { error: sharedCancelError } = await serviceSupabase
      .from("bookings")
      .update({ shared_status: "cancelled" })
      .eq("id", bookingId)
      .eq("customer_manage_token", token)
      .eq("booking_status", "cancelled");

    if (sharedCancelError) {
      console.error("[customer booking cancel] Could not cancel shared status", {
        bookingId,
        message: sharedCancelError.message,
      });
    }

    try {
      await settleSharedJoinRequestsForBookingCancellation({
        booking: {
          ...booking,
          ...cancelledBooking,
          booking_status: "cancelled",
          shared_status: "cancelled",
        },
        siteUrl: await getRequestOrigin(),
      });
    } catch (error) {
      console.error("[customer booking cancel] Could not settle shared requests", {
        bookingId,
        message: error.message,
      });
    }
  }

  const emailResult = await sendBookingEmail({
    booking: {
      ...cancelledBooking,
      customer_cancel_reason:
        cancelledBooking.customer_cancel_reason || customerCancelReason,
    },
    eventType: "cancelled",
    supabase,
  });

  if (!emailResult.sent) {
    console.error("[customer booking cancel] Email was not sent", {
      bookingId,
      reason: emailResult.reason,
    });
  }

  redirect(getManagePath({ bookingId, locale, token }, { cancelled: "1" }));
}

export async function respondToSharedJoinRequest(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const locale = getLocale(getFormText(formData, "locale"));
  const requestId = getFormText(formData, "requestId");
  const response = getFormText(formData, "response");
  const token = getFormText(formData, "token");

  if (!bookingId || !requestId || !token) {
    redirect(getManagePath({ bookingId, locale, token }, { sharedError: "1" }));
  }

  let redirectParams = { sharedError: "1" };

  try {
    if (response === "accept") {
      await acceptSharedJoinRequestForHost({
        bookingId,
        manageToken: token,
        requestId,
        siteUrl: await getRequestOrigin(),
      });
      redirectParams = { sharedAccepted: "1" };
    } else if (response === "reject") {
      await rejectSharedJoinRequestForHost({
        bookingId,
        manageToken: token,
        requestId,
        siteUrl: await getRequestOrigin(),
      });
      redirectParams = { sharedRejected: "1" };
    }
  } catch (error) {
    console.error("[customer shared join response]", {
      bookingId,
      message: error.message,
      requestId,
      response,
    });
  }

  revalidatePath(`/${locale}/booking/manage/${bookingId}`);
  redirect(getManagePath({ bookingId, locale, token }, redirectParams));
}
