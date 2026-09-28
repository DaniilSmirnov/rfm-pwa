(() => {
  const nav = navigator;
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem('rfm-theme-v1');
  } catch {}
  const theme =
    savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#111318' : '#f5f5f5');
  const ios =
    /iPhone|iPad|iPod/i.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone =
    nav.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches;
  document.documentElement.dataset.ios = ios ? 'true' : 'false';
  document.documentElement.dataset.standalone = standalone ? 'true' : 'false';
})();
