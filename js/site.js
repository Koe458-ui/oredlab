const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const header = document.querySelector('.header');
const year = document.getElementById('year');

function applyTheme(theme) {
  root.dataset.theme = theme;
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
  window.dispatchEvent(new CustomEvent('ored-theme', { detail: theme }));
}

themeToggle.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ored-theme', next); } catch (e) {}
  applyTheme(next);
});
applyTheme(root.dataset.theme);

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

if (year) year.textContent = new Date().getFullYear();
