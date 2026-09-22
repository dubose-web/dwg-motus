// Shared demo chrome: nav links plus the no-js guard the README documents.
document.documentElement.classList.remove('no-js');

const PAGES = [
  ['index.html', 'Basics'],
  ['anchor.html', 'Anchors'],
  ['offset.html', 'Offset'],
  ['once.html', 'Once & mirror'],
  ['async.html', 'Dynamic DOM'],
  ['headless.html', 'Headless'],
];

const here = location.pathname.split('/').pop() || 'index.html';

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('nav');
  if (!nav) return;
  nav.innerHTML = PAGES.map(
    ([href, label]) =>
      `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
});
