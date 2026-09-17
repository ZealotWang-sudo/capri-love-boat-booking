import { NextResponse } from "next/server";
import { completeElapsedBookings } from "@/lib/bookings/completeElapsedBookings";
import { runPaymentReconciliation } from "@/lib/stripe/runPaymentReconciliation";

export const runtime = "nodejs";
export const maxDuration = 60;

function getCronAuthError(request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      message: "Missing CRON_SECRET environment variable.",
      status: 500,
    };
  }

  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader !== `Bearer ${cronSecret}`) {
    return {
      message: "Unauthorized",
      status: 401,
    };
  }

  return null;
}

export async function GET(request) {
  const authError = getCronAuthError(request);

  if (authError) {
    return NextResponse.json(
      {
        ok: false,
        error: authError.message,
      },
      { status: authError.status },
    );
  }

  // Reconciliation runs first: an unrecovered authorization is more urgent than
  // closing yesterday's trips, and it must happen even if completion fails.
  let reconciliation = null;
  let reconciliationError = null;

  try {
    reconciliation = await runPaymentReconciliation();
  } catch (error) {
    reconciliationError = error?.message ?? "Reconciliation failed.";
    console.error("[cron] Payment reconciliation failed", {
      message: reconciliationError,
    });
  }

  try {
    const summary = await completeElapsedBookings();

    return NextResponse.json({
      ok: true,
      reconciliation,
      reconciliationError,
      ...summary,
    });
  } catch (error) {
    console.error("[cron] Could not complete elapsed bookings", {
      message: error?.message,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Could not complete elapsed bookings.",
        reconciliation,
        reconciliationError,
      },
      { status: 500 },
    );
  }
}
