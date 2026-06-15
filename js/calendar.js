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
