-- Customer booking management links for no-login booking access.
-- Run this in the Supabase SQL editor.

alter table public.bookings
  add column if not exists customer_manage_token text,
  add column if not exists customer_cancelled_at timestamptz,
  add column if not exists customer_cancel_reason text;

update public.bookings
set customer_manage_token = rtrim(
  translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'),
  '='
)
where customer_manage_token is null;

create unique index if not exists bookings_customer_manage_token_unique
  on public.bookings (customer_manage_token)
  where customer_manage_token is not null;

create index if not exists bookings_customer_manage_lookup_idx
  on public.bookings (id, customer_manage_token);

create or replace function public.get_customer_managed_booking(
  p_booking_id uuid,
  p_manage_token text
)
returns table (
  id uuid,
  locale text,
  customer_name text,
  email text,
  guest_count integer,
  requested_date date,
  tour_type text,
  time_slot text,
  time_window text,
  total_price_eur integer,
  reservation_fee_eur integer,
  pay_on_board_eur integer,
  booking_status text,
  customer_cancelled_at timestamptz,
  customer_cancel_reason text
)
language sql
security definer
set search_path = public
as $$
  select
    bookings.id,
    bookings.locale,
    bookings.customer_name,
    bookings.email,
    bookings.guest_count,
    bookings.requested_date,
    bookings.tour_type,
    bookings.time_slot,
    bookings.time_window,
    bookings.total_price_eur,
    bookings.reservation_fee_eur,
    bookings.pay_on_board_eur,
    bookings.booking_status,
    bookings.customer_cancelled_at,
    bookings.customer_cancel_reason
  from public.bookings
  where bookings.id = p_booking_id
    and bookings.customer_manage_token = p_manage_token
    and p_manage_token is not null
    and length(p_manage_token) >= 32
  limit 1;
$$;

create or replace function public.customer_cancel_booking(
  p_booking_id uuid,
  p_manage_token text,
  p_cancel_reason text default null
)
returns table (
  id uuid,
  locale text,
  customer_name text,
  email text,
  guest_count integer,
  requested_date date,
  tour_type text,
  time_slot text,
  time_window text,
  total_price_eur integer,
  reservation_fee_eur integer,
  pay_on_board_eur integer,
  booking_status text,
  customer_cancelled_at timestamptz,
  customer_cancel_reason text
)
language sql
security definer
set search_path = public
as $$
  update public.bookings
  set
    booking_status = 'cancelled',
    customer_cancelled_at = now(),
    customer_cancel_reason = nullif(trim(p_cancel_reason), ''),
    updated_at = now()
  where bookings.id = p_booking_id
    and bookings.customer_manage_token = p_manage_token
    and p_manage_token is not null
    and length(p_manage_token) >= 32
    and bookings.booking_status in (
      'requested',
      'checking_with_captain',
      'payment_pending'
    )
  returning
    bookings.id,
    bookings.locale,
    bookings.customer_name,
    bookings.email,
    bookings.guest_count,
    bookings.requested_date,
    bookings.tour_type,
    bookings.time_slot,
    bookings.time_window,
    bookings.total_price_eur,
    bookings.reservation_fee_eur,
    bookings.pay_on_board_eur,
    bookings.booking_status,
    bookings.customer_cancelled_at,
    bookings.customer_cancel_reason;
$$;

revoke all on function public.get_customer_managed_booking(uuid, text) from public;
revoke all on function public.customer_cancel_booking(uuid, text, text) from public;

grant execute on function public.get_customer_managed_booking(uuid, text) to anon, authenticated;
grant execute on function public.customer_cancel_booking(uuid, text, text) to anon, authenticated;
