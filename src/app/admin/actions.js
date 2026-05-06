"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getBookingEmailEventForStatus,
  sendBookingEmail,
} from "@/lib/email/sendBookingEmail";

const ADMIN_EMAIL = "wangkexin-personal@outlook.com";
const CLOSED_BOOKING_STATUSES = new Set([
  "completed",
  "cancelled",
  "not_available",
  "expired",
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

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
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

async function getAdminSupabaseClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Unauthorized booking status update.");
  }

  return supabase;
}

export async function updateBookingOperationalStatus(formData) {
  const bookingId = getFormText(formData, "bookingId");
  const cancellationReason = getFormText(formData, "cancellationReason");
  const statusAction = getFormText(formData, "statusAction");
  const updateFields = BOOKING_STATUS_UPDATES[statusAction];

  if (!bookingId || !updateFields) {
    throw new Error("Invalid booking status update.");
  }

  if (statusAction === "cancelled" && !cancellationReason) {
    throw new Error("Cancellation reason is required.");
  }

  const supabase = await getAdminSupabaseClient();
  const updatePayload = {
    ...updateFields,
    updated_at: new Date().toISOString(),
  };

  if (statusAction === "cancelled") {
    updatePayload.customer_cancel_reason = cancellationReason;
  }

  const { data: updatedBooking, error } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    .select(
      "id, locale, customer_name, email, requested_date, tour_type, time_slot, time_window, guest_count, total_price_eur, reservation_fee_eur, pay_on_board_eur, booking_status, customer_manage_token",
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
        cancellation_reason: cancellationReason,
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
}

export async function deleteClosedBooking(formData) {
  const bookingId = getFormText(formData, "bookingId");

  if (!bookingId) {
    throw new Error("Invalid booking delete request.");
  }

  const supabase = await getAdminSupabaseClient();
  const { data: deletedBooking, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .in("booking_status", Array.from(CLOSED_BOOKING_STATUSES))
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[admin booking delete]", error.message);
    throw new Error("Could not delete booking.");
  }

  if (!deletedBooking) {
    throw new Error("Only closed or cancelled bookings can be deleted.");
  }

  revalidatePath("/admin");
}
