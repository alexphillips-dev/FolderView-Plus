import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
const page = read('FolderViewPlus.page');
const settingsJs = read('scripts/folderviewplus.js');
const dashboardJs = read('scripts/dashboard.js');
const vmJs = read('scripts/vm.js');
const prefsPhp = read('server/lib.prefs.php');
const diagnosticsPhp = read('server/lib.diagnostics.php');
const require = createRequire(import.meta.url);
const settingsRegistry = require(path.join(pluginRoot, 'scripts/folderviewplus.settings-registry.js'));
const viewSettings = require(path.join(pluginRoot, 'scripts/folderviewplus.view-settings.js'));

const expectedPreferenceKeys = {
    changeVisibilityPref: ['appColumnWidth', 'hideEmptyFolders'],
    changeStatusPref: ['attentionAccent', 'displayMode', 'mode', 'trendEnabled', 'warnStoppedPercent'],
    changeBadgePref: ['running', 'stopped', 'updates'],
    changeRuntimePref: ['lazyPreviewEnabled', 'lazyPreviewThreshold', 'liveRefreshEnabled', 'liveRefreshSeconds', 'pageViewMode', 'performanceProfile', 'themeCompatibilityMode'],
    changeDashboardPref: ['expandToggle', 'folderLabel', 'greyscale', 'layout', 'previewContext', 'previewGraph', 'previewGraphTime', 'previewTrigger', 'privacyMaskExternalUrls', 'privacyMaskImageRegistry', 'privacyMaskInterfaces', 'privacyMaskLocalIps', 'privacyMaskMacAddresses', 'privacyMaskNames', 'privacyMaskPorts', 'privacyMaskPublicIps', 'privacyMaskVmDiskPaths', 'privacyMaskVolumePaths', 'privacyMode'],
    changeHealthPref: ['allStoppedMode', 'cardsEnabled', 'criticalStoppedPercent', 'profile', 'resourceCriticalGiB', 'resourceCriticalVcpu', 'resourceWarnGiB', 'resourceWarnVcpu', 'runtimeBadgeEnabled', 'updatesMode', 'warnStoppedPercent']
};

