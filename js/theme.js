/* theme.js — night/day mode with persistence */
(function () {
  const KEY = "mrb_theme";

  // Apply the saved theme (or OS preference) immediately to avoid a flash.
  function current() {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
    const btn = document.querySelector(".theme-toggle");
    if (btn) {
      const dark = theme === "dark";
      btn.textContent = dark ? "☀️" : "🌙";
      btn.title = dark ? "Switch to day mode" : "Switch to night mode";
      btn.setAttribute("aria-label", btn.title);
    }
  }

  // Run before paint.
  apply(current());

  // Wire up the toggle once the DOM is ready.
  document.addEventListener("DOMContentLoaded", () => {
    apply(current());
    const btn = document.querySelector(".theme-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        apply(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      });
    }
  });
})();
