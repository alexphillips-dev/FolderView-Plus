import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const settingsSearchJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-search.js');
const chromeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.chrome.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');

test('settings search topbar exposes compact accessible controls and advanced scope', () => {
    assert.match(chromeJs, /type="search" id="fv-settings-search"/);
    assert.match(chromeJs, /aria-controls="fv-settings-root"/);
    assert.match(chromeJs, /aria-describedby="fv-settings-search-status"/);
    assert.match(chromeJs, /id="fv-settings-search-status"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(chromeJs, /id="fv-settings-clear-search"/);
    assert.match(chromeJs, /id="fv-settings-search-scope"[\s\S]*Current tab[\s\S]*All advanced/);
    assert.doesNotMatch(chromeJs, /fv-search-all-advanced|Search all advanced/);
});

test('settings topbar exposes a conditional accessible plugin update link', () => {
    assert.match(chromeJs, /id="fv-plugin-update-link"[^>]*href="\/Plugins"[^>]*hidden/);
    assert.match(chromeJs, /class="fv-plugin-update-icon"[^>]*aria-hidden="true"[^>]*focusable="false"/);
    assert.match(chromeJs, /data-i18n="settings\.update\.available">Update Available/);
    assert.match(settingsJs, /const setPluginUpdateIndicator = \(response = null\) =>/);
    assert.match(settingsJs, /response\?\.ok === true && response\?\.updateAvailable === true/);
    assert.match(settingsJs, /apiGetJson\('\/plugins\/folderview\.plus\/server\/update_check\.php'\)/);
    assert.match(settingsJs, /void refreshPluginUpdateIndicator\(\);/);
    assert.match(settingsCss, /\.fv-settings-subtitle\s*\{[\s\S]*?font-size:\s*1\.3rem/);
    assert.match(settingsCss, /\.fv-plugin-update-link\s*\{[\s\S]*?font-size:\s*1\.3rem;[\s\S]*?font-weight:\s*700/);
    assert.match(settingsCss, /\.fv-plugin-update-link\[hidden\]\s*\{[\s\S]*?display:\s*none !important/);
});

test('settings search uses cached privacy-safe field indexing and word-token matching', () => {
    assert.match(settingsJs, /const SETTINGS_SEARCH_DEBOUNCE_MS = 90;/);
    assert.match(settingsSearchJs, /const buildIndex = \(\) => \{/);
    assert.match(settingsSearchJs, /if \(index\.length > 0\)/);
    assert.match(settingsSearchJs, /const tokenize = \(query\) =>/);
    assert.match(settingsSearchJs, /tokens\.every\(\(token\) => text\.includes\(token\)\)/);
    assert.match(settingsSearchJs, /section\.key,[\s\S]*section\.title,[\s\S]*getPrivacySafeText\(target\)/);
    assert.match(settingsSearchJs, /SETTINGS_SEARCH_PRIVATE_SELECTOR/);
    assert.match(settingsSearchJs, /'tbody'[\s\S]*'\[role="listbox"\]'[\s\S]*'\[id\$="-output"\]'/);
    assert.match(settingsSearchJs, /clone\.querySelectorAll\([\s\S]*'input'[\s\S]*'select'[\s\S]*'textarea'/);
    assert.match(settingsSearchJs, /node !== element && node\.closest\?\.\(SETTINGS_SEARCH_PRIVATE_SELECTOR\)/);
    assert.doesNotMatch(settingsJs, /getSectionSearchHaystack/);
});

test('settings search provides field highlighting navigation feedback and reset behavior', () => {
    assert.match(settingsJs, /const syncSettingsSearchMatchPresentation =/);
    assert.match(settingsSearchJs, /classList\.add\('fv-setting-search-match'\)/);
    assert.match(settingsSearchJs, /const focusFirstMatch =/);
    assert.match(settingsJs, /event\.key === 'Escape'[\s\S]*clearSettingsSearch\(\)/);
    assert.match(settingsJs, /event\.key === 'Enter'[\s\S]*focusFirstSettingsSearchMatch\(\)/);
    assert.match(settingsSearchJs, /No settings found/);
    assert.match(settingsSearchJs, /data-fv-clear-settings-search/);
    assert.match(settingsCss, /\.fv-setting-search-match\s*\{/);
    assert.match(settingsCss, /\.fv-settings-search-empty\s*\{/);
});

test('settings search keeps Basic and per-tab Advanced queries and hides irrelevant scope', () => {
    assert.match(settingsJs, /basicSearchQuery:\s*''/);
    assert.match(settingsJs, /basicQuery:\s*normalizedFilter\(settingsUiState\.basicSearchQuery\)/);
    assert.match(settingsJs, /settingsUiState\.basicSearchQuery = source\.advancedSearch\.basicQuery/);
    assert.match(settingsJs, /writeActiveAdvancedSearchQuery\(settingsUiState\.query\)/);
    assert.match(settingsJs, /settingsUiState\.mode === 'advanced' && settingsUiState\.searchAllAdvanced !== true/);
    assert.match(settingsCss, /#fv-settings-topbar\[data-fv-mode="basic"\] \.fv-search-scope\s*\{[\s\S]*display:\s*none/);
});

test('settings search aligns with desktop mode controls without overlapping them', () => {
    assert.match(settingsCss, /\.fv-settings-right\s*\{[\s\S]*align-items:\s*flex-start[\s\S]*flex-wrap:\s*nowrap/);
    assert.match(settingsCss, /\.fv-settings-search-block\s*\{[\s\S]*display:\s*inline-grid[\s\S]*width:\s*clamp\(240px,\s*20vw,\s*320px\)/);
    assert.match(settingsCss, /\.fv-settings-search-wrap\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*width:\s*100%/);
    assert.match(settingsCss, /@media \(max-width:\s*760px\)[\s\S]*\.fv-settings-right\s*\{[\s\S]*align-items:\s*center/);
});

test('settings Wizard control aligns with the toolbar and uses theme-aware blue text', () => {
    assert.match(settingsCss, /#fv-run-wizard\s*\{[\s\S]*align-self:\s*flex-start[\s\S]*margin:\s*0\.18rem 0 0/);
    assert.match(settingsCss, /#fv-run-wizard\s*\{[\s\S]*min-height:\s*34px/);
    assert.match(settingsCss, /#fv-settings-root #fv-run-wizard\s*\{[\s\S]*color:\s*var\(--fvplus-settings-chip-info\) !important/);
});

test('settings search clear control resists host button inflation', () => {
    assert.match(settingsCss, /#fv-settings-root #fv-settings-clear-search\s*\{[\s\S]*width:\s*24px !important[\s\S]*min-width:\s*24px !important/);
    assert.match(settingsCss, /#fv-settings-root #fv-settings-clear-search\s*\{[\s\S]*padding:\s*0 !important[\s\S]*border:\s*0 !important[\s\S]*box-shadow:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root #fv-settings-clear-search \.fa\s*\{[\s\S]*font-size:\s*0\.8rem/);
});

test('Basic shortcuts reveal the chosen workspace, clear filtering and transfer keyboard focus', () => {
    const source = settingsJs.match(/const openBasicSettingsShortcut = \(key\) => \{[\s\S]*?\n\};/)?.[0];
    assert.ok(source);
    const calls = [];
    const heading = { setAttribute: (...args) => calls.push(['attribute', ...args]), focus: () => calls.push(['focus']) };
    const state = { sections: [{ key: 'backups', advanced: true, advancedGroup: 'recovery', heading }, { key: 'docker', advanced: false, heading }], expandedAdvancedSections: new Set() };
    const context = vm.createContext({ settingsUiState: state,
        persistExpandedAdvancedSections: () => calls.push(['expand']),
        setAdvancedTab: tab => calls.push(['tab', tab]), setSettingsMode: mode => calls.push(['mode', mode]),
        clearSettingsSearch: () => calls.push(['clear']), scrollToSectionKey: key => calls.push(['scroll', key])
    });
    vm.runInContext(`${source}; openBasicSettingsShortcut('backups');`, context);
    assert.equal(state.activeSectionKey, 'backups');
    assert.equal(state.expandedAdvancedSections.has('backups'), true);
    assert.deepEqual(calls, [['expand'], ['tab', 'recovery'], ['mode', 'advanced'], ['clear'], ['scroll', 'backups'], ['attribute', 'tabindex', '-1'], ['focus']]);
    calls.length = 0;
    vm.runInContext("openBasicSettingsShortcut('docker'); openBasicSettingsShortcut('unsupported');", context);
    assert.deepEqual(calls.map(call => call[0]), ['mode', 'clear', 'scroll', 'attribute', 'focus']);
    assert.equal(calls[0][1], 'basic');
    assert.match(chromeJs, /data-fv-settings-shortcut="theme-workspace"/);
});
