"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser, isAllowedAdmin } from "../auth";

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getPricingRedirectPath(params = {}) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  return query ? `/admin/pricing?${query}` : "/admin/pricing";
}

function getFormInteger(formData, fieldName) {
  const value = getFormText(formData, fieldName);

  if (value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return number;
}

async function getAdminSupabaseClient() {
  const user = await getAdminUser("/admin/pricing");

  if (!isAllowedAdmin(user)) {
    throw new Error("Unauthorized pricing update.");
  }

  return createSupabaseServerClient();
}

export async function updateTourPrice(formData) {
  const id = getFormText(formData, "id");
  const notes = getFormText(formData, "notes");
  const isActive = getFormText(formData, "is_active") === "true";
  let reservationFeeEur;
  let captainPriceEur;

  try {
    reservationFeeEur = getFormInteger(formData, "reservation_fee_eur");
    captainPriceEur = getFormInteger(formData, "captain_price_eur");
  } catch {
    redirect(getPricingRedirectPath({ error: "Price values must be whole euros." }));
  }

  if (!id) {
    redirect(getPricingRedirectPath({ error: "Missing tour price id." }));
  }

  if (reservationFeeEur === null || captainPriceEur === null) {
    redirect(
      getPricingRedirectPath({
        error: "Reservation fee and captain price are required.",
      }),
    );
  }

  if (reservationFeeEur <= 0) {
    redirect(
      getPricingRedirectPath({ error: "Reservation fee must be greater than 0." }),
    );
  }

  if (captainPriceEur < 0) {
    redirect(
      getPricingRedirectPath({ error: "Captain price must be 0 or greater." }),
    );
  }

  const payOnBoardEur = captainPriceEur;
  const totalPriceEur = reservationFeeEur + captainPriceEur;

  const supabase = await getAdminSupabaseClient();
  const { error } = await supabase
    .from("tour_prices")
    .update({
      captain_price_eur: captainPriceEur,
      is_active: isActive,
      notes: notes || null,
      pay_on_board_eur: payOnBoardEur,
      reservation_fee_eur: reservationFeeEur,
      total_price_eur: totalPriceEur,
    })
    .eq("id", id);

  if (error) {
    console.error("[admin pricing] Could not update tour price", error.message);
    redirect(getPricingRedirectPath({ error: "Could not update tour price." }));
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin");
  revalidatePath("/en/book");
  revalidatePath("/zh/book");
  revalidatePath("/it/book");
  revalidatePath("/de/book");
  revalidatePath("/fr/book");
  redirect(getPricingRedirectPath({ updated: "1" }));
}
