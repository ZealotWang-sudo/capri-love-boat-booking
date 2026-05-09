-- Privacy-friendly first-party page view analytics.
-- Run this in the Supabase SQL editor.

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null,
  locale text,
  referrer text,
  user_agent text,
  session_id text
);

alter table public.page_views enable row level security;

drop policy if exists "Anonymous users can insert page views" on public.page_views;
drop policy if exists "Admin can select page views" on public.page_views;

create policy "Anonymous users can insert page views"
  on public.page_views
  for insert
  to anon, authenticated
  with check (true);

create policy "Admin can select page views"
  on public.page_views
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'wangkexin-personal@outlook.com');

grant insert on public.page_views to anon, authenticated;
grant select on public.page_views to authenticated;
grant all on public.page_views to service_role;
