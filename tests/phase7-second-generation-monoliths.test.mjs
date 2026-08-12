import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const scriptsRoot = path.join(pluginRoot, 'scripts');
const require = createRequire(import.meta.url);
const read = (file) => fs.readFileSync(path.join(pluginRoot, file), 'utf8');
const lineCount = (file) => read(file).split(/\r?\n/).length;

test('Phase 7 utility facade delegates to bounded domain modules without changing its public surface', () => {
    const utils = require(path.join(scriptsRoot, 'folderviewplus.utils.js'));
    const expectedExports = [
        'normalizePrefs',
        'orderFoldersByPrefs',
        'parseImportPayload',
        'buildImportOperations',
        'getAutoRuleDecision',
        'getEffectiveFolderMembers',
        'planFolderRuntimeAction'
    ];
    expectedExports.forEach((name) => assert.equal(typeof utils[name], 'function', `${name} remains public`));
    assert.ok(lineCount('scripts/folderviewplus.utils.js') < 100, 'utility facade stays coordination-only');
    for (const file of [
        'scripts/folderviewplus.utils-normalization.js',
        'scripts/folderviewplus.utils-prefs.js',
        'scripts/folderviewplus.utils-ordering.js',
        'scripts/folderviewplus.utils-transfer.js',
        'scripts/folderviewplus.utils-rules.js'
    ]) {
        assert.ok(lineCount(file) < 750, `${file} remains below the Phase 7 child-module ceiling`);
    }
});

test('Phase 7 shared runtime facade composes visual, primitive, diagnostics, and control owners', () => {
    const runtime = require(path.join(scriptsRoot, 'docker.runtime.shared.js'));
    for (const name of [
        'applyFolderPreviewLayout',
        'createRuntimeStateStore',
        'createRuntimeDiagnosticsBridge',
        'createStableToggleController',
        'createSecureNavigationApi'
    ]) {
        assert.equal(typeof runtime[name], 'function', `${name} remains public`);
    }
    assert.ok(lineCount('scripts/docker.runtime.shared.js') < 500, 'shared runtime facade stays below 500 lines');
    for (const file of [
        'scripts/runtime.shared-primitives.js',
        'scripts/runtime.shared-diagnostics.js',
        'scripts/runtime.shared-controls.js'
    ]) {
        assert.ok(lineCount(file) < 550, `${file} remains below the Phase 7 child-module ceiling`);
    }
});

test('every consuming page loads Phase 7 children before compatibility facades', () => {
    for (const page of [
        'FolderViewPlus.page',
        'folderview.plus.Docker.page',
        'folderview.plus.VMs.page',
        'folderview.plus.Dashboard.page',
        'Folder.page'
    ]) {
        const source = read(page);
        const facadeIndex = source.indexOf('folderviewplus.utils.js');
        for (const child of [
            'folderviewplus.utils-normalization.js',
            'folderviewplus.utils-prefs.js',
            'folderviewplus.utils-ordering.js',
            'folderviewplus.utils-transfer.js',
            'folderviewplus.utils-rules.js'
        ]) {
            const childIndex = source.indexOf(child);
            assert.ok(childIndex >= 0 && childIndex < facadeIndex, `${page} loads ${child} before utility facade`);
        }
    }

    for (const page of ['folderview.plus.Docker.page', 'folderview.plus.VMs.page', 'folderview.plus.Dashboard.page']) {
        const source = read(page);
        const facadeIndex = source.indexOf('docker.runtime.shared.js');
        for (const child of ['runtime.shared-primitives.js', 'runtime.shared-diagnostics.js', 'runtime.shared-controls.js']) {
            const childIndex = source.indexOf(child);
            assert.ok(childIndex >= 0 && childIndex < facadeIndex, `${page} loads ${child} before shared runtime facade`);
        }
    }
});
