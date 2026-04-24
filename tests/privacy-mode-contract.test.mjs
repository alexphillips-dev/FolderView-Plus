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
    assert.match(libPrefsPhp, /'privacyMode'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskNames'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskContainerIps'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskLocalIps'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskPorts'\s*=>\s*false/);
    assert.match(libPrefsPhp, /'privacyMode'\s*=>\s*normalizeBool\(\$dashboardIncoming\['privacyMode'\] \?\? true,\s*true\)/);
    assert.match(libPrefsPhp, /'privacyMaskNames'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskNames', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskNames'\], true\)/);
    assert.match(libPrefsPhp, /'privacyMaskContainerIps'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskContainerIps', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskContainerIps'\], true\)/);
    assert.match(libPrefsPhp, /'privacyMaskLocalIps'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskLocalIps', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskLocalIps'\], true\)/);
    assert.match(libPrefsPhp, /'privacyMaskPorts'\s*=>\s*normalizeBool\(\$dashboardIncoming\['privacyMaskPorts'\] \?\? false,\s*false\)/);
    assert.match(utilsJs, /privacyMode:\s*true/);
    assert.match(utilsJs, /privacyMaskNames:\s*true/);
    assert.match(utilsJs, /privacyMaskContainerIps:\s*true/);
    assert.match(utilsJs, /privacyMaskLocalIps:\s*true/);
    assert.match(utilsJs, /privacyMaskPorts:\s*false/);
    assert.match(utilsJs, /privacyMode:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMode'\)[\s\S]*incomingDashboard\.privacyMode === true/);
    assert.match(utilsJs, /privacyMaskNames:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskNames'\)[\s\S]*incomingDashboard\.privacyMaskNames !== false/);
    assert.match(utilsJs, /privacyMaskContainerIps:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskContainerIps'\)[\s\S]*incomingDashboard\.privacyMaskContainerIps !== false/);
    assert.match(utilsJs, /privacyMaskLocalIps:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskLocalIps'\)[\s\S]*incomingDashboard\.privacyMaskLocalIps !== false/);
    assert.match(utilsJs, /privacyMaskPorts:\s*incomingDashboard\.privacyMaskPorts === true/);
});

test('settings page exposes granular privacy controls under the dashboard privacy toggle', () => {
    assert.match(settingsPage, /id="docker-dashboard-privacy-mode"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-options"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-names"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-container-ips"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-local-ips"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-ports"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-mode"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-options"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-mask-names"/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMode', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskNames', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskContainerIps', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskLocalIps', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskPorts', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'privacyMode', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'privacyMaskNames', this\.checked\)/);
    assert.match(settingsJs, /#\$\{type\}-dashboard-privacy-options/);
    assert.match(settingsJs, /#\$\{type\}-dashboard-privacy-mask-names/);
    assert.match(settingsJs, /#docker-dashboard-privacy-mask-container-ips/);
    assert.match(settingsJs, /#docker-dashboard-privacy-mask-local-ips/);
    assert.match(settingsJs, /#docker-dashboard-privacy-mask-ports/);
    assert.match(settingsCss, /\.settings-privacy-options/);
});

test('privacy mask settings toggle runtime body classes and existing mask selectors', () => {
    assert.doesNotMatch(settingsJs, /const applySettingsPrivacyMode = \(\) =>/);
    assert.doesNotMatch(settingsJs, /fvplus-privacy-\$\{type\}-settings/);
    assert.doesNotMatch(settingsJs, /settings-mask-names/);
    assert.match(settingsJs, /privacyMaskNames:\s*dashboard\.privacyMaskNames !== false/);
    assert.match(settingsJs, /else if \(key === 'privacyMaskNames'\) \{/);
    assert.match(settingsJs, /else if \(key === 'privacyMaskContainerIps' && type === 'docker'\) \{/);
    assert.match(settingsJs, /else if \(key === 'privacyMaskLocalIps' && type === 'docker'\) \{/);
    assert.match(settingsJs, /else if \(key === 'privacyMaskPorts' && type === 'docker'\) \{/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime', dockerPrivacyMode\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-names', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskNames !== false\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-container-ips', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskContainerIps !== false\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-local-ips', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskLocalIps !== false\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-ports', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskPorts === true\)/);
    assert.match(vmJs, /toggleClass\('fvplus-privacy-vm-runtime', vmPrivacyMode\)/);
    assert.match(vmJs, /toggleClass\('fvplus-privacy-vm-runtime-mask-names', vmPrivacyMode && normalized\?\.dashboard\?\.privacyMaskNames !== false\)/);
    assert.match(dashboardJs, /toggleClass\('fvplus-privacy-docker-dashboard', dockerPrivacyMode\)/);
    assert.match(dashboardJs, /toggleClass\('fvplus-privacy-docker-dashboard-mask-names', dockerPrivacyMode && dockerPrefs\?\.dashboard\?\.privacyMaskNames !== false\)/);
    assert.match(dashboardJs, /toggleClass\('fvplus-privacy-vm-dashboard', vmPrivacyMode\)/);
    assert.match(dashboardJs, /toggleClass\('fvplus-privacy-vm-dashboard-mask-names', vmPrivacyMode && vmPrefs\?\.dashboard\?\.privacyMaskNames !== false\)/);
    assert.doesNotMatch(settingsCss, /body\.fvplus-privacy-docker-settings/);
    assert.doesNotMatch(settingsCss, /body\.fvplus-privacy-docker-settings-mask-names/);
    assert.doesNotMatch(settingsCss, /body\.fvplus-privacy-vm-settings/);
    assert.doesNotMatch(settingsCss, /body\.fvplus-privacy-vm-settings-mask-names/);
    assert.match(dockerCss, /body\.fvplus-privacy-docker-runtime/);
    assert.match(dockerCss, /body\.fvplus-privacy-docker-runtime-mask-names/);
    assert.match(vmCss, /body\.fvplus-privacy-vm-runtime/);
    assert.match(vmCss, /body\.fvplus-privacy-vm-runtime-mask-names/);
    assert.match(dashboardCss, /body\.fvplus-privacy-docker-dashboard/);
    assert.match(dashboardCss, /body\.fvplus-privacy-docker-dashboard-mask-names/);
    assert.match(dashboardCss, /body\.fvplus-privacy-vm-dashboard/);
    assert.match(dashboardCss, /body\.fvplus-privacy-vm-dashboard-mask-names/);
});

test('docker privacy mode formats port mappings without raw IPs when masks are enabled', () => {
    assert.match(dockerJs, /const getDockerRuntimePrivacyOptions = \(prefs = null\) =>/);
    assert.match(dockerJs, /maskContainerIps: enabled && dashboard\.privacyMaskContainerIps !== false/);
    assert.match(dockerJs, /maskLocalIps: enabled && dashboard\.privacyMaskLocalIps !== false/);
    assert.match(dockerJs, /maskPorts: enabled && dashboard\.privacyMaskPorts === true/);
    assert.match(dockerJs, /const buildDockerPortMappingsHtml = \(ports = \[\]\) =>/);
    assert.match(dockerJs, /const refreshDockerRuntimePrivacyPortMappings = \(\) =>/);
    assert.match(dockerJs, /findDockerRuntimeInfoByShortId\(shortId\)/);
    assert.match(dockerJs, /node\.innerHTML = buildDockerPortMappingsHtml\(ports\);/);
    assert.match(dockerJs, /refreshDockerRuntimePrivacyPortMappings\(\);/);
    assert.match(dockerJs, /buildDockerPortMappingsHtml\(runtimeEntry\.info\.Ports\)/);
    assert.doesNotMatch(dockerJs, /e\.PrivateIP \? e\.PrivateIP \+ ':' : ''/);
    assert.doesNotMatch(dockerJs, /e\.PublicIP \? e\.PublicIP \+ ':' : ''/);
});

test('docker runtime privacy toggle stays in sync with saved dashboard privacy prefs', () => {
    assert.match(dockerJs, /const readDockerRuntimePrivacyMode = \(\) => utils\.normalizePrefs\(folderTypePrefs \|\| \{\}\)\.dashboard\?\.privacyMode === true;/);
    assert.match(dockerJs, /const enabled = readDockerRuntimePrivacyMode\(\);/);
    assert.match(dockerJs, /checked: enabled/);
    assert.match(dockerJs, /basePrefs = await fetchDockerBootstrapPrefs\(\);/);
    assert.match(dockerJs, /buildDockerRuntimePrivacyPrefsPayload\(nextEnabled, basePrefs\)/);
    assert.match(dockerJs, /persistDockerRuntimePrivacyMode\(targetEnabled, folderTypePrefs\)/);
    assert.match(dockerJs, /folderTypePrefs = utils\.normalizePrefs\(prefsResponse\?\.prefs \|\| \{\}\);[\s\S]*applyRuntimePrefs\(folderTypePrefs\);/);
    assert.match(dockerJs, /folderTypePrefs = nextPrefs;[\s\S]*applyRuntimePrefs\(nextPrefs\);/);
    assert.match(dockerJs, /queueDockerRuntimePrivacyToggleMount\(\);/);
});
