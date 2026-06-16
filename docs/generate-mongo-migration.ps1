# Generates the MongoDB migration design document (.docx) via Word automation.
$ErrorActionPreference = "Stop"

$outPath = "c:\Users\A267829\OneDrive - Standard Bank\Desktop\PO - PPB\Power Apps\GIT\meeting-room-booking\docs\Meeting-Room-Booking-MongoDB-Migration.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$sel = $word.Selection

function GoEnd { $sel.EndKey(6) | Out-Null }
function H1($t){ GoEnd; $sel.Style = "Heading 1"; $sel.ParagraphFormat.Alignment = 0; $sel.TypeText($t); $sel.TypeParagraph() }
function H2($t){ GoEnd; $sel.Style = "Heading 2"; $sel.ParagraphFormat.Alignment = 0; $sel.TypeText($t); $sel.TypeParagraph() }
function H3($t){ GoEnd; $sel.Style = "Heading 3"; $sel.ParagraphFormat.Alignment = 0; $sel.TypeText($t); $sel.TypeParagraph() }
function P($t){ GoEnd; $sel.Style = "Normal"; $sel.ParagraphFormat.Alignment = 0; $sel.Font.Bold = $false; $sel.TypeText($t); $sel.TypeParagraph() }
function B($t){ GoEnd; $sel.Style = "List Bullet"; $sel.TypeText($t); $sel.TypeParagraph() }
function Code($t){ GoEnd; $sel.Style = "Normal"; $sel.ParagraphFormat.Alignment = 0; $sel.Font.Name = "Consolas"; $sel.Font.Size = 9; $sel.TypeText($t); $sel.TypeParagraph(); $sel.Font.Name = "Calibri"; $sel.Font.Size = 11 }

function Tbl($rows){
  GoEnd
  $sel.Style = "Normal"
  $nr = $rows.Count
  $nc = $rows[0].Count
  $tbl = $doc.Tables.Add($sel.Range, $nr, $nc)
  $tbl.Borders.InsideLineStyle = 1
  $tbl.Borders.OutsideLineStyle = 1
  $tbl.Range.Font.Size = 9
  $tbl.Range.Font.Bold = $false
  for ($r = 0; $r -lt $nr; $r++){
    for ($c = 0; $c -lt $nc; $c++){
      $tbl.Cell($r + 1, $c + 1).Range.Text = [string]$rows[$r][$c]
    }
  }
  $tbl.Rows.Item(1).Range.Font.Bold = $true
  $tbl.Rows.Item(1).Shading.BackgroundPatternColor = 14277081
  try { $tbl.AutoFitBehavior(1) } catch {}
  GoEnd
  $sel.TypeParagraph()
}

# ---- title page -----------------------------------------------------------
$sel.ParagraphFormat.Alignment = 1
$sel.Font.Size = 24; $sel.Font.Bold = $true
$sel.TypeText("Migration Design Document"); $sel.TypeParagraph()
$sel.Font.Size = 15; $sel.Font.Bold = $false
$sel.TypeText("Moving the Meeting Room Booking System"); $sel.TypeParagraph()
$sel.TypeText("from Supabase (PostgreSQL) to MongoDB"); $sel.TypeParagraph()
$sel.Font.Size = 13
$sel.TypeText("PPB Mozambique - Personal & Private Banking"); $sel.TypeParagraph()
$sel.TypeParagraph()
$sel.Font.Size = 11
$sel.TypeText("Document Version: 1.0"); $sel.TypeParagraph()
$sel.TypeText("Status: Proposed migration plan"); $sel.TypeParagraph()
$sel.TypeText("Date: June 2026"); $sel.TypeParagraph()
$sel.TypeText("Classification: Internal / Confidential"); $sel.TypeParagraph()
$sel.InsertBreak(7)

$sel.ParagraphFormat.Alignment = 0
$sel.Font.Size = 11; $sel.Font.Bold = $false

# ---- TOC ------------------------------------------------------------------
$sel.Style = "Heading 1"; $sel.TypeText("Table of Contents"); $sel.TypeParagraph()
GoEnd
$toc = $doc.TablesOfContents.Add($sel.Range, $true, 1, 3)
GoEnd
$sel.InsertBreak(7)

