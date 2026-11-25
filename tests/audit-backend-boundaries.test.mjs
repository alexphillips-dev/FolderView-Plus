import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const server = process.env.FVPLUS_BOUNDARY_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const require = createRequire(import.meta.url);
const utils = require(path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js'));
const fixture = process.env.FVPLUS_BOUNDARY_FIXTURE || path.resolve('tests/fixtures/backend-boundaries.php');
const run = request => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-boundaries-'));
    for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
    if (request.buildMetadata) fs.writeFileSync(path.join(root, 'source', 'build-metadata.json'), JSON.stringify(request.buildMetadata));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
    try {
        return JSON.parse(execFileSync('php', [fixture, server, root], { encoding: 'utf8', timeout: 30000,
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_STORAGE_DIR: root,
                FVPLUS_TEST_SECURITY_STATE_PATH: path.join(root, 'security/state.json'),
                FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'config/autostart') }
        }));
    } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), base);
        fs.rmSync(root, { recursive: true, force: true });
    }
};

test('guarded legacy conversion refuses unsupported managed predicates without changing state or backups', () => {
    for (const pattern of ['\\Qabc\\E', '(?>abc)', '[', '\\u{1F600}', '^\\p{L}+$']) {
        const result = run({ operation: 'convert', pattern });
        assert.equal(result.response.ok, false, pattern);
        assert.equal(result.exactUnchanged, true, pattern);
        assert.equal(result.legacy, pattern);
        assert.deepEqual(result.rules, []);
        assert.deepEqual(result.afterMembers, result.beforeMembers);
    }
});

test('guarded supported legacy conversions preserve membership and meaningful whitespace', () => {
    for (const pattern of ['^media-', ' ^media$', '^fixture\\/x$', '^\\\\u{1F600}$']) {
        const result = run({ operation: 'convert', pattern, names: ['media-app', ' ^media$', ' media', 'media', 'other', 'fixture/x', '\\u{1F600}'] });
        assert.equal(result.response.ok, true, pattern);
        assert.equal(result.legacy, '');
        assert.equal(result.rules.length, 1);
        assert.equal(result.rules[0].pattern, pattern);
        assert.deepEqual(result.afterMembers, result.beforeMembers);
        assert.deepEqual(result.issues, []);
    }
});

test('guarded legacy conversion keeps UTF-16 matching in stored PHP and browser rules', () => {
    const names = ['😀', 'ab', 'b', 'aab'];
    const result = run({ operation: 'convert', pattern: '^..$', names });
    assert.equal(result.response.ok, true);
    assert.equal(result.legacy, '');
    assert.equal(result.rules[0].regexMode, 'legacy');
    assert.deepEqual(result.beforeMembers, ['😀', 'ab']);
    assert.deepEqual(result.afterMembers, result.beforeMembers);
    const opts = { type: 'vm', infoByName: Object.fromEntries(names.map(name => [name, {}])), names };
    const before = utils.buildMembershipSnapshot({ ...opts, folders: { fixture: { regex: '^..$' } } });
    const after = utils.buildMembershipSnapshot({ ...opts, folders: { fixture: {} },
        rules: utils.normalizePrefs({ autoRules: result.rules }).autoRules });
    assert.deepEqual(after.byFolder.fixture.liveMembers, before.byFolder.fixture.liveMembers);
    assert.deepEqual(after.primaryOwnerByName, before.primaryOwnerByName);
});

test('converted legacy backreferences match the original browser rule and retain legacy escapes', () => {
    const fixtures = [
        ['^(archive-)?backup\\1$', ['backup', 'archive-backuparchive-', 'archive-backup']],
        ['^(?<prefix>archive-)?backup\\k<prefix>$', ['backup', 'archive-backuparchive-', 'archive-backup']],
        ['^(a)?\\1\\12$', ['\n', 'aa\n', 'a\n']]
    ];
    for (const [pattern, names] of fixtures) {
        const converted = run({ operation: 'convert', pattern, names });
        assert.equal(converted.response.ok, true, pattern);
        const options = { type: 'vm', names, infoByName: Object.fromEntries(names.map(name => [name, {}])) };
        const before = utils.buildMembershipSnapshot({ ...options, folders: { fixture: { regex: pattern } } });
        const after = utils.buildMembershipSnapshot({ ...options, folders: { fixture: {} }, rules: converted.rules });
        assert.deepEqual(after.byFolder.fixture.liveMembers, before.byFolder.fixture.liveMembers, pattern);
        assert.deepEqual(converted.afterMembers.toSorted(), before.byFolder.fixture.liveMembers.toSorted(), pattern);
    }
});

