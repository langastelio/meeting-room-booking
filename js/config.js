/*
 * config.js — backend settings.
 *
 * The app picks a backend automatically, in this order:
 *   1. Supabase   — if SUPABASE_URL + SUPABASE_ANON_KEY are set (shared, live).
 *   2. JSONBin    — if JSONBIN_BIN_ID + JSONBIN_KEY are set (shared, simple).
 *   3. Local-only — if everything is blank (data stays in this browser).
 *
 * ⚠️ Only put PUBLIC keys here. Anything in this file is visible to anyone who
 *    views the page source. For Supabase that means the *publishable/anon* key
 *    (safe by design, protected by Row Level Security) — NEVER the secret key
 *    and NEVER the database password / connection string.
 */
const CONFIG = {
  // --- Supabase (active) ---
  SUPABASE_URL: "https://egpahskzpayqnfhpcsjg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_9D4qfbNvzCpiUnzjkjH7jg_0lENB-uM",

  // --- JSONBin (unused while Supabase is set) ---
  JSONBIN_BIN_ID: "",
  JSONBIN_KEY: "",
};
