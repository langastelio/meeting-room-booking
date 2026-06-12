/* admin.js — room management (saves straight to the database) */

const a = {
  form: document.getElementById("roomForm"),
  name: document.getElementById("name"),
  location: document.getElementById("location"),
  capacity: document.getElementById("capacity"),
  facilities: document.getElementById("facilities"),
  alert: document.getElementById("roomAlert"),
  list: document.getElementById("adminRoomList"),
};

let editingRoomId = null; // id of the room being edited inline

function showAlert(msg, ok) {
  a.alert.textContent = msg;
  a.alert.className = `alert show ${ok ? "ok" : "err"}`;
  setTimeout(() => (a.alert.className = "alert"), 4000);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);
const statusLabel = (active) => (active ? T("status.active") : T("status.inactive"));

function roomRow(r) {
  if (editingRoomId === r.id) {
    return `
      <tr class="inline-edit" data-row="${r.id}">
        <td><input type="text" data-edit-name value="${esc(r.name)}" /></td>
        <td><input type="text" data-edit-location value="${esc(r.location)}" /></td>
        <td><input type="number" min="1" data-edit-capacity value="${esc(r.capacity)}" style="max-width:80px" /></td>
        <td><input type="text" data-edit-facilities value="${esc(r.facilities)}" /></td>
        <td><span class="pill ${r.active ? "on" : "off"}">${statusLabel(r.active)}</span></td>
        <td><div class="btn-bar">
          <button data-save="${r.id}">${T("btn.save")}</button>
          <button class="ghost" data-cancel="1">${T("btn.cancel")}</button>
        </div></td>
      </tr>`;
  }
  return `
    <tr data-row="${r.id}">
      <td>${esc(r.name)}</td>
      <td>${esc(r.location)}</td>
      <td>${esc(r.capacity)}</td>
      <td>${esc(r.facilities) || "—"}</td>
      <td><span class="pill ${r.active ? "on" : "off"}">${statusLabel(r.active)}</span></td>
      <td><div class="btn-bar">
        <button class="ghost" data-edit="${r.id}">${T("btn.edit")}</button>
        <button class="ghost" data-toggle="${r.id}" data-to="${r.active ? "false" : "true"}">
          ${r.active ? T("btn.deactivate") : T("btn.activate")}
        </button>
        <button class="icon-btn" data-del="${r.id}" title="Delete room">✕</button>
      </div></td>
    </tr>`;
}

function renderRooms() {
  const rooms = DB.getRooms();
  if (!rooms.length) {
    a.list.innerHTML = `<tr><td colspan="6" class="empty">${T("empty.noRoomsAdmin")}</td></tr>`;
    return;
  }
  a.list.innerHTML = rooms.map(roomRow).join("");

  // Edit / Cancel
  a.list.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => { editingRoomId = Number(b.dataset.edit); renderRooms(); })
  );
  a.list.querySelectorAll("[data-cancel]").forEach((b) =>
    b.addEventListener("click", () => { editingRoomId = null; renderRooms(); })
  );

  // Save inline edit
  a.list.querySelectorAll("[data-save]").forEach((b) =>
    b.addEventListener("click", async () => {
      const row = b.closest("tr");
      try {
        await DB.updateRoom(b.dataset.save, {
          name: row.querySelector("[data-edit-name]").value,
          location: row.querySelector("[data-edit-location]").value,
          capacity: row.querySelector("[data-edit-capacity]").value,
          facilities: row.querySelector("[data-edit-facilities]").value,
        });
        editingRoomId = null;
        renderRooms();
        showAlert("Room updated.", true);
      } catch (err) {
        showAlert("Update failed: " + err.message, false);
      }
    })
  );

  // Toggle Active / Inactive
  a.list.querySelectorAll("[data-toggle]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await DB.updateRoom(b.dataset.toggle, { active: b.dataset.to === "true" });
        renderRooms();
      } catch (err) {
        showAlert("Update failed: " + err.message, false);
      }
    })
  );

  // Delete
  a.list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (confirm("Delete this room? Existing bookings are kept.")) {
        try { await DB.deleteRoom(b.dataset.del); renderRooms(); }
        catch (err) { showAlert("Delete failed: " + err.message, false); }
      }
    })
  );
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

window.addEventListener("languagechange", renderRooms);

(async function init() {
  await DB.init();
  renderRooms();

  // Keep the room list in sync with other people (poll + realtime).
  if (DB.isShared()) {
    let syncing = false;
    const sync = async () => {
      if (syncing || editingRoomId !== null) return; // don't interrupt an edit
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
