-- ===========================================================================
-- EMAIL NOTIFICATIONS — database setup
-- Run this in the Supabase SQL Editor AFTER deploying the send-emails function.
-- ===========================================================================

-- 1) Store an email address per user --------------------------------------
alter table public.app_users add column if not exists email text;

-- 2) Track which reminder emails have already been sent for a booking ------
alter table public.bookings add column if not exists remind_30_sent boolean not null default false;
alter table public.bookings add column if not exists remind_15_sent boolean not null default false;
alter table public.bookings add column if not exists remind_5_sent  boolean not null default false;

-- 3) Outbox: the app inserts rows here; the Edge Function sends & marks them
create table if not exists public.email_outbox (
  id          bigint generated always as identity primary key,
  to_email    text not null,
  to_name     text,
  subject     text not null,
  body        text not null,
  status      text not null default 'pending',  -- pending | sent | error
  error       text,
  created_at  timestamptz default now(),
  sent_at     timestamptz
);

alter table public.email_outbox enable row level security;

-- Clients may INSERT (queue) emails but NOT read others' messages.
-- The Edge Function uses the service-role key, which bypasses RLS.
drop policy if exists "email_outbox insert" on public.email_outbox;
create policy "email_outbox insert" on public.email_outbox for insert with check (true);

-- ===========================================================================
-- 4) SCHEDULER — run the send-emails function every minute
-- Requires the pg_cron and pg_net extensions (available on Supabase).
-- Replace the two placeholders below, then run this section once.
--   <PROJECT_REF>   e.g. egpahskzpayqnfhpcsjg
--   <CRON_SECRET>   any long random string; also set it as a function secret
-- ===========================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove a previous schedule with the same name if re-running.
select cron.unschedule('drain-emails') where exists (
  select 1 from cron.job where jobname = 'drain-emails'
);

select cron.schedule(
  'drain-emails',
  '* * * * *',  -- every minute
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-emails',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', '<CRON_SECRET>'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- To check the schedule:   select * from cron.job;
-- To see recent runs:      select * from cron.job_run_details order by start_time desc limit 10;
