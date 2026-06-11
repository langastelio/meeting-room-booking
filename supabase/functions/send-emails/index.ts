// supabase/functions/send-emails/index.ts
//
// Scheduled every minute by pg_cron. Two jobs:
//   1) Enqueue reminder emails for meetings 30 / 15 / 5 minutes away.
//   2) Drain the email_outbox and send each message via Outlook SMTP.
//
// Credentials live ONLY in function secrets (never in the client):
//   SMTP_HOST  (default smtp-mail.outlook.com)
//   SMTP_PORT  (default 587)
//   SMTP_USER  (the Outlook address)
//   SMTP_PASS  (Outlook password or app password)
//   SMTP_FROM  (optional; defaults to SMTP_USER)
//   CRON_SECRET (shared secret checked on each call)
//   APP_TZ_OFFSET_MIN (minutes east of UTC for booking times; e.g. 120 = SAST)
//
// Deploy:  supabase functions deploy send-emails --no-verify-jwt
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp-mail.outlook.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_FROM = Deno.env.get("SMTP_FROM") ?? SMTP_USER;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const TZ_OFFSET_MIN = Number(Deno.env.get("APP_TZ_OFFSET_MIN") ?? "0");

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Convert a stored local date + "HH:MM" to a UTC timestamp (ms).
function startMs(date: string, time: string): number {
  const utcAsIfZulu = Date.parse(`${date}T${(time || "00:00")}:00Z`);
  return utcAsIfZulu - TZ_OFFSET_MIN * 60_000;
}

async function enqueueReminders() {
  const { data: bookings } = await sb
    .from("bookings")
    .select("*")
    .eq("status", "booked");
  if (!bookings) return;

  const now = Date.now();
  const thresholds: [number, string][] = [
    [30, "remind_30_sent"],
    [15, "remind_15_sent"],
    [5, "remind_5_sent"],
  ];

  for (const b of bookings) {
    const mins = (startMs(b.date, b.start_time) - now) / 60_000;
    if (mins <= 0) continue; // already started / past
    for (const [t, col] of thresholds) {
      if (mins <= t && !b[col]) {
        const contact = await emailFor(b.created_by);
        if (contact?.email) {
          await sb.from("email_outbox").insert({
            to_email: contact.email,
            to_name: contact.name ?? b.booked_by ?? "",
            subject: `Reminder: "${b.title}" starts soon`,
            body:
              `<p>Hi ${contact.name ?? b.booked_by ?? ""},</p>` +
              `<p>Your meeting <b>${b.title}</b> in <b>${b.room_name}</b> starts at ` +
              `<b>${b.start_time}</b> on <b>${b.date}</b> (about ${t} minutes away).</p>`,
          });
        }
        await sb.from("bookings").update({ [col]: true }).eq("id", b.id);
      }
    }
  }
}

async function emailFor(username: string | null) {
  if (!username) return null;
  const { data } = await sb
    .from("app_users")
    .select("name, email")
    .eq("username", String(username).toLowerCase())
    .limit(1);
  return data && data.length ? data[0] : null;
}

async function drainOutbox(): Promise<number> {
  const { data: pending } = await sb
    .from("email_outbox")
    .select("*")
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(25);
  if (!pending || pending.length === 0) return 0;

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465, // 587 -> STARTTLS (tls:false); 465 -> implicit TLS
      auth: { username: SMTP_USER, password: SMTP_PASS },
    },
  });

  let sent = 0;
  for (const row of pending) {
    try {
      await client.send({
        from: SMTP_FROM,
        to: row.to_email,
        subject: row.subject,
        content: "text/html",
        html: row.body,
      });
      await sb
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      await sb
        .from("email_outbox")
        .update({ status: "error", error: String(e) })
        .eq("id", row.id);
    }
  }
  await client.close();
  return sent;
}

Deno.serve(async (req) => {
  // Simple shared-secret guard (the function is deployed with --no-verify-jwt).
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    await enqueueReminders();
    const sent = await drainOutbox();
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
