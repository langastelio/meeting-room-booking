/* app.js — booking page logic */

const els = {
  room: document.getElementById("room"),
  form: document.getElementById("bookingForm"),
  title: document.getElementById("title"),
  bookedBy: document.getElementById("bookedBy"),
  date: document.getElementById("date"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  repeat: document.getElementById("repeat"),
  repeatUntil: document.getElementById("repeatUntil"),
  repeatUntilRow: document.getElementById("repeatUntilRow"),
  alert: document.getElementById("formAlert"),
  suggestions: document.getElementById("suggestions"),
  roomList: document.getElementById("roomList"),
  bookingList: document.getElementById("bookingList"),
  mineOnly: document.getElementById("mineOnly"),
  upRoomFilter: document.getElementById("upRoomFilter"),
  upPageSize: document.getElementById("upPageSize"),
  upPrev: document.getElementById("upPrev"),
  upNext: document.getElementById("upNext"),
  upPageInfo: document.getElementById("upPageInfo"),
  roomSearch: document.getElementById("roomSearch"),
  roomPageSize: document.getElementById("roomPageSize"),
  roomViewToggle: document.getElementById("roomViewToggle"),
  roomPrev: document.getElementById("roomPrev"),
  roomNext: document.getElementById("roomNext"),
  roomPageInfo: document.getElementById("roomPageInfo"),
};

// Pagination state for the Upcoming Bookings datatable.
let upPage = 0;
// Available Rooms: search, pagination and view-mode state.
let roomPage = 0;
let roomView = localStorage.getItem("mrb_room_view") === "list" ? "list" : "cards";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function showAlert(msg, ok) {
  els.alert.textContent = msg;
  els.alert.className = `alert show ${ok ? "ok" : "err"}`;
  if (ok) setTimeout(() => (els.alert.className = "alert"), 4000);
}

/* ---- cancel-reason modal (replaces window.prompt) ---- */
const cancelModal = {
  overlay: document.getElementById("cancelModal"),
  sub: document.getElementById("cancelModalSub"),
  reason: document.getElementById("cancelReason"),
  err: document.getElementById("cancelModalErr"),
  confirm: document.getElementById("cancelModalConfirm"),
  dismiss: document.getElementById("cancelModalDismiss"),
};

// Opens the modal; resolves with the trimmed reason, or null if dismissed.
function askCancelReason(label) {
  return new Promise((resolve) => {
    const m = cancelModal;
    m.reason.value = "";
    m.err.className = "alert";
    m.sub.textContent = label
      ? `Why is "${label}" being cancelled?`
      : "Tell everyone why this meeting is being cancelled.";
    m.overlay.hidden = false;
    setTimeout(() => m.reason.focus(), 0);

    const close = (result) => {
      m.overlay.hidden = true;
      m.confirm.removeEventListener("click", onConfirm);
      m.dismiss.removeEventListener("click", onDismiss);
      m.overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onConfirm = () => {
      const v = m.reason.value.trim();
      if (!v) {
        m.err.textContent = T("cancel.reasonRequired");
        m.err.className = "alert show err";
        m.reason.focus();
        return;
      }
      close(v);
    };
    const onDismiss = () => close(null);
    const onOverlay = (e) => { if (e.target === m.overlay) close(null); };
    const onKey = (e) => {
      if (e.key === "Escape") close(null);
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onConfirm();
    };

    m.confirm.addEventListener("click", onConfirm);
    m.dismiss.addEventListener("click", onDismiss);
    m.overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKey);
  });
}

/* ---- edit-meeting modal ---- */
const editModal = {
  overlay: document.getElementById("editModal"),
  room: document.getElementById("editRoom"),
  title: document.getElementById("editTitle"),
  date: document.getElementById("editDate"),
  start: document.getElementById("editStart"),
  end: document.getElementById("editEnd"),
  err: document.getElementById("editModalErr"),
  save: document.getElementById("editModalSave"),
  dismiss: document.getElementById("editModalDismiss"),
};
let editingId = null;

function openEdit(b) {
  editingId = b.id;
  const rooms = DB.getActiveRooms();
  editModal.room.innerHTML = rooms
    .map((r) => `<option value="${r.id}" ${Number(r.id) === Number(b.roomId) ? "selected" : ""}>${esc(r.name)}</option>`)
    .join("");
  editModal.title.value = b.title || "";
  editModal.date.value = b.date || "";
  editModal.start.value = b.startTime || "";
  editModal.end.value = b.endTime || "";
  editModal.err.className = "alert";
  editModal.overlay.hidden = false;
  setTimeout(() => editModal.title.focus(), 0);
}
function closeEdit() { editModal.overlay.hidden = true; editingId = null; }

if (editModal.overlay) {
  editModal.dismiss.addEventListener("click", closeEdit);
  editModal.overlay.addEventListener("click", (e) => { if (e.target === editModal.overlay) closeEdit(); });
  editModal.save.addEventListener("click", async () => {
    if (editingId == null) return;
    const title = editModal.title.value.trim();
    if (!title) {
      editModal.err.textContent = T("label.title");
      editModal.err.className = "alert show err";
      return;
    }
    editModal.save.disabled = true;
    try {
      const r = await DB.updateBooking(editingId, {
        roomId: editModal.room.value,
        title,
        date: editModal.date.value,
        startTime: editModal.start.value,
        endTime: editModal.end.value,
      });
      if (!r.ok) {
        editModal.err.textContent = r.error;
        editModal.err.className = "alert show err";
        return;
      }
      closeEdit();
      await DB.refresh();
      renderAll(true);
      showAlert(T("msg.updated"), true);
    } catch (err) {
      editModal.err.textContent = err.message;
      editModal.err.className = "alert show err";
    } finally {
      editModal.save.disabled = false;
    }
  });
}

// Who may cancel a booking: admins cancel any; users cancel only their own.
function canCancel(b) {
  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  if (!me) return false;
  if (me.role === "admin") return true;
  if (b.createdBy && b.createdBy === me.username) return true;
  // Fallback for bookings made before created_by existed: match by name.
  if (!b.createdBy && b.bookedBy && b.bookedBy === (me.name || me.username)) return true;
  return false;
}

// Is this booking owned by the given user? (created_by, or name match for old rows)
function isMine(b, me) {
  if (!me) return false;
  if (b.createdBy && b.createdBy === me.username) return true;
  if (!b.createdBy && b.bookedBy && b.bookedBy === (me.name || me.username)) return true;
  return false;
}

// Translation helper (falls back to the key if i18n isn't loaded).
const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);

