import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);
const readInfoPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/read_info.php'
);
const thirdPartyIconsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/third_party_icons.php'
);
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);
const dashboardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
);
const dockerModulesPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.modules.js'
);
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const settingsImportJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js'
);
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);

const libPhp = fs.readFileSync(libPath, 'utf8');
const readInfoPhp = fs.readFileSync(readInfoPath, 'utf8');
const thirdPartyIconsPhp = fs.readFileSync(thirdPartyIconsPath, 'utf8');
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');
const dashboardJs = fs.readFileSync(dashboardJsPath, 'utf8');
const dockerModulesJs = fs.readFileSync(dockerModulesPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const settingsImportJs = fs.readFileSync(settingsImportJsPath, 'utf8');
const settingsRuntime = `${settingsJs}\n${settingsImportJs}`;
const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');

test('read_info supports cached full/state payload retrieval', () => {
    assert.match(libPhp, /const FVPLUS_INFO_CACHE_TTL_FULL\s*=\s*\d+/);
    assert.match(libPhp, /const FVPLUS_INFO_CACHE_TTL_STATE\s*=\s*\d+/);
    assert.match(libPhp, /function normalizeReadInfoMode\s*\(/);
    assert.match(libPhp, /function readInfoState\s*\(/);
    assert.match(libPhp, /function readInfoCached\s*\(/);
    assert.match(readInfoPhp, /readInfoCached\(\$type,\s*\$mode,\s*\$ttl,\s*\$forceRefresh\)/);
    assert.match(readInfoPhp, /\$_GET\['mode'\]|\$_REQUEST\['mode'\]/);
});

test('runtime refresh uses lightweight state mode checks before re-rendering', () => {
    assert.match(dockerJs, /read_info\.php\?type=docker&mode=state/);
    assert.match(vmJs, /read_info\.php\?type=vm&mode=state/);
    assert.match(dashboardJs, /read_info\.php\?type=\$\{type\}&mode=state/);
    assert.match(dockerJs, /queueLoadlistRefresh/);
    assert.match(vmJs, /queueLoadlistRefresh/);
    assert.match(dashboardJs, /queueLoadlistRefresh/);
});

test('dashboard widget renders root-level folders only when nested folders exist', () => {
    assert.match(dashboardJs, /const filterDashboardToRootFolders = \(folders\) =>/);
    assert.match(dashboardJs, /const dockerRootFolders = filterDashboardToRootFolders\(allDockerFolders\);/);
    assert.match(dashboardJs, /const vmRootFolders = filterDashboardToRootFolders\(allVmFolders\);/);
    assert.match(dashboardJs, /const parentId = normalizeFolderParentId\(folder\?\.parentId \|\| folder\?\.parent_id \|\| ''\);/);
    assert.match(dashboardJs, /Object\.keys\(rootOnly\)\.length/);
    assert.match(dashboardJs, /Object\.keys\(source\)\.length/);
    assert.match(dashboardJs, /const aggregateRootMatchCache = \(fullFolders,\s*rootFolders,\s*fullCache\) =>/);
    assert.match(dashboardJs, /const dockerMatchCache = aggregateRootMatchCache\(allDockerFolders,\s*folders,\s*dockerFullMatchCache\);/);
});

test('docker and vm render paths support precomputed membership caches', () => {
    assert.match(dockerJs, /buildDockerFolderMatchCache/);
    assert.match(dockerJs, /matchCacheEntry = null/);
    assert.match(vmJs, /buildVmFolderMatchCache/);
    assert.match(vmJs, /matchCacheEntry = null/);
});

test('third-party icon endpoint caches folder and icon scans', () => {
    assert.match(thirdPartyIconsPhp, /FVPLUS_THIRD_PARTY_ICON_CACHE_TTL/);
    assert.match(thirdPartyIconsPhp, /function readThirdPartyIconCache\s*\(/);
    assert.match(thirdPartyIconsPhp, /function writeThirdPartyIconCache\s*\(/);
    assert.match(thirdPartyIconsPhp, /thirdPartyFolderListSignature/);
    assert.match(thirdPartyIconsPhp, /thirdPartyFolderIconsSignature/);
});

test('row-centering observer scopes to docker containers instead of full document body by default', () => {
    assert.match(dockerModulesJs, /document\.querySelector\('#docker_list'\)/);
    assert.match(dockerModulesJs, /folderRowCenterObserver\.observe\(observerRoot/);
});

test('full readInfo docker template metadata uses cached signature index', () => {
    assert.match(libPhp, /FVPLUS_DOCKER_TEMPLATE_CACHE_TTL/);
    assert.match(libPhp, /function buildDockerTemplateSignature\s*\(/);
    assert.match(libPhp, /function getDockerTemplateIndexCached\s*\(/);
    assert.match(libPhp, /getDockerTemplateIndexCached\(\$dockerTemplates\)/);
});

test('tailscale helper calls support cache and running-state guard', () => {
    assert.match(libPhp, /FVPLUS_TAILSCALE_EXEC_CACHE_TTL/);
    assert.match(libPhp, /function fv3_read_tailscale_cache\s*\(/);
    assert.match(libPhp, /fv3_get_tailscale_fqdn_from_container\(string \$containerName,\s*bool \$containerRunning/);
    assert.match(libPhp, /fv3_get_tailscale_ip_from_container\(string \$containerName,\s*bool \$containerRunning/);
    assert.match(libPhp, /Skipping exec for stopped container/);
});

test('docker tooltip payload is lazy-built on first open', () => {
    assert.match(dockerJs, /const buildDockerTooltipContent\s*=\s*\(ct\)\s*=>/);
    assert.match(dockerJs, /fvTooltipLazyBuilt/);
    assert.match(dockerJs, /Loading preview\.\.\./);
});

test('import apply uses chunked execution and performance diagnostics panel exists', () => {
    assert.match(settingsRuntime, /IMPORT_APPLY_CHUNK_SIZE/);
    assert.match(settingsRuntime, /runImportChunked/);
    assert.match(settingsRuntime, /performanceDiagnosticsState/);
    assert.match(settingsRuntime, /renderPerformanceDiagnostics/);
    assert.match(settingsPage, /performance-diagnostics-output/);
});
