-- Minimal Shared Boat v1 join-request patch for the current application code.
-- This patch is additive only:
-- - does not create/drop tables
-- - does not drop/recreate constraints
-- - does not narrow status values
-- - does not touch RLS policies

create table if not exists public.shared_join_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  locale text,
  customer_name text,
  email text,
  phone text,
  whatsapp text,
  wechat text,
  preferred_contact_method text,
  guest_count integer,
  gender_composition text,
  message text,
  consent_accepted boolean default false,
  customer_manage_token text,
  original_shared_request_fee_eur integer,
  promo_code text,
  promo_discount_eur integer default 0,
  shared_request_fee_eur integer,
  payment_status text default 'authorization_pending',
  status text default 'authorization_pending',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  authorized_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  contact_shared_at timestamptz,
  host_response_deadline_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional check before applying:
-- select required.column_name
-- from (
--   values
--     ('id'),
--     ('booking_id'),
--     ('locale'),
--     ('customer_name'),
--     ('email'),
--     ('phone'),
--     ('whatsapp'),
--     ('wechat'),
--     ('preferred_contact_method'),
--     ('guest_count'),
--     ('gender_composition'),
--     ('message'),
--     ('consent_accepted'),
--     ('customer_manage_token'),
--     ('original_shared_request_fee_eur'),
--     ('promo_code'),
--     ('promo_discount_eur'),
--     ('shared_request_fee_eur'),
--     ('payment_status'),
--     ('status'),
--     ('stripe_checkout_session_id'),
--     ('stripe_payment_intent_id'),
--     ('authorized_at'),
--     ('accepted_at'),
--     ('rejected_at'),
--     ('contact_shared_at'),
--     ('host_response_deadline_at'),
--     ('created_at'),
--     ('updated_at')
-- ) as required(column_name)
-- left join information_schema.columns existing
--   on existing.table_schema = 'public'
--  and existing.table_name = 'shared_join_requests'
--  and existing.column_name = required.column_name
-- where existing.column_name is null
-- order by required.column_name;

alter table public.shared_join_requests
  add column if not exists id uuid,
  add column if not exists booking_id uuid,
  add column if not exists locale text,
  add column if not exists customer_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists wechat text,
  add column if not exists preferred_contact_method text,
  add column if not exists guest_count integer,
  add column if not exists gender_composition text,
  add column if not exists message text,
  add column if not exists consent_accepted boolean default false,
  add column if not exists customer_manage_token text,
  add column if not exists original_shared_request_fee_eur integer,
  add column if not exists promo_code text,
  add column if not exists promo_discount_eur integer default 0,
  add column if not exists shared_request_fee_eur integer,
  add column if not exists payment_status text default 'authorization_pending',
  add column if not exists status text default 'authorization_pending',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists authorized_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists contact_shared_at timestamptz,
  add column if not exists host_response_deadline_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.bookings
  add column if not exists shared_primary_replacement jsonb;

update public.shared_join_requests
set
  id = coalesce(id, gen_random_uuid()),
  consent_accepted = coalesce(consent_accepted, false),
  promo_discount_eur = coalesce(promo_discount_eur, 0),
  payment_status = coalesce(payment_status, 'authorization_pending'),
  status = coalesce(status, 'authorization_pending'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  id is null
  or consent_accepted is null
  or promo_discount_eur is null
  or payment_status is null
  or status is null
  or created_at is null
  or updated_at is null;

alter table public.shared_join_requests
  alter column id set default gen_random_uuid(),
  alter column consent_accepted set default false,
  alter column promo_discount_eur set default 0,
  alter column payment_status set default 'authorization_pending',
  alter column status set default 'authorization_pending',
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column id set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_join_requests_pkey'
      and conrelid = 'public.shared_join_requests'::regclass
  ) then
    alter table public.shared_join_requests
      add constraint shared_join_requests_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_join_requests_booking_id_fkey'
      and conrelid = 'public.shared_join_requests'::regclass
  ) then
    alter table public.shared_join_requests
      add constraint shared_join_requests_booking_id_fkey
      foreign key (booking_id)
      references public.bookings(id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_join_requests_status_check'
      and conrelid = 'public.shared_join_requests'::regclass
  ) then
    alter table public.shared_join_requests
      add constraint shared_join_requests_status_check
      check (
        status in (
          'authorization_pending',
          'authorized_pending_host_decision',
          'sent_to_main_booker',
          'accepted',
          'connected',
          'rejected',
          'released',
          'failed',
          'cancelled_by_admin',
          'promoted_to_primary'
        )
      )
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_join_requests_payment_status_check'
      and conrelid = 'public.shared_join_requests'::regclass
  ) then
    alter table public.shared_join_requests
      add constraint shared_join_requests_payment_status_check
      check (
        payment_status in (
          'authorization_pending',
          'authorized',
          'captured',
          'released',
          'refunded',
          'failed'
        )
      )
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shared_join_requests_guest_count_check'
      and conrelid = 'public.shared_join_requests'::regclass
  ) then
    alter table public.shared_join_requests
      add constraint shared_join_requests_guest_count_check
      check (guest_count is null or guest_count between 1 and 6)
      not valid;
  end if;
end $$;

create unique index if not exists shared_join_requests_checkout_session_unique
  on public.shared_join_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists shared_join_requests_manage_token_unique
  on public.shared_join_requests (customer_manage_token)
  where customer_manage_token is not null;

-- This is the race guard the webhook expects: only one join request can actively
-- block or connect to a shared booking at a time.
create unique index if not exists shared_join_requests_one_active_per_booking
  on public.shared_join_requests (booking_id)
  where status in (
    'authorized_pending_host_decision',
    'sent_to_main_booker',
    'accepted',
    'connected'
  );

