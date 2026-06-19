/* calendar.js — agenda of booked meetings (week / day / month) + click-to-book + edit */

const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const byId = (id) => document.getElementById(id);

const OPEN_MIN = 8 * 60, CLOSE_MIN = 17 * 60 + 30, STEP = 30;
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const locale = () => (typeof I18N !== "undefined" && I18N.current() === "pt" ? "pt-PT" : "en-GB");

function startOfWeek(date) {
  const x = new Date(date);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

let cursor = new Date();          // the date in focus (drives every view)
let viewMode = "week";            // "week" | "day" | "month"
let roomFilter = "";              // room id as string; "" = all rooms

const grid = byId("calGrid");
const weekLabel = byId("calWeekLabel");
const roomSel = byId("calRoom");

const M = {
  overlay: byId("calModal"),
  title: byId("calModalTitle"),
  body: byId("calModalBody"),
  alert: byId("calModalAlert"),
  close: byId("calModalClose"),
  action: byId("calModalAction"),
};

function closeModal() { M.overlay.hidden = true; M.action.onclick = null; }
function modalAlert(msg) { M.alert.textContent = msg; M.alert.className = "alert show err"; }
function openModal(titleText, bodyHtml, actionLabel, actionFn) {
  M.title.textContent = titleText;
  M.body.innerHTML = bodyHtml;
  M.alert.className = "alert";
  if (actionLabel) { M.action.style.display = ""; M.action.textContent = actionLabel; M.action.onclick = actionFn; }
  else { M.action.style.display = "none"; M.action.onclick = null; }
  M.overlay.hidden = false;
}
M.close.onclick = closeModal;
M.overlay.addEventListener("click", (e) => { if (e.target === M.overlay) closeModal(); });

function canCancel(b, me) {
  if (!me) return false;
  if (me.role === "admin") return true;
  if (b.createdBy && b.createdBy === me.username) return true;
  if (!b.createdBy && b.bookedBy && b.bookedBy === (me.name || me.username)) return true;
  return false;
}

function buildRoomSelect() {
  const rooms = DB.getActiveRooms();
  roomSel.innerHTML =
    `<option value="">${T("cal.allRooms")}</option>` +
    rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
  // Default to the first room for a clean single-room agenda.
  if (!roomFilter && rooms.length) roomFilter = String(rooms[0].id);
  roomSel.value = roomFilter;
}

// Active (non-cancelled) bookings honouring the room filter.
function activeBookings() {
  return DB.getBookings().filter(
    (b) => b.status !== "cancelled" && (!roomFilter || String(b.roomId) === roomFilter)
  );
}

// One meeting block, showing title AND who booked it (and room when "all rooms").
function evHTML(b) {
  const owner = `👤 ${esc(b.bookedBy || "—")}${roomFilter ? "" : " · " + esc(b.roomName)}`;
  return `<div class="cal-ev" data-id="${b.id}" title="${esc(b.title)} · ${esc(b.bookedBy)} (${esc(b.startTime)}–${esc(b.endTime)})">
    <span class="cal-ev-title">${esc(b.title)}</span>
    <span class="cal-ev-owner">${owner}</span>
  </div>`;
}

// Shared time-grid body for week (7 days) and day (1 day) views.
function timeGridHTML(days) {
  const todayISO = localISO(new Date());
  const bookings = activeBookings();

  let html = `<div class="cal-head cal-corner"></div>`;
  days.forEach((d) => {
    const today = localISO(d) === todayISO ? "today" : "";
    html += `<div class="cal-head ${today}">${d.toLocaleDateString(locale(), { weekday: "short" })}<br>${pad(d.getDate())}/${pad(d.getMonth() + 1)}</div>`;
  });

  for (let m = OPEN_MIN; m < CLOSE_MIN; m += STEP) {
    html += `<div class="cal-time">${hhmm(m)}</div>`;
    days.forEach((d) => {
      const dateISO = localISO(d);
      const covering = bookings.filter((b) => b.date === dateISO && toMin(b.startTime) < m + STEP && toMin(b.endTime) > m);
      if (covering.length) {
        const starting = covering.filter((b) => toMin(b.startTime) >= m && toMin(b.startTime) < m + STEP);
        if (starting.length) {
          html += `<div class="cal-cell">` + starting.map(evHTML).join("") + `</div>`;
        } else {
          html += `<div class="cal-cell cal-busy" data-id="${covering[0].id}"></div>`;
        }
      } else {
        html += `<div class="cal-cell cal-slot" data-date="${dateISO}" data-min="${m}"></div>`;
      }
    });
  }
  return html;
}

function wireGrid() {
  grid.querySelectorAll(".cal-slot").forEach((c) =>
    c.addEventListener("click", () => openBook(c.dataset.date, Number(c.dataset.min)))
  );
  grid.querySelectorAll("[data-id]").forEach((c) =>
    c.addEventListener("click", () => openDetails(c.dataset.id))
  );
}

function renderWeek() {
  const ws = startOfWeek(cursor);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); days.push(d); }
  weekLabel.textContent =
    `${days[0].toLocaleDateString(locale(), { day: "2-digit", month: "short" })} – ` +
    `${days[6].toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" })}`;
  grid.className = "cal-grid week";
  grid.innerHTML = timeGridHTML(days);
  wireGrid();
}

