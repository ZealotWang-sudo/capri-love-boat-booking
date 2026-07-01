-- Manual admin-editable tour pricing.
-- Run this in the Supabase SQL editor.

create table if not exists public.tour_prices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tour_type text not null unique,
  season text default 'standard',
  display_name_en text not null,
  display_name_zh text not null,
  display_name_it text not null,
  duration_hours numeric,
  total_price_eur integer not null,
  reservation_fee_eur integer not null,
  pay_on_board_eur integer not null,
  captain_price_eur integer,
  is_active boolean default true,
  sort_order integer default 0,
  notes text,
  constraint tour_prices_positive_amounts_check
    check (
      total_price_eur = reservation_fee_eur + pay_on_board_eur
      and reservation_fee_eur > 0
      and pay_on_board_eur >= 0
      and captain_price_eur = pay_on_board_eur
    )
);

alter table public.tour_prices
  drop constraint if exists tour_prices_positive_amounts_check;

alter table public.tour_prices
  add constraint tour_prices_positive_amounts_check
  check (
    total_price_eur = reservation_fee_eur + pay_on_board_eur
    and reservation_fee_eur > 0
    and pay_on_board_eur >= 0
    and captain_price_eur = pay_on_board_eur
  );

create or replace function public.set_tour_prices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tour_prices_updated_at on public.tour_prices;
create trigger set_tour_prices_updated_at
before update on public.tour_prices
for each row
execute function public.set_tour_prices_updated_at();

alter table public.tour_prices enable row level security;

drop policy if exists "Public can read active tour prices" on public.tour_prices;
drop policy if exists "Admin can read tour prices" on public.tour_prices;
drop policy if exists "Admin can update tour prices" on public.tour_prices;

create policy "Public can read active tour prices"
  on public.tour_prices
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Admin can read tour prices"
  on public.tour_prices
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can update tour prices"
  on public.tour_prices
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

grant select on public.tour_prices to anon, authenticated;
grant update on public.tour_prices to authenticated;
grant all on public.tour_prices to service_role;

insert into public.tour_prices (
  tour_type,
  display_name_en,
  display_name_zh,
  display_name_it,
  duration_hours,
  total_price_eur,
  reservation_fee_eur,
  pay_on_board_eur,
  captain_price_eur,
  sort_order,
  notes
)
values
  (
    'two_half_hours',
    '2.5 hours',
    '2.5小时',
    '2,5 ore',
    2.5,
    270,
    70,
    200,
    200,
    0,
    'Blue Cave / Blue Grotto visit is not possible with this option.'
  ),
  ('three_hours', '3 hours', '3小时', '3 ore', 3, 350, 70, 280, 280, 1, null),
  ('four_hours', '4 hours', '4小时', '4 ore', 4, 450, 90, 360, 360, 2, null),
  (
    'sunset_three_hours',
    'Sunset 3 hours',
    '日落3小时',
    'Sunset 3 ore',
    3,
    370,
    120,
    250,
    250,
    3,
    null
  ),
  ('five_hours', '5 hours', '5小时', '5 ore', 5, 570, 120, 450, 450, 4, null)
on conflict (tour_type) do nothing;
