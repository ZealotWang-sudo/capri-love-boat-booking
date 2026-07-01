import { NextResponse } from "next/server";
import { completeElapsedBookings } from "@/lib/bookings/completeElapsedBookings";

export const runtime = "nodejs";

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

  try {
    const summary = await completeElapsedBookings();

    return NextResponse.json({
      ok: true,
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
      },
      { status: 500 },
    );
  }
}