# ===========================================================================
H1 "1. Document Control"
Tbl @(
  @("Version","Date","Author","Description"),
  @("0.1","June 2026","Product Owner","Initial migration outline"),
  @("1.0","June 2026","Product Owner","Full plan: architecture, data model, migration, cutover")
)
P "This document describes how to move the Meeting Room Booking System from its current Supabase (PostgreSQL) backend to MongoDB, with no loss of data and minimal disruption to users."

H1 "2. Executive Summary"
P "The application currently runs as a static web front end on Vercel that talks directly to Supabase (PostgreSQL). Supabase exposes a secure, browser-callable data API, which is why the app needs no server of its own."
P "MongoDB does not provide an equivalent, safe, browser-callable API. MongoDB's Atlas Data API (the closest equivalent) was deprecated and retired (end of life September 2025). Therefore the migration is not a simple 'swap the database' exercise: it requires introducing a small backend API layer that holds the database credentials and performs all reads and writes on behalf of the browser."
P "The recommended target keeps the existing front end and Vercel hosting, adds a set of Vercel Serverless Functions as the API layer, and uses MongoDB Atlas as the database. Real-time push (a Supabase feature) is replaced by the polling the app already performs, so the user experience stays effectively the same. Data is migrated with a verified, reversible process that keeps Supabase intact as a fallback until the new system is proven."
P "Good news: the app was built with a pluggable data layer (js/db.js already supports multiple backends), so the front-end change is small and contained - mainly adding an 'api' backend mode."

H1 "3. Purpose and Scope"
H2 "3.1 Purpose"
P "To define the architecture, data model, application changes, and a zero-data-loss migration and cutover plan for replacing Supabase/PostgreSQL with MongoDB."
H2 "3.2 In Scope"
B "Target architecture using a backend API layer plus MongoDB Atlas."
B "Data model mapping from PostgreSQL tables to MongoDB collections."
B "Application changes (data layer, authentication, real-time vs polling)."
B "Data migration, verification, cutover, and rollback."
H2 "3.3 Out of Scope"
B "New product features (covered by the product roadmap / BRD)."
B "Email notifications (tracked separately as MVP2)."

H1 "4. Current Architecture (As-Is)"
P "The system is a static front end (HTML, CSS, vanilla JavaScript) hosted on Vercel. It uses the supabase-js client to read and write directly to Supabase (PostgreSQL), protected by the public (anon) key and Row Level Security. Supabase also provides Realtime push so browsers stay in sync, with periodic polling as a fallback."
Tbl @(
  @("Layer","Today"),
  @("Front end","HTML / CSS / vanilla JS on Vercel (static)"),
  @("Data access","supabase-js called directly from the browser"),
  @("Database","Supabase - PostgreSQL with Row Level Security"),
  @("Sync","Supabase Realtime push + polling every few seconds"),
  @("Auth","Application-level (custom) against the app_users table"),
  @("Secrets","Only the public anon key is in the browser")
)

H1 "5. Why This Is Not a Direct Swap"
P "Supabase is a Backend-as-a-Service: it safely exposes the database to the browser through an authenticated REST/Realtime API with row-level security. MongoDB is just a database - it is designed to be reached by a trusted server using a connection string, never directly from a browser, because that connection string is a full-access secret."
P "MongoDB Atlas previously offered a browser-callable HTTPS 'Data API', but it was deprecated and reached end of life in September 2025. As a result, the supported way to use MongoDB from a web app in 2026 is to place a small backend between the browser and the database."
P "Conclusion: migrating to MongoDB means adding a backend API layer. This is the single biggest change in the migration, and it also improves security (credentials and business rules move server-side)."

H1 "6. Target Architecture (To-Be)"
P "Keep the front end and Vercel hosting. Add Vercel Serverless Functions (Node.js) in the same project under an /api path; these hold the MongoDB connection string (as an environment variable) and perform all data access. The browser calls these endpoints with fetch, exactly where it currently calls supabase-js."
Tbl @(
  @("Layer","After migration"),
  @("Front end","Unchanged - HTML / CSS / vanilla JS on Vercel"),
  @("Data access","fetch() calls to /api endpoints (new 'api' mode in db.js)"),
  @("API layer","Vercel Serverless Functions (Node.js + official MongoDB driver)"),
  @("Database","MongoDB Atlas (managed cloud)"),
  @("Sync","Polling every few seconds (Realtime push retired)"),
  @("Auth","Server-side, token-based (recommended), enforced in the API"),
  @("Secrets","MongoDB connection string + token secret in Vercel env vars only")
)
P "Data flow: Browser -> /api/* (Vercel Function) -> MongoDB Atlas. The connection string never leaves the server. Because the same Vercel project serves both the site and the functions, there are no cross-origin (CORS) complications and deployment stays a single push."

