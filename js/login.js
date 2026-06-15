/* login.js — sign in, or create the first admin if no accounts exist yet. */

const L = {
  form: document.getElementById("authForm"),
  nameRow: document.getElementById("nameRow"),
  fullName: document.getElementById("fullName"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  btn: document.getElementById("authBtn"),
  title: document.getElementById("authTitle"),
  sub: document.getElementById("authSub"),
  alert: document.getElementById("authAlert"),
};

let firstRun = false; // true when there are no users yet → create-admin mode
const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);

// Apply the create-admin labels (also re-applied when the language changes).
function applyFirstRunText() {
  if (!firstRun) return;
  L.title.textContent = T("title.firstAdmin");
  L.sub.textContent = T("sub.firstAdmin");
  L.btn.textContent = T("btn.createAdmin");
}
window.addEventListener("languagechange", applyFirstRunText);

function showAlert(msg, ok) {
  L.alert.textContent = msg;
  L.alert.className = `alert show ${ok ? "ok" : "err"}`;
}

L.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  L.btn.disabled = true;
  const original = L.btn.textContent;
  L.btn.textContent = T("msg.pleaseWait");
  try {
    const username = L.username.value.trim();
    const password = L.password.value;
    const res = firstRun
      ? await Auth.createFirstAdmin({ username, password, name: L.fullName.value })
      : await Auth.login(username, password);

    if (!res.ok) {
      showAlert(res.error, false);
      return;
    }
    // Force a password change if the account still has a temporary password.
    if (!firstRun && Auth.session()?.mustReset) {
      location.href = "reset-password.html";
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

// "Forgot password?" — there's no email reset; an admin resets it for you.
const forgotLink = document.getElementById("forgotLink");
if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    showAlert(T("forgot.msg"), false);
  });
}

// Show / hide password
const togglePass = document.getElementById("togglePass");
if (togglePass) {
  togglePass.addEventListener("click", () => {
    const show = L.password.type === "password";
    L.password.type = show ? "text" : "password";
    togglePass.classList.toggle("on", show);
    togglePass.setAttribute("aria-label", show ? "Hide password" : "Show password");
    L.password.focus();
  });
}

// 5-second animated splash loader, then reveal the login form.
setTimeout(function () {
  var loader = document.getElementById("loader");
  if (loader) {
    loader.classList.add("hide");
    setTimeout(function () { loader.remove(); }, 600);
  }
}, 5000);

// Notice if the previous session ended due to inactivity.
if (localStorage.getItem("mrb_logout_reason") === "idle") {
  localStorage.removeItem("mrb_logout_reason");
  showAlert(T("msg.idleLogout"), false);
}

(async function init() {
  if (!Auth.hasBackend()) {
    showAlert("Database not configured (check js/config.js).", false);
    return;
  }
  try {
    if ((await Auth.userCount()) === 0) {
      firstRun = true;
      applyFirstRunText();
      L.password.setAttribute("autocomplete", "new-password");
      L.nameRow.style.display = "block";
      L.fullName.required = true;
      const forgotRow = document.getElementById("forgotRow");
      if (forgotRow) forgotRow.style.display = "none"; // no account to recover yet
    }
  } catch (err) {
    showAlert("Could not reach the database: " + (err.message || err), false);
  }
})();
