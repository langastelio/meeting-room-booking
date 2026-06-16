# Generates the Business Requirements Document (.docx) via Word automation.
$ErrorActionPreference = "Stop"

$outPath = "c:\Users\A267829\OneDrive - Standard Bank\Desktop\PO - PPB\Power Apps\GIT\meeting-room-booking\docs\Meeting-Room-Booking-BRD.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$sel = $word.Selection

# ---- helpers --------------------------------------------------------------
function GoEnd { $sel.EndKey(6) | Out-Null }   # 6 = wdStory
function H1($t){ GoEnd; $sel.Style = "Heading 1"; $sel.ParagraphFormat.Alignment = 0; $sel.TypeText($t); $sel.TypeParagraph() }
function H2($t){ GoEnd; $sel.Style = "Heading 2"; $sel.ParagraphFormat.Alignment = 0; $sel.TypeText($t); $sel.TypeParagraph() }
function H3($t){ GoEnd; $sel.Style = "Heading 3"; $sel.ParagraphFormat.Alignment = 0; $sel.TypeText($t); $sel.TypeParagraph() }
function P($t){ GoEnd; $sel.Style = "Normal"; $sel.ParagraphFormat.Alignment = 0; $sel.Font.Bold = $false; $sel.TypeText($t); $sel.TypeParagraph() }
function B($t){ GoEnd; $sel.Style = "List Bullet"; $sel.TypeText($t); $sel.TypeParagraph() }

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
$sel.Font.Size = 26; $sel.Font.Bold = $true
$sel.TypeText("Business Requirements Document"); $sel.TypeParagraph()
$sel.Font.Size = 16; $sel.Font.Bold = $false
$sel.TypeText("Meeting Room Booking System"); $sel.TypeParagraph()
$sel.Font.Size = 13
$sel.TypeText("PPB Mozambique - Personal & Private Banking"); $sel.TypeParagraph()
$sel.TypeParagraph()
$sel.Font.Size = 11
$sel.TypeText("Document Version: 1.0"); $sel.TypeParagraph()
$sel.TypeText("Status: Baseline (MVP1 deployed on Vercel)"); $sel.TypeParagraph()
$sel.TypeText("Date: June 2026"); $sel.TypeParagraph()
$sel.TypeText("Classification: Internal / Confidential"); $sel.TypeParagraph()
$sel.InsertBreak(7)   # page break

# reset body formatting
$sel.ParagraphFormat.Alignment = 0
$sel.Font.Size = 11; $sel.Font.Bold = $false

# ---- table of contents ----------------------------------------------------
$sel.Style = "Heading 1"; $sel.TypeText("Table of Contents"); $sel.TypeParagraph()
GoEnd
$toc = $doc.TablesOfContents.Add($sel.Range, $true, 1, 3)
GoEnd
$sel.InsertBreak(7)

# ===========================================================================
H1 "1. Document Control"
H2 "1.1 Version History"
Tbl @(
  @("Version","Date","Author","Description"),
  @("0.1","June 2026","Product Owner","Initial draft - scope and functional outline"),
  @("0.9","June 2026","Product Owner","Added NFRs, data model, architecture"),
  @("1.0","June 2026","Product Owner","Baseline approved after MVP1 deployment to Vercel")
)
H2 "1.2 Approvals / Sign-off"
Tbl @(
  @("Role","Name","Responsibility","Signature / Date"),
  @("Business Sponsor","TBD","Funds and authorises the initiative",""),
  @("Product Owner","TBD","Owns requirements and backlog",""),
  @("IT / Security","TBD","Approves security and hosting",""),
  @("Lead Developer","TBD","Confirms technical feasibility","")
)
H2 "1.3 Distribution List"
Tbl @(
  @("Audience","Purpose"),
  @("Business Sponsor / Management","Approval and oversight"),
  @("Administrators","Operational ownership of rooms and users"),
  @("End Users (staff)","Awareness of capabilities"),
  @("IT / Security","Hosting, data protection, integration"),
  @("Development Team","Implementation reference")
)