function renderRoomOptions() {
  const rooms = DB.getActiveRooms();
  els.room.innerHTML = rooms.length
    ? rooms.map((r) => `<option value="${r.id}">${r.name} — ${r.location} (${r.capacity})</option>`).join("")
    : `<option value="">${T("empty.noRooms")}</option>`;
}

function updateRoomPager(page, pages, total) {
  if (!els.roomPageInfo) return;
  els.roomPageInfo.textContent = total ? T("dt.pageInfo", { page: page + 1, pages, total }) : "";
  if (els.roomPrev) els.roomPrev.disabled = page <= 0;
  if (els.roomNext) els.roomNext.disabled = page >= pages - 1;
}

function renderRooms() {
  const all = DB.getActiveRooms();
  els.roomList.className = roomView === "list" ? "rooms list" : "rooms";
  if (els.roomViewToggle) els.roomViewToggle.textContent = roomView === "list" ? "▦" : "☰";

  if (!all.length) {
    els.roomList.innerHTML = `<p class="empty">${T("empty.noRooms")}</p>`;
    updateRoomPager(0, 0, 0);
    return;
  }

  // Filter by free text across name, location and facilities.
  const q = (els.roomSearch ? els.roomSearch.value : "").trim().toLowerCase();
  const rooms = q
    ? all.filter((r) => `${r.name} ${r.location} ${r.facilities}`.toLowerCase().includes(q))
    : all;

  if (!rooms.length) {
    els.roomList.innerHTML = `<p class="empty">${T("empty.noRoomMatch")}</p>`;
    updateRoomPager(0, 0, 0);
    return;
  }

  // Paginate (6 per page by default, expandable to 12).
  const pageSize = els.roomPageSize ? Number(els.roomPageSize.value) || 6 : 6;
  const pages = Math.ceil(rooms.length / pageSize);
  if (roomPage > pages - 1) roomPage = pages - 1;
  if (roomPage < 0) roomPage = 0;
  const pageRooms = rooms.slice(roomPage * pageSize, roomPage * pageSize + pageSize);
  updateRoomPager(roomPage, pages, rooms.length);

  els.roomList.innerHTML = pageRooms
    .map((r) => {
      const tags = r.facilities
        ? r.facilities.split(",").map((f) => `<span class="tag">${esc(f.trim())}</span>`).join("")
        : "";
      return `
        <div class="room" data-id="${r.id}">
          <h3>${esc(r.name)}</h3>
          <div class="meta">${esc(r.location)} · ${r.capacity} ${T("seats")}</div>
          <div class="tags">${tags}</div>
        </div>`;
    })
    .join("");

  // Click a room card to select it in the form.
  els.roomList.querySelectorAll(".room").forEach((card) => {
    card.addEventListener("click", () => {
      els.room.value = card.dataset.id;
      highlightSelected();
    });
  });
  highlightSelected();
}

