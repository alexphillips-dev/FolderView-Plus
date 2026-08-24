import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fc from 'fast-check';
import {
    compareSanitizedSupportBundles,
    renderSupportBundleComparisonMarkdown
} from '../scripts/lib/support_bundle_compare.mjs';

const require = createRequire(import.meta.url);
const imageFallbacks = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.image-fallbacks.js');
globalThis.FolderViewPlusFoundationModules = { imageFallbacks };
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const containerModel = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.container-model.js');
const hierarchy = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.hierarchy.js').createApi();

const FUZZ_OPTIONS = Object.freeze({ numRuns: 250 });

const folderRecordArbitrary = fc.record({
    name: fc.oneof(fc.string({ maxLength: 80 }), fc.jsonValue()),
    icon: fc.oneof(fc.string({ maxLength: 9000 }), fc.jsonValue()),
    parentId: fc.oneof(fc.string({ maxLength: 80 }), fc.jsonValue()),
    containers: fc.oneof(
        fc.array(fc.jsonValue(), { maxLength: 40 }),
        fc.dictionary(fc.string({ maxLength: 40 }), fc.boolean(), { maxKeys: 40 }),
        fc.jsonValue()
    ),
    settings: fc.jsonValue(),
    actions: fc.oneof(fc.array(fc.jsonValue(), { maxLength: 240 }), fc.jsonValue())
});

test('fast-check: folder normalization preserves identifier and collection safety invariants', () => {
    fc.assert(fc.property(
        fc.dictionary(fc.string({ maxLength: 80 }), folderRecordArbitrary, { maxKeys: 50 }),
        (source) => {
            const normalized = utils.normalizeFolderMap(source);
            assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
            for (const [id, folder] of Object.entries(normalized)) {
                assert.equal(utils.normalizeFolderId(id), id);
                assert.notEqual(id, '__proto__');
                assert.notEqual(id, 'constructor');
                assert.equal(folder.name, folder.name.trim());
                assert.notEqual(folder.name, '');
                assert.ok(Array.isArray(folder.containers));
                assert.deepEqual(folder.containers, [...new Set(folder.containers)]);
                assert.ok(folder.containers.every((value) => typeof value === 'string' && value.trim() !== ''));
                assert.ok(Array.isArray(folder.actions));
                assert.ok(folder.actions.length <= 200);
                assert.equal(typeof folder.settings, 'object');
                assert.equal(Array.isArray(folder.settings), false);
            }
        }
    ), FUZZ_OPTIONS);
});

test('fast-check: import parsing is total for arbitrary JSON and returns a bounded contract', () => {
    fc.assert(fc.property(
        fc.jsonValue(),
        fc.constantFrom('docker', 'vm'),
        (payload, expectedType) => {
            const parsed = utils.parseImportPayload(payload, expectedType);
            assert.equal(typeof parsed, 'object');
            assert.equal(typeof parsed.ok, 'boolean');
            if (parsed.ok) {
                assert.equal(typeof parsed.folders, 'object');
                assert.equal(Array.isArray(parsed.folders), false);
                assert.ok(Object.keys(parsed.folders).every((id) => utils.normalizeFolderId(id) === id));
            } else {
                assert.equal(typeof parsed.error, 'string');
                assert.notEqual(parsed.error.trim(), '');
            }
        }
    ), FUZZ_OPTIONS);
});

test('fast-check: cyclic folder graphs produce bounded descendant sets', () => {
    fc.assert(fc.property(
        fc.array(fc.integer({ min: -1, max: 40 }), { minLength: 1, maxLength: 40 }),
        fc.nat(),
        (parentIndexes, rootSeed) => {
            const ids = parentIndexes.map((_value, index) => `folder-${index}`);
            const folders = Object.fromEntries(ids.map((id, index) => {
                const parentIndex = parentIndexes[index];
                const parentId = parentIndex >= 0 ? ids[parentIndex % ids.length] : '';
                return [id, { name: id, parentId }];
            }));
            const rootId = ids[rootSeed % ids.length];
            const descendants = hierarchy.computeFolderDescendantIds(folders, rootId);
            assert.ok(descendants instanceof Set);
            assert.equal(descendants.has(rootId), false);
            assert.ok(descendants.size <= ids.length - 1);
            assert.ok([...descendants].every((id) => Object.hasOwn(folders, id)));
        }
    ), FUZZ_OPTIONS);
});

test('fast-check: Docker container normalization returns immutable bounded structures', () => {
    fc.assert(fc.property(
        fc.dictionary(fc.string({ maxLength: 40 }), fc.jsonValue(), { maxKeys: 50 }),
        fc.string({ maxLength: 40 }),
        (entry, source) => {
            const normalized = containerModel.normalizeContainer(entry, { source });
            assert.equal(normalized.schemaVersion, 1);
            assert.ok(Object.isFrozen(normalized));
            assert.ok(Object.isFrozen(normalized.names));
            assert.ok(Object.isFrozen(normalized.ports));
            assert.ok(Object.isFrozen(normalized.mounts));
            assert.equal(normalized.name.startsWith('/'), false);
            assert.ok(normalized.ports.every((port) => Object.isFrozen(port)));
            assert.ok(normalized.mounts.every((mount) => Object.isFrozen(mount)));
        }
    ), FUZZ_OPTIONS);
});

test('fast-check: support-bundle comparison omits values behind sensitive keys', () => {
    fc.assert(fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{1,32}$/),
        fc.nat({ max: 10000 }),
        fc.nat({ max: 10000 }),
        (suffix, leftCount, rightCount) => {
            const marker = `private-${suffix}`;
            const makeBundle = (folderCount) => ({
                bundleMeta: { privacyMode: 'sanitized', schemaVersion: 2 },
                pluginState: {
                    folderCount,
                    folderName: marker,
                    configPath: marker,
                    sourceUrl: marker,
                    ipAddress: marker,
                    accessToken: marker,
                    sessionCookie: marker,
                    machineUuid: marker
                },
                redactionManifest: { mode: 'sanitized', hashedCount: 8 }
            });
            const report = compareSanitizedSupportBundles(makeBundle(leftCount), makeBundle(rightCount));
            const rendered = renderSupportBundleComparisonMarkdown(report);
            assert.doesNotMatch(JSON.stringify(report), new RegExp(marker));
            assert.doesNotMatch(rendered, new RegExp(marker));
            assert.ok(report.differences.every((row) => !/(name|path|url|ip|token|cookie|uuid)/i.test(row.path)));
        }
    ), FUZZ_OPTIONS);
});
