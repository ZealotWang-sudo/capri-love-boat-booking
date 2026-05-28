-- WhatsApp outbound/inbound message tracking.
-- Run this in the Supabase SQL editor.

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  meta_message_id text unique,
  to_phone text,
  direction text not null,
  message_type text,
  template_name text,
  status text,
  raw_payload jsonb,
  created_at timestamptz default now()
);
