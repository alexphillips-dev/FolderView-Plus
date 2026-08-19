import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const grouping = createRequire(import.meta.url)(path.join(pluginRoot, 'scripts', 'docker.runtime.folder-grouping.js'));
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const createRow = ({ name, id, containerId = '' }) => ({
    id,
    dataset: containerId ? { containerId } : {},
    isConnected: true,
    classList: { contains: () => false },
    querySelector: (selector) => (
        selector.includes('.appname') ? { textContent: name, dataset: {} } : null
    )
});
const createRuntime = (count = 18) => Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
        const name = `app-${String(index).padStart(2, '0')}`;
        const id = `sha256:${(index + 1).toString(16).padStart(2, '0').repeat(32)}`;
        return [name, {
            id,
            shortId: id.slice(7, 19),
            info: { Id: id, Name: `/${name}` }
        }];
    })
);

test('Docker grouping resolves short-id host rows to canonical runtime names', () => {
    const containersInfo = createRuntime();
    const rows = Object.entries(containersInfo).map(([name, entry]) => createRow({
        name,
        id: `ct-${entry.shortId}`
    }));
    const session = grouping.createSession({
        document: { querySelectorAll: () => rows },
        containersInfo
    });

    assert.deepEqual(session.readOrder(), Object.keys(containersInfo));
    assert.deepEqual(session.snapshot().hostRows, {
        total: 18,
        resolved: 18,
        unresolved: 0,
        conflictingCandidates: 0,
        duplicateCanonical: 0
    });
});

test('late wizard folders survive hide-empty grouping with manual and rule candidates', () => {
    const containersInfo = createRuntime();
    const names = Object.keys(containersInfo);
    const rows = names.map((name) => createRow({
        name,
        id: `ct-${containersInfo[name].shortId}`
    }));
    const session = grouping.createSession({
        document: { querySelectorAll: () => rows },
        containersInfo
    });
    const assignments = new Map([
        [3, { explicit: names.slice(0, 1) }],
        [8, { explicit: names.slice(1, 10) }],
        [21, { explicit: names.slice(10, 12) }],
        [22, { rules: names.slice(12, 14) }],
        [23, { label: names.slice(14, 16) }],
        [24, { regex: names.slice(16, 17) }]
    ]);

    for (let folderIndex = 0; folderIndex < 25; folderIndex++) {
        const sources = assignments.get(folderIndex) || {};
        const combined = [...new Set(Object.values(sources).flat())];
        const folderId = `folder-${folderIndex}`;
        session.beginFolder(folderId, sources, combined.length);
        const claimed = combined.map((name) => session.claim(folderId, name)).filter(Boolean);
        session.finishFolder(folderId, {
            renderedMemberCount: claimed.length,
            removedByHideEmpty: claimed.length === 0
        });
    }

    const snapshot = session.snapshot();
    assert.equal(snapshot.folders.total, 25);
    assert.equal(snapshot.folders.combinedCandidateCount, 17);
    assert.equal(snapshot.folders.claimedRowCount, 17);
    assert.equal(snapshot.folders.renderedMemberCount, 17);
    assert.equal(snapshot.folders.missingRowCount, 0);
    assert.equal(snapshot.folders.removedByHideEmptyCount, 19);
    assert.equal(snapshot.folders.entries.filter((entry) => !entry.removedByHideEmpty).length, 6);
    assert.equal(snapshot.folders.entries[22].ruleCandidateCount, 2);
    assert.equal(snapshot.folders.entries[23].labelCandidateCount, 2);
    assert.equal(snapshot.folders.entries[24].regexCandidateCount, 1);
    assert.equal(JSON.stringify(snapshot).includes('app-'), false, 'diagnostics must not expose container names');
    assert.equal(JSON.stringify(snapshot).includes('sha256:'), false, 'diagnostics must not expose container IDs');
});

test('Docker grouping preserves first-folder-wins ownership', () => {
    const containersInfo = createRuntime(1);
    const name = Object.keys(containersInfo)[0];
    const row = createRow({ name, id: `ct-${containersInfo[name].shortId}` });
    const session = grouping.createSession({
        document: { querySelectorAll: () => [row] },
        containersInfo
    });

    session.beginFolder('first', { explicit: [name] }, 1);
    session.beginFolder('second', { rules: [name] }, 1);
    assert.equal(session.claim('first', name), row);
    assert.equal(session.claim('second', name), null);
    session.finishFolder('first', { renderedMemberCount: 1 });
    session.finishFolder('second', { renderedMemberCount: 0, removedByHideEmpty: true });

    const snapshot = session.snapshot();
    assert.equal(snapshot.folders.claimedRowCount, 1);
    assert.equal(snapshot.folders.missingRowCount, 1);
    assert.equal(snapshot.folders.removedByHideEmptyCount, 1);
});

test('Docker runtime loads and consumes the extracted folder grouping module', () => {
    const page = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
    const docker = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
    const diagnostics = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.diagnostics.js');
    const groupingIndex = page.indexOf('/plugins/folderview.plus/scripts/docker.runtime.folder-grouping.js');
    const runtimeIndex = page.indexOf('/plugins/folderview.plus/scripts/docker.js');

    assert.ok(groupingIndex >= 0 && groupingIndex < runtimeIndex);
    assert.match(docker, /dockerFolderGroupingModule\.createSession\(\{ document, containersInfo \}\)/);
    assert.match(docker, /let order = dockerFolderGroupingSession\.readOrder\(\)/);
    assert.match(docker, /dockerFolderGroupingSession\.claim\(id, container_name_in_folder\)/);
    assert.match(docker, /dockerFolderGroupingSession\?\.finishFolder/);
    assert.match(diagnostics, /folderGrouping: cloneValue\(getFolderGroupingDiagnostics\(\)\)/);
});
