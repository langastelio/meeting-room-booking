/* users.js — admin-only user management */

const U = {
  form: document.getElementById("userForm"),
  username: document.getElementById("newUsername"),
  password: document.getElementById("newPassword"),
  role: document.getElementById("newRole"),
  alert: document.getElementById("userAlert"),
  list: document.getElementById("userList"),
};

function showAlert(msg, ok) {
  U.alert.textContent = msg;
  U.alert.className = `alert show ${ok ? "ok" : "err"}`;
  setTimeout(() => (U.alert.className = "alert"), 4000);
}

async function renderUsers() {
  let users;
  try {
    users = await Auth.listUsers();
  } catch (err) {
    U.list.innerHTML = `<tr><td colspan="4" class="empty">Could not load users: ${err.message}</td></tr>`;
    return;
  }
  const me = Auth.session();

  U.list.innerHTML = users
    .map((u) => {
      const self = me && me.id === u.id;
      const roleBtn = self
        ? ""
        : `<button class="ghost icon-btn" data-role="${u.id}" data-to="${u.role === "admin" ? "user" : "admin"}">
             ${u.role === "admin" ? "Make user" : "Make admin"}
           </button>`;
      const activeBtn = self
        ? ""
        : `<button class="ghost icon-btn" data-active="${u.id}" data-to="${u.active ? "false" : "true"}">
             ${u.active ? "Disable" : "Enable"}
           </button>`;
      const delBtn = self
        ? ""
        : `<button class="icon-btn" data-del="${u.id}" title="Delete user">✕</button>`;
      return `
        <tr>
          <td>${u.username}${self ? " <span class='tag'>you</span>" : ""}</td>
          <td><span class="pill ${u.role === "admin" ? "on" : "off"}">${u.role}</span></td>
          <td><span class="pill ${u.active ? "on" : "off"}">${u.active ? "Active" : "Disabled"}</span></td>
          <td><div class="btn-bar">${roleBtn}${activeBtn}${delBtn}</div></td>
        </tr>`;
    })
    .join("");

  U.list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (confirm("Delete this user? They will lose access.")) {
        try { await Auth.deleteUser(b.dataset.del); renderUsers(); }
        catch (err) { showAlert("Delete failed: " + err.message, false); }
      }
    })
  );
  U.list.querySelectorAll("[data-role]").forEach((b) =>
    b.addEventListener("click", async () => {
      try { await Auth.setRole(b.dataset.role, b.dataset.to); renderUsers(); }
      catch (err) { showAlert("Update failed: " + err.message, false); }
    })
  );
  U.list.querySelectorAll("[data-active]").forEach((b) =>
    b.addEventListener("click", async () => {
      try { await Auth.setActive(b.dataset.active, b.dataset.to === "true"); renderUsers(); }
      catch (err) { showAlert("Update failed: " + err.message, false); }
    })
  );
}

U.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = U.form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Creating…";
  try {
    const res = await Auth.createUser({
      username: U.username.value,
      password: U.password.value,
      role: U.role.value,
    });
    if (!res.ok) return showAlert(res.error, false);
    showAlert(`Created "${res.user.username}" (${res.user.role}).`, true);
    U.form.reset();
    renderUsers();
  } finally {
    btn.disabled = false;
    btn.textContent = "Create User";
  }
});

(async function init() {
  if (!Auth.hasBackend()) {
    showAlert("Database not configured (check js/config.js).", false);
    return;
  }
  renderUsers();
})();
