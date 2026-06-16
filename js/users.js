/* users.js — admin-only user management: create, edit (modal), reset, remove.
   The list is a lightweight "datatable": live search + click-to-sort columns. */

const U = {
  form: document.getElementById("userForm"),
  name: document.getElementById("newName"),
  username: document.getElementById("newUsername"),
  email: document.getElementById("newEmail"),
  password: document.getElementById("newPassword"),
  role: document.getElementById("newRole"),
  alert: document.getElementById("userAlert"),
  list: document.getElementById("userList"),
  search: document.getElementById("userSearch"),
  count: document.getElementById("userCount"),
  table: document.getElementById("usersTable"),
};

// Edit-user modal handles.
const UM = {
  overlay: document.getElementById("userModal"),
  name: document.getElementById("euName"),
  username: document.getElementById("euUsername"),
  email: document.getElementById("euEmail"),
  role: document.getElementById("euRole"),
  err: document.getElementById("userModalErr"),
  save: document.getElementById("userModalSave"),
  dismiss: document.getElementById("userModalDismiss"),
};

let allUsers = [];        // last fetched list
let search = "";          // current search text
let sortKey = "name";     // column being sorted
let sortDir = 1;          // 1 = ascending, -1 = descending
let editingUser = null;   // user object open in the edit modal
let pendingSet = new Set(); // usernames that have requested a password reset

function showAlert(msg, ok) {
  U.alert.textContent = msg;
  U.alert.className = `alert show ${ok ? "ok" : "err"}`;
  setTimeout(() => (U.alert.className = "alert"), 4000);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);

/* ---------- list (search + sort + render) ---------- */

function sortedFiltered() {
  const q = search.trim().toLowerCase();
  const rows = allUsers.filter(
    (u) => !q || [u.name, u.username, u.email, u.role].some((v) => String(v || "").toLowerCase().includes(q))
  );
  rows.sort((a, b) => {
    let av, bv;
    if (sortKey === "active") { av = a.active ? 1 : 0; bv = b.active ? 1 : 0; }
    else { av = String(a[sortKey] || "").toLowerCase(); bv = String(b[sortKey] || "").toLowerCase(); }
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });
  return rows;
}

function rowHtml(u, me) {
  const self = me && me.id === u.id;
  const roleBadge = `<span class="pill ${u.role === "admin" ? "on" : "off"}">${u.role}</span>`;
  const statusBadge = `<span class="pill ${u.active ? "on" : "off"}">${u.active ? T("status.active") : T("status.disabled")}</span>`;
  const pending = u.must_reset ? ` <span class="tag">${T("tag.tempPw")}</span>` : "";
  const reqTag = pendingSet.has(u.username) ? ` <span class="tag req">${T("tag.resetRequested")}</span>` : "";

  const actions = [`<button class="ghost" data-edit="${u.id}">${T("btn.edit")}</button>`];
  if (!self) {
    actions.push(`<button class="ghost" data-reset="${u.id}" data-username="${esc(u.username)}">${T("btn.resetPw")}</button>`);
    actions.push(`<button class="ghost" data-active="${u.id}" data-to="${u.active ? "false" : "true"}">${u.active ? T("btn.disable") : T("btn.enable")}</button>`);
    actions.push(`<button class="icon-btn" data-del="${u.id}" title="Delete user">✕</button>`);
  }

  return `
    <tr data-row="${u.id}">
      <td>${esc(u.name || "—")}${self ? ` <span class='tag'>${T("tag.you")}</span>` : ""}${reqTag}</td>
      <td>${esc(u.username)}</td>
      <td>${esc(u.email || "—")}</td>
      <td>${roleBadge}${pending}</td>
      <td>${statusBadge}</td>
      <td><div class="btn-bar">${actions.join("")}</div></td>
    </tr>`;
}

function updateSortHeaders() {
  U.table.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === sortKey) th.classList.add(sortDir === 1 ? "sort-asc" : "sort-desc");
  });
}

function paint() {
  const me = Auth.session();
  const rows = sortedFiltered();
  U.count.textContent = T("users.shown", { shown: rows.length, total: allUsers.length });

  if (!rows.length) {
    U.list.innerHTML = `<tr><td colspan="6" class="empty">${T("users.noMatch")}</td></tr>`;
    updateSortHeaders();
    return;
  }
  U.list.innerHTML = rows.map((u) => rowHtml(u, me)).join("");
  updateSortHeaders();
  wireRowActions();
}

function wireRowActions() {
  U.list.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => {
      const u = allUsers.find((x) => String(x.id) === String(b.dataset.edit));
      if (u) openEdit(u);
    })
  );

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

  U.list.querySelectorAll("[data-active]").forEach((b) =>
    b.addEventListener("click", async () => {
      try { await Auth.setActive(b.dataset.active, b.dataset.to === "true"); renderUsers(); }
      catch (err) { showAlert("Update failed: " + err.message, false); }
    })
  );

  U.list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this user? They will lose access.")) return;
      try { await Auth.deleteUser(b.dataset.del); renderUsers(); }
      catch (err) { showAlert("Delete failed: " + err.message, false); }
    })
  );
}

async function renderUsers() {
  try {
    allUsers = await Auth.listUsers();
  } catch (err) {
    U.list.innerHTML = `<tr><td colspan="6" class="empty">Could not load users: ${esc(err.message)}</td></tr>`;
    return;
  }
  // Who has asked for a password reset (tolerant: empty if column not added).
  try {
    pendingSet = new Set((await Auth.pendingResets()).map((r) => r.username));
  } catch (e) {
    pendingSet = new Set();
  }
  paint();
}

/* ---------- edit modal ---------- */

function openEdit(u) {
  editingUser = u;
  const me = Auth.session();
  const self = me && me.id === u.id;
  UM.name.value = u.name || "";
  UM.username.value = u.username;
  UM.email.value = u.email || "";
  UM.role.value = u.role;
  UM.role.disabled = self;                 // can't change your own role
  UM.role.title = self ? "You cannot change your own role" : "";
  UM.err.className = "alert";
  UM.overlay.hidden = false;
  setTimeout(() => UM.name.focus(), 0);
}
function closeEdit() { UM.overlay.hidden = true; editingUser = null; }

UM.dismiss.addEventListener("click", closeEdit);
UM.overlay.addEventListener("click", (e) => { if (e.target === UM.overlay) closeEdit(); });
UM.save.addEventListener("click", async () => {
  if (!editingUser) return;
  const patch = { name: UM.name.value, email: UM.email.value };
  if (!UM.role.disabled) patch.role = UM.role.value;
  UM.save.disabled = true;
  try {
    const res = await Auth.updateUser(editingUser.id, patch);
    if (!res.ok) {
      UM.err.textContent = "Update failed: " + res.error;
      UM.err.className = "alert show err";
      return;
    }
    closeEdit();
    showAlert("User updated.", true);
    renderUsers();
  } finally {
    UM.save.disabled = false;
  }
});

/* ---------- create form ---------- */

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

/* ---------- search + sort wiring ---------- */

U.search.addEventListener("input", () => { search = U.search.value; paint(); });

U.table.querySelectorAll("th.sortable").forEach((th) =>
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (sortKey === key) sortDir *= -1;       // same column → flip direction
    else { sortKey = key; sortDir = 1; }      // new column → ascending
    paint();
  })
);

window.addEventListener("languagechange", paint);

(async function init() {
  if (!Auth.hasBackend()) {
    showAlert("Database not configured (check js/config.js).", false);
    return;
  }
  renderUsers();
})();
