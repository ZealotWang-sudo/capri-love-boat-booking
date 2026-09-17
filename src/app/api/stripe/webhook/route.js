import { NextResponse } from "next/server";
import {
  expireCheckoutSession,
  handleCheckoutSessionCompleted,
  syncCancelledPaymentIntent,
  syncRefundedCharge,
} from "@/lib/stripe/confirmBookingPayment";
import {
  expireSharedJoinCheckoutSession,
  handleSharedJoinCheckoutSessionCompleted,
} from "@/lib/stripe/sharedJoinRequests";
import {
  CLAIM_RESULTS,
  claimWebhookEvent,
  completeWebhookEvent,
} from "@/lib/stripe/webhookEventLedger";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseServiceRoleServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const HANDLED_EVENT_TYPES = new Set([
  "charge.refunded",
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.canceled",
]);

async function handleCheckoutCompleted(session) {
  if (session.metadata?.type === "shared_join_request") {
    await handleSharedJoinCheckoutSessionCompleted({ session });
    return { outcome: "shared_join_request", terminal: true };
  }

  const result = await handleCheckoutSessionCompleted({ session });

  return { outcome: result.outcome ?? "handled", terminal: result.terminal };
}

async function handleCheckoutExpired(session) {
  if (session.metadata?.type === "shared_join_request") {
    await expireSharedJoinCheckoutSession({ session });
    return { outcome: "shared_join_expired", terminal: true };
  }

  const result = await expireCheckoutSession({ session });

  return { outcome: result.expired ? "expired" : "nothing_to_expire", terminal: true };
}

async function processEvent(event) {
  if (event.type === "checkout.session.completed") {
    return handleCheckoutCompleted(event.data.object);
  }

  if (event.type === "checkout.session.expired") {
    return handleCheckoutExpired(event.data.object);
  }

  if (event.type === "payment_intent.canceled") {
    const result = await syncCancelledPaymentIntent({
      paymentIntent: event.data.object,
    });

    return {
      outcome: result.synced ? "authorization_released" : "no_matching_booking",
      terminal: true,
    };
  }

  if (event.type === "charge.refunded") {
    const result = await syncRefundedCharge({ charge: event.data.object });

    return {
      outcome: result.synced ? "refund_recorded" : "no_matching_booking",
      terminal: true,
    };
  }

  return { outcome: "ignored", terminal: true };
}

export async function POST(request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    console.error("[stripe webhook] Missing STRIPE_WEBHOOK_SECRET");

    return NextResponse.json(
      { error: "Webhook secret is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const payload = await request.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeWebhookSecret,
    );
  } catch (error) {
    console.error("[stripe webhook] Invalid signature", error.message);

    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ ignored: true, received: true });
  }

  const supabase = createSupabaseServiceRoleServerClient();
  const claim = await claimWebhookEvent({ event, supabase });

  if (claim === CLAIM_RESULTS.processed || claim === CLAIM_RESULTS.inProgress) {
    return NextResponse.json({ duplicate: true, received: true });
  }

  try {
    const result = await processEvent(event);

    await completeWebhookEvent({
      eventId: event.id,
      outcome: result.outcome,
      status: result.terminal === false ? "failed" : "processed",
      supabase,
    });

    if (result.terminal === false) {
      // Not settled yet (for example the authorization has not landed). Ask
      // Stripe to deliver again rather than silently dropping the event.
      return NextResponse.json(
        { outcome: result.outcome, received: false },
        { status: 500 },
      );
    }

    return NextResponse.json({ outcome: result.outcome, received: true });
  } catch (error) {
    console.error("[stripe webhook] Handler failed", error.message);

    await completeWebhookEvent({
      error: error.message,
      eventId: event.id,
      status: "failed",
      supabase,
    });

    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 },
    );
  }
}
