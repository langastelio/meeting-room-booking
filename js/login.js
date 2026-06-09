/* login.js — sign in, or create the first admin if no accounts exist yet. */

const L = {
  form: document.getElementById("authForm"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  btn: document.getElementById("authBtn"),
  title: document.getElementById("authTitle"),
  sub: document.getElementById("authSub"),
  alert: document.getElementById("authAlert"),
};

let firstRun = false; // true when there are no users yet → create-admin mode

function showAlert(msg, ok) {
  L.alert.textContent = msg;
  L.alert.className = `alert show ${ok ? "ok" : "err"}`;
}

L.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  L.btn.disabled = true;
  const original = L.btn.textContent;
  L.btn.textContent = "Please wait…";
  try {
    const username = L.username.value.trim();
    const password = L.password.value;
    const res = firstRun
      ? await Auth.createFirstAdmin({ username, password })
      : await Auth.login(username, password);

    if (!res.ok) {
      showAlert(res.error, false);
      return;
    }
    location.href = "index.html";
  } catch (err) {
    showAlert("Something went wrong: " + (err.message || err), false);
  } finally {
    L.btn.disabled = false;
    L.btn.textContent = original;
  }
});

(async function init() {
  if (!Auth.hasBackend()) {
    showAlert("Database not configured (check js/config.js).", false);
    return;
  }
  try {
    if ((await Auth.userCount()) === 0) {
      firstRun = true;
      L.title.textContent = "Create the first admin";
      L.sub.textContent = "No accounts exist yet. The first account becomes the administrator.";
      L.btn.textContent = "Create admin & continue";
      L.password.setAttribute("autocomplete", "new-password");
    }
  } catch (err) {
    showAlert("Could not reach the database: " + (err.message || err), false);
  }
})();
