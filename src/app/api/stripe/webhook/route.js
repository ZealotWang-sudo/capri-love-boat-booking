import { NextResponse } from "next/server";
import { confirmBookingPaymentFromSession } from "@/lib/stripe/confirmBookingPayment";
import { getStripe } from "@/lib/stripe/server";

async function handleCheckoutCompleted(session) {
  await confirmBookingPaymentFromSession({ session });
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

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    }
  } catch (error) {
    console.error("[stripe webhook] Handler failed", error.message);

    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
