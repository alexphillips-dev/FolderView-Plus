import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-order.php');
const prefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php');
const validationPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php');
const prefsEndpoint = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/prefs.php');
const startOrderEndpoint = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/docker_start_order.php');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const startOrderCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/start-order-workspace.css');
const utilsNormalizationJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-normalization.js');
const utilsPrefsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-prefs.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const startOrderModelJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-model.js');
const startOrderViewJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-view.js');
const startOrderWorkspaceJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-workspace.js');
const startOrderSequencePhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.docker-start-order-sequence.php');

test('Docker start-order preferences are normalized and accepted', () => {
    assert.match(prefsPhp, /'dockerStartOrder'\s*=>\s*\[/);
    assert.match(prefsPhp, /function normalizeDockerStartOrderPrefs\(\$value\): array/);
    assert.match(prefsPhp, /'mode'\s*=>\s*\$mode/);
    assert.match(prefsPhp, /'remaining'\s*=>\s*\$remaining/);
    assert.match(prefsPhp, /'batches'\s*=>\s*\$batches/);
    assert.match(validationPhp, /'dockerStartOrder'/);
    assert.match(validationPhp, /dockerStartOrder\.batches/);
    assert.match(utilsNormalizationJs, /DEFAULT_DOCKER_START_ORDER/);
    assert.match(utilsPrefsJs, /dockerStartOrder/);
    assert.match(prefsPhp, /'unmanaged'/);
    assert.match(prefsPhp, /'containerWaits'\s*=>\s*\$containerWaits/);
    assert.match(startOrderModelJs, /const MODES = Object\.freeze\(\['unmanaged', 'docker-page', 'custom-batches'\]\)/);
    assert.match(startOrderModelJs, /modules\.startOrderModel = factory\(\)/);
});

test('server builds preview and sync order from Docker page or custom batches', () => {
    assert.match(libPhp, /function buildDockerStartOrderContext\(\): array/);
    assert.match(libPhp, /function buildDockerPageStartOrder\(array \$context\): array/);
    assert.match(libPhp, /function buildDockerCustomStartOrder\(array \$context, array \$plan\): array/);
    assert.match(libPhp, /function buildDockerStartOrderPlan\(array \$context = null\): array/);
    assert.match(libPhp, /function dockerStartOrderPreview\(\): array/);
    assert.match(libPhp, /custom-batches/);
    assert.match(libPhp, /fvplus_set_autostart_line_delay/);
    assert.match(libPhp, /autostartOrder/);
    assert.match(libPhp, /buildDockerStartOrderSequence/);
    assert.match(startOrderSequencePhp, /function buildDockerStartOrderSequence/);
    assert.match(startOrderSequencePhp, /array_key_exists\(\$name, \$waits\)/);
    assert.match(startOrderSequencePhp, /function applyDockerStartOrderSequenceWaits/);
    assert.match(libPhp, /skipped because Docker start order is unmanaged/);
    assert.match(libPhp, /'managed'\s*=>\s*\$mode !== 'unmanaged'/);
    assert.match(prefsEndpoint, /normalizeDockerStartOrderPrefs\(\$current\['dockerStartOrder'\]/);
    assert.match(startOrderEndpoint, /dockerStartOrderPreview\(\)/);
    assert.match(startOrderEndpoint, /syncContainerOrder\('docker'\)/);
});

test('settings page exposes a user-friendly Docker start-order workspace', () => {
    assert.match(settingsPage, /id="docker-start-order-stage"/);
    assert.match(settingsPage, /Docker start order/);
    assert.match(settingsJs, /const renderDockerStartOrderWorkspace = \(options = \{\}\) =>/);
    assert.match(startOrderViewJs, /data-fv-start-order-region="preview"/);
    assert.match(settingsJs, /const preservePreview = options\.preservePreview === true && host\.find\('#docker-start-order-preview'\)\.length > 0;/);
    assert.match(settingsJs, /host\.find\('\[data-fv-start-order-region="top"\]'\)\.replaceWith\(dockerStartOrderView\.buildControlsHtml\(plan\)\);/);
    assert.match(settingsJs, /host\.find\('\[data-fv-start-order-region="batches"\]'\)\.replaceWith\(dockerStartOrderView\.buildBatchesHtml\(batches, batchOptions\)\);/);
    assert.match(settingsJs, /dockerStartOrderFolderOptionsCache/);
    assert.match(settingsJs, /dockerStartOrderContainerOptionsCache/);
    assert.match(startOrderViewJs, /Leave Unraid order unmanaged/);
    assert.match(startOrderViewJs, /Follow Docker page order/);
    assert.match(startOrderViewJs, /Custom batch order/);
    assert.match(startOrderViewJs, /Remaining autostart containers/);
    assert.match(startOrderViewJs, /Preview autostart sequence/);
    assert.match(startOrderViewJs, /fv-start-order-table/);
    assert.match(startOrderViewJs, /fv-start-order-switch/);
    assert.match(startOrderViewJs, /net\.unraid\.docker\.icon/);
    assert.match(settingsJs, /syncDockerStartOrderNow/);
    assert.match(settingsJs, /toggleDockerStartOrderAutostart/);
    assert.match(settingsJs, /updateDockerStartOrderWait/);
    assert.match(startOrderWorkspaceJs, /updateAutostartConfiguration/);
});

test('Docker start-order workspace uses shared Settings dark-mode tokens', () => {
    assert.match(startOrderCss, /\.fv-docker-start-order-panel\s*\{[\s\S]*var\(--fvplus-settings-surface-panel\)/);
    assert.match(startOrderCss, /\.fv-docker-start-order-workspace\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(startOrderCss, /\.fv-docker-start-order-batch,[\s\S]*\.fv-docker-start-order-disabled\s*\{[\s\S]*var\(--fvplus-settings-surface-card\)/);
    assert.match(startOrderCss, /background:\s*var\(--fvplus-settings-button-quiet-top\);/);
    assert.doesNotMatch(startOrderCss, /background:\s*#(?:181b20|1a1d22|1c2026|202329|20242a|101216)/);
    assert.doesNotMatch(startOrderCss, /linear-gradient\(180deg,\s*#31353d/);
});

test('Docker page sync hook is guarded and triggers autostart sync after relevant saves', () => {
    assert.match(dockerJs, /if \(!data\.has\('names'\)\)/);
    assert.match(dockerJs, /scheduleFolderViewPlusDockerStartOrderSync/);
    assert.match(dockerJs, /server\/sync_order\.php/);
    assert.match(dockerJs, /ajaxComplete/);
    assert.match(dockerJs, /action=\(autostart\|wait\)/);
});
