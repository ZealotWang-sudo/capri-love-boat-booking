# Booking payment reliability

Background for the September 2026 incident, where a customer authorized €70 in
Stripe and no booking existed anywhere in the application.

## The rule this design enforces

**Stripe is never the only place a booking exists.**

Before the fix, `POST /api/bookings` generated a booking UUID in memory, put the
entire booking into Stripe Checkout metadata, and wrote nothing to Supabase. The
database row was created later, by whichever of two *push* deliveries arrived
first:

1. the `checkout.session.completed` webhook, or
2. the customer's browser landing on the `success_url`.

Nothing ever asked Stripe what had happened, so when both deliveries failed the
authorization was invisible and unrecoverable. A disabled webhook destination
was the trigger; the absence of any pull-based recovery was the defect.

## Lifecycle now

```
POST /api/bookings
  ├─ validate, price, check availability (bookings + pending attempts)
  ├─ INSERT booking_checkout_attempts   ← durable record, before Stripe
  ├─ stripe.checkout.sessions.create(..., { idempotencyKey })
  └─ UPDATE attempt with session id     ← recoverable if it fails

authorization lands
  ├─ checkout.session.completed webhook ┐
  ├─ browser return (latency only)      ├─ all call authorizeCheckoutSession()
  └─ reconciliation pass                ┘

authorizeCheckoutSession()
  ├─ INSERT bookings (checking_with_captain / authorized)
  ├─ send booking_authorized email      (deduped by unique index)
  └─ ask the captain on Telegram        (deduped by conditional claim)

captain accepts → capture      captain declines → release
```

### Checkout attempts

`public.booking_checkout_attempts` holds the full booking payload and a
half-open `[tour_start_minutes, tour_end_minutes)` range. A `pending` attempt
holds its slot through a GiST exclusion constraint, so two customers cannot pay
for the same boat at the same time.

The exclusion predicate cannot reference `now()`, so expired holds are swept to
`expired` by `expireStaleAttempts()` before every availability read and every
booking creation. An abandoned checkout therefore blocks a slot for at most 35
minutes.

### Reconciliation

`reconcileBookingPayments()` in `src/lib/bookings/reconcilePayments.js` is the
pull path. One pass:

1. checks every `pending` attempt older than 10 minutes against Stripe;
2. expires holds that Stripe says were abandoned;
3. **sweeps Stripe for authorized PaymentIntents whose `booking_id` has no row**
   and creates the booking — this is what heals the incident, including
   bookings made before attempts existed;
4. retries captain notifications for bookings still at `captain_status =
   'pending'`;
5. retries `booking_authorized` emails with no `sent` event;
6. releases bookings whose authorization was cancelled in Stripe.

It runs from three places, because the project's Vercel cron allowance is two
daily jobs:

- the daily `/api/cron` job;
- a throttled `after()` hook on `GET /api/availability` (at most one run per
  five minutes across all instances, via `public.claim_task_run`);
- the **Run reconciliation now** button on `/admin/recovery`.

If the project moves to a Vercel plan with more cron jobs, add a dedicated
frequent job and the `after()` hook becomes redundant:

```json
{ "path": "/api/cron/reconcile", "schedule": "*/15 * * * *" }
```

### Why notifications have no outbox

Booking state *is* the retry queue. `captain_status = 'pending'` on an
authorized booking means the captain has not been told; a missing `sent` row in
`booking_email_events` means the email did not go out. Reconciliation queries
for exactly those shapes, so a partial failure repairs itself without a separate
outbox table or worker.

`sendCaptainBookingRequest()` claims `captain_status` with a conditional update
*before* calling Telegram, and releases the claim if the call fails. Concurrent
callers cannot double-send, and a failed send stays visible to the reconciler.

## Required configuration

| Variable | Status | Notes |
| --- | --- | --- |
| `STRIPE_WEBHOOK_SECRET` | already set | unchanged |
| `CRON_SECRET` | already set | unchanged |
| `TELEGRAM_WEBHOOK_SECRET` | **new, optional but strongly recommended** | see below |

The Telegram webhook previously accepted any unauthenticated POST, which let
anyone who learned a booking UUID forge a captain accept (capturing money) or
decline (releasing it). The endpoint now enforces the
`x-telegram-bot-api-secret-token` header **when `TELEGRAM_WEBHOOK_SECRET` is
set**, and always rejects callbacks from chats other than
`TELEGRAM_CAPTAIN_GROUP_CHAT_ID`. It is tolerant of the variable being absent
(with a warning) purely so that deploying this change cannot break the live
captain buttons before the secret is registered with Telegram.

To close the hole, after deploying:

1. Generate a secret. Telegram accepts 1–256 characters from `A-Z a-z 0-9 _ -`:

   ```
   openssl rand -hex 32
   ```

2. Add it to Vercel as `TELEGRAM_WEBHOOK_SECRET` (Project → Settings →
   Environment Variables → Production), then redeploy so the running app can
   read it.

3. Open `/admin/development` → **Telegram** tab and press **Set production
   webhook**. That server action calls `setWebhook` with the secret, so no
   manual `curl` is needed. The card underneath the button shows
   "Secret will be sent" once the variable is visible to the app.

4. Press **Check webhook** to confirm the URL is right and there is no recent
   delivery error.

Note that `secret_token` has to be resent on every `setWebhook` call, because
Telegram resets omitted parameters to their defaults. The admin action always
includes it, so pressing the button again is safe.

Production and preview share one bot token, so only one webhook can be
registered at a time. Pressing **Set preview webhook** redirects the captain's
buttons to the preview deployment until production is set again.

## Deployment order

1. Run `supabase/booking-payment-reliability.sql` in the Supabase SQL editor.
   Check the warnings it prints; the three "best effort" guards at the end are
   skipped rather than failing the migration if legacy data violates them.
2. Verify the pre-check queries at the top of that file return no rows, and
   re-run the file if any guard was skipped.
3. Deploy the application.
4. **Re-enable the Stripe webhook destination** for
   `https://capriloveboat.com/api/stripe/webhook`. The destination only needs
   `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.canceled` and `charge.refunded`; other event types are
   acknowledged and ignored.
5. Add `TELEGRAM_WEBHOOK_SECRET`, redeploy, then press **Set production
   webhook** on `/admin/development` as described above.

Steps 1 and 3 are independent of 4: reconciliation makes the system correct even
if the webhook stays disabled.

## Post-deployment verification

1. Open `/admin/recovery`. "Stripe webhook events" should start filling up
   within minutes of the first booking; if it stays empty the destination is
   still disabled.
2. Press **Run reconciliation now** and confirm "Orphaned authorizations" is
   empty and "Payment intents scanned" is non-zero.
3. Make a test booking in Stripe test mode, complete Checkout, and **close the
   tab before the redirect**. The booking must appear in Admin and the captain
   must receive the Telegram request.
4. Repeat, but disable the webhook destination first. Within one reconciliation
   interval the booking must appear anyway.
5. Start a checkout and abandon it. The slot must be released within 35 minutes.
6. Send `stripe trigger checkout.session.completed` twice for the same session
   and confirm exactly one booking, one email and one Telegram message.

## Local testing

```
npm test
```

Runs the failure-scenario suite with Node's test runner. The fake Supabase
client in `tests/helpers/fakeSupabase.mjs` enforces the same unique and
exclusion constraints as the migration, so the tests exercise the real
safeguards rather than an idealised database.
