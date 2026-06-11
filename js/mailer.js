/*
 * mailer.js — client side of email notifications.
 *
 * The browser NEVER sends email and never holds mail credentials. It only
 * inserts a row into the `email_outbox` table. A scheduled Supabase Edge
 * Function ("send-emails") drains the outbox and sends via Outlook SMTP using
 * secrets stored server-side.
 */
const Mailer = (() => {
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

  const ready = () => !!sb;

  // Queue an email. Safe no-op if the backend isn't configured or no recipient.
  async function enqueue(toEmail, toName, subject, body) {
    if (!sb || !toEmail) return;
    try {
      await sb.from("email_outbox").insert({
        to_email: String(toEmail).trim(),
        to_name: toName || null,
        subject: subject || "(no subject)",
        body: body || "",
      });
    } catch (e) {
      console.warn("Mailer.enqueue failed:", e.message || e);
    }
  }

  // The login URL for this deployment (works in a subfolder on GitHub Pages).
  const loginUrl = () => location.href.replace(/[^/]*$/, "login.html");

  return { ready, enqueue, loginUrl };
})();
