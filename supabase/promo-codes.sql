-- Promo codes for reservation-fee discounts.
-- Run this in the Supabase SQL editor.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_eur integer not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_code_normalized_check
    check (code = upper(trim(code)) and length(code) > 0),
  constraint promo_codes_discount_positive_check
    check (discount_eur > 0)
);

alter table public.bookings
  add column if not exists promo_code text,
  add column if not exists promo_discount_eur integer not null default 0,
  add column if not exists original_reservation_fee_eur integer,
  add column if not exists final_reservation_fee_eur integer;

update public.bookings
set
  original_reservation_fee_eur = coalesce(original_reservation_fee_eur, reservation_fee_eur),
  final_reservation_fee_eur = coalesce(final_reservation_fee_eur, reservation_fee_eur),
  promo_discount_eur = coalesce(promo_discount_eur, 0)
where original_reservation_fee_eur is null
  or final_reservation_fee_eur is null
  or promo_discount_eur is null;

alter table public.bookings
  drop constraint if exists bookings_promo_amounts_check;

alter table public.bookings
  add constraint bookings_promo_amounts_check
  check (
    promo_discount_eur >= 0
    and (original_reservation_fee_eur is null or original_reservation_fee_eur > 0)
    and (final_reservation_fee_eur is null or final_reservation_fee_eur >= 10)
    and (
      original_reservation_fee_eur is null
      or final_reservation_fee_eur is null
      or original_reservation_fee_eur - promo_discount_eur = final_reservation_fee_eur
    )
  );

create or replace function public.set_promo_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.code = upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists set_promo_codes_updated_at on public.promo_codes;
create trigger set_promo_codes_updated_at
before insert or update on public.promo_codes
for each row
execute function public.set_promo_codes_updated_at();

alter table public.promo_codes enable row level security;

drop policy if exists "Admin can read promo codes" on public.promo_codes;
drop policy if exists "Admin can insert promo codes" on public.promo_codes;
drop policy if exists "Admin can update promo codes" on public.promo_codes;

create policy "Admin can read promo codes"
  on public.promo_codes
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can insert promo codes"
  on public.promo_codes
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can update promo codes"
  on public.promo_codes
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

grant select, insert, update on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;
