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
    localStorage.removeItem("mrb_last_activity"); // clean idle clock for next login
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
      .select("id, username, name, role, active, must_reset, created_at")
      .order("id", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Display name helper: prefer the person's name, fall back to username.
  const displayName = (u) => (u && (u.name || u.username)) || "";

  // ---- auth actions --------------------------------------------------------
  async function login(username, password) {
    if (!sb) return { ok: false, error: "Database not configured." };
    username = (username || "").trim().toLowerCase();
    const ph = await hash(username, password);
    const { data, error } = await sb
      .from("app_users")
      .select("id, username, name, role, active, must_reset")
      .eq("username", username)
      .eq("password_hash", ph)
      .limit(1);
    if (error) return { ok: false, error: error.message };
    if (!data.length) return { ok: false, error: "Invalid username or password." };
    const u = data[0];
    if (!u.active) return { ok: false, error: "This account is disabled." };
    setSession({
      id: u.id,
      username: u.username,
      name: u.name || u.username,
      role: u.role,
      mustReset: !!u.must_reset,
    });
    return { ok: true, user: u };
  }

  async function createUser({ username, password, name, role, mustReset = true }) {
    if (!sb) return { ok: false, error: "Database not configured." };
    username = (username || "").trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Username and password are required." };
    // Whitelist allowed characters (defence-in-depth; the data layer is already
    // parameterised, so this is belt-and-suspenders against injection/odd input).
    if (!/^[a-z0-9._@-]{3,50}$/.test(username)) {
      return { ok: false, error: "Username may only contain letters, numbers, and . _ - @ (3–50 characters)." };
    }
    const ph = await hash(username, password);
    const { data, error } = await sb
      .from("app_users")
      .insert({
        username,
        name: (name || "").trim() || null,
        password_hash: ph,
        role: role === "admin" ? "admin" : "user",
        active: true,
        must_reset: !!mustReset,
      })
      .select("id, username, name, role, active, must_reset")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That username already exists." };
      return { ok: false, error: error.message };
    }
    return { ok: true, user: data };
  }

  // Used by the login page when no accounts exist yet. The first admin chooses
  // their own password, so no forced reset.
  async function createFirstAdmin({ username, password, name }) {
    if (!sb) return { ok: false, error: "Database not configured." };
    if ((await userCount()) > 0)
      return { ok: false, error: "An account already exists. Please sign in." };
    const res = await createUser({ username, password, name, role: "admin", mustReset: false });
    if (res.ok) {
      setSession({
        id: res.user.id,
        username: res.user.username,
        name: res.user.name || res.user.username,
        role: "admin",
        mustReset: false,
      });
    }
    return res;
  }

  // The logged-in user changes their own password (also clears must_reset).
  async function changeOwnPassword(newPassword) {
    const s = session();
    if (!s) return { ok: false, error: "Not signed in." };
    if (!newPassword || newPassword.length < 4)
      return { ok: false, error: "Password must be at least 4 characters." };
    const ph = await hash(s.username, newPassword);
    const { error } = await sb
      .from("app_users")
      .update({ password_hash: ph, must_reset: false })
      .eq("id", s.id);
    if (error) return { ok: false, error: error.message };
    setSession({ ...s, mustReset: false });
    return { ok: true };
  }

  // ---- admin: manage other users ------------------------------------------
  async function updateUser(id, { name, role }) {
    const patch = {};
    if (name !== undefined) patch.name = (name || "").trim() || null;
    if (role !== undefined) patch.role = role === "admin" ? "admin" : "user";
    const { error } = await sb.from("app_users").update(patch).eq("id", Number(id));
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // Admin assigns a new temporary password; user must reset it on next login.
  async function resetUserPassword(id, username, tempPassword) {
    if (!tempPassword) return { ok: false, error: "Enter a temporary password." };
    const ph = await hash(username, tempPassword);
    const { error } = await sb
      .from("app_users")
      .update({ password_hash: ph, must_reset: true })
      .eq("id", Number(id));
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function deleteUser(id) {
    const { error } = await sb.from("app_users").delete().eq("id", Number(id));
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
    displayName,
    logout,
    userCount,
    listUsers,
    login,
    createUser,
    createFirstAdmin,
    changeOwnPassword,
    updateUser,
    resetUserPassword,
    deleteUser,
    setActive,
  };
})();
