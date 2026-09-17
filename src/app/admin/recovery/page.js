import Link from "next/link";
import AdminHeader from "@/app/admin/AdminHeader";
import UnauthorizedAdmin from "@/app/admin/UnauthorizedAdmin";
import { getAdminUser, isAllowedAdmin } from "@/app/admin/auth";
import { ATTEMPT_SELECT } from "@/lib/bookings/checkoutAttempts";
import { RECONCILIATION_TASK_NAME } from "@/lib/stripe/runPaymentReconciliation";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";
import { runReconciliationAction } from "./actions";

export const dynamic = "force-dynamic";

const UNSETTLED_ATTEMPT_STATUSES = ["pending", "failed", "conflict"];

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const time = Date.parse(value);

  return Number.isNaN(time)
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Rome",
      }).format(time);
}

function formatReference(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "—";
}

function Panel({ children, description, title }) {
  return (
    <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5">
      <h2 className="text-lg font-normal">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyRow({ children }) {
  return <p className="text-sm text-stone-600">{children}</p>;
}

export default async function AdminRecoveryPage() {
  const user = await getAdminUser("/admin/recovery");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const [attemptsResult, eventsResult, taskResult] = await Promise.all([
    supabase
      .from("booking_checkout_attempts")
      .select(ATTEMPT_SELECT)
      .in("status", UNSETTLED_ATTEMPT_STATUSES)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("stripe_webhook_events")
      .select("event_id, event_type, status, outcome, attempts, received_at, last_error")
      .order("received_at", { ascending: false })
      .limit(20),
    supabase
      .from("app_task_runs")
      .select("task_name, last_run_at, last_finished_at, last_result")
      .eq("task_name", RECONCILIATION_TASK_NAME)
      .maybeSingle(),
  ]);

  const attempts = attemptsResult.data ?? [];
  const events = eventsResult.data ?? [];
  const lastRun = taskResult.data ?? null;
  const lastSummary = lastRun?.last_result ?? null;
  const orphans = lastSummary?.orphanedAuthorizations ?? [];

  return (
    <main className="min-h-screen bg-[#f3eee7] px-3 py-8 text-stone-950 sm:px-8 sm:py-10">
      <section className="mx-auto max-w-5xl">
        <AdminHeader
          active="recovery"
          title="Payment recovery"
          userEmail={user.email}
        />

        <p className="mt-6 text-sm leading-6 text-stone-600">
          Every Stripe authorization is reconciled automatically. Use this page
          to see anything still unsettled and to force a reconciliation pass.
        </p>

        <form action={runReconciliationAction} className="mt-6">
          <button
            type="submit"
            className="border border-stone-950 bg-stone-950 px-5 py-3 text-xs uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-stone-800"
          >
            Run reconciliation now
          </button>
        </form>

        <Panel
          description={`Last run ${formatDateTime(lastRun?.last_run_at)}.`}
          title="Last reconciliation result"
        >
          {lastSummary ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-stone-500">Bookings recovered</dt>
                <dd className="text-lg">{lastSummary.bookingsRecovered ?? 0}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Payment intents scanned</dt>
                <dd className="text-lg">
                  {lastSummary.paymentIntentsScanned ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Attempts expired</dt>
                <dd className="text-lg">{lastSummary.attemptsExpired ?? 0}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Captain retries</dt>
                <dd className="text-lg">
                  {lastSummary.captainNotificationsRetried ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Email retries</dt>
                <dd className="text-lg">{lastSummary.emailsRetried ?? 0}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Releases synced</dt>
                <dd className="text-lg">
                  {lastSummary.releasedAuthorizationsSynced ?? 0}
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyRow>No reconciliation has been recorded yet.</EmptyRow>
          )}
        </Panel>

        <Panel
          description="Authorized money in Stripe that could not be turned into a booking automatically. These need manual action."
          title="Orphaned authorizations"
        >
          {orphans.length === 0 ? (
            <EmptyRow>None.</EmptyRow>
          ) : (
            <ul className="space-y-3">
              {orphans.map((orphan) => (
                <li
                  key={orphan.paymentIntentId}
                  className="border border-red-900/30 bg-red-50 p-4 text-sm text-red-900"
                >
                  <p className="font-medium">
                    {formatReference(orphan.bookingId)} · {orphan.paymentIntentId}
                  </p>
                  <p className="mt-1">{orphan.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          description="Checkouts that started but have not settled into a booking."
          title="Unsettled checkout attempts"
        >
          {attempts.length === 0 ? (
            <EmptyRow>None.</EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  <tr>
                    <th className="py-2 pr-4">Reference</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Tour</th>
                    <th className="py-2 pr-4">Started</th>
                    <th className="py-2 pr-4">Expires</th>
                    <th className="py-2">Stripe session</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="border-t border-stone-200">
                      <td className="py-2 pr-4">{formatReference(attempt.id)}</td>
                      <td className="py-2 pr-4">{attempt.status}</td>
                      <td className="py-2 pr-4">
                        {attempt.tour_type} · {attempt.requested_date}{" "}
                        {attempt.time_slot}
                      </td>
                      <td className="py-2 pr-4">
                        {formatDateTime(attempt.created_at)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatDateTime(attempt.expires_at)}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {attempt.stripe_checkout_session_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          description="Most recent Stripe deliveries and how they were processed."
          title="Stripe webhook events"
        >
          {events.length === 0 ? (
            <EmptyRow>
              No Stripe events have been received. If this stays empty the
              webhook destination is disabled or misconfigured.
            </EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  <tr>
                    <th className="py-2 pr-4">Received</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Outcome</th>
                    <th className="py-2">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.event_id} className="border-t border-stone-200">
                      <td className="py-2 pr-4">
                        {formatDateTime(event.received_at)}
                      </td>
                      <td className="py-2 pr-4">{event.event_type}</td>
                      <td className="py-2 pr-4">{event.status}</td>
                      <td className="py-2 pr-4">
                        {event.outcome ?? event.last_error ?? "—"}
                      </td>
                      <td className="py-2">{event.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="mt-8 text-sm">
          <Link className="underline" href="/admin">
            Back to bookings
          </Link>
        </p>
      </section>
    </main>
  );
}
