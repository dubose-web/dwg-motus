// Shared demo nav. The no-js guard lives inline in each page's <head>, where
// nothing can block it.
const PAGES = [
  ['index.html', 'Basics'],
  ['anchor.html', 'Anchors'],
  ['offset.html', 'Offset'],
  ['once.html', 'Once & mirror'],
  ['async.html', 'Dynamic DOM'],
  ['headless.html', 'Headless'],
  ['candidates.html', 'Candidates'],
  ['diagnose.html', 'Diagnose'],
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
