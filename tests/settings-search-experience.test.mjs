import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
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

test('settings search uses cached privacy-safe field indexing and word-token matching', () => {
    assert.match(settingsJs, /const SETTINGS_SEARCH_DEBOUNCE_MS = 90;/);
    assert.match(settingsJs, /const buildSettingsSearchIndex = \(\) => \{/);
    assert.match(settingsJs, /settingsUiState\.searchIndex\.length > 0/);
    assert.match(settingsJs, /const tokenizeSettingsSearchQuery =/);
    assert.match(settingsJs, /tokens\.every\(\(token\) => text\.includes\(token\)\)/);
    assert.match(settingsJs, /section\.key,[\s\S]*section\.title,[\s\S]*getPrivacySafeSettingsSearchText\(target\)/);
    assert.match(settingsJs, /SETTINGS_SEARCH_PRIVATE_SELECTOR/);
    assert.match(settingsJs, /'tbody'[\s\S]*'\[role="listbox"\]'[\s\S]*'\[id\$="-output"\]'/);
    assert.match(settingsJs, /clone\.querySelectorAll\([\s\S]*'input'[\s\S]*'select'[\s\S]*'textarea'/);
    assert.match(settingsJs, /node !== element && node\.closest\?\.\(SETTINGS_SEARCH_PRIVATE_SELECTOR\)/);
    assert.doesNotMatch(settingsJs, /getSectionSearchHaystack/);
});

test('settings search provides field highlighting navigation feedback and reset behavior', () => {
    assert.match(settingsJs, /const syncSettingsSearchMatchPresentation =/);
    assert.match(settingsJs, /classList\.add\('fv-setting-search-match'\)/);
    assert.match(settingsJs, /const focusFirstSettingsSearchMatch =/);
    assert.match(settingsJs, /event\.key === 'Escape'[\s\S]*clearSettingsSearch\(\)/);
    assert.match(settingsJs, /event\.key === 'Enter'[\s\S]*focusFirstSettingsSearchMatch\(\)/);
    assert.match(settingsJs, /No settings found/);
    assert.match(settingsJs, /data-fv-clear-settings-search/);
    assert.match(settingsCss, /\.fv-setting-search-match\s*\{/);
    assert.match(settingsCss, /\.fv-settings-search-empty\s*\{/);
});

test('settings search keeps Basic and per-tab Advanced queries and hides irrelevant scope', () => {
    assert.match(settingsJs, /basicSearchQuery:\s*''/);
    assert.match(settingsJs, /basicQuery:\s*normalizedFilter\(settingsUiState\.basicSearchQuery\)/);
    assert.match(settingsJs, /settingsUiState\.basicSearchQuery = normalizedFilter\(sourceAdvancedSearch\.basicQuery\)/);
    assert.match(settingsJs, /writeActiveAdvancedSearchQuery\(settingsUiState\.query\)/);
    assert.match(settingsJs, /settingsUiState\.mode === 'advanced' && settingsUiState\.searchAllAdvanced !== true/);
    assert.match(settingsCss, /#fv-settings-topbar\[data-fv-mode="basic"\] \.fv-search-scope\s*\{[\s\S]*display:\s*none/);
});
