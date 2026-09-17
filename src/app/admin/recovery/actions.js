"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser, isAllowedAdmin } from "@/app/admin/auth";
import {
  RECONCILIATION_TASK_NAME,
  runPaymentReconciliation,
} from "@/lib/stripe/runPaymentReconciliation";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { recordTaskResult } from "@/lib/tasks/taskThrottle";

export async function runReconciliationAction() {
  const user = await getAdminUser("/admin/recovery");

  if (!isAllowedAdmin(user)) {
    throw new Error("Not authorized.");
  }

  const summary = await runPaymentReconciliation();

  await recordTaskResult({
    result: summary,
    supabase: createSupabaseServiceRoleServerClient(),
    taskName: RECONCILIATION_TASK_NAME,
  });

  revalidatePath("/admin/recovery");
}
