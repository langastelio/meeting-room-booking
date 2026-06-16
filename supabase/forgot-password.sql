-- ===========================================================================
-- FORGOT PASSWORD - database setup (run once in the Supabase SQL Editor)
-- ===========================================================================
-- When a signed-out user requests a password reset, the app stamps this column
-- with the time of the request. Administrators see a "reset requested" tag on
-- the Users page and issue a temporary password (which clears this column).
--
-- The feature works without this column too - it simply won't show the admin
-- "reset requested" indicator until the column exists.
-- ===========================================================================

alter table public.app_users
  add column if not exists reset_requested timestamptz;

-- Optional: see who currently has a pending request.
--   select username, name, reset_requested
--   from public.app_users
--   where reset_requested is not null
--   order by reset_requested;