function renderDay() {
  const d = new Date(cursor);
  weekLabel.textContent = d.toLocaleDateString(locale(), { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  grid.className = "cal-grid day";
  grid.innerHTML = timeGridHTML([d]);
  wireGrid();
}

function renderMonth() {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  weekLabel.textContent = cursor.toLocaleDateString(locale(), { month: "long", year: "numeric" });

  const start = startOfWeek(new Date(year, month, 1)); // Monday on/before the 1st
  const todayISO = localISO(new Date());
  const bookings = activeBookings();

  // weekday headers (Mon..Sun)
  let html = "";
  const wd = new Date(start);
  for (let i = 0; i < 7; i++) {
    html += `<div class="cal-head">${wd.toLocaleDateString(locale(), { weekday: "short" })}</div>`;
    wd.setDate(wd.getDate() + 1);
  }

  // 6 weeks × 7 days
  const day = new Date(start);
  for (let i = 0; i < 42; i++) {
    const dateISO = localISO(day);
    const inMonth = day.getMonth() === month;
    const today = dateISO === todayISO ? "today" : "";
    const dayB = bookings
      .filter((b) => b.date === dateISO)
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    const chips = dayB.slice(0, 3).map((b) =>
      `<div class="cal-mchip" data-id="${b.id}" title="${esc(b.title)} · ${esc(b.bookedBy)} (${esc(b.startTime)}–${esc(b.endTime)})">${esc(b.startTime)} ${esc(b.title)}</div>`
    ).join("");
    const more = dayB.length > 3 ? `<div class="cal-more">+${dayB.length - 3} …</div>` : "";
    html += `<div class="cal-mcell ${inMonth ? "" : "cal-mout"} ${today}" data-goday="${dateISO}">
      <div class="cal-mdate">${day.getDate()}</div>${chips}${more}</div>`;
    day.setDate(day.getDate() + 1);
  }

  grid.className = "cal-grid month";
  grid.innerHTML = html;

  // Click a chip → meeting details; click anywhere else in a day → open that day.
  grid.querySelectorAll(".cal-mchip").forEach((c) =>
    c.addEventListener("click", (e) => { e.stopPropagation(); openDetails(c.dataset.id); })
  );
  grid.querySelectorAll("[data-goday]").forEach((c) =>
    c.addEventListener("click", () => { cursor = new Date(c.dataset.goday + "T00:00:00"); setView("day"); })
  );
}

function render() {
  if (viewMode === "day") renderDay();
  else if (viewMode === "month") renderMonth();
  else renderWeek();
  updateViewButtons();
}

function updateViewButtons() {
  [["calWeek", "week"], ["calDay", "day"], ["calMonth", "month"]].forEach(([id, v]) => {
    const b = byId(id);
    if (b) b.classList.toggle("active", viewMode === v);
  });
}

function setView(v) { viewMode = v; render(); }

function openBook(dateISO, startMin) {
  const rooms = DB.getActiveRooms();
  if (!rooms.length) return;
  const endMin = Math.min(startMin + STEP, CLOSE_MIN);
  const roomOpts = rooms.map((r) =>
    `<option value="${r.id}" ${String(r.id) === roomFilter ? "selected" : ""}>${esc(r.name)}</option>`
  ).join("");

  const body = `
    <label>${T("label.room")}</label>
    <select id="cmRoom">${roomOpts}</select>
    <label>${T("label.title")}</label>
    <input id="cmTitle" type="text" placeholder="${T("ph.title")}" />
    <div class="cal-detail-row" style="margin-top:8px;"><b>${T("label.date")}:</b> ${esc(dateISO)}</div>
    <div class="row">
      <div><label>${T("label.start")}</label><input id="cmStart" type="time" min="08:00" max="17:00" value="${hhmm(startMin)}" /></div>
      <div><label>${T("label.end")}</label><input id="cmEnd" type="time" min="08:30" max="17:30" value="${hhmm(endMin)}" /></div>
    </div>`;

  openModal(T("cal.newMeeting"), body, T("btn.reserve"), async () => {
    const me = typeof Auth !== "undefined" ? Auth.session() : null;
    const title = byId("cmTitle").value.trim();
    if (!title) return modalAlert(T("label.title"));
    const r = await DB.addBooking({
      roomId: byId("cmRoom").value,
      title,
      bookedBy: me ? me.name || me.username : "",
      createdBy: me ? me.username : null,
      date: dateISO,
      startTime: byId("cmStart").value,
      endTime: byId("cmEnd").value,
    });
    if (!r.ok) return modalAlert(r.error);
    closeModal();
    await DB.refresh();
    render();
  });
}

// Edit an existing meeting (room / title / date / time) — owner or admin only.
function openEdit(b) {
  const rooms = DB.getActiveRooms();
  const roomOpts = rooms.map((r) =>
    `<option value="${r.id}" ${Number(r.id) === Number(b.roomId) ? "selected" : ""}>${esc(r.name)}</option>`
  ).join("");

  const body = `
    <label>${T("label.room")}</label>
    <select id="cmRoom">${roomOpts}</select>
    <label>${T("label.title")}</label>
    <input id="cmTitle" type="text" value="${esc(b.title)}" />
    <label>${T("label.date")}</label>
    <input id="cmDate" type="date" value="${esc(b.date)}" />
    <div class="row">
      <div><label>${T("label.start")}</label><input id="cmStart" type="time" min="08:00" max="17:00" value="${esc(b.startTime)}" /></div>
      <div><label>${T("label.end")}</label><input id="cmEnd" type="time" min="08:30" max="17:30" value="${esc(b.endTime)}" /></div>
    </div>`;

  openModal(T("cal.editMeeting"), body, T("btn.saveChanges"), async () => {
    const title = byId("cmTitle").value.trim();
    if (!title) return modalAlert(T("label.title"));
    const r = await DB.updateBooking(b.id, {
      roomId: byId("cmRoom").value,
      title,
      date: byId("cmDate").value,
      startTime: byId("cmStart").value,
      endTime: byId("cmEnd").value,
    });
    if (!r.ok) return modalAlert(r.error);
    closeModal();
    await DB.refresh();
    render();
  });
}

function openDetails(id) {
  const b = DB.getBookings().find((x) => String(x.id) === String(id));
  if (!b) return;
  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  const can = canCancel(b, me);

  let body =
    `<div class="cal-detail-row"><b>${T("label.title")}:</b> ${esc(b.title)}</div>` +
    `<div class="cal-detail-row"><b>${T("th.room")}:</b> ${esc(b.roomName)}</div>` +
    `<div class="cal-detail-row"><b>${T("label.date")}:</b> ${esc(b.date)}</div>` +
    `<div class="cal-detail-row"><b>${T("th.time")}:</b> ${esc(b.startTime)}–${esc(b.endTime)}</div>` +
    `<div class="cal-detail-row"><b>${T("cal.owner")}:</b> ${esc(b.bookedBy)}</div>`;
  if (can) {
    body += `<div class="btn-bar" style="margin-top:12px;"><button class="ghost" id="cmEditBtn" type="button">✎ ${T("btn.edit")}</button></div>`;
    body += `<div class="cal-modal-field"><label>${T("label.reason")}</label><input id="cmReason" type="text" placeholder="${T("ph.reason")}" /></div>`;
  }

  openModal(T("cal.details"), body, can ? T("btn.cancelMeeting") : null, can ? async () => {
    const reason = byId("cmReason").value.trim();
    if (!reason) return modalAlert(T("cancel.reasonRequired"));
    await DB.cancelBooking(b.id, { reason, cancelledBy: me ? me.name || me.username : "" });
    if (me && me.role === "admin" && b.createdBy && b.createdBy !== me.username &&
        typeof Notify !== "undefined" && Notify.enabled()) {
      await Notify.create(b.createdBy,
        `Your meeting "${b.title}" in ${b.roomName} on ${b.date} (${b.startTime}–${b.endTime}) was cancelled by ${me.name || me.username}. Reason: ${reason}`);
    }
    closeModal();
    await DB.refresh();
    render();
  } : null);

  // "Edit" button inside the details modal swaps over to the edit form.
  const editBtn = byId("cmEditBtn");
  if (editBtn) editBtn.onclick = () => openEdit(b);
}

// ---- export to .ics (drops into Outlook / Google Calendar) ----
function icsEscape(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// Local floating time stamp: YYYYMMDDTHHMMSS (no timezone = the reader's local time).
function icsDateTime(dateISO, hhmmStr) {
  return `${dateISO.replace(/-/g, "")}T${String(hhmmStr).replace(":", "")}00`;
}
function exportICS() {
  const rooms = DB.getActiveRooms();
  const roomName = roomFilter ? (rooms.find((r) => String(r.id) === roomFilter) || {}).name : null;
  const bookings = activeBookings().sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meeting Room Booking//PPB//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  bookings.forEach((b) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:mrb-${b.id}@meeting-room-booking`);
    lines.push(`SUMMARY:${icsEscape(b.title)}`);
    lines.push(`DTSTART:${icsDateTime(b.date, b.startTime)}`);
    lines.push(`DTEND:${icsDateTime(b.date, b.endTime)}`);
    if (b.roomName) lines.push(`LOCATION:${icsEscape(b.roomName)}`);
    if (b.bookedBy) lines.push(`DESCRIPTION:${icsEscape(T("cal.owner") + ": " + b.bookedBy)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = roomName ? `meetings-${roomName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics` : "meetings-all-rooms.ics";
  a.click();
  URL.revokeObjectURL(url);
}

// ---- print a schedule (per room when filtered, grouped by room when "All rooms") ----
// Date span follows the current view: the focused day, week (Mon–Sun) or whole month.
function printRange() {
  if (viewMode === "day") { const d = new Date(cursor); return { start: d, end: d }; }
  if (viewMode === "month") {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
  }
  const ws = startOfWeek(cursor);
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  return { start: ws, end: we };
}

const fmtPrintDay = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(locale(), { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

function scheduleTableHTML(list) {
  const head = `<tr><th>${T("label.date")}</th><th>${T("th.time")}</th><th>${T("th.meeting")}</th><th>${T("cal.owner")}</th></tr>`;
  const rows = list.map((b) =>
    `<tr><td>${esc(fmtPrintDay(b.date))}</td><td>${esc(b.startTime)}–${esc(b.endTime)}</td><td>${esc(b.title)}</td><td>${esc(b.bookedBy || "—")}</td></tr>`
  ).join("");
  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function printSchedule() {
  const rooms = DB.getActiveRooms();
  const { start, end } = printRange();
  const startISO = localISO(start), endISO = localISO(end);
  const bookings = activeBookings()
    .filter((b) => b.date >= startISO && b.date <= endISO)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const roomName = roomFilter ? (rooms.find((r) => String(r.id) === roomFilter) || {}).name : null;
  const scopeLabel = roomName || T("cal.allRooms");
  const rangeLabel = startISO === endISO ? fmtPrintDay(startISO) : `${fmtPrintDay(startISO)} – ${fmtPrintDay(endISO)}`;

  let body;
  if (!bookings.length) {
    body = `<div class="empty">${T("print.empty")}</div>`;
  } else if (roomFilter) {
    body = scheduleTableHTML(bookings);
  } else {
    // "All rooms" → one section per room (in the room list's order, extras last).
    const order = rooms.map((r) => r.name);
    const groups = {};
    bookings.forEach((b) => { const k = b.roomName || "—"; (groups[k] = groups[k] || []).push(b); });
    body = Object.keys(groups)
      .sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
      })
      .map((n) => `<h2>${esc(n)} <span class="count">(${groups[n].length})</span></h2>${scheduleTableHTML(groups[n])}`)
      .join("");
  }

  const generated = new Date().toLocaleString(locale());
  const html = `<!DOCTYPE html><html lang="${esc(I18N.current())}"><head><meta charset="utf-8">
<title>${esc(T("print.heading"))} — ${esc(scopeLabel)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
  h1{font-size:16px;margin:0 0 2px}
  .scope{font-size:14px;font-weight:bold;margin:6px 0 2px}
  .meta{font-size:12px;color:#555;margin-bottom:16px}
  h2{font-size:13px;margin:18px 0 6px;border-bottom:2px solid #333;padding-bottom:2px}
  .count{font-weight:normal;color:#666}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th,td{border:1px solid #bbb;padding:6px 8px;font-size:12px;text-align:left;vertical-align:top}
  th{background:#f0f0f0}
  tr:nth-child(even) td{background:#fafafa}
  .empty{font-size:13px;color:#666;padding:12px 0}
  .toolbar{margin-bottom:16px}
  .toolbar button{font-size:13px;padding:6px 14px;cursor:pointer}
  @media print{body{margin:0}.toolbar{display:none}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ ${esc(T("cal.print"))}</button></div>
<h1>▦ ${esc(T("brand"))}</h1>
<div class="scope">${esc(T("print.heading"))}: ${esc(scopeLabel)}</div>
<div class="meta">${esc(rangeLabel)} · ${esc(T("print.generated"))}: ${esc(generated)}</div>
${body}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert(T("print.popupBlocked")); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ---- toolbar ----
function shift(dir) {
  if (viewMode === "day") cursor.setDate(cursor.getDate() + dir);
  else if (viewMode === "week") cursor.setDate(cursor.getDate() + dir * 7);
  else cursor.setMonth(cursor.getMonth() + dir);
  cursor = new Date(cursor);
  render();
}
byId("calPrev").addEventListener("click", () => shift(-1));
byId("calNext").addEventListener("click", () => shift(1));
byId("calToday").addEventListener("click", () => { cursor = new Date(); render(); });
byId("calWeek").addEventListener("click", () => setView("week"));
byId("calDay").addEventListener("click", () => setView("day"));
byId("calMonth").addEventListener("click", () => setView("month"));
byId("calExport").addEventListener("click", exportICS);
byId("calPrint").addEventListener("click", printSchedule);
roomSel.addEventListener("change", () => { roomFilter = roomSel.value; render(); });
window.addEventListener("languagechange", () => { buildRoomSelect(); render(); });

(async function init() {
  await DB.init();
  buildRoomSelect();
  render();
  if (DB.isShared()) {
    let syncing = false;
    const sync = async () => {
      if (syncing || !M.overlay.hidden) return; // don't refresh while a modal is open
      syncing = true;
      try { await DB.refresh(); render(); } finally { syncing = false; }
    };
    window.addEventListener("focus", sync);
    setInterval(sync, 8000);
    DB.onChange(sync);
  }
})();
