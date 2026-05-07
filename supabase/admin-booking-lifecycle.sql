-- Admin booking lifecycle and cancellation metadata.
-- Run this in the Supabase SQL editor.

alter table public.bookings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_type text,
  add column if not exists cancellation_reason text;

alter table public.bookings
  drop constraint if exists bookings_booking_status_check;

alter table public.bookings
  add constraint bookings_booking_status_check
  check (
    booking_status in (
      'requested',
      'checking_with_captain',
      'payment_pending',
      'confirmed',
      'completed',
      'cancelled',
      'not_available',
      'expired'
    )
  );

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (
    payment_status in (
      'unpaid',
      'payment_link_sent',
      'captured',
      'refunded',
      'released',
      'failed'
    )
  );

alter table public.bookings
  drop constraint if exists bookings_captain_status_check;

alter table public.bookings
  add constraint bookings_captain_status_check
  check (
    captain_status in (
      'pending',
      'available',
      'not_available',
      'suggested_alternative'
    )
  );

alter table public.bookings
  drop constraint if exists bookings_cancelled_by_check;

alter table public.bookings
  add constraint bookings_cancelled_by_check
  check (
    cancelled_by is null
    or cancelled_by in ('customer', 'admin', 'captain', 'system')
  );

alter table public.bookings
  drop constraint if exists bookings_cancellation_type_check;

alter table public.bookings
  add constraint bookings_cancellation_type_check
  check (
    cancellation_type is null
    or cancellation_type in (
      'customer_requested',
      'captain_unavailable',
      'weather_or_safety',
      'admin_decision',
      'duplicate_or_test',
      'other'
    )
  );

grant select, update on public.bookings to authenticated;
grant select, update on public.bookings to service_role;
