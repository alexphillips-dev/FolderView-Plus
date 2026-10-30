import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const server = process.env.FVPLUS_BOUNDARY_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = process.env.FVPLUS_BOUNDARY_FIXTURE || path.resolve('tests/fixtures/backend-boundaries.php');
const run = request => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-boundaries-'));
    for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
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
    for (const pattern of ['\\Qabc\\E', '(?>abc)', '[', '\\u{1F600}']) {
        const result = run({ operation: 'convert', pattern });
        assert.equal(result.response.ok, false, pattern);
        assert.equal(result.exactUnchanged, true, pattern);
        assert.equal(result.legacy, pattern);
        assert.deepEqual(result.rules, []);
        assert.deepEqual(result.afterMembers, result.beforeMembers);
    }
});

test('guarded supported legacy conversions preserve membership and meaningful whitespace', () => {
    for (const pattern of ['^media-', ' ^media$']) {
        const result = run({ operation: 'convert', pattern, names: ['media-app', ' ^media$', ' media', 'media', 'other'] });
        assert.equal(result.response.ok, true, pattern);
        assert.equal(result.legacy, '');
        assert.equal(result.rules.length, 1);
        assert.equal(result.rules[0].pattern, pattern);
        assert.deepEqual(result.afterMembers, result.beforeMembers);
        assert.deepEqual(result.issues, []);
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