H1 "2. Executive Summary"
P "The Meeting Room Booking System is a lightweight, web-based application that lets staff of PPB Mozambique reserve meeting rooms, view a shared agenda, and manage bookings in real time. It replaces informal and error-prone methods (verbal agreements, spreadsheets, email chains) with a single, authoritative source of truth that prevents double-booking and provides reporting."
P "The solution is a static web front end (HTML, CSS, JavaScript) hosted on Vercel, backed by a Supabase (PostgreSQL) cloud database. It supports role-based access (Administrator and User), bilingual operation (English and Portuguese), day and night themes, and is fully responsive across desktop, tablet, and mobile."
P "MVP1 is complete and deployed on Vercel. This document baselines the delivered scope and records the agreed future enhancements (MVP2 and beyond), notably email notifications, a utilization dashboard, calendar export (ICS), and stronger authentication."

H1 "3. Introduction"
H2 "3.1 Purpose of this Document"
P "This Business Requirements Document (BRD) defines the business needs, scope, functional and non-functional requirements, business rules, data, and constraints for the Meeting Room Booking System. It is the agreed reference against which the solution is built, tested, and accepted."
H2 "3.2 Project Background"
P "Meeting rooms are a shared, limited resource. Without a central booking tool, rooms are double-booked, meetings are disrupted, and there is no record of usage. The business needed a simple, reliable, low-cost tool that any authorised staff member can use from a browser, with no installation."
H2 "3.3 Scope of this Document"
P "The document covers the business and system requirements for the booking application and its administration. It includes the deployed MVP1 capabilities and the planned roadmap. It does not include detailed source code, low-level design, or test scripts, which are maintained separately."
H2 "3.4 Intended Audience"
P "Business sponsors, the product owner, administrators, the development team, and IT / Security stakeholders."
H2 "3.5 Definitions, Acronyms and Abbreviations"
Tbl @(
  @("Term","Meaning"),
  @("BRD","Business Requirements Document"),
  @("MVP","Minimum Viable Product (a delivery increment)"),
  @("RLS","Row Level Security (database access policy)"),
  @("PII","Personally Identifiable Information"),
  @("POPIA","Protection of Personal Information Act (South Africa)"),
  @("CDN","Content Delivery Network"),
  @("SLA","Service Level Agreement"),
  @("i18n","Internationalisation (multi-language support)"),
  @("CSV","Comma-Separated Values (export format)"),
  @("ICS","iCalendar file format (calendar import)"),
  @("SMTP","Simple Mail Transfer Protocol (email sending)"),
  @("pg_cron","PostgreSQL scheduler used in Supabase"),
  @("SHA-256","Secure Hash Algorithm used to hash passwords"),
  @("Slot","A bookable time interval (30-minute granularity)")
)
H2 "3.6 References"
Tbl @(
  @("Reference","Description"),
  @("System Documentation","Meeting-Room-Booking-System-Documentation.docx"),
  @("System Presentation","Meeting-Room-Booking-System-Presentation.pptx"),
  @("Database schema","supabase/schema.sql"),
  @("Email setup (MVP2)","supabase/email-setup.sql"),
  @("Hosting","Vercel deployment connected to the Git repository")
)

H1 "4. Business Context"
H2 "4.1 Business Problem"
B "Rooms are double-booked because there is no shared, authoritative schedule."
B "Staff waste time finding a free room and resolving clashes."
B "No record exists of who booked what, or why a meeting was cancelled."
B "No visibility of room utilisation for planning."
H2 "4.2 Business Objectives"
B "Provide a single, reliable source of truth for room availability."
B "Eliminate double-booking through enforced conflict checks."
B "Give administrators control over rooms and user access."
B "Provide reporting and an auditable history of bookings and cancellations."
B "Be easy to use, multilingual (EN/PT), and accessible from any device."
H2 "4.3 Goals and Success Metrics"
Tbl @(
  @("Goal","Success Metric / KPI"),
  @("Eliminate double-booking","Zero overlapping confirmed bookings per room"),
  @("Adoption","Majority of meetings booked through the system"),
  @("Efficiency","Reduced time and email traffic to secure a room"),
  @("Accountability","100% of cancellations carry a recorded reason"),
  @("Availability","Application reachable during business hours")
)
H2 "4.4 Stakeholders"
Tbl @(
  @("Stakeholder","Interest / Role"),
  @("Business Sponsor","Authorises and funds the initiative"),
  @("Product Owner","Defines and prioritises requirements"),
  @("Administrators","Manage rooms and user accounts; full visibility"),
  @("End Users","Book and manage their own meetings"),
  @("IT / Security","Hosting, data protection, integrations"),
  @("Facilities / Office Management","Room inventory and utilisation insight")
)
H2 "4.5 Assumptions"
B "Users have a modern web browser and network access."
B "Each user is issued an account by an administrator."
B "Business hours are 08:00 to 17:30 (close of business)."
B "The Supabase database and Vercel hosting remain available."
B "Email notifications are deferred to MVP2."
H2 "4.6 Constraints"
B "The front end is a static site (no server-side application code on the host)."
B "Authentication is application-level (custom), not enterprise SSO, in MVP1."
B "Bookings are limited to the 08:00-17:30 window in 30-minute granularity."
B "Email cannot be sent from the browser; it requires a server component (MVP2)."
H2 "4.7 Dependencies"
B "Supabase (PostgreSQL, Realtime, Row Level Security)."
B "Vercel static hosting and CDN."
B "supabase-js client library and SheetJS (seed import), loaded via CDN."

