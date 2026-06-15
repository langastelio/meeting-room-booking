/* calendar.js — weekly agenda of booked meetings + click-a-slot to book */

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

let weekStart = startOfWeek(new Date());
let roomFilter = ""; // room id as string; "" = all rooms

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

function render() {
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); days.push(d); }

  const first = days[0], last = days[6];
  weekLabel.textContent =
    `${first.toLocaleDateString(locale(), { day: "2-digit", month: "short" })} – ` +
    `${last.toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" })}`;

  const todayISO = localISO(new Date());
  const bookings = DB.getBookings().filter(
    (b) => b.status !== "cancelled" && (!roomFilter || String(b.roomId) === roomFilter)
  );

  // Header row
  let html = `<div class="cal-head cal-corner"></div>`;
  days.forEach((d) => {
    const today = localISO(d) === todayISO ? "today" : "";
    html += `<div class="cal-head ${today}">${d.toLocaleDateString(locale(), { weekday: "short" })}<br>${pad(d.getDate())}/${pad(d.getMonth() + 1)}</div>`;
  });

  // Time rows
  for (let m = OPEN_MIN; m < CLOSE_MIN; m += STEP) {
    html += `<div class="cal-time">${hhmm(m)}</div>`;
    days.forEach((d) => {
      const dateISO = localISO(d);
      const covering = bookings.filter((b) => b.date === dateISO && toMin(b.startTime) < m + STEP && toMin(b.endTime) > m);
      if (covering.length) {
        const starting = covering.filter((b) => toMin(b.startTime) >= m && toMin(b.startTime) < m + STEP);
        if (starting.length) {
          html += `<div class="cal-cell">` + starting.map((b) =>
            `<div class="cal-ev" data-id="${b.id}" title="${esc(b.title)} (${esc(b.startTime)}–${esc(b.endTime)})">${esc(b.title)}${roomFilter ? "" : " · " + esc(b.roomName)}</div>`
          ).join("") + `</div>`;
        } else {
          html += `<div class="cal-cell cal-busy" data-id="${covering[0].id}"></div>`;
        }
      } else {
        html += `<div class="cal-cell cal-slot" data-date="${dateISO}" data-min="${m}"></div>`;
      }
    });
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".cal-slot").forEach((c) =>
    c.addEventListener("click", () => openBook(c.dataset.date, Number(c.dataset.min)))
  );
  grid.querySelectorAll("[data-id]").forEach((c) =>
    c.addEventListener("click", () => openDetails(c.dataset.id))
  );
}

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
    `<div class="cal-detail-row"><b>${T("th.by")}:</b> ${esc(b.bookedBy)}</div>`;
  if (can) {
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
}

// ---- toolbar ----
byId("calPrev").addEventListener("click", () => { weekStart.setDate(weekStart.getDate() - 7); weekStart = new Date(weekStart); render(); });
byId("calNext").addEventListener("click", () => { weekStart.setDate(weekStart.getDate() + 7); weekStart = new Date(weekStart); render(); });
byId("calToday").addEventListener("click", () => { weekStart = startOfWeek(new Date()); render(); });
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
