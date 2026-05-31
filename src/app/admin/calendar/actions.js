"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BOOKING_TIME_SLOT_ORDER } from "@/lib/bookingAvailability";
import { getAdminUser, isAllowedAdmin } from "../auth";

const VALID_TIME_SLOTS = new Set(BOOKING_TIME_SLOT_ORDER);

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getFormTexts(formData, fieldName) {
  return formData
    .getAll(fieldName)
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function assertValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid date.");
  }
}

function assertValidTimeSlot(value) {
  if (!VALID_TIME_SLOTS.has(value)) {
    throw new Error("Invalid time slot.");
  }
}

function getValidTimeSlots(formData) {
  const timeSlots = getFormTexts(formData, "timeSlot");

  if (timeSlots.length === 0) {
    throw new Error("Invalid time slot.");
  }

  timeSlots.forEach(assertValidTimeSlot);
  return timeSlots;
}

function getRedirectPath(formData) {
  const month = getFormText(formData, "month");

  if (/^\d{4}-\d{2}$/.test(month)) {
    return `/admin/calendar?month=${month}`;
  }

  return "/admin/calendar";
}

function appendCalendarNotice(path, params = {}) {
  const [pathname, query = ""] = path.split("?");
  const searchParams = new URLSearchParams(query);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const nextQuery = searchParams.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function enumerateDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (start <= end) {
    dates.push(start.toISOString().slice(0, 10));
    start.setUTCDate(start.getUTCDate() + 1);
  }

  return dates;
}

async function getAdminSupabaseClient() {
  const user = await getAdminUser("/admin/calendar");

  if (!isAllowedAdmin(user)) {
    throw new Error("Unauthorized calendar update.");
  }

  return { supabase: await createSupabaseServerClient(), user };
}

export async function markTimeSlotUnavailable(formData) {
  const date = getFormText(formData, "date");
  const reason = getFormText(formData, "reason");
  const redirectPath = getRedirectPath(formData);
  let timeSlots;

  try {
    timeSlots = getValidTimeSlots(formData);
    assertValidDate(date);
  } catch {
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not mark time slot unavailable.",
      }),
    );
  }

  const { supabase, user } = await getAdminSupabaseClient();
  const { error } = await supabase.from("admin_unavailable_slots").upsert(
    timeSlots.map((timeSlot) => ({
      created_by: user.email,
      date,
      reason: reason || null,
      time_slot: timeSlot,
    })),
    { onConflict: "date,time_slot" },
  );

  if (error) {
    console.error("[admin calendar] Could not mark slot unavailable", error.message);
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not mark time slot unavailable.",
      }),
    );
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
  redirect(appendCalendarNotice(redirectPath, { updated: "unavailable" }));
}

export async function markTimeSlotAvailable(formData) {
  const date = getFormText(formData, "date");
  const redirectPath = getRedirectPath(formData);
  let timeSlots;

  try {
    timeSlots = getValidTimeSlots(formData);
    assertValidDate(date);
  } catch {
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not make time slot available.",
      }),
    );
  }

  const { supabase } = await getAdminSupabaseClient();
  const { error } = await supabase
    .from("admin_unavailable_slots")
    .delete()
    .eq("date", date)
    .in("time_slot", timeSlots);

  if (error) {
    console.error("[admin calendar] Could not make slot available", error.message);
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not make time slot available.",
      }),
    );
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
  redirect(appendCalendarNotice(redirectPath, { updated: "available" }));
}

export async function markDateRangeUnavailable(formData) {
  const startDate = getFormText(formData, "startDate");
  const endDate = getFormText(formData, "endDate");
  const reason = getFormText(formData, "reason");
  const redirectPath = getRedirectPath(formData);

  try {
    assertValidDate(startDate);
    assertValidDate(endDate);
  } catch {
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not mark selected date range unavailable.",
      }),
    );
  }

  if (endDate < startDate) {
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "End date must be on or after start date.",
      }),
    );
  }

  const dates = enumerateDateRange(startDate, endDate);

  if (dates.length === 0) {
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not mark selected date range unavailable.",
      }),
    );
  }

  if (dates.length > 120) {
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Date range is too large. Please use 120 days or fewer.",
      }),
    );
  }

  const { supabase, user } = await getAdminSupabaseClient();
  const rows = dates.flatMap((date) =>
    BOOKING_TIME_SLOT_ORDER.map((timeSlot) => ({
      created_by: user.email,
      date,
      reason: reason || "Date range unavailable",
      time_slot: timeSlot,
    })),
  );

  const { error } = await supabase
    .from("admin_unavailable_slots")
    .upsert(rows, { onConflict: "date,time_slot" });

  if (error) {
    console.error("[admin calendar] Could not mark date range unavailable", {
      endDate,
      message: error.message,
      startDate,
    });
    redirect(
      appendCalendarNotice(redirectPath, {
        error: "Could not mark selected date range unavailable.",
      }),
    );
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
  redirect(
    appendCalendarNotice(redirectPath, {
      range: String(dates.length),
      updated: "unavailable_range",
    }),
  );
}
