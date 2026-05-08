import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ADMIN_EMAIL = "wangkexin-personal@outlook.com";

export async function getAdminUser(nextPath = "/admin") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}

export function isAllowedAdmin(user) {
  return user.email?.toLowerCase() === ADMIN_EMAIL;
}
