export function createPaymentIntent(overrides = {}) {
  return {
    amount: 7000,
    amount_capturable: 7000,
    currency: "eur",
    id: "pi_test_authorized",
    metadata: {},
    status: "requires_capture",
    ...overrides,
  };
}

export function createCheckoutSession({ booking, overrides = {} } = {}) {
  const metadata = booking
    ? {
        booking_id: booking.id,
        booking_reference: `CAPRI-${booking.id.slice(0, 8).toUpperCase()}`,
        customer_manage_token: booking.customer_manage_token,
        customer_name: booking.customer_name,
        email: booking.email,
        final_reservation_fee_eur: String(booking.final_reservation_fee_eur),
        guest_count: String(booking.guest_count),
        is_shared_open: String(Boolean(booking.is_shared_open)),
        locale: booking.locale,
        original_reservation_fee_eur: String(
          booking.original_reservation_fee_eur,
        ),
        pay_on_board_eur: String(booking.pay_on_board_eur),
        payment_flow: "manual_authorization",
        requested_date: booking.requested_date,
        reservation_fee_eur: String(booking.reservation_fee_eur),
        site_url: "https://capriloveboat.com",
        time_slot: booking.time_slot,
        time_window: booking.time_window,
        total_price_eur: String(booking.total_price_eur),
        tour_type: booking.tour_type,
      }
    : {};

  return {
    id: "cs_test_session",
    metadata,
    payment_intent: "pi_test_authorized",
    payment_status: "unpaid",
    status: "complete",
    ...overrides,
  };
}

export function createFakeStripe({
  checkoutSessions = [],
  paymentIntents = [],
} = {}) {
  const sessions = new Map(
    checkoutSessions.map((session) => [session.id, session]),
  );
  const intents = new Map(
    paymentIntents.map((paymentIntent) => [paymentIntent.id, paymentIntent]),
  );
  const calls = { cancelled: [], listedPaymentIntents: 0 };

  return {
    calls,
    checkout: {
      sessions: {
        async list({ payment_intent: paymentIntentId }) {
          const matches = [...sessions.values()].filter(
            (session) =>
              session.payment_intent === paymentIntentId ||
              session.payment_intent?.id === paymentIntentId,
          );

          return { data: matches };
        },
        async retrieve(sessionId) {
          const session = sessions.get(sessionId);

          if (!session) {
            const error = new Error(`No such checkout session: ${sessionId}`);
            error.code = "resource_missing";
            throw error;
          }

          return session;
        },
      },
    },
    paymentIntents: {
      async cancel(paymentIntentId) {
        const paymentIntent = intents.get(paymentIntentId);
        calls.cancelled.push(paymentIntentId);

        if (paymentIntent) {
          paymentIntent.status = "canceled";
          paymentIntent.amount_capturable = 0;
        }

        return paymentIntent ?? { id: paymentIntentId, status: "canceled" };
      },
      async list() {
        calls.listedPaymentIntents += 1;

        return { data: [...intents.values()] };
      },
      async retrieve(paymentIntentId) {
        const paymentIntent = intents.get(paymentIntentId);

        if (!paymentIntent) {
          const error = new Error(`No such payment intent: ${paymentIntentId}`);
          error.code = "resource_missing";
          throw error;
        }

        return paymentIntent;
      },
    },
  };
}