H1 "5. Scope"
H2 "5.1 In Scope (MVP1 - Delivered)"
B "Secure login with role-based access (Administrator, User)."
B "Room management (add, edit, activate/deactivate, delete)."
B "Booking creation with double-booking prevention and operating-hour limits."
B "Alternative room/time suggestions on a clash."
B "Recurring bookings (daily weekdays, weekly, monthly)."
B "Edit and cancel bookings (with mandatory cancellation reason)."
B "Shared Calendar with Week, Day and Month views, click-to-book, and meeting owner display."
B "In-app reminders (30/15/5 minutes) and cancellation notices."
B "History and reporting with date filters and CSV export."
B "User management (create, edit, search, reset password, enable/disable, delete)."
B "Bilingual English/Portuguese, day/night theme, responsive design."
B "First-login guided tour, idle auto-logout, per-page favicons."
H2 "5.2 Out of Scope (MVP1) / Planned (MVP2+)"
B "Email notifications (Outlook mailbox + Supabase scheduler) - MVP2."
B "Utilisation dashboard / analytics (most-booked rooms, peak hours, cancellation rate) - MVP2."
B "Calendar export to ICS for Outlook/Google Calendar - MVP2."
B "Password complexity rules and self-service 'forgot password' flow - MVP2."
B "Attendees/invitees per meeting and check-in/no-show release - MVP3."
B "Enterprise single sign-on (SSO) and migration to Supabase Auth - MVP3."

H1 "6. User Roles and Access"
H2 "6.1 Roles"
P "The system defines two roles. The first account created in the system automatically becomes the Administrator."
Tbl @(
  @("Capability","Administrator","User"),
  @("Sign in","Yes","Yes"),
  @("Book a room (for self)","Yes","Yes"),
  @("Edit / cancel own bookings","Yes","Yes"),
  @("Cancel any booking","Yes","No"),
  @("View shared Calendar","Yes","Yes"),
  @("Manage Rooms","Yes","No"),
  @("Manage Users","Yes","No"),
  @("View History / Reports","Yes","No")
)
H2 "6.2 Personas"
B "Administrator (e.g. Office Manager): sets up rooms, manages staff accounts, oversees usage and resolves conflicts."
B "Staff User (e.g. Banker): books rooms for meetings, manages own bookings, checks the agenda."

