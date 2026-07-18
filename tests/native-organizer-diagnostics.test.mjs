import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const modulePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.native-organizer.js'
);
const moduleSource = fs.readFileSync(modulePath, 'utf8');

const response = (payload, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
});

const loadOrganizer = (root) => {
    const context = {
        globalThis: root,
        module: { exports: {} },
        exports: {},
        console,
        Date,
        Error,
        JSON,
        Number,
        Object,
        Set,
        String
    };
    vm.runInNewContext(moduleSource, context, { filename: modulePath });
    return context.module.exports;
};

test('optional organizer schema absence is stored as a sanitized capability result', async () => {
    let stored = '';
    const responses = [
        response({ data: { info: { os: { release: '7.3.2' }, cpu: { cores: 8 } } } }),
        response({ errors: [{ message: 'Cannot query field "organizer" on type "Docker". /mnt/private should never persist.' }] })
    ];
    const organizer = loadOrganizer({
        fetch: async () => responses.shift(),
        localStorage: { setItem: (_key, value) => { stored = value; } },
        document: { querySelector: () => null }
    });

    const result = await organizer.checkCapabilities({ force: true, source: 'diagnostics' });
    assert.equal(result.apiAvailable, true);
    assert.equal(result.organizerApiAvailable, false);
    assert.equal(result.reason, 'organizer_unsupported');
    assert.equal(result.failureCategory, 'schema_unsupported');
    assert.equal(result.failureStage, 'organizer_capability_probe');
    assert.equal(result.requested, false);
    assert.equal(stored.includes('/mnt/private'), false, 'raw GraphQL error text must not enter localStorage');
    assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), [
        'apiAvailable',
        'checkedAt',
        'created',
        'failureCategory',
        'failureStage',
        'hasFetch',
        'httpStatus',
        'ok',
        'organizerApiAvailable',
        'organizerSyncDone',
        'reason',
        'requested',
        'schemaVersion',
        'skipped',
        'source',
        'updated'
    ]);
});

test('forced capability check clears a cached failure and replaces stale status after recovery', async () => {
    const responses = [
        response({}, 503),
        response({ data: { info: { os: { release: '7.3.2' }, cpu: { cores: 8 } } } }),
        response({ data: { docker: { organizer: { views: [] } } } })
    ];
    const organizer = loadOrganizer({
        fetch: async () => responses.shift(),
        localStorage: { setItem() {} },
        document: { querySelector: () => null }
    });

    const failed = await organizer.checkCapabilities({ force: true, source: 'diagnostics' });
    assert.equal(failed.apiAvailable, false);
    assert.equal(failed.failureCategory, 'http_error');
    assert.equal(failed.httpStatus, 503);

    const recovered = await organizer.checkCapabilities({ force: true, source: 'diagnostics' });
    assert.equal(recovered.apiAvailable, true);
    assert.equal(recovered.organizerApiAvailable, true);
    assert.equal(recovered.reason, 'capability_available');
    assert.equal(recovered.failureCategory, '');
    assert.equal(responses.length, 0, 'forced retry must perform both fresh probes');
});

test('only an explicit sync failure records requested organizer mutation context', async () => {
    const responses = [
        response({ data: { info: { os: { release: '7.3.2' }, cpu: { cores: 8 } } } }),
        response({ data: { docker: { organizer: { views: [{ id: 'view-1' }] } } } }),
        response({ data: { docker: { organizer: { views: [{ id: 'view-1', flatEntries: [] }] } } } }),
        response({ errors: [{ message: 'GraphQL mutation failed for a private reason' }] })
    ];
    const organizer = loadOrganizer({
        fetch: async () => responses.shift(),
        localStorage: { setItem() {} },
        document: { querySelector: () => null }
    });

    const result = await organizer.syncDockerOrganizer({
        folder1: { name: 'Media', containers: { plex: {} } }
    }, { force: true, explicit: true, source: 'settings' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'sync_failed');
    assert.equal(result.requested, true);
    assert.equal(result.organizerApiAvailable, true);
    assert.equal(result.failureCategory, 'graphql_error');
    assert.equal(result.failureStage, 'organizer_create');
});
