// Theme preference, system changes, and toggle state.
export function initThemeToggle() {
  const root = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let storedTheme = null;

  try {
    storedTheme = localStorage.getItem('theme');
  } catch (e) {}

  let hasStoredPreference = storedTheme === 'light' || storedTheme === 'dark';

  function setTheme(theme) {
    const isLight = theme === 'light';
    root.dataset.theme = isLight ? 'light' : 'dark';

    if (toggle) {
      toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      toggle.setAttribute('aria-pressed', String(isLight));
    }

    if (themeColor) themeColor.content = isLight ? '#f7f6f3' : '#121212';
  }

  setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');

  if (toggle) {
    toggle.addEventListener('click', function () {
      const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      setTheme(theme);
      hasStoredPreference = true;

      try {
        localStorage.setItem('theme', theme);
      } catch (e) {}
    });
  }

  function followSystemPreference(event) {
    if (!hasStoredPreference) setTheme(event.matches ? 'light' : 'dark');
  }

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', followSystemPreference);
  } else {
    mediaQuery.addListener(followSystemPreference);
  }
}
