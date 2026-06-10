/*
 * idle.js — sign the user out after 15 minutes of inactivity, scoped to the
 * current browser (tab) session.
 *
 * The idle clock is keyed to a per-tab sessionStorage flag, so a freshly opened
 * session never logs out on its first load just because an old timestamp is
 * sitting in localStorage. On logout the timestamp is cleared so the next login
 * starts clean.
 */
(function () {
  if (typeof Auth === "undefined" || !Auth.session()) return; // only when signed in

  var KEY = "mrb_last_activity";
  var TAB = "mrb_session_started"; // per-tab marker (sessionStorage)
  var LIMIT_MS = 15 * 60 * 1000;   // 15 minutes
  var now = function () { return Date.now(); };

  function endSession() {
    localStorage.removeItem(KEY);
    try { sessionStorage.removeItem(TAB); } catch (e) {}
    localStorage.setItem("mrb_logout_reason", "idle");
    Auth.logout(); // clears the session and redirects to login
  }

  var fresh = false;
  try { fresh = !sessionStorage.getItem(TAB); } catch (e) { fresh = true; }

  if (fresh) {
    // Brand-new tab/session: start the idle clock now — never auto-logout on
    // the first load (this is what caused the false "signed out" message).
    try { sessionStorage.setItem(TAB, "1"); } catch (e) {}
    localStorage.setItem(KEY, String(now()));
  } else {
    // Continuing in the same tab session: enforce the idle limit.
    var last = parseInt(localStorage.getItem(KEY) || "0", 10);
    if (last && now() - last > LIMIT_MS) { endSession(); return; }
    localStorage.setItem(KEY, String(now()));
  }

  // Record activity (throttled).
  var lastWrite = 0;
  function mark() {
    var n = now();
    if (n - lastWrite > 5000) { lastWrite = n; localStorage.setItem(KEY, String(n)); }
  }
  ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"].forEach(function (ev) {
    window.addEventListener(ev, mark, { passive: true });
  });

  // Periodically enforce the idle limit while the page stays open.
  setInterval(function () {
    var l = parseInt(localStorage.getItem(KEY) || "0", 10);
    if (l && now() - l > LIMIT_MS) endSession();
  }, 30000);
})();
