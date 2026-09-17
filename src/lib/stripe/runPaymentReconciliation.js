import { reconcileBookingPayments } from "@/lib/bookings/reconcilePayments";
import { buildAuthorizationDeps } from "@/lib/stripe/confirmBookingPayment";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { claimTaskRun } from "@/lib/tasks/taskThrottle";

export const RECONCILIATION_TASK_NAME = "stripe_payment_reconciliation";
const BACKGROUND_INTERVAL_SECONDS = 300;

export async function runPaymentReconciliation({ lookbackDays } = {}) {
  const supabase = createSupabaseServiceRoleServerClient();

  return reconcileBookingPayments({
    deps: {
      ...buildAuthorizationDeps({ supabase }),
      siteUrl: getSiteUrl(),
    },
    lookbackDays,
    stripe: getStripe(),
  });
}

/**
 * Opportunistic reconciliation from request handlers.
 *
 * The project runs on a cron allowance of two daily jobs, so hot server paths
 * also nudge reconciliation. `claimTaskRun` keeps that to one run per interval
 * across all serverless instances.
 */
export async function runThrottledPaymentReconciliation({
  minIntervalSeconds = BACKGROUND_INTERVAL_SECONDS,
} = {}) {
  try {
    const supabase = createSupabaseServiceRoleServerClient();
    const claimed = await claimTaskRun({
      minIntervalSeconds,
      supabase,
      taskName: RECONCILIATION_TASK_NAME,
    });

    if (!claimed) {
      return { ran: false };
    }

    const summary = await runPaymentReconciliation();

    return { ran: true, summary };
  } catch (error) {
    console.error("[reconcile payments] Background run failed", {
      message: error?.message,
    });

    return { ran: false };
  }
}
