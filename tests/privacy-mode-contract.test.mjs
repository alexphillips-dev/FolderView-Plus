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
const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

test('privacy mode persists in prefs normalization on server and client', () => {
    assert.match(libPrefsPhp, /'privacyMode'\s*=>\s*false/);
    assert.match(libPrefsPhp, /'privacyMaskNames'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskContainerIps'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskLocalIps'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskPorts'\s*=>\s*true/);
    assert.match(libPrefsPhp, /'privacyMaskNames'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskNames', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskNames'\], true\)/);
    assert.match(libPrefsPhp, /'privacyMaskContainerIps'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskContainerIps', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskContainerIps'\], true\)/);
    assert.match(libPrefsPhp, /'privacyMaskLocalIps'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskLocalIps', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskLocalIps'\], true\)/);
    assert.match(libPrefsPhp, /'privacyMaskPorts'\s*=>\s*![\s\S]*array_key_exists\('privacyMaskPorts', \$dashboardIncoming\)[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMaskPorts'\], true\)/);
    assert.match(utilsJs, /privacyMode:\s*false/);
    assert.match(utilsJs, /privacyMaskNames:\s*true/);
    assert.match(utilsJs, /privacyMaskContainerIps:\s*true/);
    assert.match(utilsJs, /privacyMaskLocalIps:\s*true/);
    assert.match(utilsJs, /privacyMaskPorts:\s*true/);
    assert.match(utilsJs, /const PRIVACY_MODE_PREFS_SCHEMA = 3/);
    assert.match(utilsJs, /const privacyModePrefsReady = runtimePrefsSchema >= PRIVACY_MODE_PREFS_SCHEMA/);
    assert.match(utilsJs, /privacyMode:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMode'\)[\s\S]*privacyModePrefsReady && incomingDashboard\.privacyMode === true/);
    assert.match(libPhp, /const FVPLUS_PRIVACY_MODE_PREFS_SCHEMA = 3/);
    assert.match(libPrefsPhp, /\$privacyModePrefsReady = \$runtimePrefsSchema >= FVPLUS_PRIVACY_MODE_PREFS_SCHEMA/);
    assert.match(libPrefsPhp, /'privacyMode'\s*=>\s*\$privacyModePrefsReady[\s\S]*normalizeBool\(\$dashboardIncoming\['privacyMode'\] \?\? false,\s*false\)[\s\S]*:\s*false/);
    assert.match(utilsJs, /privacyMaskNames:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskNames'\)[\s\S]*incomingDashboard\.privacyMaskNames !== false/);
    assert.match(utilsJs, /privacyMaskContainerIps:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskContainerIps'\)[\s\S]*incomingDashboard\.privacyMaskContainerIps !== false/);
    assert.match(utilsJs, /privacyMaskLocalIps:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskLocalIps'\)[\s\S]*incomingDashboard\.privacyMaskLocalIps !== false/);
    assert.match(utilsJs, /privacyMaskPorts:\s*![\s\S]*hasOwnProperty\.call\(incomingDashboard, 'privacyMaskPorts'\)[\s\S]*incomingDashboard\.privacyMaskPorts !== false/);
});

test('settings page exposes granular privacy mask controls in dedicated privacy cards', () => {
    assert.doesNotMatch(settingsPage, /id="docker-dashboard-privacy-mode"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-options"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-names"/);
    assert.doesNotMatch(settingsPage, /id="docker-dashboard-privacy-mask-container-ips"/);
    assert.doesNotMatch(settingsPage, /id="docker-dashboard-privacy-mask-local-ips"/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-lan-ips"/);
    assert.match(settingsPage, /data-i18n="settings\.privacy\.mask-lan-ips">Mask LAN IPs<\/span><\/label>/);
    assert.match(settingsPage, /id="docker-dashboard-privacy-mask-ports"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-mode"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-options"/);
    assert.match(settingsPage, /id="vm-dashboard-privacy-mask-names"/);
    assert.match(settingsPage, /class="settings-mini-card fv-settings-card-privacy"[\s\S]*id="docker-dashboard-privacy-options"/);
    assert.match(settingsPage, /class="settings-mini-card fv-settings-card-privacy"[\s\S]*id="vm-dashboard-privacy-options"/);
    assert.doesNotMatch(settingsPage, /changeDashboardPref\('docker', 'privacyMode', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskNames', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskLocalIps', this\.checked\)/);
    assert.doesNotMatch(settingsPage, /changeDashboardPref\('docker', 'privacyMaskContainerIps', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('docker', 'privacyMaskPorts', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'privacyMode', this\.checked\)/);
    assert.match(settingsPage, /changeDashboardPref\('vm', 'privacyMaskNames', this\.checked\)/);
    assert.doesNotMatch(settingsJs, /#\$\{type\}-dashboard-privacy-options`\)\.toggleClass\('is-hidden', prefs\.privacyMode !== true\)/);
    assert.match(settingsJs, /#vm-dashboard-privacy-mode/);
    assert.match(settingsJs, /#\$\{type\}-dashboard-privacy-mask-names/);
    assert.match(settingsJs, /#docker-dashboard-privacy-mask-lan-ips/);
    assert.doesNotMatch(settingsJs, /#docker-dashboard-privacy-mask-container-ips/);
    assert.doesNotMatch(settingsJs, /#docker-dashboard-privacy-mask-local-ips/);
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
    assert.match(settingsJs, /await updatePrefsPartial\(type,\s*\{\s*dashboard:\s*\{\s*\[key\]: nextDashboard\[key\]\s*\}\s*\},\s*\{[\s\S]*immediate: key === 'layout' \|\| key === 'privacyMode' \|\| key\.startsWith\('privacyMask'\) \|\| key\.startsWith\('preview'\)/);
    assert.match(settingsJs, /postPrefs\(resolvedType, partial,\s*\{\s*currentPrefs: next,\s*immediate: options\.immediate === true/);
    assert.match(dockerJs, /dockerPrefsCoordinator\.subscribe\(\(snapshot\) =>[\s\S]*snapshot\?\.type !== 'docker'[\s\S]*applyRuntimePrefs\(nextPrefs\)/);
    assert.match(vmJs, /vmPrefsCoordinator\.subscribe\(\(snapshot\) =>[\s\S]*snapshot\?\.type !== 'vm'[\s\S]*applyRuntimePrefs\(folderTypePrefs\)/);
    assert.match(dashboardJs, /dashboardPrefsCoordinator\.subscribe\(\(snapshot\) =>[\s\S]*folderTypePrefs\[type\] = utils\.normalizePrefs\(snapshot\.prefs\)[\s\S]*applyDashboardRuntimePrefs\(\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime', dockerPrivacyMode\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-names', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskNames !== false\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-container-ips', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskContainerIps !== false\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-local-ips', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskLocalIps !== false\)/);
    assert.match(dockerJs, /toggleClass\('fvplus-privacy-docker-runtime-mask-ports', dockerPrivacyMode && normalized\?\.dashboard\?\.privacyMaskPorts !== false\)/);
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
    assert.match(dockerCss, /#docker_list \.folder-preview img\.img/);
    assert.match(dockerCss, /#docker_view \.folder-preview img\.img/);
    assert.match(dockerCss, /runtime-mask-container-ips #docker_list tr\.folder-element > td:nth-child\(4\) \.docker_readmore/);
    assert.match(dockerCss, /runtime-mask-ports #docker_list tr\.folder-element > td:nth-child\(5\) \.docker_readmore/);
    assert.doesNotMatch(dockerCss, /runtime-mask-local-ips #docker_list tr\.folder-element > td:nth-child\(6\) \.docker_readmore/);
    assert.doesNotMatch(dockerCss, /runtime-mask-ports #docker_list tr\.folder-element > td:nth-child\(6\) \.docker_readmore/);
    assert.match(dockerCss, /runtime-mask-local-ips \.fvplus-privacy-lan-ip-value/);
    assert.match(dockerCss, /runtime-mask-ports \.fvplus-privacy-lan-port-value/);
    assert.match(dockerJs, /const splitDockerLanEndpoint = \(value\) =>/);
    assert.match(dockerJs, /const decorateDockerRuntimeLanEndpointValues = \(\) =>/);
    assert.match(dockerJs, /fvplus-privacy-lan-ip-value/);
    assert.match(dockerJs, /fvplus-privacy-lan-port-value/);
    assert.match(dockerJs, /decorateDockerRuntimeLanEndpointValues\(\);/);
    assert.match(dockerJs, /const disconnect = dockerHostAdapter\.observeRows\(\(\) => \{\s*decorateDockerRuntimeLanEndpointValues\(\);/);
    assert.match(vmCss, /body\.fvplus-privacy-vm-runtime/);
    assert.match(vmCss, /body\.fvplus-privacy-vm-runtime-mask-names/);
    assert.match(dashboardCss, /body\.fvplus-privacy-docker-dashboard/);
    assert.match(dashboardCss, /body\.fvplus-privacy-docker-dashboard-mask-names/);
    assert.match(dashboardCss, /body\.fvplus-privacy-vm-dashboard/);
    assert.match(dashboardCss, /body\.fvplus-privacy-vm-dashboard-mask-names/);
});

test('docker privacy mode formats port mappings without raw IPs when masks are enabled', () => {
    assert.match(dockerJs, /const getDockerRuntimePrivacyOptions = \(prefs = null\) =>/);
    assert.match(dockerJs, /const enabled = resolveDockerRuntimePrivacyMode\(normalized\);/);
    assert.match(dockerJs, /maskContainerIps: enabled && dashboard\.privacyMaskContainerIps !== false/);
    assert.match(dockerJs, /maskLocalIps: enabled && dashboard\.privacyMaskLocalIps !== false/);
    assert.match(dockerJs, /maskPorts: enabled && dashboard\.privacyMaskPorts !== false/);
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
    assert.match(dockerCss, /\.fvplus-docker-runtime-toggle-label\s*\{[\s\S]*?font-size:\s*1\.1rem;/);
    assert.match(dockerCss, /\.ToggleViewMode\.fvplus-docker-runtime-toggle-cluster\s*\{[\s\S]*?margin-top:\s*-0\.7rem;[\s\S]*?margin-bottom:\s*0\.3rem;/);
    assert.match(dockerJs, /mount\.host\.classList\.toggle\('fvplus-docker-runtime-toggle-cluster', Boolean\(mount\.anchor\)\);/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_PRIVACY_MENU_BUTTON_ID = 'fvplus-docker-runtime-privacy-menu-button';/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_PRIVACY_MENU_ID = 'fvplus-docker-runtime-privacy-menu';/);
    for (const [key, label] of [
        ['privacyMaskNames', 'Mask names and icons'],
        ['privacyMaskLocalIps', 'Mask LAN IPs'],
        ['privacyMaskPorts', 'Mask ports'],
        ['privacyMaskVolumePaths', 'Mask volume paths'],
        ['privacyMaskImageRegistry', 'Mask image registries'],
        ['privacyMaskPublicIps', 'Mask public IPs'],
        ['privacyMaskInterfaces', 'Mask network interfaces'],
        ['privacyMaskExternalUrls', 'Mask external URLs']
    ]) {
        assert.match(dockerJs, new RegExp(`key: '${key}', label: '${label}'`));
    }
    assert.match(dockerJs, /aria-haspopup="dialog"/);
    assert.match(dockerJs, /data-fvplus-privacy-option=/);
    assert.match(dockerJs, /off_label:\s*'',\s*on_label:\s*''/);
    assert.match(dockerJs, /const setDockerRuntimePrivacyMaskPreference = async \(key, enabled\) =>/);
    assert.match(dockerJs, /dockerPrefsCoordinator\.save\('docker',[\s\S]*?\[key\]: enabled === true[\s\S]*?immediate: true/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu\s*\{[\s\S]*?var\(--fvplus-runtime-menu-bg/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu\s*\{[\s\S]*?font-size:\s*1\.2rem;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu\s*\{[\s\S]*?max-height:\s*min\(30rem, calc\(100vh - 3rem\)\);/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu-heading\s*\{[\s\S]*?font-size:\s*inherit;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu-help\s*\{[\s\S]*?font-size:\s*inherit;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-option\s*\{[\s\S]*?font-size:\s*inherit;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu\[hidden\]\s*\{[\s\S]*?display:\s*none !important;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-option\s*\{[\s\S]*?cursor:\s*pointer;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu-button\s*\{[\s\S]*?width:\s*fit-content !important;[\s\S]*?min-width:\s*0 !important;[\s\S]*?padding:\s*0\.18rem 0 !important;[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/);
    assert.match(dockerCss, /\.fvplus-docker-runtime-privacy-menu-button\.is-open\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/);
    assert.match(dockerJs, /const DOCKER_RUNTIME_PRIVACY_MODE_STORAGE_KEY = 'fvplus\.runtime\.privacy\.docker\.v1';/);
    assert.match(dockerJs, /const readDockerRuntimePrivacyMode = \(\) => resolveDockerRuntimePrivacyMode\(folderTypePrefs\);/);
    assert.match(dockerJs, /const stored = readStoredDockerRuntimePrivacyMode\(\);[\s\S]*if \(stored !== null\) \{[\s\S]*return stored;/);
    assert.match(dockerJs, /const enabled = readDockerRuntimePrivacyMode\(\);/);
    assert.match(dockerJs, /checked: enabled/);
    assert.match(dockerJs, /const basePrefs = previousPrefs;/);
    assert.doesNotMatch(dockerJs, /const setDockerRuntimePrivacyMode = async[\s\S]*?basePrefs = await fetchDockerBootstrapPrefs\(\);/);
    assert.match(dockerJs, /buildDockerRuntimePrivacyPrefsPayload\(nextEnabled, basePrefs\)/);
    assert.match(dockerJs, /persistDockerRuntimePrivacyMode\(targetEnabled, folderTypePrefs\)/);
    assert.match(dockerJs, /assertDockerPrefsSaveResponse\(response, 'Failed to save Docker privacy mode\.'\);/);
    assert.match(dockerJs, /if \(!response\?\.prefs \|\| typeof response\.prefs !== 'object' \|\| Array\.isArray\(response\.prefs\)\) \{/);
    assert.match(dockerJs, /if \(savedPrefs\.dashboard\?\.privacyMode !== \(enabled === true\)\) \{/);
    assert.match(dockerJs, /writeStoredDockerRuntimePrivacyMode\(nextEnabled\);/);
    assert.match(dockerJs, /const targetStored = readStoredDockerRuntimePrivacyMode\(\);/);
    assert.match(dockerJs, /clearTimeout\(dockerRuntimePrivacyServerReconcileTimer\);/);
    assert.match(dockerJs, /queueDockerRuntimePrivacyServerReconcile\(folderTypePrefs\);/);
    assert.match(dockerJs, /window\.addEventListener\('storage'/);
    assert.match(dockerJs, /folderTypePrefs = applyDockerPinnedFolderPrefsOverride\(normalizeDockerPrefsResponse\(prefsResponse\)\);[\s\S]*applyRuntimePrefs\(folderTypePrefs\);/);
    assert.match(dockerJs, /folderTypePrefs = nextPrefs;[\s\S]*applyRuntimePrefs\(nextPrefs\);/);
    assert.match(dockerJs, /queueDockerRuntimePrivacyToggleMount\(\);/);
});
