"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminUser, isAllowedAdmin } from "../auth";

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
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
  const totalPriceEur = getFormInteger(formData, "total_price_eur");
  const reservationFeeEur = getFormInteger(formData, "reservation_fee_eur");
  const payOnBoardEur = getFormInteger(formData, "pay_on_board_eur");
  const captainPriceEur = getFormInteger(formData, "captain_price_eur");
  const notes = getFormText(formData, "notes");
  const isActive = getFormText(formData, "is_active") === "true";

  if (!id) {
    throw new Error("Missing tour price id.");
  }

  if (
    totalPriceEur === null ||
    reservationFeeEur === null ||
    payOnBoardEur === null
  ) {
    throw new Error("Total, reservation fee, and pay on board are required.");
  }

  if (reservationFeeEur <= 0) {
    throw new Error("Reservation fee must be greater than 0.");
  }

  if (payOnBoardEur < 0) {
    throw new Error("Pay on board must be 0 or greater.");
  }

  if (captainPriceEur !== null && captainPriceEur < 0) {
    throw new Error("Captain price must be 0 or greater.");
  }

  if (totalPriceEur !== reservationFeeEur + payOnBoardEur) {
    throw new Error("Total price must equal reservation fee plus pay on board.");
  }

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
    throw new Error("Could not update tour price.");
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin");
  revalidatePath("/en/book");
  revalidatePath("/zh/book");
  revalidatePath("/it/book");
  redirect("/admin/pricing");
}
