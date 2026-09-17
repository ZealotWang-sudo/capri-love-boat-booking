-- Booking/payment reliability hardening.
-- Run this in the Supabase SQL editor. Every statement is additive and safe to
-- re-run; nothing here drops or rewrites existing booking data.
--
-- Before running, check whether the two "best effort" blocks at the bottom can
-- succeed on production data:
--
--   -- duplicate Stripe ids (expected: 0 rows)
--   select stripe_checkout_session_id, count(*)
--   from public.bookings
--   where stripe_checkout_session_id is not null
--   group by 1 having count(*) > 1;
--
--   select stripe_payment_intent_id, count(*)
--   from public.bookings
--   where stripe_payment_intent_id is not null
--   group by 1 having count(*) > 1;
--
--   -- overlapping active bookings (expected: 0 rows, run after the backfill)
--   select a.id, b.id
--   from public.bookings a
--   join public.bookings b
--     on a.requested_date = b.requested_date
--    and a.id < b.id
--    and int4range(a.tour_start_minutes, a.tour_end_minutes)
--        && int4range(b.tour_start_minutes, b.tour_end_minutes)
--   where a.booking_status in ('requested','checking_with_captain','payment_pending','confirmed','available')
--     and b.booking_status in ('requested','checking_with_captain','payment_pending','confirmed','available')
--     and coalesce(a.payment_status,'unpaid') not in ('failed','released')
--     and coalesce(b.payment_status,'unpaid') not in ('failed','released');

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Booking schedule range columns
-- ---------------------------------------------------------------------------
-- The application owns tour durations (src/lib/bookingAvailability.js). It now
-- writes the resolved half-open [start, end) minute range on every booking so
-- the database can enforce overlap without duplicating that business logic.

alter table public.bookings
  add column if not exists tour_start_minutes integer,
  add column if not exists tour_end_minutes integer,
  add column if not exists checkout_attempt_id uuid;

-- One-time backfill for rows created before this migration. The duration and
-- slot values below mirror TOUR_DURATIONS_MINUTES / TIME_SLOT_WINDOWS at the
-- time of writing; later changes are supplied by the application, not here.
with slot_minutes as (
  select
    b.id,
    case b.time_slot
      when 'morning_0930' then 570
      when 'morning_1000' then 600
      when 'afternoon_1330' then 810
      when 'afternoon_1400' then 840
      when 'sunset_1800' then 1080
      when 'morning' then 570
      when 'afternoon' then 810
      when 'sunset' then 1080
    end as start_minutes,
    case b.time_slot
      when 'morning_0930' then 570
      when 'morning_1000' then 600
      when 'afternoon_1330' then 810
      when 'afternoon_1400' then 840
      when 'sunset_1800' then 1080
      when 'morning' then 600
      when 'afternoon' then 840
      when 'sunset' then 1080
    end as window_end_minutes,
    case b.tour_type
      when 'two_half_hours' then 150
      when 'two_hours' then 120
      when 'three_hours' then 180
      when 'four_hours' then 240
      when 'sunset_three_hours' then 180
      when 'five_hours' then 300
    end as duration_minutes
  from public.bookings b
  where b.tour_start_minutes is null
     or b.tour_end_minutes is null
)
update public.bookings b
set
  tour_start_minutes = slot_minutes.start_minutes,
  tour_end_minutes = slot_minutes.window_end_minutes + slot_minutes.duration_minutes
from slot_minutes
where b.id = slot_minutes.id
  and slot_minutes.start_minutes is not null
  and slot_minutes.window_end_minutes is not null
  and slot_minutes.duration_minutes is not null;

create index if not exists bookings_schedule_range_idx
  on public.bookings (requested_date, tour_start_minutes, tour_end_minutes)
  where tour_start_minutes is not null;

-- ---------------------------------------------------------------------------
-- 2. Checkout attempts
-- ---------------------------------------------------------------------------
-- A durable record of every Stripe Checkout we start. Written before the Stripe
-- API call so an authorization can never exist without a local trace of it.

create table if not exists public.booking_checkout_attempts (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending',
  locale text,
  customer_email text,
  requested_date date not null,
  tour_type text not null,
  time_slot text not null,
  tour_start_minutes integer not null,
  tour_end_minutes integer not null,
  reservation_fee_eur integer,
  expires_at timestamptz not null,
  booking_payload jsonb not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  resolved_at timestamptz,
  reconciled_at timestamptz,
  reconcile_attempts integer not null default 0,
  last_error text
);

alter table public.booking_checkout_attempts
  drop constraint if exists booking_checkout_attempts_status_check;

alter table public.booking_checkout_attempts
  add constraint booking_checkout_attempts_status_check
  check (
    status in (
      'pending',
      'authorized',
      'expired',
      'cancelled',
      'conflict',
      'failed'
    )
  );

create unique index if not exists booking_checkout_attempts_session_unique
  on public.booking_checkout_attempts (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists booking_checkout_attempts_open_idx
  on public.booking_checkout_attempts (status, expires_at);

create index if not exists booking_checkout_attempts_date_idx
  on public.booking_checkout_attempts (requested_date)
  where status = 'pending';

-- A pending attempt holds its slot. The predicate cannot reference now(), so
-- expired attempts are swept to 'expired' by the application before every
-- availability read and booking creation.
do $$
begin
  alter table public.booking_checkout_attempts
    add constraint booking_checkout_attempts_no_overlap
    exclude using gist (
      requested_date with =,
      int4range(tour_start_minutes, tour_end_minutes) with &&
    )
    where (status = 'pending');
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Stripe webhook event ledger
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing',
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  last_error text
);

