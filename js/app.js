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
  roomList: document.getElementById("roomList"),
  bookingList: document.getElementById("bookingList"),
};

function showAlert(msg, ok) {
  els.alert.textContent = msg;
  els.alert.className = `alert show ${ok ? "ok" : "err"}`;
  setTimeout(() => (els.alert.className = "alert"), 4000);
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

function renderBookings() {
  const bookings = DB.getBookings()
    .slice()
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  if (!bookings.length) {
    els.bookingList.innerHTML = `<tr><td colspan="6" class="empty">No bookings yet.</td></tr>`;
    return;
  }
  els.bookingList.innerHTML = bookings
    .map(
      (b) => `
      <tr>
        <td>${b.roomName}</td>
        <td>${b.title}</td>
        <td>${b.bookedBy}</td>
        <td>${b.date}</td>
        <td>${b.startTime}–${b.endTime}</td>
        <td><button class="icon-btn" data-del="${b.id}" title="Cancel">✕</button></td>
      </tr>`
    )
    .join("");

  els.bookingList.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Cancel this booking?")) {
        await DB.deleteBooking(btn.dataset.del);
        renderBookings();
      }
    });
  });
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!els.room.value) return showAlert("Please add a room first.", false);

  const btn = els.form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Reserving…";
  try {
    const result = await DB.addBooking({
      roomId: els.room.value,
      title: els.title.value.trim(),
      bookedBy: els.bookedBy.value.trim(),
      date: els.date.value,
      startTime: els.startTime.value,
      endTime: els.endTime.value,
    });

    if (!result.ok) return showAlert(result.error, false);

    showAlert(
      DB.isShared() ? "Room booked and shared with everyone." : "Room booked! (local only — set up JSONBin to share)",
      true
    );
    els.form.reset();
    els.date.value = new Date().toISOString().slice(0, 10);
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

function renderAll() {
  renderRoomOptions();
  renderRooms();
  renderBookings();
}

(async function init() {
  await DB.init();
  // Default the date picker to today.
  els.date.value = new Date().toISOString().slice(0, 10);
  renderAll();

  // Keep in sync with other people: re-pull shared data when the tab regains focus.
  if (DB.isShared()) {
    window.addEventListener("focus", async () => {
      await DB.refresh();
      renderAll();
    });
  }
})();
