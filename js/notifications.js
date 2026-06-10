/*
 * notifications.js — Notify: store & fetch user notifications (Supabase).
 * Used so an admin cancelling someone else's meeting leaves a message the
 * creator sees next time they're on the app.
 */
const Notify = (() => {
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

  const enabled = () => !!sb;

  async function create(recipient, message) {
    if (!sb || !recipient) return;
    const { error } = await sb
      .from("notifications")
      .insert({ recipient: String(recipient).toLowerCase(), message });
    if (error) console.warn("Notify.create failed:", error.message);
  }

  async function unreadFor(username) {
    if (!sb || !username) return [];
    const { data, error } = await sb
      .from("notifications")
      .select("id, message, created_at")
      .eq("recipient", String(username).toLowerCase())
      .eq("read", false)
      .order("id", { ascending: true });
    if (error) {
      console.warn("Notify.unreadFor failed:", error.message);
      return [];
    }
    return data || [];
  }

  async function markRead(ids) {
    if (!sb || !ids || !ids.length) return;
    const { error } = await sb.from("notifications").update({ read: true }).in("id", ids);
    if (error) console.warn("Notify.markRead failed:", error.message);
  }

  return { enabled, create, unreadFor, markRead };
})();
