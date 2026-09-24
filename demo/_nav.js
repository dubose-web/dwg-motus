// We render the shared nav here; the no-js guard lives in each <head>.
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
