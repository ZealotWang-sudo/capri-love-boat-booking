-- Manual admin calendar unavailability.
-- Run this in the Supabase SQL editor.

create table if not exists public.admin_unavailable_slots (
  date date not null,
  time_slot text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (date, time_slot),
  constraint admin_unavailable_slots_time_slot_check
    check (
      time_slot in (
        'morning_0930',
        'morning_1000',
        'afternoon_1330',
        'afternoon_1400',
        'sunset_1800'
      )
    )
);

alter table public.admin_unavailable_slots enable row level security;

drop policy if exists "Public can read unavailable slots" on public.admin_unavailable_slots;
drop policy if exists "Admin can insert unavailable slots" on public.admin_unavailable_slots;
drop policy if exists "Admin can update unavailable slots" on public.admin_unavailable_slots;
drop policy if exists "Admin can delete unavailable slots" on public.admin_unavailable_slots;

create policy "Public can read unavailable slots"
  on public.admin_unavailable_slots
  for select
  to anon, authenticated
  using (true);

create policy "Admin can insert unavailable slots"
  on public.admin_unavailable_slots
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can update unavailable slots"
  on public.admin_unavailable_slots
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

create policy "Admin can delete unavailable slots"
  on public.admin_unavailable_slots
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

grant select on public.admin_unavailable_slots to anon, authenticated;
grant insert, update, delete on public.admin_unavailable_slots to authenticated;
grant all on public.admin_unavailable_slots to service_role;