H1 "7. Data Model Mapping"
P "Each PostgreSQL table becomes a MongoDB collection. To preserve relationships with zero remapping, keep the existing integer identifiers as the MongoDB _id, so references such as a booking's room id stay valid. Field names move from snake_case to camelCase, which also lets us remove the snake_case mapping currently in db.js."
H2 "7.1 Tables to Collections"
Tbl @(
  @("PostgreSQL table","MongoDB collection","Notes"),
  @("rooms","rooms","Integer id kept as _id"),
  @("bookings","bookings","Integer id kept as _id; references roomId"),
  @("app_users","app_users","Integer id kept as _id; unique username"),
  @("notifications","notifications","Per-user messages"),
  @("email_outbox","email_outbox","For MVP2 email; carried over as-is")
)
H2 "7.2 Field Mapping (bookings example)"
Tbl @(
  @("PostgreSQL field","MongoDB field"),
  @("id","_id (integer, preserved)"),
  @("room_id","roomId"),
  @("room_name","roomName"),
  @("title","title"),
  @("booked_by","bookedBy"),
  @("created_by","createdBy"),
  @("date","date (YYYY-MM-DD)"),
  @("start_time / end_time","startTime / endTime (HH:MM)"),
  @("status","status"),
  @("cancelled_by / cancel_reason / cancelled_at","cancelledBy / cancelReason / cancelledAt"),
  @("created_at","createdAt")
)
H2 "7.3 Auto-Increment Identifiers"
P "PostgreSQL generated sequential integer ids automatically. MongoDB uses ObjectId by default. To keep the existing numeric ids working without changing the front end, add a small 'counters' collection that issues the next integer id per collection (a well-known MongoDB pattern). New rooms, bookings and users then get the next integer id, just like before."
H2 "7.4 Indexes"
P "Indexes ensure performance and correctness, especially for the double-booking check."
Tbl @(
  @("Collection","Index","Purpose"),
  @("bookings","{ roomId: 1, date: 1 }","Fast conflict checks per room and day"),
  @("bookings","{ date: 1, startTime: 1 }","Calendar and upcoming-list queries"),
  @("bookings","{ status: 1 }","Filter cancelled vs active"),
  @("app_users","{ username: 1 } unique","Prevent duplicate usernames"),
  @("notifications","{ recipient: 1, read: 1 }","Per-user unread lookups"),
  @("counters","{ _id: 1 }","Id sequence per collection")
)

H1 "8. Application Changes"
H2 "8.1 Data layer (db.js)"
P "The data layer already abstracts the backend. Add a new 'api' mode whose functions call the /api endpoints with fetch and return the same shapes the rest of the app expects. The Supabase-specific code can be retired once cutover is complete. Because field names become camelCase, the snake_case translation helpers (fromDbBooking / toDbBooking) are no longer needed."
H2 "8.2 Authentication"
P "Today authentication runs in the browser against the app_users table. With a backend, move it server-side: the /api/auth/login endpoint verifies the password hash and returns a signed token (JWT). The browser stores the token and sends it on each request; the API verifies it and enforces roles. This is more secure than the current model and is the recommended approach. A minimal alternative is to keep the existing logic but route it through the API; the token-based design is preferred."
H2 "8.3 Real-time sync"
P "Supabase Realtime push is retired. The app already polls every few seconds as a fallback, so simply rely on that. If near-instant updates are required later, the API can add Server-Sent Events; for an internal booking tool, short-interval polling is smooth and sufficient."
H2 "8.4 Double-booking rule"
P "The conflict check moves into the booking endpoint, where it becomes authoritative (the browser can no longer bypass it). Use the { roomId, date } index, and wrap the check-and-insert in a MongoDB transaction so two simultaneous requests cannot both win the same slot."

