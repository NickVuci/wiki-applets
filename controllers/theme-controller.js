const THEME_STORAGE_KEY = "microtonal-pitch-trainer-theme";

export function initThemeController({ dom }) {
  const { themeToggleButton } = dom.audioControls;

  themeToggleButton.addEventListener("click", toggleTheme);

  function initializeTheme() {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const preferredTheme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : "light";

    applyTheme(preferredTheme);
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggleButton.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  initializeTheme();

  return {
    initializeTheme
  };
}