function highlightSelected() {
  els.roomList.querySelectorAll(".room").forEach((c) => {
    c.classList.toggle("selected", c.dataset.id === els.room.value);
  });
}

// End time of a booking as a timestamp (used to drop meetings already held).
const endTs = (b) => new Date(`${b.date}T${b.endTime}`).getTime();

// (Re)build the room dropdown for the upcoming list, keeping the current choice.
function renderUpRoomFilter() {
  if (!els.upRoomFilter) return;
  const cur = els.upRoomFilter.value;
  const rooms = DB.getRooms();
  els.upRoomFilter.innerHTML =
    `<option value="">${T("cal.allRooms")}</option>` +
    rooms.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
  els.upRoomFilter.value = cur || "";
}

function updatePager(page, pages, total) {
  if (!els.upPageInfo) return;
  els.upPageInfo.textContent = total ? T("dt.pageInfo", { page: page + 1, pages, total }) : "";
  if (els.upPrev) els.upPrev.disabled = page <= 0;
  if (els.upNext) els.upNext.disabled = page >= pages - 1;
}

function renderBookings() {
  const now = Date.now();
  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  const mineOnly = els.mineOnly && els.mineOnly.checked;
  const roomId = els.upRoomFilter ? els.upRoomFilter.value : "";
  // "Upcoming" = not cancelled and not ended. Cancelled/held ones move to History.
  const bookings = DB.getBookings()
    .filter((b) => b.status !== "cancelled" && (isNaN(endTs(b)) || endTs(b) > now))
    .filter((b) => !mineOnly || isMine(b, me))
    .filter((b) => !roomId || String(b.roomId) === roomId)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  if (!bookings.length) {
    els.bookingList.innerHTML = `<tr><td colspan="6" class="empty">${T(mineOnly ? "empty.noMine" : "empty.noUpcoming")}</td></tr>`;
    updatePager(0, 0, 0);
    return;
  }

  // Pagination: 5 rows by default, expandable to 10.
  const pageSize = els.upPageSize ? Number(els.upPageSize.value) || 5 : 5;
  const pages = Math.ceil(bookings.length / pageSize);
  if (upPage > pages - 1) upPage = pages - 1;
  if (upPage < 0) upPage = 0;
  const pageRows = bookings.slice(upPage * pageSize, upPage * pageSize + pageSize);
  updatePager(upPage, pages, bookings.length);

  els.bookingList.innerHTML = pageRows
    .map(
      (b) => `
      <tr>
        <td>${esc(b.roomName)}</td>
        <td>${esc(b.title)}</td>
        <td>${esc(b.bookedBy)}</td>
        <td>${esc(b.date)}</td>
        <td>${esc(b.startTime)}–${esc(b.endTime)}</td>
        <td>${
          canCancel(b)
            ? `<div class="btn-bar">
                 <button class="ghost" data-edit="${b.id}">✎ ${T("btn.edit")}</button>
                 <button class="danger" data-del="${b.id}" data-creator="${esc(b.createdBy || "")}"
                   data-title="${esc(b.title)}" data-room="${esc(b.roomName)}"
                   data-date="${esc(b.date)}" data-time="${esc(b.startTime)}–${esc(b.endTime)}"
                   title="${esc(T("btn.cancelMeeting"))}">✕ ${T("btn.cancel")}</button>
               </div>`
            : ""
        }</td>
      </tr>`
    )
    .join("");

  els.bookingList.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const b = DB.getBookings().find((x) => String(x.id) === String(btn.dataset.edit));
      if (b) openEdit(b);
    });
  });

  els.bookingList.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const reason = await askCancelReason(btn.dataset.title);
      if (reason === null) return;                 // dismissed the modal

      const me = typeof Auth !== "undefined" ? Auth.session() : null;
      const creator = btn.dataset.creator;
      try {
        await DB.cancelBooking(btn.dataset.del, {
          reason,
          cancelledBy: me ? me.name || me.username : "",
        });
        // If an admin cancels someone else's meeting, notify the creator (in-app).
        if (
          me && me.role === "admin" && creator && creator !== me.username &&
          typeof Notify !== "undefined" && Notify.enabled()
        ) {
          const msg = `Your meeting "${btn.dataset.title}" in ${btn.dataset.room} on ${btn.dataset.date} (${btn.dataset.time}) was cancelled by ${me.name || me.username}. Reason: ${reason.trim()}`;
          await Notify.create(creator, msg);
        }
        renderBookings();
      } catch (err) {
        showAlert("Could not cancel: " + err.message, false);
      }
    });
  });
}