H1 "7. Functional Requirements"
H2 "7.1 Authentication and Access Control"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-A1","Users sign in with a username and password.","Must"),
  @("FR-A2","Passwords are stored only as salted SHA-256 hashes, never in plain text.","Must"),
  @("FR-A3","The first account created becomes the Administrator (bootstrap).","Must"),
  @("FR-A4","Accounts created by an admin use a temporary password that the user must change on first login.","Must"),
  @("FR-A5","Access is role-based; admin-only pages are hidden and protected from Users.","Must"),
  @("FR-A6","A session is held per browser; the user is automatically signed out after 15 minutes of inactivity.","Must"),
  @("FR-A7","Logout clears the session and idle timers.","Must"),
  @("FR-A8","User input is validated/whitelisted and database access is parameterised to prevent injection.","Must")
)
H2 "7.2 User Management (Administrator)"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-U1","Create a user with full name, username, email, temporary password, and role.","Must"),
  @("FR-U2","Edit a user (name, email, role) via a focused dialog.","Must"),
  @("FR-U3","Search and sort the user list (datatable behaviour).","Should"),
  @("FR-U4","Reset a user password (sets a temporary password and forces a reset at next login).","Must"),
  @("FR-U5","Enable or disable a user account.","Must"),
  @("FR-U6","Delete a user.","Must"),
  @("FR-U7","An admin cannot change or remove their own role (self-lockout protection).","Should")
)
H2 "7.3 Room Management (Administrator - 'Manage Rooms')"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-R1","Add a room with name, location, capacity, and facilities.","Must"),
  @("FR-R2","Edit room details.","Must"),
  @("FR-R3","Activate or deactivate a room.","Must"),
  @("FR-R4","Delete a room.","Should"),
  @("FR-R5","Only active rooms are available for booking.","Must")
)
H2 "7.4 Booking Management"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-B1","Create a booking selecting room, title, date, start and end time.","Must"),
  @("FR-B2","The booker is the signed-in user and is not editable; the person's name is shown.","Must"),
  @("FR-B3","Prevent double-booking: no two confirmed meetings may overlap in the same room on the same date; checked against the latest data.","Must"),
  @("FR-B4","Bookings must end by 17:30; start must be before end.","Must"),
  @("FR-B5","On a clash, suggest free rooms at the same time and alternative free times.","Should"),
  @("FR-B6","Never suggest a time that has already passed for same-day bookings.","Must"),
  @("FR-B7","Support recurring bookings: daily (weekdays), weekly, monthly, until a chosen date, with a per-occurrence result summary.","Should"),
  @("FR-B8","Edit an existing booking (room, title, date, time) with the same validation rules.","Must"),
  @("FR-B9","Cancel a booking with a mandatory reason captured in a dialog.","Must"),
  @("FR-B10","Admins may cancel any booking; users may cancel only their own.","Must"),
  @("FR-B11","'My bookings only' filter on the upcoming list, remembered across visits.","Should"),
  @("FR-B12","The upcoming list excludes cancelled and already-ended meetings.","Must")
)
H2 "7.5 Calendar"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-C1","Provide Week, Day and Month views of booked meetings.","Must"),
  @("FR-C2","Filter the agenda by a single room or show all rooms.","Must"),
  @("FR-C3","Navigate previous/today/next by the active view's unit.","Must"),
  @("FR-C4","Click an empty slot to open a pre-filled booking dialog.","Must"),
  @("FR-C5","Click a meeting to view details and, where permitted, edit or cancel it.","Must"),
  @("FR-C6","Display the meeting owner (booked-by) on each meeting.","Must"),
  @("FR-C7","In Month view, show meeting chips per day and drill into a Day view on click.","Should"),
  @("FR-C8","Keep the agenda in sync across browsers (live update / polling).","Must")
)
H2 "7.6 Notifications and Reminders"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-N1","Remind the meeting owner 30, 15 and 5 minutes before their meeting (in-app toast, and OS notification if permitted).","Should"),
  @("FR-N2","Remove meetings from the upcoming list once they have been held.","Must"),
  @("FR-N3","When an admin cancels another user's meeting, notify the owner in-app with the reason.","Must"),
  @("FR-N4","Email notifications (confirmation, reminders, cancellation) via Outlook + Supabase scheduler.","MVP2")
)
H2 "7.7 History and Reporting (Administrator)"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-H1","List meetings that have been held or cancelled, newest first.","Must"),
  @("FR-H2","Filter the report by date range.","Must"),
  @("FR-H3","Show status, who cancelled, and the cancellation reason.","Must"),
  @("FR-H4","Export the report to CSV.","Must"),
  @("FR-H5","Utilisation dashboard: most-booked rooms, peak hours, cancellation rate.","MVP2")
)
H2 "7.8 Localisation, Theming and Usability"
Tbl @(
  @("ID","Requirement","Priority"),
  @("FR-L1","Toggle between English and Portuguese; the choice persists and translates all text and dates.","Must"),
  @("FR-T1","Toggle day/night theme; the choice persists and applies without a flash on load.","Should"),
  @("FR-O1","Offer a first-login guided tour that the user can accept or decline.","Could"),
  @("FR-G1","The interface is responsive across desktop, tablet and mobile.","Must"),
  @("FR-G2","Each page has a favicon and clear branding (Meeting Room Booking - PPB Mozambique).","Could")
)

