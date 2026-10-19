import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createBackupScheduleFixture as setup, runBackupScheduleFixture as run } from './helpers/backup-schedule-fixture.mjs';
const require = createRequire(import.meta.url);
const detail = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-detail.js');
const viewModel = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.diagnostics-view-model.js');
for (const type of ['docker', 'vm']) {
    test(`${type}: unchanged hourly checks preserve USB files, retention and revisions while logging skips`, () => {
        const result = run(type, 'unchanged');
        assert.deepEqual(result.after, result.before);
        assert.deepEqual(result.afterImmediate, result.first, 'five-minute cron polling must not write state or duplicate log entries before the interval');
        assert.equal(result.backups.length, 1);
        assert.equal(result.state.events.length, 2);
        assert.equal(result.schedule.intervalHours, 1);
        assert.equal(result.schedule.lastStatus, 'skipped');
        assert.equal(result.schedule.skipReason, 'unchanged-config');
        assert.equal(result.health.state, 'ready');
        assert.equal(result.health.unchanged, true);
        assert.equal(result.stoppedHealth.state, 'overdue');
        const card = viewModel.decorateIntegrityCard({ key: 'backup_readiness', status: 'healthy', states: { [type]: result.health } }, {},
            (_key, fallback, ...params) => fallback.replace(/\$(\d+)/g, (token, index) => String(params[Number(index) - 1] ?? token)));
        assert.match(card.detail, /Last check found no changes.*Backup age: 48 h/);
        const row = result.events.find(row => row.action === 'backup_schedule_run');
        assert.equal(row.status, 'skipped');
        assert.match(detail.buildActivityEventDetail(row), /Folders and preferences match.*No duplicate file.*backups were kept.*every 1 h.*memory.*restart/);
        assert.match(result.timeline.find(row => row.action === 'backup_schedule_run').summary, /skipReason=unchanged-config/);
        assert.doesNotMatch(JSON.stringify(result.state.events), /Private fixture folder|second|\/boot|fingerprint/i);
    });
    for (const scenario of ['folders', 'prefs', 'order']) test(`${type}: ${scenario} changes create one backup and the following due check skips`, () => {
        const result = run(type, scenario);
        assert.equal(result.first.types[type].lastStatus, 'ok');
        assert.equal(result.backups.length, 2);
        assert.equal(result.schedule.skipReason, 'unchanged-config');
        assert.equal(result.state.events.length, 2);
    });
    for (const scenario of ['missing', 'corrupt', 'wrong-type', 'schema', 'partial', 'missing-after-skip']) test(`${type}: ${scenario} baseline creates a replacement backup`, () => {
        const result = run(type, scenario);
        assert.equal(result.schedule.lastStatus, 'ok');
        assert.ok(result.backups.some(row => row.reason === 'scheduled'));
    });
    test(`${type}: bookkeeping alone does not create a duplicate`, () => {
        const result = run(type, 'bookkeeping');
        assert.equal(result.schedule.skipReason, 'unchanged-config');
        assert.deepEqual(result.after, result.before);
    });
    test(`${type}: empty maps preserve old backups and explain the skipped status`, () => {
        const result = run(type, 'empty');
        assert.equal(result.schedule.lastStatus, 'skipped');
        assert.equal(result.schedule.skipReason, 'empty-folder-map');
        assert.equal(result.backups.length, 1);
        assert.deepEqual(result.after, result.before);
        assert.match(detail.buildActivityEventDetail(result.state.events[0]), /No folders.*No backup file.*backups were kept/);
    });
    test(`${type}: disabled schedules do not run or log checks`, () => {
        const result = run(type, 'disabled');
        assert.deepEqual(result.state, { types: [], events: [] });
        assert.deepEqual(result.after, result.before);
    });
    for (const scenario of ['restart', 'future', 'interval-change']) test(`${type}: ${scenario} allows a fresh check and saves actual schedule changes`, () => {
        const result = run(type, scenario);
        assert.equal(result.schedule.lastStatus, scenario === 'interval-change' ? 'ok' : 'skipped');
        assert.equal(result.backups.length, scenario === 'interval-change' ? 2 : 1);
        assert.equal(result.schedule.intervalHours, scenario === 'interval-change' ? 2 : 1);
    });
    for (const scenario of ['manual', 'restore']) test(`${type}: explicit ${scenario} backups still create files`, () => {
        const result = run(type, scenario);
        assert.equal(result.manual.skipped, false);
        assert.ok(result.manual.name);
        assert.ok(result.backups.length >= 2);
    });
    test(`${type}: failed writes do not advance the interval and a retry succeeds`, () => {
        const result = run(type, 'failure');
        assert.match(result.failure, /Injected durable storage failure/);
        assert.deepEqual(result.first, { types: [], events: [] });
        assert.equal(result.schedule.lastStatus, 'ok');
        assert.equal(result.backups.length, 1);
    });
    test(`${type}: concurrent schedule processes create a single due result`, async () => {
        const fixture = setup();
        try {
            fixture.run({ type, scenario: 'seed' });
            const launch = () => new Promise((resolve, reject) => {
                const child = spawn('php', fixture.args({ type, operation: 'run' }), { env: fixture.env });
                let output = '', error = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { error += value; });
                child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(error)));
            });
            const states = await Promise.all([launch(), launch(), launch()]);
            for (const state of states) assert.equal(state.events.length, 1);
            assert.equal(fs.readdirSync(path.join(fixture.root, 'config', 'backups')).length, 1);
        } finally { fixture.close(); }
    });
    test(`${type}: the actual cron CLI entrypoint uses isolated configuration and returns the skip outcome`, () => {
        const fixture = setup();
        try {
            fixture.run({ type, scenario: 'seed' });
            const runner = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/scheduled_backup.php');
            const result = JSON.parse(execFileSync('php', [runner, type], { env: fixture.env, encoding: 'utf8', timeout: 15000 }));
            assert.equal(result.ok, true);
            assert.equal(result.schedules[type].skipReason, 'unchanged-config');
            assert.equal(result.schedules[type].lastStatus, 'skipped');
            assert.equal(fs.readdirSync(path.join(fixture.root, 'config', 'backups')).length, 1);
        } finally { fixture.close(); }
    });
}
test('Docker and VM cron processes preserve both schedules in their shared RAM state', async () => {
    const fixture = setup();
    try {
        for (const type of ['docker', 'vm']) fixture.run({ type, scenario: 'seed' });
        await Promise.all(['docker', 'vm'].map(type => new Promise((resolve, reject) => {
            const child = spawn('php', fixture.args({ type, operation: 'run' }), { env: fixture.env });
            let error = ''; child.stdout.resume(); child.stderr.on('data', value => { error += value; });
            child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(error)));
        })));
        const state = JSON.parse(fs.readFileSync(path.join(fixture.root, 'source', '.backup-schedule-state.json'), 'utf8'));
        assert.deepEqual(Object.keys(state.types).sort(), ['docker', 'vm']);
        assert.deepEqual(state.events.map(row => row.type).sort(), ['docker', 'vm']);
        assert.equal(fs.readdirSync(path.join(fixture.root, 'config', 'backups')).length, 2);
    } finally { fixture.close(); }
});
test('RAM check history stays bounded without rewriting persistent diagnostic history', () => {
    const fixture = setup();
    try {
        fixture.run({ type: 'docker', scenario: 'seed' });
        const history = path.join(fixture.root, 'config', 'diagnostics.history.json');
        const before = fs.readFileSync(history);
        fs.writeFileSync(path.join(fixture.root, 'source', '.backup-schedule-state.json'), JSON.stringify({ types: {},
            events: Array.from({ length: 250 }, (_, index) => ({ id: `old${index}`, timestamp: '2020-01-01T00:00:00Z', action: 'backup_schedule_run' })) }));
        const state = fixture.run({ type: 'docker', operation: 'run' });
        assert.equal(state.events.length, 250);
        assert.equal(state.events[0].id, 'old1');
        assert.equal(state.events.at(-1).status, 'skipped');
        assert.deepEqual(fs.readFileSync(history), before);
    } finally { fixture.close(); }
});
test('a fresh install exposes empty-configuration skips before any persistent history exists', () => {
    const fixture = setup();
    try {
        const runner = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/scheduled_backup.php');
        const result = JSON.parse(execFileSync('php', [runner, 'docker'], { env: fixture.env, encoding: 'utf8', timeout: 15000 }));
        assert.equal(result.schedules.docker.skipReason, 'empty-folder-map');
        assert.equal(fs.existsSync(path.join(fixture.root, 'config', 'diagnostics.history.json')), false);
        const events = fixture.run({ type: 'docker', operation: 'history' });
        assert.equal(events.length, 1);
        assert.equal(events[0].status, 'skipped');
        assert.equal(events[0].details.skipReason, 'empty-folder-map');
    } finally { fixture.close(); }
});
