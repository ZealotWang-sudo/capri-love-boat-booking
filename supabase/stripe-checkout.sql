-- Stripe Checkout support for reservation fee payments.
-- Run this in the Supabase SQL editor if your bookings table does not already
-- allow payment_status = 'payment_link_sent'.

alter table public.bookings
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (
    payment_status in (
      'unpaid',
      'payment_link_sent',
      'authorization_pending',
      'authorized',
      'captured',
      'released',
      'refunded'
    )
  );

create index if not exists bookings_stripe_checkout_session_id_idx
  on public.bookings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