function clearSuggestions() {
  els.suggestions.innerHTML = "";
  els.suggestions.classList.remove("show");
}

// Show clickable alternatives after a clash. Clicking one applies it and re-books.
function renderSuggestions(s) {
  if (!s || (!s.rooms.length && !s.times.length)) {
    els.suggestions.innerHTML = `<p class="muted-note">${T("sugg.none")}</p>`;
    els.suggestions.classList.add("show");
    return;
  }
  let html = "";
  if (s.rooms.length) {
    html += `<p class="muted-note">${T("sugg.freeRooms")}</p><div class="btn-bar">`;
    html += s.rooms
      .map((r) => `<button type="button" class="ghost" data-room="${r.id}">${esc(r.name)}</button>`)
      .join("");
    html += `</div>`;
  }
  if (s.times.length) {
    html += `<p class="muted-note">${T("sugg.tryTimes")}</p><div class="btn-bar">`;
    html += s.times
      .map((t) => `<button type="button" class="ghost" data-start="${t.start}" data-end="${t.end}">${t.start}–${t.end}</button>`)
      .join("");
    html += `</div>`;
  }
  els.suggestions.innerHTML = html;
  els.suggestions.classList.add("show");

  els.suggestions.querySelectorAll("[data-room]").forEach((b) =>
    b.addEventListener("click", () => {
      els.room.value = b.dataset.room;
      highlightSelected();
      els.form.requestSubmit();
    })
  );
  els.suggestions.querySelectorAll("[data-start]").forEach((b) =>
    b.addEventListener("click", () => {
      els.startTime.value = b.dataset.start;
      els.endTime.value = b.dataset.end;
      els.form.requestSubmit();
    })
  );
}

// Local YYYY-MM-DD (avoids UTC off-by-one near midnight).
function localISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Build the list of occurrence dates for a recurring booking (max 60).
function buildDates(startISO, untilISO, freq) {
  const out = [];
  const s = new Date(startISO + "T00:00:00");
  const u = new Date(untilISO + "T00:00:00");
  if (isNaN(s) || isNaN(u) || u < s) return out;
  const d = new Date(s);
  let guard = 0;
  while (d <= u && out.length < 60 && guard < 800) {
    guard++;
    if (freq === "daily") {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) out.push(localISO(d)); // weekdays only
      d.setDate(d.getDate() + 1);
    } else if (freq === "weekly") {
      out.push(localISO(d));
      d.setDate(d.getDate() + 7);
    } else if (freq === "monthly") {
      out.push(localISO(d));
      d.setMonth(d.getMonth() + 1);
    } else break;
  }
  return out;
}