H1 "8. Business Rules"
Tbl @(
  @("ID","Business Rule"),
  @("BR-1","Only one meeting may occupy a given room and time; overlapping times are blocked."),
  @("BR-2","Meetings cannot end after 17:30 (close of business)."),
  @("BR-3","A meeting's start time must be before its end time."),
  @("BR-4","Bookings operate within 08:00-17:30, in 30-minute granularity on the calendar."),
  @("BR-5","The first account created becomes the Administrator."),
  @("BR-6","A temporary password must be changed at first login."),
  @("BR-7","Only administrators manage rooms, users and history; users may only book."),
  @("BR-8","Administrators may cancel any meeting; users only their own; a reason is mandatory."),
  @("BR-9","Daily recurrence covers weekdays only; a series is capped (max 60 occurrences)."),
  @("BR-10","Past time slots are never offered for same-day bookings."),
  @("BR-11","A cancelled meeting frees the room and moves to History."),
  @("BR-12","The booker identity is the signed-in user and cannot be edited.")
)

H1 "9. Key Use Cases"
H2 "9.1 Book a Room"
P "Actor: User. Pre-condition: signed in, at least one active room exists."
B "1. User opens Book a Room (or clicks a free calendar slot)."
B "2. User selects room, enters title, date, start and end time."
B "3. System validates hours and checks for clashes against the latest data."
B "4. If free, the booking is saved and appears for all users; otherwise alternatives are suggested."
H2 "9.2 Cancel a Meeting"
P "Actor: User (own) or Administrator (any)."
B "1. User selects Cancel on a meeting."
B "2. System requires a reason in a dialog."
B "3. The meeting is cancelled, the room is freed, and the record moves to History."
B "4. If an admin cancelled another user's meeting, the owner is notified with the reason."
H2 "9.3 Create a User"
P "Actor: Administrator."
B "1. Admin enters full name, username, email, temporary password, and role."
B "2. System creates the account flagged to force a password reset at first login."

H1 "10. Non-Functional Requirements"
Tbl @(
  @("Category","Requirement"),
  @("Usability","Clean, self-explanatory interface; common tasks achievable in a few clicks; modal dialogs avoid scrolling."),
  @("Responsiveness","Fully usable on desktop, tablet and mobile; tables scroll/adapt on small screens."),
  @("Accessibility","Semantic markup, readable contrast in both themes, keyboard-operable forms."),
  @("Performance","Static assets served from Vercel's CDN for fast first load; data queries are lightweight."),
  @("Availability","Depends on Vercel and Supabase; targeted to be available during business hours."),
  @("Scalability","Supabase PostgreSQL scales to the organisation's room and user counts."),
  @("Reliability / Sync","Changes propagate to all browsers via realtime plus periodic polling."),
  @("Security","Salted SHA-256 password hashing, role-based access, input whitelisting, Row Level Security; recommended upgrade to Supabase Auth."),
  @("Privacy / Data Protection","Minimal PII (name, username, email); handled in line with POPIA expectations for an internal tool."),
  @("Compatibility","Modern evergreen browsers (Chrome, Edge, Firefox, Safari)."),
  @("Maintainability","Modular vanilla JavaScript, centralised translation dictionary, documented schema."),
  @("Localisability","All user-facing text is translatable; English and Portuguese provided."),
  @("Auditability","History retains held and cancelled meetings with reasons and who cancelled.")
)

