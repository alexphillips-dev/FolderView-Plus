/* Test-only Aurora 2026.10.28.1932 page heading excerpt, commit
 * 1d994b539923731b1b103c38f50c9c0de692d661. Functions below copied from
 * plugin/src/scripts/enhance.js; the fixture exports pageHeading for load-order checks.
 * https://github.com/Tunefish92/Aurora-Theme
 * MIT: aurora.LICENSE.txt. No server handlers or other enhancers are included.
 */
(function () {
  const TABS = { Settings: ['Configuration', 'System, network service and preference settings.'] };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function pageHeading(info) {
    const box = document.getElementById('displaybox');
    if (!box || !info.tab || box.querySelector('.tp-heading')) return;
    const known = TABS[info.tab];
    const heading = element('div', 'tp-heading');
    // The Apps tab's search bar sits above the heading on phones (theme.css adds the space).
    if (document.querySelector('.searchAreaHolder')) heading.classList.add('tp-heading-below-search');
    const text = element('div', 'tp-heading-text');
    const eyebrow = info.subPage ? info.tab : known && known[0];
    if (eyebrow) text.append(element('p', 'tp-eyebrow', eyebrow));
    text.append(element('h1', '', info.subPage || info.tab));
    if (known && !info.subPage) text.append(element('p', 'tp-subtitle', known[1]));
    heading.append(text);
    box.prepend(heading);
  }
  window.fixtureAuroraPageHeading = pageHeading;
})();
