// Apply the persisted theme before first paint to avoid a light/dark flash.
// Kept as a static file (not inline) so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var raw = localStorage.getItem('flowsync.ui');
    var theme = raw ? JSON.parse(raw).state.theme : 'system';
    var dark =
      theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (_) {
    /* ignore */
  }
})();
