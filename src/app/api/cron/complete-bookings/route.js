import { NextResponse } from "next/server";
import { completeElapsedBookings } from "@/lib/bookings/completeElapsedBookings";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await completeElapsedBookings();

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron complete bookings] Failed", {
      message: error?.message || "Unknown error.",
    });

    return NextResponse.json(
      { ok: false, error: "Could not complete elapsed bookings." },
      { status: 500 },
    );
  }
}
