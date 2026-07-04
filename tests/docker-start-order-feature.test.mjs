import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const prefsPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.prefs.php');
const validationPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php');
const prefsEndpoint = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/prefs.php');
const startOrderEndpoint = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/docker_start_order.php');
const settingsPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const utilsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');

test('Docker start-order preferences are normalized and accepted', () => {
    assert.match(prefsPhp, /'dockerStartOrder'\s*=>\s*\[/);
    assert.match(prefsPhp, /function normalizeDockerStartOrderPrefs\(\$value\): array/);
    assert.match(prefsPhp, /'mode'\s*=>\s*\$mode/);
    assert.match(prefsPhp, /'remaining'\s*=>\s*\$remaining/);
    assert.match(prefsPhp, /'batches'\s*=>\s*\$batches/);
    assert.match(validationPhp, /'dockerStartOrder'/);
    assert.match(validationPhp, /dockerStartOrder\.batches/);
    assert.match(utilsJs, /DEFAULT_DOCKER_START_ORDER/);
    assert.match(utilsJs, /dockerStartOrder/);
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
    assert.match(prefsEndpoint, /normalizeDockerStartOrderPrefs\(\$current\['dockerStartOrder'\]/);
    assert.match(startOrderEndpoint, /dockerStartOrderPreview\(\)/);
    assert.match(startOrderEndpoint, /syncContainerOrder\('docker'\)/);
});

test('settings page exposes a user-friendly Docker start-order workspace', () => {
    assert.match(settingsPage, /id="docker-start-order-stage"/);
    assert.match(settingsPage, /Docker start order/);
    assert.match(settingsJs, /const renderDockerStartOrderWorkspace = \(options = \{\}\) =>/);
    assert.match(settingsJs, /data-fv-start-order-region="preview"/);
    assert.match(settingsJs, /const preservePreview = options\.preservePreview === true && host\.find\('#docker-start-order-preview'\)\.length > 0;/);
    assert.match(settingsJs, /host\.find\('\[data-fv-start-order-region="toolbar"\]'\)\.replaceWith\(buildDockerStartOrderToolbarHtml\(customVisible\)\);/);
    assert.match(settingsJs, /host\.find\('\[data-fv-start-order-region="batches"\]'\)\.replaceWith\(buildDockerStartOrderBatchesHtml\(batches, customVisible\)\);/);
    assert.match(settingsJs, /dockerStartOrderFolderOptionsCache/);
    assert.match(settingsJs, /dockerStartOrderContainerOptionsCache/);
    assert.match(settingsJs, /Follow Docker page order/);
    assert.match(settingsJs, /Custom batch order/);
    assert.match(settingsJs, /Remaining autostart containers/);
    assert.match(settingsJs, /Preview autostart order/);
    assert.match(settingsJs, /syncDockerStartOrderNow/);
});

test('Docker page sync hook is guarded and triggers autostart sync after relevant saves', () => {
    assert.match(dockerJs, /if \(!data\.has\('names'\)\)/);
    assert.match(dockerJs, /scheduleFolderViewPlusDockerStartOrderSync/);
    assert.match(dockerJs, /server\/sync_order\.php/);
    assert.match(dockerJs, /ajaxComplete/);
    assert.match(dockerJs, /action=\(autostart\|wait\)/);
});
