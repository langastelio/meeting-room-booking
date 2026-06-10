/* nav.js — fills the user badge, hides admin-only links, wires logout. */
document.addEventListener("DOMContentLoaded", () => {
  const s = Auth.session();

  const badge = document.getElementById("userBadge");
  if (badge && s) badge.textContent = `${s.name || s.username} · ${s.role}`;

  // Hide admin-only navigation for non-admins.
  if (!s || s.role !== "admin") {
    ["navAdmin", "navUsers", "navHistory"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => Auth.logout());
});
