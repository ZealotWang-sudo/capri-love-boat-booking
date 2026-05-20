"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePromoCode } from "@/lib/promoCodes";
import { getAdminUser, isAllowedAdmin } from "../auth";

function getFormText(formData, fieldName) {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

function getPromoCodesRedirectPath(params = {}) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();

  return query ? `/admin/promo-codes?${query}` : "/admin/promo-codes";
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
  const user = await getAdminUser("/admin/promo-codes");

  if (!isAllowedAdmin(user)) {
    throw new Error("Unauthorized promo code update.");
  }

  return createSupabaseServerClient();
}

export async function createPromoCode(formData) {
  const code = normalizePromoCode(getFormText(formData, "code"));
  const notes = getFormText(formData, "notes");
  const isActive = getFormText(formData, "is_active") === "true";
  let discountEur;

  try {
    discountEur = getFormInteger(formData, "discount_eur");
  } catch {
    redirect(getPromoCodesRedirectPath({ error: "Discount must be a whole euro amount." }));
  }

  if (!code) {
    redirect(getPromoCodesRedirectPath({ error: "Promo code is required." }));
  }

  if (discountEur === null || discountEur <= 0) {
    redirect(
      getPromoCodesRedirectPath({ error: "Discount must be greater than 0." }),
    );
  }

  const supabase = await getAdminSupabaseClient();
  const { error } = await supabase.from("promo_codes").insert({
    code,
    discount_eur: discountEur,
    is_active: isActive,
    notes: notes || null,
  });

  if (error) {
    if (error.code === "23505") {
      redirect(
        getPromoCodesRedirectPath({
          error: "A promo code with this code already exists.",
        }),
      );
    }

    console.error("[admin promo codes] Could not create promo code", error.message);
    redirect(getPromoCodesRedirectPath({ error: "Could not create promo code." }));
  }

  revalidatePath("/admin/promo-codes");
  redirect(getPromoCodesRedirectPath({ created: "1" }));
}

export async function updatePromoCodeStatus(formData) {
  const id = getFormText(formData, "id");
  const isActive = getFormText(formData, "is_active") === "true";

  if (!id) {
    redirect(getPromoCodesRedirectPath({ error: "Promo code id is required." }));
  }

  const supabase = await getAdminSupabaseClient();
  const { error } = await supabase
    .from("promo_codes")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("[admin promo codes] Could not update promo code", error.message);
    redirect(getPromoCodesRedirectPath({ error: "Could not update promo code." }));
  }

  revalidatePath("/admin/promo-codes");
  redirect(getPromoCodesRedirectPath({ updated: isActive ? "active" : "inactive" }));
}
