/* reset.js — set a new password (forced on first login, or change anytime). */

const R = {
  form: document.getElementById("resetForm"),
  pw: document.getElementById("newPassword"),
  confirm: document.getElementById("confirmPassword"),
  btn: document.getElementById("resetBtn"),
  title: document.getElementById("resetTitle"),
  sub: document.getElementById("resetSub"),
  alert: document.getElementById("resetAlert"),
};

function showAlert(msg, ok) {
  R.alert.textContent = msg;
  R.alert.className = `alert show ${ok ? "ok" : "err"}`;
}

R.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (R.pw.value !== R.confirm.value) return showAlert("Passwords do not match.", false);

  R.btn.disabled = true;
  R.btn.textContent = "Saving…";
  try {
    const res = await Auth.changeOwnPassword(R.pw.value);
    if (!res.ok) return showAlert(res.error, false);
    location.href = "index.html";
  } finally {
    R.btn.disabled = false;
    R.btn.textContent = "Save password";
  }
});

(function init() {
  const s = Auth.session();
  if (s && s.mustReset) {
    R.title.textContent = "Choose your password";
    R.sub.textContent =
      "Your account was created with a temporary password. Please set your own to continue.";
  }
})();
