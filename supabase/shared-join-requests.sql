-- Minimal Shared Boat v1 join-request patch for the current application code.
-- This patch is additive only:
-- - does not create/drop tables
-- - does not drop/recreate constraints
-- - does not narrow status values
-- - does not touch RLS policies

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

