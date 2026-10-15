import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runMigrationFixture } from './helpers/folderview3-fixture.mjs';
const require = createRequire(import.meta.url);
const activity = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-detail.js');

test('the production endpoint records rejected previews and applies without exposing uploaded source details', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-diagnostics-endpoint-'));
    const call = request => {
        fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/folderview3-browser.php'), root, path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server')], { encoding: 'utf8' }));
    };
    try {
        const before = call({ action: 'fixture_read' });
        for (const action of ['preview_folderview3', 'apply_folderview3']) {
            assert.equal(call({ action, sourceKind: 'export', payload: '{invalid', fileName: 'private-source-name.json' }).ok, false);
        }
        const events = call({ action: 'fixture_history' }).events.filter(row => row.action.startsWith('folderview3_'));
        assert.deepEqual(events.map(row => row.action).sort(), ['folderview3_migration', 'folderview3_preview']);
        assert.ok(events.every(row => row.details.phase === 'validation' && row.details.outcome === 'validation-rejected' && !row.details.verified && !row.details.checkpointAvailable));
        assert.doesNotMatch(JSON.stringify(events.map(row => row.details)), /private-source|invalid|payload|fileName/);
        assert.deepEqual(call({ action: 'fixture_read' }), before);
    } finally {
        const resolved = path.resolve(root);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('fvplus-diagnostics-endpoint-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
});

test('migration diagnostics distinguish verified, rejected, compensated and failed restoration outcomes', () => {
    for (const [operation, outcome, rollback, verified] of [
        ['apply', 'applied', 'not-needed', true], ['stale', 'stale-preview', 'not-needed', false],
        ['failure', 'write-failed', 'complete', false], ['verification-failure', 'verification-failed', 'complete', false],
        ['rollback-failure', 'write-failed', 'failed', false]
    ]) {
        const result = runMigrationFixture({ operation, includeSupportBundle: operation === 'apply' });
        const event = result.diagnosticEvents.find(row => row.action === 'folderview3_migration');
        assert.ok(event, operation);
        assert.deepEqual([event.details.outcome, event.details.rollback, event.details.verified], [outcome, rollback, verified], operation);
        assert.equal(event.status, verified ? 'ok' : 'error');
        assert.equal(event.details.checkpointAvailable, operation !== 'stale');
        if (operation === 'apply') {
            const exported = result.supportBundleHistory.recentMutations.events.find(row => row.action === 'folderview3_migration');
            assert.deepEqual(exported.details, event.details);
        }
        assert.doesNotMatch(JSON.stringify(event.details), /synthetic\.json|Original fixture|original-member|Fixture|[\\/]|rollbackName/);
        if (rollback === 'complete' || operation === 'stale') assert.equal(result.protectedUnchanged, true);
    }
});

test('diagnostics storage and observer failures cannot turn a verified transaction into a failure', () => {
    for (const operation of ['diagnostics-failure', 'observer-failure']) {
        const result = runMigrationFixture({ operation });
        assert.equal(result.error, '');
        assert.equal(result.applied.transaction.verified, true);
    }
});

test('the Activity feed includes migration success and shows stage and rollback outcomes', () => {
    const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js', 'utf8');
    const start = source.indexOf('const serverActivityLabel =');
    const render = source.indexOf('const renderChangeHistory =', start);
    const end = source.indexOf('\n};', render) + 4;
    const context = {
        window: { FolderViewPlusActivityDetail: activity }, document: { getElementById: () => ({}) },
        diagnosticsT: (_key, fallback, ...args) => fallback.replace(/\$(\d+)/g, (token, index) => String(args[Number(index) - 1] ?? token)), lastDiagnostics: null, activityFeedEntries: [], activityFeedClearedAt: 0,
        activityFeedClearedServerKeys: [], ACTIVITY_FEED_RETENTION_MS: 60000, normalizeActivityLevel: level => level,
        restoreActivityFeed() {}, persistActivityFeed() {}, renderActivityFeed() {}, retainActivityEntries: rows => rows
    };
    vm.runInNewContext(source.slice(start, end) + ';globalThis.render = renderChangeHistory;', context);
    context.render({ importExportHistory: { events: [
        { id: 'migration-success', timestamp: new Date().toISOString(), action: 'folderview3_migration', status: 'ok', details: { dockerCount: 3, vmCount: 2, outcome: 'applied', checkpointAvailable: true } },
        { id: 'migration-failure', timestamp: new Date().toISOString(), action: 'folderview3_migration', status: 'error', details: { outcome: 'verification-failed', rollback: 'complete' } },
        { id: 'migration-preview', timestamp: new Date().toISOString(), action: 'folderview3_preview', status: 'error', details: { outcome: 'validation-rejected' } }
    ] } });
    assert.equal(context.activityFeedEntries.length, 3);
    assert.equal(context.activityFeedEntries[0].message, 'FolderView3 migration applied');
    assert.match(context.activityFeedEntries[0].detail, /3 Docker folders, 2 VM folders.*Recovery checkpoint/);
    assert.match(context.activityFeedEntries[1].detail, /verification failed.*Previous configuration restored/);
    assert.match(context.activityFeedEntries[2].message, /preview failed/);
});
