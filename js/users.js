/* users.js — admin-only user management: create, edit, reset password, remove */

const U = {
  form: document.getElementById("userForm"),
  name: document.getElementById("newName"),
  username: document.getElementById("newUsername"),
  email: document.getElementById("newEmail"),
  password: document.getElementById("newPassword"),
  role: document.getElementById("newRole"),
  alert: document.getElementById("userAlert"),
  list: document.getElementById("userList"),
};

let editingId = null; // id of the row currently being edited inline

function showAlert(msg, ok) {
  U.alert.textContent = msg;
  U.alert.className = `alert show ${ok ? "ok" : "err"}`;
  setTimeout(() => (U.alert.className = "alert"), 4000);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);

function rowHtml(u, me) {
  const self = me && me.id === u.id;
  const roleBadge = `<span class="pill ${u.role === "admin" ? "on" : "off"}">${u.role}</span>`;
  const statusBadge = `<span class="pill ${u.active ? "on" : "off"}">${u.active ? T("status.active") : T("status.disabled")}</span>`;
  const pending = u.must_reset ? ` <span class="tag">${T("tag.tempPw")}</span>` : "";

  if (editingId === u.id) {
    // Inline edit mode
    return `
      <tr class="inline-edit" data-row="${u.id}">
        <td><input type="text" data-edit-name value="${esc(u.name || "")}" placeholder="Full name" /></td>
        <td>${esc(u.username)}</td>
        <td><input type="email" data-edit-email value="${esc(u.email || "")}" placeholder="name@company.com" /></td>
        <td>
          <select data-edit-role ${self ? "disabled title='You cannot change your own role'" : ""}>
            <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>${statusBadge}</td>
        <td><div class="btn-bar">
          <button data-save="${u.id}">${T("btn.save")}</button>
          <button class="ghost" data-cancel="1">${T("btn.cancel")}</button>
        </div></td>
      </tr>`;
  }

  const actions = [`<button class="ghost" data-edit="${u.id}">${T("btn.edit")}</button>`];
  if (!self) {
    actions.push(`<button class="ghost" data-reset="${u.id}" data-username="${esc(u.username)}">${T("btn.resetPw")}</button>`);
    actions.push(`<button class="ghost" data-active="${u.id}" data-to="${u.active ? "false" : "true"}">${u.active ? T("btn.disable") : T("btn.enable")}</button>`);
    actions.push(`<button class="icon-btn" data-del="${u.id}" title="Delete user">✕</button>`);
  }

  return `
    <tr data-row="${u.id}">
      <td>${esc(u.name || "—")}${self ? ` <span class='tag'>${T("tag.you")}</span>` : ""}</td>
      <td>${esc(u.username)}</td>
      <td>${esc(u.email || "—")}</td>
      <td>${roleBadge}${pending}</td>
      <td>${statusBadge}</td>
      <td><div class="btn-bar">${actions.join("")}</div></td>
    </tr>`;
}

async function renderUsers() {
  let users;
  try {
    users = await Auth.listUsers();
  } catch (err) {
    U.list.innerHTML = `<tr><td colspan="6" class="empty">Could not load users: ${esc(err.message)}</td></tr>`;
    return;
  }
  const me = Auth.session();
  U.list.innerHTML = users.map((u) => rowHtml(u, me)).join("");

  // Edit / Cancel
  U.list.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => { editingId = Number(b.dataset.edit); renderUsers(); })
  );
  U.list.querySelectorAll("[data-cancel]").forEach((b) =>
    b.addEventListener("click", () => { editingId = null; renderUsers(); })
  );

  // Save inline edit
  U.list.querySelectorAll("[data-save]").forEach((b) =>
    b.addEventListener("click", async () => {
      const row = b.closest("tr");
      const name = row.querySelector("[data-edit-name]").value;
      const email = row.querySelector("[data-edit-email]").value;
      const roleSel = row.querySelector("[data-edit-role]");
      const patch = { name, email };
      if (roleSel && !roleSel.disabled) patch.role = roleSel.value;
      const res = await Auth.updateUser(b.dataset.save, patch);
      if (!res.ok) return showAlert("Update failed: " + res.error, false);
      editingId = null;
      renderUsers();
      showAlert("User updated.", true);
    })
  );

  // Reset password (admin sets a temp password; user must change it next login)
  U.list.querySelectorAll("[data-reset]").forEach((b) =>
    b.addEventListener("click", async () => {
      const temp = prompt(`Set a temporary password for "${b.dataset.username}".\nThey'll be asked to change it on next login:`);
      if (!temp) return;
      const res = await Auth.resetUserPassword(b.dataset.reset, b.dataset.username, temp);
      if (!res.ok) return showAlert("Reset failed: " + res.error, false);
      showAlert("Temporary password set.", true);
      renderUsers();
    })
  );

  // Enable / Disable
  U.list.querySelectorAll("[data-active]").forEach((b) =>
    b.addEventListener("click", async () => {
      try { await Auth.setActive(b.dataset.active, b.dataset.to === "true"); renderUsers(); }
      catch (err) { showAlert("Update failed: " + err.message, false); }
    })
  );

  // Delete
  U.list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this user? They will lose access.")) return;
      try { await Auth.deleteUser(b.dataset.del); renderUsers(); }
      catch (err) { showAlert("Delete failed: " + err.message, false); }
    })
  );
}

U.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = U.form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Creating…";
  try {
    const email = U.email ? U.email.value.trim() : "";
    const res = await Auth.createUser({
      name: U.name.value,
      username: U.username.value,
      email,
      password: U.password.value,
      role: U.role.value,
      mustReset: true, // they must change the temp password on first login
    });
    if (!res.ok) return showAlert(res.error, false);
    showAlert(`Created "${res.user.name || res.user.username}" (${res.user.role}). They'll reset the password on first login.`, true);
    U.form.reset();
    renderUsers();
  } finally {
    btn.disabled = false;
    btn.textContent = "Create User";
  }
});

window.addEventListener("languagechange", renderUsers);

(async function init() {
  if (!Auth.hasBackend()) {
    showAlert("Database not configured (check js/config.js).", false);
    return;
  }
  renderUsers();
})();
