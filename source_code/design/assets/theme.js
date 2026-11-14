(function () {
  "use strict";
  const KEY = "moksha.theme";
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  const forced = new URLSearchParams(location.search).get("theme");
  if (forced === "light" || forced === "dark") root.dataset.theme = forced;

  const media = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const current = () => root.dataset.theme || (media && media.matches ? "dark" : "light");
  function sync() {
    const dark = current() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(b => {
      b.setAttribute("aria-checked", dark);
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      const t = b.querySelector("[data-theme-label]");
      if (t) t.textContent = dark ? "Dark mode" : "Light mode";
    });
  }
  function set(t) {
    root.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (e) {}
    sync();
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-theme-toggle]")) set(current() === "dark" ? "light" : "dark");
  });
  if (media && media.addEventListener) media.addEventListener("change", sync);
  document.addEventListener("DOMContentLoaded", sync);
  window.MokshaTheme = { current, set, sync };
})();