test('public support bundle sanitizes persisted nested icon/history data and retains full mode', () => {
    const { sanitized, full, another } = run({ operation: 'bundle' });
    for (const bundle of [sanitized, another]) {
        assert.doesNotMatch(JSON.stringify(bundle), /PRIVATE_/);
        const missing = bundle.system.pathHealth.customIcons.missingReferencedIcons[0];
        assert.equal(missing.referenceCount, 1);
        assert.equal(missing.name, null);
        assert.match(missing.nameHash, /^[0-9a-f]{16}$/);
        const folder = bundle.runtimeState.vm.folderHierarchySummary.folders[0];
        assert.equal(missing.references[0].folderId, folder.folderId);
        const details = bundle.healthAndHistory.recentMutations.events.find(event => event.action === 'environment_import').details;
        assert.equal(details.sourceName, null);
        assert.match(details.sourceNameHash, /^[0-9a-f]{16}$/);
        assert.equal(details.details.templateId, null);
        assert.match(details.details.templateIdHash, /^[0-9a-f]{16}$/);
        assert.equal(JSON.stringify(bundle).includes('"123456789"'), false);
        assert.equal(details.folderCount, 3);
        assert.equal(details.verified, true);
        assert.equal(details.phase, 'verified');
    }
    assert.notEqual(sanitized.system.pathHealth.customIcons.missingReferencedIcons[0].nameHash,
        another.system.pathHealth.customIcons.missingReferencedIcons[0].nameHash);
    const fullText = JSON.stringify(full);
    for (const value of ['PRIVATE_ID', 'PRIVATE_FOLDER', 'PRIVATE_ICON.png', 'PRIVATE_SOURCE.json',
        'PRIVATE_TEMPLATE', 'PRIVATE_FROM', 'PRIVATE_TO', 'PRIVATE_ERROR', 'PRIVATE_NESTED.json', 'PRIVATE_ITEM']) {
        assert.ok(fullText.includes(value), `full mode lost ${value}`);
    }
});

test('support bundles omit private build origins and branch names from the sanitized export', () => {
    const publicPrefix = 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/';
    const buildMetadata = {
        sourceBranch: 'private-fixture-branch',
        manifestUrl: 'https://packages.fixture.invalid/private-plugin',
        archiveUrl: publicPrefix + 'archive/folderview.plus-2026.11.24.06.txz?key=private-fixture',
        iconAssetPackUrl: 'https://packages.fixture.invalid/private-icon-pack'
    };
    const { sanitized, full } = run({ operation: 'bundle', buildMetadata });
    for (const [key, value] of Object.entries(buildMetadata)) {
        assert.equal(sanitized.bundleMeta.buildIdentity[key], null);
        assert.equal(full.bundleMeta.buildIdentity[key], value);
        assert.ok(sanitized.redactionManifest.omittedFields.includes('bundleMeta.buildIdentity.' + key));
        assert.equal(JSON.stringify(sanitized).includes(value), false);
    }
});

test('diagnostics endpoints redact private folder references, history, and last backup metadata', () => {
    const { results, backupName } = run({ operation: 'report-privacy' });
    for (const action of ['report', 'support_bundle']) {
        for (const value of ['PRIVATE_REPORT_FOLDER', 'PRIVATE_CHILD_FOLDER', 'PRIVATE_STALE_FOLDER', 'PRIVATE_ORPHAN_VM',
            'PRIVATE_MISSING_ICON.png', 'PRIVATE_HISTORY_NAME', 'PRIVATE_SNAPSHOT_REASON', backupName]) {
            assert.equal(JSON.stringify(results[action].sanitized).includes(value), false, `${action} leaked ${value}`);
            assert.equal(JSON.stringify(results[action].full).includes(value), true, `${action} full mode lost ${value}`);
        }
    }
    const vm = results.report.sanitized.types.vm;
    const [folderId] = vm.pinnedFolderIds;
    const [sameFolderId, staleId] = vm.hiddenFolderIds;
    const child = Object.values(vm.stateSnapshot.folders).find(row => row.parentId === folderId);
    assert.match(folderId, /^[a-f0-9]{16}$/);
    assert.equal(sameFolderId, folderId);
    assert.match(staleId, /^[a-f0-9]{16}$/);
    assert.deepEqual(vm.expandedFolderState, { [folderId]: true, [child.folderId]: false });
    assert.equal(vm.stateSnapshot.folders[folderId].folderId, folderId);
    assert.equal(vm.integrityChecks.orphanedMembers.inventoryVerified, true);
    assert.equal(vm.integrityChecks.orphanedMembers.folders[0].folderId, folderId);
    assert.deepEqual(vm.integrityChecks.missingHiddenFolderIds.ids, [staleId]);
    assert.equal(results.report.sanitized.customIcons.missingReferencedIcons[0].references[0].folderId, folderId);
    const lastBackup = results.support_bundle.sanitized.pluginState.vm.lastBackup;
    assert.equal(lastBackup.name, null);
    assert.equal(lastBackup.reason, null);
    assert.equal(lastBackup.count, 2);
    assert.ok(results.support_bundle.sanitized.redactionManifest.omittedFields.includes('pluginState.vm.lastBackup.name'));
});
