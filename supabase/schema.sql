-- ============================================================================
--  Meeting Room Booking — Supabase schema
--  Run this once in your Supabase project:  SQL Editor → New query → paste →
--  Run.  Safe to re-run (uses IF NOT EXISTS / idempotent policies).
-- ============================================================================

-- ---- Tables ----------------------------------------------------------------
create table if not exists public.rooms (
  id          bigint generated always as identity primary key,
  name        text not null,
  location    text,
  capacity    integer default 0,
  facilities  text,
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists public.bookings (
  id          bigint generated always as identity primary key,
  room_id     bigint references public.rooms(id) on delete set null,
  room_name   text,
  title       text not null,
  booked_by   text,
  date        date not null,
  start_time  text not null,
  end_time    text not null,
  created_at  timestamptz default now()
);

create index if not exists bookings_date_idx on public.bookings (date);

-- ---- Row Level Security ----------------------------------------------------
-- Internal team tool: allow the public (anon publishable key) to read & write.
-- Tighten these later (e.g. require auth) if you need stricter access.
alter table public.rooms    enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "rooms read"   on public.rooms;
drop policy if exists "rooms write"  on public.rooms;
drop policy if exists "rooms update" on public.rooms;
drop policy if exists "rooms delete" on public.rooms;
create policy "rooms read"   on public.rooms for select using (true);
create policy "rooms write"  on public.rooms for insert with check (true);
create policy "rooms update" on public.rooms for update using (true) with check (true);
create policy "rooms delete" on public.rooms for delete using (true);

drop policy if exists "bookings read"   on public.bookings;
drop policy if exists "bookings write"  on public.bookings;
drop policy if exists "bookings update" on public.bookings;
drop policy if exists "bookings delete" on public.bookings;
create policy "bookings read"   on public.bookings for select using (true);
create policy "bookings write"  on public.bookings for insert with check (true);
create policy "bookings update" on public.bookings for update using (true) with check (true);
create policy "bookings delete" on public.bookings for delete using (true);

-- ---- Realtime (optional but recommended) -----------------------------------
-- Lets the app receive instant push updates so other browsers refresh on their
-- own. The app also polls every 5s, so this is a bonus, not required.
do $$ begin
  alter publication supabase_realtime add table public.rooms, public.bookings;
exception when others then null;  -- already added / not available: ignore
end $$;

-- The app auto-seeds "Boardroom A" from data/database.xlsx on first run, so you
-- don't need to insert any rows here. (Optional manual seed below.)
-- insert into public.rooms (name, location, capacity, facilities, active)
-- values ('Boardroom A', '3rd Floor - East Wing', 12, 'Projector, Whiteboard, Video Conference', true);
