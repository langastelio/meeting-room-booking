/* app.js — booking page logic */

const els = {
  room: document.getElementById("room"),
  form: document.getElementById("bookingForm"),
  title: document.getElementById("title"),
  bookedBy: document.getElementById("bookedBy"),
  date: document.getElementById("date"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  alert: document.getElementById("formAlert"),
  suggestions: document.getElementById("suggestions"),
  roomList: document.getElementById("roomList"),
  bookingList: document.getElementById("bookingList"),
};

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
        m.err.textContent = "Please enter a reason.";
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

function renderRoomOptions() {
  const rooms = DB.getActiveRooms();
  els.room.innerHTML = rooms.length
    ? rooms.map((r) => `<option value="${r.id}">${r.name} — ${r.location} (${r.capacity})</option>`).join("")
    : `<option value="">No rooms yet — add one in Admin</option>`;
}

function renderRooms() {
  const rooms = DB.getActiveRooms();
  if (!rooms.length) {
    els.roomList.innerHTML = `<p class="empty">No rooms yet. Go to <a href="admin.html">Admin</a> to add one.</p>`;
    return;
  }
  els.roomList.innerHTML = rooms
    .map((r) => {
      const tags = r.facilities
        ? r.facilities.split(",").map((f) => `<span class="tag">${f.trim()}</span>`).join("")
        : "";
      return `
        <div class="room" data-id="${r.id}">
          <h3>${r.name}</h3>
          <div class="meta">${r.location} · seats ${r.capacity}</div>
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

function renderBookings() {
  const now = Date.now();
  // "Upcoming" = not cancelled and not ended. Cancelled/held ones move to History.
  const bookings = DB.getBookings()
    .filter((b) => b.status !== "cancelled" && (isNaN(endTs(b)) || endTs(b) > now))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  if (!bookings.length) {
    els.bookingList.innerHTML = `<tr><td colspan="6" class="empty">No upcoming meetings.</td></tr>`;
    return;
  }
  els.bookingList.innerHTML = bookings
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
            ? `<button class="icon-btn" data-del="${b.id}" data-creator="${esc(b.createdBy || "")}"
                 data-title="${esc(b.title)}" data-room="${esc(b.roomName)}"
                 data-date="${esc(b.date)}" data-time="${esc(b.startTime)}–${esc(b.endTime)}"
                 title="Cancel booking">✕</button>`
            : ""
        }</td>
      </tr>`
    )
    .join("");

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
        // If an admin cancels someone else's meeting, notify the creator.
        if (me && me.role === "admin" && creator && creator !== me.username) {
          const msg = `Your meeting "${btn.dataset.title}" in ${btn.dataset.room} on ${btn.dataset.date} (${btn.dataset.time}) was cancelled by ${me.name || me.username}. Reason: ${reason.trim()}`;
          if (typeof Notify !== "undefined" && Notify.enabled()) await Notify.create(creator, msg);
          // Email the meeting owner too.
          if (typeof Mailer !== "undefined" && Mailer.ready()) {
            const c = await Auth.userContact(creator);
            if (c && c.email) {
              Mailer.enqueue(c.email, c.name,
                `Meeting cancelled: ${btn.dataset.title}`,
                `<p>Hi ${c.name || ""},</p><p>Your meeting <b>${btn.dataset.title}</b> in <b>${btn.dataset.room}</b> ` +
                `on <b>${btn.dataset.date}</b> (${btn.dataset.time}) was cancelled by <b>${me.name || me.username}</b>.</p>` +
                `<p><b>Reason:</b> ${reason.trim()}</p>`);
            }
          }
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
    els.suggestions.innerHTML = `<p class="muted-note">No free alternatives found in 08:00–18:00 that day. Try another day.</p>`;
    els.suggestions.classList.add("show");
    return;
  }
  let html = "";
  if (s.rooms.length) {
    html += `<p class="muted-note">Free rooms at the same time:</p><div class="btn-bar">`;
    html += s.rooms
      .map((r) => `<button type="button" class="ghost" data-room="${r.id}">${esc(r.name)}</button>`)
      .join("");
    html += `</div>`;
  }
  if (s.times.length) {
    html += `<p class="muted-note">Free times for this room:</p><div class="btn-bar">`;
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

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!els.room.value) return showAlert("Please add a room first.", false);

  const me = typeof Auth !== "undefined" ? Auth.session() : null;
  const btn = els.form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Reserving…";
  clearSuggestions();
  try {
    const result = await DB.addBooking({
      roomId: els.room.value,
      title: els.title.value.trim(),
      bookedBy: els.bookedBy.value.trim(),
      createdBy: me ? me.username : null,
      date: els.date.value,
      startTime: els.startTime.value,
      endTime: els.endTime.value,
    });

    if (!result.ok) {
      showAlert(result.error, false);
      if (result.suggestions) renderSuggestions(result.suggestions);
      return;
    }

    showAlert("Room booked.", true);
    // Email the booker a confirmation.
    if (me && me.email && typeof Mailer !== "undefined" && Mailer.ready() && result.booking) {
      var bk = result.booking;
      Mailer.enqueue(me.email, me.name,
        `Booking confirmed: ${bk.title}`,
        `<p>Hi ${me.name || ""},</p><p>Your meeting <b>${bk.title}</b> is booked in <b>${bk.roomName}</b> ` +
        `on <b>${bk.date}</b> from <b>${bk.startTime}</b> to <b>${bk.endTime}</b>.</p>`);
    }
    clearSuggestions();
    els.title.value = "";
    renderRoomOptions();
    renderBookings();
  } catch (err) {
    showAlert("Could not save: " + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Reserve Room";
  }
});

els.room.addEventListener("change", highlightSelected);

// Re-render everything. When preserveSelection is true, keep the room the user
// has chosen in the form (so background refreshes don't reset it mid-booking).
function renderAll(preserveSelection) {
  const selected = els.room.value;
  renderRoomOptions();
  if (preserveSelection && selected) els.room.value = selected;
  renderRooms();
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
