/*
 * tour.js — first-login guided tour for the booking page.
 * Shows a welcome prompt ("Take the tour?"). If accepted, it spotlights key
 * parts of the UI with short tips. Runs once per user (remembered per browser).
 */
(function () {
  if (typeof Auth === "undefined") return;
  var me = Auth.session();
  if (!me) return;

  var DONE_KEY = "mrb_tour_done_" + (me.username || "");
  if (localStorage.getItem(DONE_KEY)) return; // already seen

  function q(sel) { return document.querySelector(sel); }
  function vis(el) { return el && el.offsetParent !== null; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  var steps = [
    { center: true, welcome: true, title: "Welcome, " + (me.name || me.username) + "!",
      text: "Here's a 20-second tour of how to book a meeting room. You can skip it anytime." },
    { sel: "#room", title: "1. Choose a room", text: "Pick the meeting room you want from this list." },
    { sel: "#title", title: "2. Meeting title", text: "Give your meeting a short name, e.g. \"Sprint planning\"." },
    { sel: "#date", title: "3. Date & time", text: "Set the date, then the start and end time below it." },
    { sel: "#bookedBy", title: "4. Booking as you", text: "Bookings are made in your name automatically — this field can't be edited." },
    { sel: "#bookingForm button[type='submit']", title: "5. Reserve", text: "Click Reserve to book. If the room is busy, the app suggests free rooms and times." },
    { sel: "#bookingList", title: "6. Your meetings", text: "Upcoming meetings appear here. Cancel with the ✕ — you'll be asked for a reason." },
    { sel: ".theme-toggle", title: "Theme", text: "Switch between dark and light mode anytime." },
    { sel: "#navAdmin", title: "Admin tools", text: "As an admin you can manage rooms, users and view reports from here." },
    { sel: "#logoutBtn", title: "You're all set!", text: "Tip: you'll be signed out automatically after 15 minutes of inactivity. Enjoy!" }
  ];

  // Drop steps whose target isn't present/visible (e.g. admin links for users).
  steps = steps.filter(function (s) { return s.center || vis(q(s.sel)); });

  var i = 0, block, spot, pop;
  var total = steps.filter(function (s) { return !s.center; }).length;

  function build() {
    block = document.createElement("div"); block.className = "tour-block";
    spot = document.createElement("div"); spot.className = "tour-spotlight";
    pop = document.createElement("div"); pop.className = "tour-pop";
    document.body.appendChild(block);
    document.body.appendChild(spot);
    document.body.appendChild(pop);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
  }

  function finish() {
    localStorage.setItem(DONE_KEY, "1");
    [block, spot, pop].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  }

  function onKey(e) {
    if (e.key === "Escape") finish();
    else if (e.key === "Enter" || e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
  }

  function next() { if (i < steps.length - 1) { i++; render(); } else finish(); }
  function back() { if (i > 0) { i--; render(); } }

  function place(el) {
    var r = el.getBoundingClientRect(), pad = 6;
    spot.style.display = "block";
    spot.style.top = (r.top - pad) + "px";
    spot.style.left = (r.left - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px";
    spot.style.height = (r.height + pad * 2) + "px";

    pop.classList.remove("center");
    var popW = 300, popH = pop.offsetHeight || 170;
    var top = r.bottom + 12;
    if (top + popH > window.innerHeight - 8) top = Math.max(8, r.top - popH - 12);
    var left = r.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (left < 8) left = 8;
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function reposition() {
    var s = steps[i];
    if (s && !s.center) { var el = q(s.sel); if (el) place(el); }
  }

  function render() {
    var s = steps[i];
    var html = "<h3>" + esc(s.title) + "</h3><p>" + esc(s.text) + "</p>";
    if (s.welcome) {
      html += '<div class="tour-foot"><span class="tour-step"></span><div class="tour-actions">' +
        '<button class="ghost" data-act="skip">No thanks</button>' +
        '<button data-act="next">Take the tour</button></div></div>';
    } else {
      var last = i === steps.length - 1;
      html += '<div class="tour-foot"><span class="tour-step">Step ' + i + ' of ' + total + '</span>' +
        '<div class="tour-actions">' +
        (i > 1 ? '<button class="ghost" data-act="back">Back</button>' : '') +
        '<button class="ghost" data-act="skip">Skip</button>' +
        '<button data-act="' + (last ? "done" : "next") + '">' + (last ? "Done" : "Next") + '</button>' +
        '</div></div>';
    }
    pop.innerHTML = html;
    pop.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.dataset.act;
        if (a === "next") next();
        else if (a === "back") back();
        else finish(); // skip / done
      });
    });

    if (s.center) {
      spot.style.display = "none";
      pop.classList.add("center");
      pop.style.top = ""; pop.style.left = "";
    } else {
      var el = q(s.sel);
      if (!el) { next(); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(function () { place(el); }, 300);
    }
  }

  function start() {
    if (!Auth.session()) return;       // safety: session may have ended
    if (localStorage.getItem(DONE_KEY)) return;
    build();
    render();
  }

  if (document.readyState === "complete") setTimeout(start, 700);
  else window.addEventListener("load", function () { setTimeout(start, 700); });
})();
