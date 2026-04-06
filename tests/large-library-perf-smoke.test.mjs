import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

const buildFolderMap = (count, prefix = 'folder') => {
    const output = {};
    for (let index = 1; index <= count; index += 1) {
        const id = `${prefix}-${String(index).padStart(4, '0')}`;
        const members = [];
        for (let memberIndex = 1; memberIndex <= 8; memberIndex += 1) {
            members.push(`${prefix}-item-${index}-${memberIndex}`);
        }
        output[id] = {
            name: `${prefix.toUpperCase()} ${index}`,
            icon: '',
            regex: `^${prefix}-item-${index}-`,
            containers: members,
            settings: { preview: index % 4 },
            actions: []
        };
    }
    return output;
};

const withinMs = (label, startedAt, thresholdMs = 4000) => {
    const elapsed = performance.now() - startedAt;
    assert.ok(
        elapsed <= thresholdMs,
        `${label} exceeded perf smoke budget (${elapsed.toFixed(1)}ms > ${thresholdMs}ms)`
    );
};

for (const type of ['docker', 'vm']) {
    test(`large-library perf smoke (${type}): order + import planning remain responsive`, () => {
        const existing = buildFolderMap(350, `${type}-existing`);
        const incoming = buildFolderMap(420, `${type}-incoming`);

        const importPayload = utils.buildFullExportPayload({
            type,
            pluginVersion: 'perf-smoke',
            folders: incoming
        });

        const parseStartedAt = performance.now();
        const parsed = utils.parseImportPayload(importPayload, type);
        withinMs(`${type} parseImportPayload`, parseStartedAt, 2500);
        assert.equal(parsed.ok, true);

        const summarizeStartedAt = performance.now();
        const summary = utils.summarizeImport(existing, parsed, 'merge');
        withinMs(`${type} summarizeImport`, summarizeStartedAt, 2500);
        assert.ok(Array.isArray(summary.creates));
        assert.ok(Array.isArray(summary.updates));

        const opsStartedAt = performance.now();
        const operations = utils.buildImportOperations(existing, parsed, 'merge');
        withinMs(`${type} buildImportOperations`, opsStartedAt, 2500);
        assert.ok(Array.isArray(operations.creates));
        assert.ok(Array.isArray(operations.upserts));

        const orderStartedAt = performance.now();
        const ordered = utils.orderFoldersByPrefs(incoming, {
            sortMode: 'manual',
            manualOrder: Object.keys(incoming).slice().reverse(),
            pinnedFolderIds: Object.keys(incoming).slice(0, 12)
        });
        withinMs(`${type} orderFoldersByPrefs`, orderStartedAt, 3000);
        assert.equal(Object.keys(ordered).length, Object.keys(incoming).length);
    });
}