H1 "9. Backend API Design"
P "A small set of Vercel Serverless Functions. All endpoints validate input types (to prevent NoSQL injection), require a valid token (except login), and enforce role permissions."
Tbl @(
  @("Endpoint","Method","Purpose"),
  @("/api/auth/login","POST","Verify credentials, return a token"),
  @("/api/auth/request-reset","POST","Flag a forgotten-password request"),
  @("/api/rooms","GET / POST","List rooms / add a room (admin)"),
  @("/api/rooms/:id","PATCH / DELETE","Edit or remove a room (admin)"),
  @("/api/bookings","GET / POST","List bookings / create (conflict-checked)"),
  @("/api/bookings/:id","PATCH","Edit a booking (conflict-checked)"),
  @("/api/bookings/:id/cancel","POST","Cancel with a reason"),
  @("/api/users","GET / POST","List / create users (admin)"),
  @("/api/users/:id","PATCH / DELETE","Edit, reset password, enable/disable, delete (admin)"),
  @("/api/notifications","GET / POST","Read / create in-app notifications")
)

H1 "10. Data Migration Plan (Zero Data Loss)"
P "The migration is designed to be verifiable and reversible. Supabase is kept intact and read-only as a fallback until MongoDB is proven in production."
H2 "10.1 Steps"
B "1. Announce a short maintenance window (or run in parallel with writes paused) to get a clean, consistent snapshot."
B "2. Back up Supabase: take a full database backup/export, plus a per-table export (CSV or JSON) for the migration script. Keep copies off-site."
B "3. Provision MongoDB Atlas: create the cluster, database, collections, indexes and the counters collection."
B "4. Run the migration script (Node.js): read each table, rename fields to camelCase, set _id to the existing integer id, seed the counters to the current maximum id, and insert into MongoDB. Use upserts so the script is safe to re-run."
B "5. Verify: compare record counts table-by-table against collection-by-collection; spot-check a sample of rooms, bookings and users; confirm relationships (every booking's roomId exists)."
B "6. Point the app to the API/MongoDB via a configuration flag and deploy to a preview environment."
B "7. Smoke-test every flow: login, book (incl. conflict and after-hours rules), edit, cancel, calendar, history/CSV, user management, forgot-password."
B "8. Cut over production by switching the configuration flag; keep Supabase read-only as a fallback for an agreed period (e.g. 2 weeks)."
B "9. Decommission Supabase once the new system is stable."
H2 "10.2 Verification Checklist"
Tbl @(
  @("Check","Pass criteria"),
  @("Record counts","rooms / bookings / users / notifications counts match exactly"),
  @("Referential integrity","Every booking.roomId resolves to a room"),
  @("Id continuity","counters issue the next id without colliding with migrated ids"),
  @("Spot checks","Random sampled records match field-for-field"),
  @("Functional parity","All smoke tests pass on the new backend")
)

H1 "11. MongoDB Atlas Setup"
B "Create a MongoDB Atlas account and a cluster (M0 free tier for testing; a paid tier such as M10 for production)."
B "Create a database user with least-privilege access to the application database only."
B "Configure network access: restrict to the API's egress, or use Atlas's private networking; avoid leaving it open to all IPs in production."
B "Copy the connection string (SRV URI) - this is a secret."
B "Create collections and indexes as defined in Section 7.4."

H1 "12. Environment and Deployment (Vercel)"
B "Add the API as Vercel Serverless Functions in the same repository (an /api folder)."
B "Store secrets as Vercel Environment Variables: MONGODB_URI (connection string) and a token signing secret. Never place these in the front end or in the repository."
B "Pushing to the main branch deploys both the site and the functions together; preview deployments allow safe testing before production."
B "Set the data-layer mode (api) in the front-end config so the app calls the new endpoints."

H1 "13. Testing and Validation"
B "Unit-test the API endpoints (validation, auth, conflict logic)."
B "Run the full functional parity checklist on a preview deployment against a copy of migrated data."
B "Load-check the conflict path with simultaneous bookings to confirm the transaction prevents double-booking."
B "User Acceptance Testing with an administrator and a normal user before cutover."

H1 "14. Cutover and Rollback Strategy"
P "Before cutover, rollback is instant: the configuration flag still points to Supabase, which is untouched. After cutover, Supabase remains read-only as a fallback; if a serious issue appears, switch the flag back and, if needed, replay the small number of new bookings made on MongoDB back into Supabase. Choosing a low-traffic window keeps any such replay tiny."
Tbl @(
  @("Phase","Primary store","Rollback"),
  @("Before cutover","Supabase","No action - already on Supabase"),
  @("At cutover","MongoDB","Flip flag back to Supabase (intact)"),
  @("Stabilisation","MongoDB","Flip back + replay new records (small window)"),
  @("After decommission","MongoDB","Restore from final Supabase backup if ever needed")
)

