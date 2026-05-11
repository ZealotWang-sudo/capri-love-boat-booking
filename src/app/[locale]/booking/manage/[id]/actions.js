"use server";

import { redirect } from "next/navigation";
import { sendBookingEmail } from "@/lib/email/sendBookingEmail";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";

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

export async function cancelCustomerBooking(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const customerCancelReason = getFormText(formData, "customerCancelReason");
  const locale = getLocale(getFormText(formData, "locale"));
  const token = getFormText(formData, "token");

  if (!bookingId || !token) {
    redirect(`/${locale}/booking/manage/${bookingId || "invalid"}?cancelError=1`);
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
