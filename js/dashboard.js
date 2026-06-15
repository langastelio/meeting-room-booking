/* dashboard.js — admin-only usage report built from the bookings data.
   Pure CSS bar charts (no external chart library). */

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);
const locale = () => (typeof I18N !== "undefined" && I18N.current() === "pt" ? "pt-PT" : "en-GB");

const D = {
  stats: document.getElementById("statGrid"),
  rooms: document.getElementById("chartRooms"),
  hours: document.getElementById("chartHours"),
  days: document.getElementById("chartDays"),
  bookers: document.getElementById("chartBookers"),
};

const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
const endTs = (b) => new Date(`${b.date}T${b.endTime}`).getTime();

// Render a list of {label, value} as horizontal bars (value scaled to the max).
function barChart(el, items) {
  if (!items.length) { el.innerHTML = `<p class="empty">${T("dash.noData")}</p>`; return; }
  const max = Math.max(...items.map((i) => i.value)) || 1;
  el.innerHTML = items
    .map(
      (i) => `
      <div class="bar-row">
        <span class="bar-label" title="${esc(i.label)}">${esc(i.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round((i.value / max) * 100)}%"></span></span>
        <span class="bar-val">${i.value}</span>
      </div>`
    )
    .join("");
}

function statCard(label, value, accent) {
  return `<div class="stat-card ${accent || ""}"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function render() {
  const all = DB.getBookings();
  const active = all.filter((b) => b.status !== "cancelled");
  const now = Date.now();
  const cancelled = all.filter((b) => b.status === "cancelled").length;
  const held = active.filter((b) => !isNaN(endTs(b)) && endTs(b) <= now).length;
  const upcoming = active.filter((b) => isNaN(endTs(b)) || endTs(b) > now).length;
  const total = all.length;
  const rate = total ? Math.round((cancelled / total) * 100) : 0;
  const activeRooms = DB.getActiveRooms().length;

  D.stats.innerHTML =
    statCard(T("dash.total"), total) +
    statCard(T("dash.upcoming"), upcoming, "accent-blue") +
    statCard(T("dash.held"), held) +
    statCard(T("dash.cancelled"), cancelled, "accent-red") +
    statCard(T("dash.cancelRate"), rate + "%", rate >= 25 ? "accent-red" : "") +
    statCard(T("dash.activeRooms"), activeRooms);

  // Most-booked rooms (active bookings) — top 8.
  const roomCounts = {};
  active.forEach((b) => { const k = b.roomName || "—"; roomCounts[k] = (roomCounts[k] || 0) + 1; });
  barChart(D.rooms, Object.entries(roomCounts).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8));

  // Peak hours by start hour, 08:00–17:00.
  const hourCounts = {};
  active.forEach((b) => { const h = Math.floor(toMin(b.startTime) / 60); if (h >= 8 && h <= 17) hourCounts[h] = (hourCounts[h] || 0) + 1; });
  const hours = [];
  for (let h = 8; h <= 17; h++) hours.push({ label: `${String(h).padStart(2, "0")}:00`, value: hourCounts[h] || 0 });
  barChart(D.hours, hours);

  // Busiest weekdays (Mon–Sun).
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // index by Monday-based day
  active.forEach((b) => {
    const d = new Date(`${b.date}T00:00:00`);
    if (!isNaN(d)) { const idx = (d.getDay() + 6) % 7; dayCounts[idx]++; }
  });
  const ref = new Date("2024-01-01T00:00:00"); // a Monday
  const days = dayCounts.map((value, i) => {
    const dd = new Date(ref); dd.setDate(dd.getDate() + i);
    return { label: dd.toLocaleDateString(locale(), { weekday: "short" }), value };
  });
  barChart(D.days, days);

  // Top bookers — top 8.
  const bookerCounts = {};
  active.forEach((b) => { const k = b.bookedBy || "—"; bookerCounts[k] = (bookerCounts[k] || 0) + 1; });
  barChart(D.bookers, Object.entries(bookerCounts).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8));
}

window.addEventListener("languagechange", render);

(async function init() {
  await DB.init();
  render();
  if (DB.isShared()) {
    setInterval(async () => { await DB.refresh(); render(); }, 15000);
    DB.onChange(async () => { await DB.refresh(); render(); });
  }
})();
