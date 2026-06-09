/*
 * auth.js — simple login gate backed by the Supabase `app_users` table.
 *
 * NOTE: This is UI-level access control. Passwords are SHA-256 hashed before
 * storage, but because the app uses the public key with open table access, this
 * is suitable for a trusted internal team — not hardened security. Upgrade to
 * Supabase Auth for real protection.
 *
 * Roles: "admin" (manage rooms + users) and "user" (book rooms only).
 * The FIRST account created becomes the admin.
 */

const Auth = (() => {
  const SESSION_KEY = "mrb_session";
  const SALT = "mrb_v1_salt"; // static salt; combined with username per user

  let sb = null;
  if (
    typeof CONFIG !== "undefined" &&
    CONFIG.SUPABASE_URL &&
    CONFIG.SUPABASE_ANON_KEY &&
    window.supabase &&
    window.supabase.createClient
  ) {
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }

  const hasBackend = () => !!sb;

  async function hash(username, password) {
    const data = new TextEncoder().encode(`${SALT}:${username.toLowerCase()}:${password}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ---- session -------------------------------------------------------------
  const session = () => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  };
  const setSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  const isAdmin = () => session()?.role === "admin";

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = "login.html";
  }

  // ---- counts / lookups ----------------------------------------------------
  async function userCount() {
    const { count, error } = await sb
      .from("app_users")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return count || 0;
  }

  async function listUsers() {
    const { data, error } = await sb
      .from("app_users")
      .select("id, username, role, active, created_at")
      .order("id", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ---- auth actions --------------------------------------------------------
  async function login(username, password) {
    if (!sb) return { ok: false, error: "Database not configured." };
    username = (username || "").trim().toLowerCase();
    const ph = await hash(username, password);
    const { data, error } = await sb
      .from("app_users")
      .select("id, username, role, active")
      .eq("username", username)
      .eq("password_hash", ph)
      .limit(1);
    if (error) return { ok: false, error: error.message };
    if (!data.length) return { ok: false, error: "Invalid username or password." };
    if (!data[0].active) return { ok: false, error: "This account is disabled." };
    setSession({ id: data[0].id, username: data[0].username, role: data[0].role });
    return { ok: true, user: data[0] };
  }

  async function createUser({ username, password, role }) {
    if (!sb) return { ok: false, error: "Database not configured." };
    username = (username || "").trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Username and password are required." };
    const ph = await hash(username, password);
    const { data, error } = await sb
      .from("app_users")
      .insert({
        username,
        password_hash: ph,
        role: role === "admin" ? "admin" : "user",
        active: true,
      })
      .select("id, username, role, active")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That username already exists." };
      return { ok: false, error: error.message };
    }
    return { ok: true, user: data };
  }

  // Used by the login page when no accounts exist yet.
  async function createFirstAdmin({ username, password }) {
    if (!sb) return { ok: false, error: "Database not configured." };
    if ((await userCount()) > 0)
      return { ok: false, error: "An account already exists. Please sign in." };
    const res = await createUser({ username, password, role: "admin" });
    if (res.ok) setSession({ id: res.user.id, username: res.user.username, role: "admin" });
    return res;
  }

  async function deleteUser(id) {
    const { error } = await sb.from("app_users").delete().eq("id", Number(id));
    if (error) throw error;
  }
  async function setRole(id, role) {
    const { error } = await sb
      .from("app_users")
      .update({ role: role === "admin" ? "admin" : "user" })
      .eq("id", Number(id));
    if (error) throw error;
  }
  async function setActive(id, active) {
    const { error } = await sb.from("app_users").update({ active: !!active }).eq("id", Number(id));
    if (error) throw error;
  }

  return {
    hasBackend,
    session,
    isAdmin,
    logout,
    userCount,
    listUsers,
    login,
    createUser,
    createFirstAdmin,
    deleteUser,
    setRole,
    setActive,
  };
})();