create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (status, received_at desc);

-- Atomically claims an event for processing.
-- Returns 'claimed' (caller should process), 'processed' (already done) or
-- 'in_progress' (another invocation holds it).
create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stale_after_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
  v_status text;
begin
  insert into public.stripe_webhook_events as e (event_id, event_type, status, attempts)
  values (p_event_id, p_event_type, 'processing', 1)
  on conflict (event_id) do update
    set status = 'processing',
        attempts = e.attempts + 1,
        received_at = now(),
        last_error = null
    where e.status = 'failed'
       or (
         e.status = 'processing'
         and e.received_at < now() - make_interval(secs => p_stale_after_seconds)
       )
  returning true into v_claimed;

  if coalesce(v_claimed, false) then
    return 'claimed';
  end if;

  select status into v_status
  from public.stripe_webhook_events
  where event_id = p_event_id;

  if v_status in ('processed', 'ignored') then
    return 'processed';
  end if;

  return 'in_progress';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Background task throttle
-- ---------------------------------------------------------------------------
-- Lets request-time background work (Next.js `after`) run reconciliation at
-- most once per interval across all serverless instances.

create table if not exists public.app_task_runs (
  task_name text primary key,
  last_run_at timestamptz not null default now(),
  last_finished_at timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.claim_task_run(
  p_task_name text,
  p_min_interval_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
begin
  insert into public.app_task_runs as t (task_name, last_run_at)
  values (p_task_name, now())
  on conflict (task_name) do update
    set last_run_at = now(),
        updated_at = now()
    where t.last_run_at < now() - make_interval(secs => p_min_interval_seconds)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Email event log
-- ---------------------------------------------------------------------------
-- Created only when missing; existing production tables are left untouched.

create table if not exists public.booking_email_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  booking_id uuid references public.bookings(id) on delete cascade,
  event_type text not null,
  locale text,
  recipient_email text,
  resend_email_id text,
  sent_at timestamptz,
  status text not null,
  subject text,
  error_message text
);

create index if not exists booking_email_events_booking_idx
  on public.booking_email_events (booking_id, event_type);

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.booking_checkout_attempts to service_role;
grant select, insert, update, delete on public.stripe_webhook_events to service_role;
grant select, insert, update, delete on public.app_task_runs to service_role;
grant select, insert, update, delete on public.booking_email_events to service_role;
grant select on public.booking_checkout_attempts to authenticated;

alter table public.booking_checkout_attempts enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.app_task_runs enable row level security;

drop policy if exists "Admin can read checkout attempts" on public.booking_checkout_attempts;

create policy "Admin can read checkout attempts"
  on public.booking_checkout_attempts
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

revoke all on function public.claim_stripe_webhook_event(text, text, integer) from public;
revoke all on function public.claim_task_run(text, integer) from public;
grant execute on function public.claim_stripe_webhook_event(text, text, integer) to service_role;
grant execute on function public.claim_task_run(text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Best-effort uniqueness / overlap guards
-- ---------------------------------------------------------------------------
-- These protect against duplicate bookings and double-booked slots. If legacy
-- data violates them the statement is skipped with a warning instead of
-- failing the whole migration; resolve the duplicates and re-run this file.

do $$
begin
  create unique index bookings_stripe_checkout_session_unique
    on public.bookings (stripe_checkout_session_id)
    where stripe_checkout_session_id is not null;
exception
  when duplicate_table then null;
  when unique_violation then
    raise warning 'Skipped bookings_stripe_checkout_session_unique: duplicate stripe_checkout_session_id values exist.';
end $$;

do $$
begin
  create unique index bookings_stripe_payment_intent_unique
    on public.bookings (stripe_payment_intent_id)
    where stripe_payment_intent_id is not null;
exception
  when duplicate_table then null;
  when unique_violation then
    raise warning 'Skipped bookings_stripe_payment_intent_unique: duplicate stripe_payment_intent_id values exist.';
end $$;

do $$
begin
  create unique index booking_email_events_sent_unique
    on public.booking_email_events (booking_id, event_type)
    where status = 'sent';
exception
  when duplicate_table then null;
  when unique_violation then
    raise warning 'Skipped booking_email_events_sent_unique: duplicate sent email events exist.';
end $$;

do $$
begin
  alter table public.bookings
    add constraint bookings_no_active_overlap
    exclude using gist (
      requested_date with =,
      int4range(tour_start_minutes, tour_end_minutes) with &&
    )
    where (
      booking_status in (
        'requested',
        'checking_with_captain',
        'payment_pending',
        'confirmed',
        'available'
      )
      and coalesce(payment_status, 'unpaid') not in ('failed', 'released')
      and tour_start_minutes is not null
      and tour_end_minutes is not null
    );
exception
  when duplicate_object then null;
  when duplicate_table then null;
  when exclusion_violation then
    raise warning 'Skipped bookings_no_active_overlap: overlapping active bookings exist.';
end $$;