H1 "11. Data Requirements"
H2 "11.1 Entities"
B "Rooms - the bookable meeting rooms."
B "Bookings - reservations (active, held, or cancelled)."
B "App Users - accounts and roles."
B "Notifications - in-app messages to users."
B "Email Outbox - queued emails (MVP2)."
H2 "11.2 Rooms"
Tbl @(
  @("Field","Type","Notes"),
  @("id","number","Unique identifier"),
  @("name","text","Room name (required)"),
  @("location","text","Where the room is"),
  @("capacity","number","Seats"),
  @("facilities","text","Comma-separated (e.g. Projector, Whiteboard)"),
  @("active","boolean","Only active rooms are bookable")
)
H2 "11.3 Bookings"
Tbl @(
  @("Field","Type","Notes"),
  @("id","number","Unique identifier"),
  @("room_id","number","The booked room"),
  @("room_name","text","Room name snapshot"),
  @("title","text","Meeting title"),
  @("booked_by","text","Display name of the booker"),
  @("created_by","text","Username of the creator"),
  @("date","date","Meeting date"),
  @("start_time / end_time","time","Within 08:00-17:30"),
  @("status","text","booked or cancelled"),
  @("cancelled_by / cancel_reason / cancelled_at","text/time","Cancellation audit"),
  @("created_at","timestamp","When created"),
  @("remind_30/15/5_sent","boolean","Reminder flags (MVP2)")
)
H2 "11.4 App Users"
Tbl @(
  @("Field","Type","Notes"),
  @("id","number","Unique identifier"),
  @("username","text","Unique login (whitelisted characters)"),
  @("name","text","Person's full name (shown as booker)"),
  @("email","text","Optional; used for email in MVP2"),
  @("password_hash","text","Salted SHA-256 hash"),
  @("role","text","admin or user"),
  @("active","boolean","Disabled accounts cannot sign in"),
  @("must_reset","boolean","Force password change at next login"),
  @("created_at","timestamp","When created")
)
H2 "11.5 Data Seeding and Retention"
B "Initial rooms can be seeded from an attached Excel workbook (data/database.xlsx)."
B "History is retained indefinitely for reporting; cancelled records are kept (soft-cancel), not deleted."

H1 "12. System Architecture and Technical Overview"
H2 "12.1 Architecture"
P "The application is a static single-page-style front end that talks directly to a Supabase cloud database. There is no custom application server; the host (Vercel) serves files over a global CDN, and Supabase provides the data, security policies, and realtime updates."
Tbl @(
  @("Layer","Technology"),
  @("Front end","HTML5, CSS3, vanilla JavaScript (no framework)"),
  @("Client libraries","supabase-js v2, SheetJS (Excel seed) via CDN"),
  @("Hosting","Vercel (static deployment, CDN, automatic HTTPS)"),
  @("Database","Supabase - PostgreSQL with Row Level Security and Realtime"),
  @("Authentication","Application-level (custom), recommended upgrade to Supabase Auth"),
  @("Configuration","js/config.js holds the Supabase URL and public (anon) key only")
)
H2 "12.2 Synchronisation"
P "All browsers stay in step using Supabase Realtime push plus a periodic poll (every few seconds), so a booking made by one person is visible to others shortly after, and conflict checks always run against the freshest data."
H2 "12.3 Deployment on Vercel"
B "The Git repository is connected to Vercel; pushing to the main branch triggers an automatic deployment."
B "As a static site, no build step is required (framework preset 'Other')."
B "Vercel provides HTTPS, a global CDN, preview deployments, and instant rollbacks to previous versions."
B "Configuration (Supabase URL and public key) lives in the client config; no secret keys are placed in the front end."
B "A custom domain can be attached through Vercel if required."
H2 "12.4 Environments"
Tbl @(
  @("Environment","Purpose"),
  @("Production","Live site on Vercel used by staff"),
  @("Preview","Automatic per-change deployments for review"),
  @("Local","Developer machine for development and testing")
)

H1 "13. Integration Requirements"
Tbl @(
  @("Integration","Description","Status"),
  @("Supabase","Primary data store, security, and realtime sync.","Live"),
  @("Web Notifications API","OS-level reminder pop-ups (with permission).","Live"),
  @("Email (Outlook + Supabase cron)","Server-side sending of confirmations, reminders, cancellations via an outbox, Edge Function and scheduler.","MVP2"),
  @("Calendar export (ICS)","Download meetings to import into Outlook/Google Calendar.","MVP2")
)

H1 "14. Security and Compliance"
B "Passwords are never stored or transmitted in plain text; they are salted and SHA-256 hashed in the browser before storage."
B "Access is role-based; administrative pages are both hidden and protected by guards."
B "Sessions auto-expire after 15 minutes of inactivity, scoped to the browser session."
B "Inputs are whitelisted and database access is parameterised to mitigate injection."
B "Row Level Security is enabled on Supabase tables; the front end uses only the public (anon) key."
P "Recommendations for hardening (roadmap): migrate to Supabase Auth for proper credential management; tighten RLS policies for write operations; enforce password complexity; rotate any credentials that may have been shared during development; consider SSO for enterprise alignment."

