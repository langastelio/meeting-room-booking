/*
 * idle.js — automatically sign the user out after 15 minutes of inactivity.
 * Activity in any tab keeps the session alive (shared via localStorage), and an
 * idle period that spans a closed tab is also caught on next load.
 */
(function () {
  if (typeof Auth === "undefined" || !Auth.session()) return; // only when signed in

  var KEY = "mrb_last_activity";
  var LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  var now = function () { return Date.now(); };

  function signOutIdle() {
    localStorage.setItem("mrb_logout_reason", "idle");
    Auth.logout(); // clears the session and redirects to login
  }

  // If we were left idle past the limit (even with the tab closed), sign out now.
  var last = parseInt(localStorage.getItem(KEY) || "0", 10);
  if (last && now() - last > LIMIT_MS) { signOutIdle(); return; }
  localStorage.setItem(KEY, String(now()));

  // Record activity (throttled so we don't hammer localStorage).
  var lastWrite = 0;
  function mark() {
    var n = now();
    if (n - lastWrite > 5000) { lastWrite = n; localStorage.setItem(KEY, String(n)); }
  }
  ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"].forEach(function (ev) {
    window.addEventListener(ev, mark, { passive: true });
  });

  // Check periodically whether the idle limit has been exceeded.
  setInterval(function () {
    var l = parseInt(localStorage.getItem(KEY) || "0", 10);
    if (now() - l > LIMIT_MS) signOutIdle();
  }, 30000);
})();