// Show the "Repeat until" field only when a recurrence is selected.
function syncRepeatUI() {
  if (!els.repeat || !els.repeatUntilRow) return;
  els.repeatUntilRow.style.display = els.repeat.value === "none" ? "none" : "block";
}
if (els.repeat) els.repeat.addEventListener("change", syncRepeatUI);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!els.room.value) return showAlert(T("msg.addRoomFirst"), false);

  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  const base = {
    roomId: els.room.value,
    title: els.title.value.trim(),
    bookedBy: els.bookedBy.value.trim(),
    createdBy: me ? me.username : null,
    startTime: els.startTime.value,
    endTime: els.endTime.value,
  };
  const repeat = els.repeat ? els.repeat.value : "none";

  const btn = els.form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = T("btn.reserving");
  clearSuggestions();
  try {
    if (repeat === "none") {
      // ---- single booking ----
      const result = await DB.addBooking({ ...base, date: els.date.value });
      if (!result.ok) {
        showAlert(result.error, false);
        if (result.suggestions) renderSuggestions(result.suggestions);
        return;
      }
      showAlert(T("msg.booked"), true);
      els.title.value = "";
    } else {
      // ---- recurring series ----
      const until = els.repeatUntil.value;
      if (!until) return showAlert(T("msg.untilRequired"), false);
      const dates = buildDates(els.date.value, until, repeat);
      if (!dates.length) return showAlert(T("msg.noDates"), false);

      let booked = 0, skipped = 0;
      for (const d of dates) {
        const r = await DB.addBooking({ ...base, date: d });
        if (r.ok) booked++; else skipped++;
      }
      showAlert(T("msg.seriesResult", { booked, skipped }), booked > 0);
      if (booked > 0) {
        els.title.value = "";
        els.repeat.value = "none";
        syncRepeatUI();
      }
    }
    renderRoomOptions();
    renderBookings();
  } catch (err) {
    showAlert("Could not save: " + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = T("btn.reserve");
  }
});

els.room.addEventListener("change", highlightSelected);

// "My bookings only" toggle — remember the choice across visits.
if (els.mineOnly) {
  els.mineOnly.checked = localStorage.getItem("mrb_mine_only") === "1";
  els.mineOnly.addEventListener("change", () => {
    localStorage.setItem("mrb_mine_only", els.mineOnly.checked ? "1" : "0");
    upPage = 0;
    renderBookings();
  });
}

// Upcoming datatable: room filter + page size (remembered) + prev/next paging.
if (els.upRoomFilter) els.upRoomFilter.addEventListener("change", () => { upPage = 0; renderBookings(); });
if (els.upPageSize) {
  els.upPageSize.value = localStorage.getItem("mrb_up_pagesize") === "10" ? "10" : "5";
  els.upPageSize.addEventListener("change", () => {
    localStorage.setItem("mrb_up_pagesize", els.upPageSize.value);
    upPage = 0;
    renderBookings();
  });
}
if (els.upPrev) els.upPrev.addEventListener("click", () => { upPage--; renderBookings(); });
if (els.upNext) els.upNext.addEventListener("click", () => { upPage++; renderBookings(); });

// Available Rooms: search, page size (remembered), view toggle (remembered), paging.
if (els.roomSearch) els.roomSearch.addEventListener("input", () => { roomPage = 0; renderRooms(); });
if (els.roomPageSize) {
  els.roomPageSize.value = localStorage.getItem("mrb_room_pagesize") === "12" ? "12" : "6";
  els.roomPageSize.addEventListener("change", () => {
    localStorage.setItem("mrb_room_pagesize", els.roomPageSize.value);
    roomPage = 0;
    renderRooms();
  });
}
if (els.roomViewToggle) {
  els.roomViewToggle.addEventListener("click", () => {
    roomView = roomView === "list" ? "cards" : "list";
    localStorage.setItem("mrb_room_view", roomView);
    renderRooms();
  });
}
if (els.roomPrev) els.roomPrev.addEventListener("click", () => { roomPage--; renderRooms(); });
if (els.roomNext) els.roomNext.addEventListener("click", () => { roomPage++; renderRooms(); });