H1 "15. Reporting and Analytics"
B "History page: held and cancelled meetings, filterable by date, exportable to CSV, including cancellation reasons and who cancelled."
B "Planned dashboard (MVP2): most-booked rooms, peak booking hours, and cancellation rate, visualised from existing data."

H1 "16. Assumptions, Risks and Mitigations"
Tbl @(
  @("Risk","Impact","Likelihood","Mitigation"),
  @("Client-side authentication model","Weaker than server-side auth","Medium","Plan migration to Supabase Auth; keep RLS enabled"),
  @("Public anon key with permissive policies","Potential unauthorised writes","Medium","Tighten RLS; restrict write policies in MVP2/3"),
  @("Reminders depend on an open browser","Missed in-app reminders","Medium","Deliver email reminders via server scheduler (MVP2)"),
  @("Credentials shared during development","Exposure","Low","Rotate all shared credentials; keep secrets server-side"),
  @("Single cloud region latency","Slower for distant users","Low","Vercel CDN for assets; acceptable for internal use")
)

H1 "17. Acceptance Criteria (Summary)"
Tbl @(
  @("Area","Acceptance Criterion"),
  @("Login / Roles","A user can sign in; admins see all pages, users only Book and Calendar; first login forces a password reset."),
  @("No double-booking","Two overlapping bookings for the same room cannot both be saved."),
  @("Operating hours","A booking ending after 17:30 is rejected."),
  @("Edit / Cancel","Owners (and admins) can edit; cancellation requires a reason and moves the record to History."),
  @("Calendar","Week/Day/Month views render bookings with owner shown; an empty slot opens a pre-filled booking."),
  @("Reporting","History can be filtered by date and exported to CSV."),
  @("Localisation","Switching to Portuguese translates the whole interface and dates."),
  @("Responsiveness","All pages are usable on a mobile screen.")
)

H1 "18. Release Plan / Roadmap"
H2 "18.1 MVP1 - Delivered (Deployed on Vercel)"
B "Authentication, roles, room management, booking with conflict prevention, suggestions, recurrence, edit/cancel, calendar (week/day/month), in-app reminders, history + CSV, user management, EN/PT, themes, responsive, tour, idle logout."
H2 "18.2 MVP2 - Planned"
B "Email notifications (Outlook mailbox + Supabase Edge Function + pg_cron outbox)."
B "Utilisation dashboard (most-booked rooms, peak hours, cancellation rate)."
B "Calendar export to ICS."
B "Password complexity rules and self-service / admin 'forgot password' flow."
B "'My bookings only' filter on the Calendar."
H2 "18.3 MVP3 - Future"
B "Attendees/invitees per meeting and check-in / no-show room release."
B "Room amenity-based search when booking."
B "Migration to Supabase Auth and RLS hardening; optional SSO."

H1 "19. Appendices"
H2 "Appendix A - Operating Parameters"
Tbl @(
  @("Parameter","Value"),
  @("Business hours","08:00 - 17:30"),
  @("Slot granularity (calendar)","30 minutes"),
  @("Idle auto-logout","15 minutes"),
  @("In-app reminders","30, 15 and 5 minutes before start"),
  @("Recurrence cap","60 occurrences per series"),
  @("Languages","English, Portuguese")
)
H2 "Appendix B - Open Decisions"
Tbl @(
  @("Decision","Owner","Status"),
  @("Email provider (Outlook SMTP vs transactional API)","Product Owner / IT","Open (MVP2)"),
  @("Migrate to Supabase Auth","IT / Security","Open (MVP3)"),
  @("Custom domain on Vercel","IT","Open")
)

# ---- finalise -------------------------------------------------------------
try { $doc.TablesOfContents.Item(1).Update() } catch {}
$doc.SaveAs([ref]$outPath, [ref]16)   # 16 = wdFormatDocumentDefault (.docx)
$doc.Close()
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($sel) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()
Write-Output "BRD created: $outPath"