test('Filter and view settings registry exposes the audited preference inventory', () => {
    const actual = {};
    for (const definition of settingsRegistry.definitions.filter((entry) => entry.ui !== false)) {
        actual[definition.handler] ||= new Set();
        actual[definition.handler].add(definition.key);
    }

    for (const [handler, keys] of Object.entries(expectedPreferenceKeys)) {
        assert.deepEqual([...actual[handler]].sort(), keys, `${handler} settings changed without updating its audited contract`);
    }
    const guard = spawnSync(process.execPath, ['scripts/filter_view_settings_guard.mjs'], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(guard.status, 0, guard.stderr || guard.stdout);
});

test('settings controller accepts registered changes, coerces values, and rejects undeclared keys', () => {
    const controller = viewSettings.createChangeController({ registry: settingsRegistry }).start();
    for (const definition of settingsRegistry.definitions) {
        for (const type of definition.types) {
            const input = definition.kind === 'boolean'
                ? true
                : (definition.kind === 'integer' ? Number(definition.max) + 100 : definition.values[0]);
            const change = controller.resolve(definition.handler, type, definition.key, input);
            assert.ok(change, `${definition.handler}/${type}/${definition.key} must resolve`);
            assert.equal(change.storageKey, definition.storageKey);
            if (definition.kind === 'boolean') assert.equal(change.value, true);
            if (definition.kind === 'integer') assert.equal(change.value, definition.max);
            if (definition.kind === 'enum') assert.equal(change.value, definition.values[0]);
        }
    }
    assert.equal(controller.resolve('changeHealthPref', 'docker', 'notASetting', true), null);
    assert.equal(controller.resolve('changeBadgePref', 'vm', 'updates', true), null);
    controller.destroy();
    assert.equal(controller.resolve('changeVisibilityPref', 'docker', 'hideEmptyFolders', true), null);
});

test('Docker advanced preview settings save immediately and are consumed by Dashboard previews', () => {
    for (const key of ['previewContext', 'previewTrigger', 'previewGraph', 'previewGraphTime']) {
        const definition = settingsRegistry.getDefinition('changeDashboardPref', key, 'docker');
        assert.ok(definition, `${key} must be registered for Docker`);
        assert.equal(definition.liveApply, true);
        assert.match(dashboardJs, new RegExp(`dashboard\\.${key}`));
    }
    assert.equal(settingsRegistry.resolveChange('changeDashboardPref', 'docker', 'previewGraph', 99).value, 4);
    assert.equal(settingsRegistry.resolveChange('changeDashboardPref', 'docker', 'previewGraphTime', 1).value, 5);
});

test('VM privacy has a persisted master activation and live runtime consumers', () => {
    assert.match(page, /id="vm-dashboard-privacy-mode"[\s\S]*changeDashboardPref\('vm', 'privacyMode', this\.checked\)/);
    assert.match(settingsJs, /#vm-dashboard-privacy-mode'\)\.prop\('checked', dashboard\.privacyMode === true\)/);
    assert.match(settingsJs, /immediate: key === 'layout' \|\| key === 'privacyMode'/);
    assert.match(vmJs, /const vmPrivacyMode = normalized\?\.dashboard\?\.privacyMode === true/);
    assert.match(vmJs, /vmPrefsCoordinator\.subscribe\([\s\S]*applyRuntimePrefs\(folderTypePrefs\)/);
    assert.match(dashboardJs, /const vmPrivacyMode = vmPrefs\?\.dashboard\?\.privacyMode === true/);
    assert.match(dashboardJs, /dashboardPrefsCoordinator\.subscribe\([\s\S]*applyDashboardRuntimePrefs\(\)/);
});

test('VM resource thresholds survive PHP normalization and remain ordered at limits', () => {
    const libPath = path.join(pluginRoot, 'server/lib.php').replace(/\\/g, '/').replace(/'/g, "\\'");
    const php = `require '${libPath}'; echo json_encode([normalizeTypePrefs(['health'=>['vmResourceWarnVcpus'=>24,'vmResourceCriticalVcpus'=>48,'vmResourceWarnGiB'=>64,'vmResourceCriticalGiB'=>128]])['health'],normalizeTypePrefs(['health'=>['vmResourceWarnVcpus'=>512,'vmResourceCriticalVcpus'=>512,'vmResourceWarnGiB'=>1024,'vmResourceCriticalGiB'=>1024]])['health']]);`;
    const result = spawnSync('php', ['-r', php], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const [saved, bounded] = JSON.parse(result.stdout);
    assert.deepEqual({
        vmResourceWarnVcpus: saved.vmResourceWarnVcpus,
        vmResourceCriticalVcpus: saved.vmResourceCriticalVcpus,
        vmResourceWarnGiB: saved.vmResourceWarnGiB,
        vmResourceCriticalGiB: saved.vmResourceCriticalGiB
    }, {
        vmResourceWarnVcpus: 24,
        vmResourceCriticalVcpus: 48,
        vmResourceWarnGiB: 64,
        vmResourceCriticalGiB: 128
    });
    assert.equal(bounded.vmResourceWarnVcpus, 511);
    assert.equal(bounded.vmResourceCriticalVcpus, 512);
    assert.equal(bounded.vmResourceWarnGiB, 1023);
    assert.equal(bounded.vmResourceCriticalGiB, 1024);
    for (const key of ['vmResourceWarnVcpus', 'vmResourceCriticalVcpus', 'vmResourceWarnGiB', 'vmResourceCriticalGiB']) {
        assert.match(prefsPhp, new RegExp(`'${key}'`));
        assert.match(diagnosticsPhp, new RegExp(`'${key}'`));
    }
});

test('retired health compact preference has no UI, client, server, or diagnostics residue', () => {
    assert.doesNotMatch(page, /health-compact|Compact card layout/);
    assert.doesNotMatch(settingsJs, /compact:\s*incoming\.compact/);
    assert.doesNotMatch(prefsPhp, /['"]compact['"]\s*=>/);
    assert.doesNotMatch(diagnosticsPhp, /['"]compact['"]\s*=>/);
});