// Re-render JS-generated text when the language changes.
window.addEventListener("languagechange", () => { clearSuggestions(); renderAll(true); });

// Re-render everything. When preserveSelection is true, keep the room the user
// has chosen in the form (so background refreshes don't reset it mid-booking).
function renderAll(preserveSelection) {
  const selected = els.room.value;
  renderRoomOptions();
  if (preserveSelection && selected) els.room.value = selected;
  renderRooms();
  renderUpRoomFilter();
  renderBookings();
}

/* ---- toasts + OS notifications ---- */
function toast(message) {
  let wrap = document.getElementById("toastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toastWrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  t.addEventListener("click", () => t.remove());
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 400); }, 9000);
}

// Show an OS notification if allowed; always also show an in-page toast.
function showReminder(message) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Meeting Room Booking", { body: message });
    }
  } catch (_) { /* ignore */ }
  toast(message);
}

/* ---- meeting reminders at T-30 / T-15 / T-5 ---- */
const REMINDER_LEADS = [30, 15, 5];
const firedReminders = JSON.parse(localStorage.getItem("mrb_reminders") || "{}");
const saveFired = () => localStorage.setItem("mrb_reminders", JSON.stringify(firedReminders));

function myUpcoming(now) {
  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  if (!me) return [];
  return DB.getBookings().filter((b) => {
    if (b.status === "cancelled") return false;
    const mine =
      (b.createdBy && b.createdBy === me.username) ||
      (!b.createdBy && b.bookedBy === (me.name || me.username));
    if (!mine) return false;
    const start = new Date(`${b.date}T${b.startTime}`).getTime();
    return start > now;
  });
}

function checkReminders() {
  const now = Date.now();
  myUpcoming(now).forEach((b) => {
    const start = new Date(`${b.date}T${b.startTime}`).getTime();
    const mins = (start - now) / 60000;
    REMINDER_LEADS.forEach((L) => {
      const key = `${b.id}:${L}`;
      // Fire once, in the minute the meeting crosses each threshold.
      if (mins <= L && mins > L - 1 && !firedReminders[key]) {
        firedReminders[key] = 1;
        saveFired();
        showReminder(`"${b.title}" in ${b.roomName} starts at ${b.startTime} — about ${L} min away.`);
      }
    });
  });
}

/* ---- inbox: messages addressed to me (e.g. admin cancelled my meeting) ---- */
async function checkNotifications() {
  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  if (!me || typeof Notify === "undefined" || !Notify.enabled()) return;
  try {
    const list = await Notify.unreadFor(me.username);
    if (!list.length) return;
    list.forEach((n) => showReminder(n.message));
    await Notify.markRead(list.map((n) => n.id));
  } catch (e) {
    console.warn("notification check failed:", e.message || e);
  }
}

(async function init() {
  await DB.init();
  // Default the date picker to today.
  els.date.value = new Date().toISOString().slice(0, 10);
  // The booker is always the signed-in person (read-only); show their name.
  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  if (me && els.bookedBy) els.bookedBy.value = me.name || me.username;
  renderAll();

  // Ask once for permission to show OS notifications (toast fallback otherwise).
  if ("Notification" in window && Notification.permission === "default") {
    try { Notification.requestPermission(); } catch (_) {}
  }

  // Keep every browser in sync, three ways:
  if (DB.isShared()) {
    let syncing = false;
    const sync = async () => {
      if (syncing) return;            // avoid overlapping refreshes
      syncing = true;
      try {
        await DB.refresh();
        renderAll(true);
      } finally {
        syncing = false;
      }
    };

    window.addEventListener("focus", sync);   // 1. when the tab regains focus
    setInterval(sync, 5000);                   // 2. poll every 5s (always works)
    DB.onChange(sync);                         // 3. instant push (if Realtime on)
  }

  // Reminders + notification inbox.
  checkReminders();
  checkNotifications();
  setInterval(checkReminders, 20000);          // every 20s while the tab is open
  setInterval(checkNotifications, 20000);
  window.addEventListener("focus", checkNotifications);
})();
