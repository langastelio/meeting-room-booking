# Email Notifications — Setup Guide

Emails are sent by a **Supabase Edge Function** (`send-emails`) that runs every minute.
The browser only *queues* emails into the `email_outbox` table — it never holds mail credentials.

What gets emailed:
- **New-user welcome** (username + temporary password + login link)
- **Booking confirmation** (to the booker)
- **Admin cancellation notice** (to the meeting owner, with the reason)
- **Reminders** at 30 / 15 / 5 minutes before a meeting (fully server-side — works even with no browser open)

> ⚠️ **Security:** the Outlook password you shared earlier is exposed — change it now. It is stored
> only as a Supabase **function secret**, never in the website code.

---

## Prerequisites
- The [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in (`supabase login`).
- Your project ref: **`egpahskzpayqnfhpcsjg`**.

## Step 1 — Add an email address to each user
In the app: **Users → Create/Edit** now has an **Email** field. Add emails to existing users
(they need one to receive notifications). Set your own admin email too.

## Step 2 — Deploy the function
From the project folder:

```powershell
supabase link --project-ref egpahskzpayqnfhpcsjg
supabase functions deploy send-emails --no-verify-jwt
```

## Step 3 — Set the function secrets
Use an **app password** if your Outlook account has 2FA (recommended). Pick any long random
`CRON_SECRET`. `APP_TZ_OFFSET_MIN` is your timezone offset in minutes (South Africa / SAST = `120`).

```powershell
supabase secrets set `
  SMTP_HOST=smtp-mail.outlook.com `
  SMTP_PORT=587 `
  SMTP_USER=stdmeet@outlook.com `
  SMTP_PASS=YOUR_NEW_OUTLOOK_OR_APP_PASSWORD `
  SMTP_FROM=stdmeet@outlook.com `
  CRON_SECRET=choose-a-long-random-string `
  APP_TZ_OFFSET_MIN=120
```

## Step 4 — Create tables + schedule
Open [supabase/email-setup.sql](../supabase/email-setup.sql), replace `<PROJECT_REF>` with
`egpahskzpayqnfhpcsjg` and `<CRON_SECRET>` with the same value from Step 3, then run it in the
Supabase **SQL Editor**. This:
- adds the `email` column, reminder flags and the `email_outbox` table, and
- schedules the function to run **every minute** via `pg_cron`.

## Step 5 — Test
1. In the app, create a user with your own email → a welcome email should arrive within ~1 minute.
2. Book a meeting → a confirmation email arrives.
3. Check the queue / sends in Supabase:
   ```sql
   select id, to_email, subject, status, error, sent_at from email_outbox order by id desc limit 20;
   select * from cron.job_run_details order by start_time desc limit 10;
   ```

## Troubleshooting
| Symptom | Fix |
|--------|-----|
| Rows stay `pending` | The cron isn't calling the function. Check `cron.job` exists and the URL/secret match. |
| Rows go to `error` with auth failure | Outlook blocked basic SMTP auth. Use an **app password**, or switch `SMTP_*` to a provider like Resend/Brevo. |
| Reminders off by hours | Set `APP_TZ_OFFSET_MIN` to your timezone offset (SAST = 120). |
| No email at all | Confirm the user has an `email` value, and that secrets are set (`supabase secrets list`). |

---

### How it fits together
```
Browser (insert row) ──▶ email_outbox ──▶ [send-emails fn, every minute] ──▶ Outlook SMTP ──▶ inbox
                          ▲
        reminders enqueued by the same function from the bookings table
```
