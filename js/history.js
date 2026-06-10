/* history.js — admin reporting: meetings that have already taken place */

const H = {
  list: document.getElementById("historyList"),
  from: document.getElementById("fromDate"),
  to: document.getElementById("toDate"),
  clear: document.getElementById("clearFilter"),
  csv: document.getElementById("exportCsv"),
  count: document.getElementById("countBadge"),
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const endTs = (b) => new Date(`${b.date}T${b.endTime}`).getTime();

// Report rows = cancelled meetings (any time) + meetings that have already ended.
// Optionally filtered by date range, newest first.
function reportBookings() {
  const now = Date.now();
  const from = H.from.value || null;
  const to = H.to.value || null;
  return DB.getBookings()
    .filter((b) => b.status === "cancelled" || (!isNaN(endTs(b)) && endTs(b) <= now))
    .filter((b) => (!from || b.date >= from) && (!to || b.date <= to))
    .sort((a, b) => (b.date + b.endTime).localeCompare(a.date + a.endTime));
}

function statusCell(b) {
  if (b.status === "cancelled") return `<span class="pill off">Cancelled</span>`;
  return `<span class="pill on">Held</span>`;
}

function render() {
  const rows = reportBookings();
  const cancelled = rows.filter((b) => b.status === "cancelled").length;
  H.count.textContent = `${rows.length} total · ${cancelled} cancelled`;
  if (!rows.length) {
    H.list.innerHTML = `<tr><td colspan="8" class="empty">No meetings for this range.</td></tr>`;
    return;
  }
  H.list.innerHTML = rows
    .map(
      (b) => `
      <tr>
        <td>${esc(b.date)}</td>
        <td>${esc(b.startTime)}–${esc(b.endTime)}</td>
        <td>${esc(b.roomName)}</td>
        <td>${esc(b.title)}</td>
        <td>${esc(b.bookedBy)}</td>
        <td>${statusCell(b)}</td>
        <td>${esc(b.cancelledBy || "")}</td>
        <td>${esc(b.cancelReason || "")}</td>
      </tr>`
    )
    .join("");
}

function exportCsv() {
  const rows = reportBookings();
  const header = ["Date", "Start", "End", "Room", "Meeting", "Booked by", "Status", "Cancelled by", "Reason"];
  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  rows.forEach((b) =>
    lines.push(
      [b.date, b.startTime, b.endTime, b.roomName, b.title, b.bookedBy,
       b.status === "cancelled" ? "Cancelled" : "Held", b.cancelledBy || "", b.cancelReason || ""]
        .map(csvCell)
        .join(",")
    )
  );
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meeting-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

H.from.addEventListener("change", render);
H.to.addEventListener("change", render);
H.clear.addEventListener("click", () => { H.from.value = ""; H.to.value = ""; render(); });
H.csv.addEventListener("click", exportCsv);

(async function init() {
  await DB.init();
  render();
  // Refresh so meetings that just ended appear, and others' bookings sync in.
  if (DB.isShared()) {
    setInterval(async () => { await DB.refresh(); render(); }, 15000);
  } else {
    setInterval(render, 30000); // local mode: just re-evaluate "now"
  }
})();
