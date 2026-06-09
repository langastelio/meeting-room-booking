# 🗓️ Meeting Room Booking App

DB PASS : SLDevStation@202

A lightweight meeting-room booking app built with **plain HTML, CSS and JavaScript**, using an
an **Excel (`.xlsx`) file as the database** (via [SheetJS](https://sheetjs.com)). Designed to deploy
for free on **GitLab Pages**.

## ✨ Features

- **Book a Room** page — choose a room, date and time; **overlapping times are blocked** (no two
  meetings can clash, across all rooms).
- **Admin page** — add / delete meeting rooms (seeded with one room: *Boardroom A*).
- **Shared database (JSONBin)** — everyone in every browser sees the same rooms and bookings.
- **Night / day mode** — toggle in the header, remembers your choice.
- **Excel in & out** — seed data comes from `/data`; **Export** the live data to a real `.xlsx`
  workbook or **Import** one.
- 100% static frontend — no server to run, deploys free on GitLab Pages.

## 📁 Project structure

```
meeting-room-booking/
├── index.html          # Booking page
├── admin.html          # Admin page (add rooms)
├── css/styles.css      # Styling (dark + light themes)
├── js/config.js        # JSONBin shared-DB settings  ← paste your keys here
├── js/db.js            # Data layer (JSONBin shared, or local fallback)
├── js/theme.js         # Night/day mode
├── js/app.js           # Booking page logic
├── js/admin.js         # Admin page logic
├── data/
│   └── database.xlsx       # ← THE DATABASE: "Rooms" + "Bookings" sheets
├── .gitlab-ci.yml      # GitLab Pages deploy config
└── README.md
```

## 💾 The Excel file IS the database

`data/database.xlsx` is the database. It has two sheets:

| Sheet | Columns |
|-------|---------|
| **Rooms** | `id, name, location, capacity, facilities, active` |
| **Bookings** | `id, roomId, roomName, title, bookedBy, date, startTime, endTime, createdAt` |

On load, the app reads this workbook with [SheetJS](https://sheetjs.com) and uses it as the data
source. Open it in Excel any time to view or edit the data directly.

**Saving changes (important):** GitHub/GitLab Pages serve **static files only — there is no server**,
so the browser can *read* the Excel file but cannot *write* back to it. To make changes permanent you
have two options:

1. **Edit + push** — change `data/database.xlsx` in Excel, then `git push`. The deployed app picks up
   the new data.
2. **Export from the app** — book/add rooms in the app, then **Admin → Export to Excel** downloads an
   updated `database.xlsx`. Replace the one in `/data` and push.

This is fine for a small team. The *only* thing it does **not** give you is many people booking
**live at the same second** without re-pushing — for that, turn on the optional shared store below.

> If you leave `js/config.js` blank, the app runs straight from `database.xlsx` (changes stay in your
> browser until you Export + commit).

## 🟢 Live shared database (Supabase) — ACTIVE

This app is wired to **Supabase** (a free hosted Postgres). When configured, all bookings and rooms
are stored in the cloud, so **everyone, on every device, sees the same data live** — no re-pushing
needed. The Excel file (`data/database.xlsx`) becomes the one-time seed.

### One-time setup

1. **Create the tables.** In your Supabase project: **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the `rooms` and
   `bookings` tables and opens Row-Level-Security policies so the app can read/write.
2. **Check the keys** in [`js/config.js`](js/config.js) — already filled with your project URL and
   **publishable** key:
   ```js
   SUPABASE_URL: "https://egpahskzpayqnfhpcsjg.supabase.co",
   SUPABASE_ANON_KEY: "sb_publishable_…",   // public by design — safe in the browser
   ```
3. **Reload the app.** On first run it seeds *Boardroom A* from `database.xlsx` into Supabase. Open the
   app in two different browsers — a booking in one appears in the other. ✅

### ⚠️ Security — do this now
- **Never** put the `sb_secret_…` key or the database password / connection string in this app —
  they'd be visible in the page source. Only the **publishable** key belongs here (it's protected by
  Row Level Security).
- Since the secret key and DB password were shared in chat, **rotate both**: Supabase → **Settings →
  API keys** (roll secret key) and **Settings → Database** (reset password).
- The RLS policies in `schema.sql` allow anyone with the URL to read/write (fine for an internal
  tool). To lock it down, replace them with policies that require authentication.

### How it maps
| App | Supabase table | Notes |
|-----|----------------|-------|
| Rooms | `public.rooms` | `id, name, location, capacity, facilities, active` |
| Bookings | `public.bookings` | snake_case columns (`room_id`, `booked_by`, `start_time`, …) mapped automatically in `db.js` |

The no-overlap rule is enforced on every booking by re-reading that day's bookings from Supabase first.

---

## 🔗 Alternative: live shared saving (JSONBin) — 4 steps

Use this **only if** you prefer JSONBin over Supabase (leave the Supabase fields blank in config). When
enabled, `database.xlsx` becomes the initial seed and live data is mirrored to a shared JSONBin store.

1. **Create a bin.** Sign up free at <https://jsonbin.io> → **Create Bin**. Paste this as the content
   and save:
   ```json
   { "rooms": [], "bookings": [] }
   ```
   Copy the **BIN ID** from the URL/details (looks like `65f1c0e8dc74654018a1b2c3`).
2. **Get your key.** Open **API Keys** in JSONBin and copy your **Master Key** (simplest). For a
   little more safety, create an **Access Key** restricted to *Read + Update* on that bin instead.
3. **Fill in `js/config.js`:**
   ```js
   const CONFIG = {
     JSONBIN_BIN_ID: "65f1c0e8dc74654018a1b2c3",
     JSONBIN_KEY: "$2a$10$your_key_here",
   };
   ```
4. **Reload the app.** It seeds *Boardroom A* into the bin on first run. Open it in two different
   browsers — a booking made in one now appears in the other (the booking page also re-syncs when you
   switch back to the tab). ✅

> ⚠️ **Security note:** anything in `config.js` is visible to anyone who views the site source — this
> is unavoidable on a static site. For an internal team tool that's usually fine. Use a scoped Access
> Key (not the Master Key), keep the GitLab project **private** if you can, and don't store sensitive
> data. For stronger security you'd need a real backend/server.


## 🧪 Run locally

Because the app fetches files, open it through a tiny web server (not by double-clicking the HTML):

```powershell
# From inside the meeting-room-booking folder
python -m http.server 8000
# then open http://localhost:8000
```

(No Python? Use `npx serve` or VS Code's "Live Server" extension.)

---

## 🌐 Make it available to multiple people

Everyone who opens your published URL loads the **same `data/database.xlsx`**, so they all see the
same rooms and bookings. New bookings made in the browser stay local until you **Export → commit** the
updated `database.xlsx` (see *The Excel file IS the database* above).

If you need people to book **live, simultaneously, without re-pushing**, turn on the optional
**[live shared saving (JSONBin)](#-optional-live-shared-saving-jsonbin--4-steps)** and commit your
`js/config.js`.

---

## 🚀 Deploy to GitHub Pages — step by step

GitHub Pages can serve these files **directly from your repo** — no build step needed (the app uses
relative paths, so it works in a subfolder). The included `.nojekyll` file tells GitHub to serve the
files as-is.

### 1. Create the repository
1. Sign up / log in at <https://github.com>.
2. Click **New** (top-left **+** → *New repository*).
3. Name it e.g. `meeting-room-booking`, choose **Public** (Pages is free on public repos), and
   **don't** add a README/.gitignore (we already have files). Click **Create repository**.

### 2. Fill in your JSONBin keys first
Edit `js/config.js` and paste your `JSONBIN_BIN_ID` + `JSONBIN_KEY` (see the JSONBin section above).
This is what makes bookings shared between people.

### 3. Push the code
Inside the `meeting-room-booking` folder:

```powershell
git init
git branch -M main
git add .
git commit -m "Meeting room booking app"
git remote add origin https://github.com/<your-username>/meeting-room-booking.git
git push -u origin main
```

> Replace `<your-username>` with your GitHub username. When asked to log in, use a
> [Personal Access Token](https://github.com/settings/tokens) as the password (GitHub no longer
> accepts your account password over HTTPS).

### 4. Turn on Pages
1. In the repo, go to **Settings → Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Set **Branch** to `main` and folder to `/ (root)`, then click **Save**.

### 5. Open your live URL
After ~1 minute, **Settings → Pages** shows the link:
```
https://<your-username>.github.io/meeting-room-booking/
```
Open it — the app is live and shared with everyone. 🎉
*(First publish can take a couple of minutes.)*

### 6. Update later
Every `git push` to `main` redeploys automatically:

```powershell
git add .
git commit -m "Add new meeting rooms"
git push
```

### Optional: clean root URL
Name the repo exactly `<your-username>.github.io` and the site is served at
`https://<your-username>.github.io/` (no subfolder).

> The `.gitlab-ci.yml` file in this project is only used by GitLab — GitHub ignores it. You can keep
> or delete it.

---

## 🚀 Deploy to GitLab Pages — step by step

### 1. Create a GitLab account & project
1. Sign up / log in at <https://gitlab.com>.
2. Click **New project → Create blank project**.
3. Name it e.g. `meeting-room-booking`, set visibility (Public is fine), and **uncheck**
   "Initialize repository with a README" (we already have files). Click **Create project**.

### 2. Push the code to GitLab
On your machine, inside the `meeting-room-booking` folder:

```powershell
git init
git branch -M main
git add .
git commit -m "Initial meeting room booking app"
git remote add origin https://gitlab.com/<your-username>/meeting-room-booking.git
git push -u origin main
```

> Replace `<your-username>` with your GitLab username. GitLab will ask you to log in (use a
> [Personal Access Token](https://gitlab.com/-/user_settings/personal_access_tokens) as the
> password if prompted).

### 3. Let the pipeline build the site
- The included `.gitlab-ci.yml` defines a **`pages`** job that copies the site into a `public/`
  folder, which GitLab Pages publishes.
- After you push, go to **Build → Pipelines** in your project. A pipeline starts automatically and
  should turn green (✅) in under a minute.

### 4. Find your live URL
1. Go to **Deploy → Pages** in the left sidebar.
2. Your site URL appears there, in the form:
   ```
   https://<your-username>.gitlab.io/meeting-room-booking/
   ```
3. Open it — the booking app is live! 🎉
   *(First publish can take a few minutes to become reachable.)*

### 5. Make changes later
Every time you `git push` to `main`, the pipeline reruns and your live site updates automatically.

```powershell
git add .
git commit -m "Add new meeting rooms"
git push
```

### Optional: use a clean root URL
If you name the project exactly `<your-username>.gitlab.io`, the site is served at
`https://<your-username>.gitlab.io/` (no subfolder).

---

## 🛠️ Troubleshooting

| Problem | Fix |
|--------|-----|
| Pipeline fails | Open **Build → Pipelines → failed job** and read the log. Ensure `.gitlab-ci.yml` is in the repo root. |
| Page is blank / 404 | Wait a few minutes after the first deploy; confirm the URL under **Deploy → Pages**. |
| Rooms don't load locally | You opened the file directly — run a local server (see *Run locally*). |
| Lost my changes | They live in your browser's localStorage. Use **Admin → Export** regularly to back up to Excel. |
