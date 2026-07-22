import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
const page = read('FolderViewPlus.page');
const settingsJs = read('scripts/folderviewplus.js');
const dashboardJs = read('scripts/dashboard.js');
const vmJs = read('scripts/vm.js');
const prefsPhp = read('server/lib.prefs.php');
const diagnosticsPhp = read('server/lib.diagnostics.php');

const expectedPreferenceKeys = {
    changeVisibilityPref: ['appColumnWidth', 'hideEmptyFolders'],
    changeStatusPref: ['attentionAccent', 'displayMode', 'mode', 'trendEnabled', 'warnStoppedPercent'],
    changeBadgePref: ['running', 'stopped', 'updates'],
    changeRuntimePref: ['lazyPreviewEnabled', 'lazyPreviewThreshold', 'liveRefreshEnabled', 'liveRefreshSeconds', 'pageViewMode', 'performanceProfile', 'themeCompatibilityMode'],
    changeDashboardPref: ['expandToggle', 'folderLabel', 'greyscale', 'layout', 'previewContext', 'previewGraph', 'previewGraphTime', 'previewTrigger', 'privacyMaskExternalUrls', 'privacyMaskImageRegistry', 'privacyMaskInterfaces', 'privacyMaskLocalIps', 'privacyMaskMacAddresses', 'privacyMaskNames', 'privacyMaskPorts', 'privacyMaskPublicIps', 'privacyMaskVmDiskPaths', 'privacyMaskVolumePaths', 'privacyMode'],
    changeHealthPref: ['allStoppedMode', 'cardsEnabled', 'criticalStoppedPercent', 'profile', 'resourceCriticalGiB', 'resourceCriticalVcpu', 'resourceWarnGiB', 'resourceWarnVcpu', 'runtimeBadgeEnabled', 'updatesMode', 'warnStoppedPercent']
};

test('Filter and view settings exposes the audited preference inventory', () => {
    const actual = {};
    const bindingPattern = /(change(?:Visibility|Status|Badge|Runtime|Dashboard|Health)Pref)\('(?:docker|vm)',\s*'([^']+)'/g;
    for (const match of page.matchAll(bindingPattern)) {
        actual[match[1]] ||= new Set();
        actual[match[1]].add(match[2]);
    }

    for (const [handler, keys] of Object.entries(expectedPreferenceKeys)) {
        assert.deepEqual([...actual[handler]].sort(), keys, `${handler} settings changed without updating its audited contract`);
        assert.match(settingsJs, new RegExp(`const ${handler} = async \\(`));
    }
});

test('all explicitly keyed settings handlers accept every key rendered by the page', () => {
    for (const [handler, keys] of Object.entries(expectedPreferenceKeys)) {
        if (handler === 'changeBadgePref') continue;
        const start = settingsJs.indexOf(`const ${handler} = async (`);
        assert.ok(start >= 0, `${handler} must exist`);
        const end = settingsJs.indexOf('\nconst ', start + 1);
        const body = settingsJs.slice(start, end >= 0 ? end : undefined);
        for (const key of keys) {
            if (handler === 'changeDashboardPref' && key.startsWith('privacyMask')) {
                assert.match(body, /key\.startsWith\('privacyMask'\)/);
            } else {
                assert.match(body, new RegExp(`key === '${key}'`), `${handler} does not accept ${key}`);
            }
        }
    }
    assert.match(settingsJs, /const changeBadgePref = async \(type, badgeKey, checked\)[\s\S]*\[badgeKey\]: Boolean\(checked\)/);
});

test('Docker advanced preview settings save immediately and are consumed by Dashboard previews', () => {
    for (const key of ['previewContext', 'previewTrigger', 'previewGraph', 'previewGraphTime']) {
        assert.match(settingsJs, new RegExp(`key === '${key}' && type === 'docker'`));
        assert.match(dashboardJs, new RegExp(`dashboard\\.${key}`));
    }
    assert.match(settingsJs, /key\.startsWith\('preview'\)/);
    assert.match(settingsJs, /previewGraph = Number\.isFinite\(parsed\)[\s\S]*Math\.min\(4, Math\.max\(0, Math\.round\(parsed\)\)\)/);
    assert.match(settingsJs, /previewGraphTime = Number\.isFinite\(parsed\)[\s\S]*Math\.min\(600, Math\.max\(5, Math\.round\(parsed\)\)\)/);
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
