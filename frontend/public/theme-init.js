// Runs before the app loads so the saved theme is applied on the first paint (no white flash in dark mode).
// Kept as a separate file because the Content-Security-Policy does not allow inline scripts.
(function () {
  var choice = "system";
  try { choice = localStorage.getItem("cc-theme") || "system"; } catch { /* storage blocked */ }
  var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var contrast = window.matchMedia && window.matchMedia("(prefers-contrast: more)").matches;
  var theme = choice === "system" ? (contrast ? "contrast" : dark ? "dark" : "light") : choice;
  if (theme !== "light" && theme !== "dark" && theme !== "contrast") theme = "light";
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#121715" : theme === "contrast" ? "#ffffff" : "#faf8f4");
})();
