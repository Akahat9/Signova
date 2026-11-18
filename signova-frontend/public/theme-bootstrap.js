(function applySignovaThemeBeforePaint() {
  try {
    var directTheme = window.localStorage.getItem('signova-display-theme-v1');
    var saved = null;
    try {
      saved = JSON.parse(window.localStorage.getItem('signova-settings-v1') || 'null');
    } catch (e) {}

    var savedSettings = saved ? (saved.settings || saved) : null;
    var settingsTheme = savedSettings && savedSettings.display ? savedSettings.display.theme : null;

    var preference = directTheme || settingsTheme || 'light';
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var useDark = preference === 'dark' || (preference === 'system' && systemDark);
    var theme = useDark ? 'dark' : 'light';

    document.documentElement.dataset.signovaTheme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.add('signova-theme-init');

    if (useDark) {
      document.documentElement.classList.add('premiumDarkMode', 'signovaPremiumDarkPage');
    } else {
      document.documentElement.classList.remove('premiumDarkMode', 'signovaPremiumDarkPage');
    }

    if (document.body) {
      document.body.dataset.signovaTheme = theme;
      document.body.style.colorScheme = theme;
      if (useDark) {
        document.body.classList.add('premiumDarkMode', 'signovaPremiumDarkPage');
      } else {
        document.body.classList.remove('premiumDarkMode', 'signovaPremiumDarkPage');
      }
    }

    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', useDark ? '#090b0f' : '#f4f6fa');
    }

    // Release initial transition lock after first paint
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function() {
        window.requestAnimationFrame(function() {
          document.documentElement.classList.remove('signova-theme-init');
        });
      });
    } else {
      setTimeout(function() {
        document.documentElement.classList.remove('signova-theme-init');
      }, 50);
    }
  } catch (error) {
    document.documentElement.dataset.signovaTheme = 'light';
  }
}());