H1 "15. Security and Compliance"
B "The MongoDB connection string is a full-access secret and lives only in server-side environment variables."
B "All input is type-validated server-side to prevent NoSQL injection (never pass raw user objects as query operators)."
B "Authentication and role checks are enforced in the API, not the browser - a security improvement over the current model."
B "Use least-privilege database users and restrict Atlas network access."
B "Continue to hash passwords; consider a stronger algorithm (e.g. bcrypt) now that hashing can run server-side."
B "Keep handling of personal data (names, emails) in line with POPIA expectations for an internal tool."

H1 "16. Risks and Mitigations"
Tbl @(
  @("Risk","Impact","Mitigation"),
  @("Added backend increases complexity","More to build and maintain","Keep the API small; reuse Vercel; lean on the pluggable data layer"),
  @("Loss of real-time push","Slightly less instant updates","Rely on existing polling; add SSE later if needed"),
  @("Authentication rework","Effort and risk","Move to token-based auth; test thoroughly; phased rollout"),
  @("Race conditions on booking","Double-booking","Conflict check in a MongoDB transaction with the right index"),
  @("Id strategy mistakes","Broken references / collisions","Preserve integer ids as _id; seed counters to current max"),
  @("Data loss during migration","Critical","Backups, verification, parallel run, read-only Supabase fallback"),
  @("Cost of managed MongoDB","Ongoing spend","Start on free/low tier; size up only as needed")
)

H1 "17. Effort, Timeline and Cost (Indicative)"
Tbl @(
  @("Phase","Work","Indicative duration"),
  @("0 - Design","Finalise API, data model, env plan","About 1 week"),
  @("1 - Build","Backend API + 'api' data-layer mode + auth","About 1-2 weeks"),
  @("2 - Migrate","Migration scripts + dry runs + verification","About 1 week"),
  @("3 - Test","Functional parity + UAT","About 1 week"),
  @("4 - Cutover","Go-live + monitoring + fallback period","A few days")
)
P "Indicative total: roughly 4-6 weeks of part-time effort. Cost: MongoDB Atlas free tier for testing; a low paid tier for production. Vercel Serverless Functions are included in the existing hosting. These are planning estimates, not commitments."

H1 "18. Decommissioning Supabase"
B "Only after the new system is stable for the agreed fallback period."
B "Take a final full export/backup of Supabase and store it securely."
B "Remove Supabase keys from configuration and revoke them."
B "Delete the Supabase project (or downgrade) once backups are confirmed."

H1 "19. Appendices"
H2 "Appendix A - Example collection document (booking)"
Code "{"
Code "  _id: 1024,"
Code "  roomId: 3,"
Code "  roomName: 'PPB ROOM',"
Code "  title: 'Credit Review',"
Code "  bookedBy: 'S. Langa',"
Code "  createdBy: 'slanga',"
Code "  date: '2026-06-16',"
Code "  startTime: '15:30',"
Code "  endTime: '16:00',"
Code "  status: 'booked',"
Code "  createdAt: ISODate('2026-06-16T08:00:00Z')"
Code "}"
H2 "Appendix B - Counters pattern (next id)"
Code "// counters: { _id: 'bookings', seq: 1024 }"
Code "// On insert: findOneAndUpdate({_id:'bookings'}, { increment seq by 1 }, {returnDocument:'after', upsert:true})"
H2 "Appendix C - Glossary"
Tbl @(
  @("Term","Meaning"),
  @("BaaS","Backend-as-a-Service (e.g. Supabase)"),
  @("Serverless Function","Small server-side function run on demand (e.g. on Vercel)"),
  @("Atlas","MongoDB's managed cloud database service"),
  @("Connection string","Secret URI granting access to the database"),
  @("JWT","Signed token used to prove who a user is"),
  @("Change Stream","MongoDB feature for reacting to data changes"),
  @("SSE","Server-Sent Events - one-way live updates to the browser"),
  @("NoSQL injection","Attack abusing unchecked input in database queries")
)

# ---- finalise -------------------------------------------------------------
try { $doc.TablesOfContents.Item(1).Update() } catch {}
$doc.SaveAs([ref]$outPath, [ref]16)
$doc.Close()
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($sel) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()
Write-Output "Migration doc created: $outPath"
