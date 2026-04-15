import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const utilsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const libPrefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');
const dashboardCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css');

test('privacy mode persists in prefs normalization on server and client', () => {
    assert.match(libPrefsPhp, /'privacyMode'\s*=>\s*false/);
    assert.match(libPrefsPhp, /'privacyMode'\s*=>\s*normalizeBool\(\$dashboardIncoming\['privacyMode'\] \?\? false,\s*false\)/);
    assert.match(utilsJs, /privacyMode:\s*false/);
    assert.match(utilsJs, /privacyMode:\s*incomingDashboard\.privacyMode === true/);
});

test('settings page exposes docker and vm privacy mode dashboard toggles', () => {
    assert.match(settingsPage, /id="docker-dashboard-privacy-mode"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-mode"/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMode', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'privacyMode', this\.checked\)/);
    assert.match(settingsJs, /const applySettingsPrivacyMode = \(\) =>/);
    assert.match(settingsJs, /toggleClass\(`fvplus-privacy-\$\{type\}-settings`, dashboard\.privacyMode === true\)/);
    assert.match(settingsJs, /privacyMode:\s*dashboard\.privacyMode === true/);
    assert.match(settingsJs, /#\$\{type\}-dashboard-privacy-mode/);
    assert.match(settingsJs, /else if \(key === 'privacyMode'\) \{/);
    assert.match(settingsJs, /nextDashboard\.privacyMode = value === true;/);
});

test('privacy mode toggles runtime body classes and ships masking selectors across settings runtime and dashboard surfaces', () => {
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime', normalized\?\.dashboard\?\.privacyMode === true\)/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_PRIVACY_TOGGLE_ID = 'fvplus-docker-runtime-privacy-toggle';/);
    assert.match(dockerJs, /const renderDockerRuntimePrivacyToggle = \(\) =>/);
    assert.match(dockerJs, /const findDockerRuntimeListViewToggleAnchor = \(\) =>/);
    assert.match(dockerJs, /const setDockerRuntimePrivacyMode = async \(enabled, options = \{\}\) =>/);
    assert.match(dockerJs, /queueDockerRuntimePrivacyToggleMount\(\);/);
    assert.match(vmJs, /toggleClass\('fvplus-privacy-vm-runtime', normalized\?\.dashboard\?\.privacyMode === true\)/);
    assert.match(dashboardJs, /toggleClass\('fvplus-privacy-docker-dashboard', dockerPrefs\?\.dashboard\?\.privacyMode === true\)/);
    assert.match(dashboardJs, /toggleClass\('fvplus-privacy-vm-dashboard', vmPrefs\?\.dashboard\?\.privacyMode === true\)/);
    assert.match(settingsCss, /body\.fvplus-privacy-docker-settings/);
    assert.match(settingsCss, /body\.fvplus-privacy-vm-settings/);
    assert.match(settingsCss, /#docker-tree-path-hint/);
    assert.match(settingsCss, /#vm-tree-path-hint/);
    assert.match(settingsCss, /\.bulk-item-name/);
    assert.match(dockerCss, /body\.fvplus-privacy-docker-runtime/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-toggle-shell/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-toggle-shell\.is-inline-cluster/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-toggle-label/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-toolbar-controls/);
    assert.match(dockerCss, /\.fv-docker-member-menu-name/);
    assert.match(vmCss, /body\.fvplus-privacy-vm-runtime/);
    assert.match(dashboardCss, /body\.fvplus-privacy-docker-dashboard/);
    assert.match(dashboardCss, /body\.fvplus-privacy-vm-dashboard/);
    assert.match(dashboardCss, /\.folder-appname-docker/);
    assert.match(dashboardCss, /\.folder-appname-vm/);
});
