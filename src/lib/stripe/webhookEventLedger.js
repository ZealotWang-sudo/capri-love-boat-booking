export const CLAIM_RESULTS = {
  claimed: "claimed",
  inProgress: "in_progress",
  processed: "processed",
};

/**
 * Claims a Stripe event so duplicate deliveries are not processed twice.
 *
 * The ledger is a fast path, not the only safeguard: every handler is
 * independently idempotent, so a ledger outage degrades to "maybe processed
 * twice, still correct" rather than blocking delivery.
 */
export async function claimWebhookEvent({ event, supabase }) {
  const { data, error } = await supabase.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
  });

  if (error) {
    console.error("[stripe webhook] Could not claim event", {
      eventId: event.id,
      message: error.message,
    });
    return CLAIM_RESULTS.claimed;
  }

  return data ?? CLAIM_RESULTS.claimed;
}

export async function completeWebhookEvent({
  error: lastError = null,
  eventId,
  outcome,
  status,
  supabase,
}) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      last_error: lastError,
      outcome: outcome ?? null,
      processed_at: new Date().toISOString(),
      status,
    })
    .eq("event_id", eventId);

  if (error) {
    console.error("[stripe webhook] Could not record event outcome", {
      eventId,
      message: error.message,
    });
  }
}
