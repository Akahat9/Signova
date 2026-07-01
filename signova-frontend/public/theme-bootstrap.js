(function applySignovaThemeBeforePaint() {
  try {
    var saved = JSON.parse(window.localStorage.getItem('signova-settings-v1') || 'null');
    var preference = saved && saved.display && saved.display.theme
      ? saved.display.theme
      : 'system';
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var useDark = preference === 'dark' || (preference === 'system' && systemDark);
    var theme = useDark ? 'dark' : 'light';
    document.documentElement.dataset.signovaTheme = theme;
    document.documentElement.classList.toggle('signovaPremiumDarkPage', useDark);
    document.documentElement.style.colorScheme = theme;
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', useDark ? '#0d1117' : '#1d4f9a');
  } catch (error) {
    document.documentElement.dataset.signovaTheme = 'light';
  }
}());
