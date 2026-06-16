/* forgot.js — self-service password-reset request.
 *
 * There is no email in MVP1, so this does not send a reset link. Instead it
 * flags the account as needing a reset; an administrator then issues a
 * temporary password from the Users page, and the user is forced to change it
 * on their next sign-in. The response is always the same regardless of whether
 * the username exists, so the form cannot reveal which accounts are real.
 */

const F = {
  form: document.getElementById("forgotForm"),
  user: document.getElementById("fpUser"),
  btn: document.getElementById("fpBtn"),
  alert: document.getElementById("fpAlert"),
};
const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);

function setAlert(msg, ok) {
  F.alert.textContent = msg;
  F.alert.className = `alert show ${ok ? "ok" : "err"}`;
}

F.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!Auth.hasBackend()) {
    setAlert("Database not configured (check js/config.js).", false);
    return;
  }
  F.btn.disabled = true;
  const original = F.btn.textContent;
  F.btn.textContent = T("msg.pleaseWait");
  try {
    await Auth.requestPasswordReset(F.user.value);
    // Same outcome either way (no account enumeration). Lock the form.
    setAlert(T("forgot.done"), true);
    F.user.disabled = true;
    F.btn.textContent = T("btn.requestReset");
    // leave the button disabled so the request isn't fired repeatedly
  } catch (err) {
    setAlert("Something went wrong: " + (err.message || err), false);
    F.btn.disabled = false;
    F.btn.textContent = original;
  }
});
