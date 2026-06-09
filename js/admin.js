/* admin.js — room management + Excel import/export */

const a = {
  form: document.getElementById("roomForm"),
  name: document.getElementById("name"),
  location: document.getElementById("location"),
  capacity: document.getElementById("capacity"),
  facilities: document.getElementById("facilities"),
  alert: document.getElementById("roomAlert"),
  list: document.getElementById("adminRoomList"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
};

function showAlert(msg, ok) {
  a.alert.textContent = msg;
  a.alert.className = `alert show ${ok ? "ok" : "err"}`;
  setTimeout(() => (a.alert.className = "alert"), 4000);
}

function renderRooms() {
  const rooms = DB.getRooms();
  if (!rooms.length) {
    a.list.innerHTML = `<tr><td colspan="6" class="empty">No rooms yet. Add your first one on the left.</td></tr>`;
    return;
  }
  a.list.innerHTML = rooms
    .map(
      (r) => `
      <tr>
        <td>${r.name}</td>
        <td>${r.location}</td>
        <td>${r.capacity}</td>
        <td>${r.facilities || "—"}</td>
        <td><span class="pill ${r.active ? "on" : "off"}">${r.active ? "Active" : "Inactive"}</span></td>
        <td><button class="icon-btn" data-del="${r.id}" title="Delete room">✕</button></td>
      </tr>`
    )
    .join("");

  a.list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this room? Existing bookings are kept.")) {
        await DB.deleteRoom(btn.dataset.del);
        renderRooms();
      }
    });
  });
}

a.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = a.form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const room = await DB.addRoom({
      name: a.name.value.trim(),
      location: a.location.value.trim(),
      capacity: a.capacity.value,
      facilities: a.facilities.value.trim(),
    });
    showAlert(
      DB.isShared() ? `Added "${room.name}" — shared with everyone.` : `Added "${room.name}". (local only)`,
      true
    );
    a.form.reset();
    renderRooms();
  } catch (err) {
    showAlert("Could not save: " + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Room";
  }
});

a.exportBtn.addEventListener("click", () => DB.exportWorkbook());

a.importInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await DB.importWorkbook(file);
    showAlert(`Imported "${file.name}".`, true);
    renderRooms();
  } catch (err) {
    showAlert("Import failed: " + err.message, false);
  }
  a.importInput.value = "";
});

a.resetBtn.addEventListener("click", async () => {
  if (confirm("Discard changes and reload from the seed file in /data?")) {
    try {
      await DB.resetToSeed();
      renderRooms();
      showAlert("Reset to the seed spreadsheet.", true);
    } catch (err) {
      showAlert("Reset failed: " + err.message, false);
    }
  }
});

(async function init() {
  await DB.init();
  renderRooms();

  // Keep the room list in sync with other people (poll + realtime).
  if (DB.isShared()) {
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        await DB.refresh();
        renderRooms();
      } finally {
        syncing = false;
      }
    };
    window.addEventListener("focus", sync);
    setInterval(sync, 5000);
    DB.onChange(sync);
  }
})();
