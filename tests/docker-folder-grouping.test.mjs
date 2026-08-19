import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const grouping = createRequire(import.meta.url)(path.join(pluginRoot, 'scripts', 'docker.runtime.folder-grouping.js'));
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const createRow = ({ name = '', id = '', containerId = '', folderId = '' }) => {
    const classes = new Set(folderId ? ['folder', 'sortable'] : ['sortable']);
    const row = {
        id,
        dataset: folderId ? { fvFolderId: folderId } : (containerId ? { containerId } : {}),
        isConnected: true,
        parentElement: null,
        parentNode: null,
        classList: {
            contains: (value) => classes.has(value),
            add: (...values) => values.forEach((value) => classes.add(value)),
            remove: (...values) => values.forEach((value) => classes.delete(value))
        },
        querySelector: (selector) => (
            selector.includes('.appname') ? { textContent: name, dataset: {} } : null
        ),
        remove: () => row.parentNode?.removeChild?.(row)
    };
    Object.defineProperty(row, 'nextSibling', {
        get: () => {
            const siblings = row.parentNode?.children || [];
            return siblings[siblings.indexOf(row) + 1] || null;
        }
    });
    return row;
};
const createParent = (initialChildren = []) => {
    const parent = {
        children: [],
        removeChild: (row) => {
            const index = parent.children.indexOf(row);
            if (index >= 0) parent.children.splice(index, 1);
            row.parentElement = null;
            row.parentNode = null;
            return row;
        },
        insertBefore: (row, anchor) => {
            row.parentNode?.removeChild?.(row);
            const index = anchor ? parent.children.indexOf(anchor) : parent.children.length;
            parent.children.splice(index < 0 ? parent.children.length : index, 0, row);
            row.parentElement = parent;
            row.parentNode = parent;
            return row;
        },
        appendChild: (row) => parent.insertBefore(row, null)
    };
    initialChildren.forEach(parent.appendChild);
    return parent;
};
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

test('late wizard folder shells survive shrinking sortable rows with hide-empty enabled', () => {
    const containersInfo = createRuntime();
    const names = Object.keys(containersInfo);
    const rows = names.map((name) => createRow({
        name,
        id: `ct-${containersInfo[name].shortId}`
    }));
    const listRoot = createParent(rows);
    const session = grouping.createSession({
        document: {
            querySelectorAll: () => rows,
            getElementById: () => listRoot
        },
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

    const order = Array.from({ length: 25 }, (_, index) => `folder-folder-${index}`).concat(names);
    for (let folderIndex = 0; folderIndex < 25; folderIndex++) {
        const sources = assignments.get(folderIndex) || {};
        const combined = [...new Set(Object.values(sources).flat())];
        const folderId = `folder-${folderIndex}`;
        session.beginFolder(folderId, sources, combined.length);
        const folderRow = createRow({ folderId });
        const storage = createParent();
        const insertion = session.insertFolderRow(folderId, folderRow, folderIndex, order);
        assert.equal(insertion.inserted, true);
        const claimed = combined.map((name) => session.claim(folderId, name)).filter(Boolean);
        claimed.forEach((row) => {
            row.classList.remove('sortable');
            row.classList.add('folder-element');
            storage.appendChild(row);
        });
        session.finishFolder(folderId, {
            renderedMemberCount: claimed.length,
            removedByHideEmpty: claimed.length === 0
        });
        if (claimed.length === 0) folderRow.remove();
    }

    const snapshot = session.snapshot();
    assert.deepEqual(
        listRoot.children.filter((row) => row.classList.contains('folder')).map((row) => row.dataset.fvFolderId),
        ['folder-3', 'folder-8', 'folder-21', 'folder-22', 'folder-23', 'folder-24']
    );
    assert.equal(snapshot.folders.total, 25);
    assert.equal(snapshot.folders.combinedCandidateCount, 17);
    assert.equal(snapshot.folders.claimedRowCount, 17);
    assert.equal(snapshot.folders.renderedMemberCount, 17);
    assert.equal(snapshot.folders.missingRowCount, 0);
    assert.equal(snapshot.folders.insertedShellCount, 25);
    assert.equal(snapshot.folders.failedShellCount, 0);
    assert.equal(snapshot.folders.fallbackShellCount, 0);
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

test('folder shell insertion falls back to a connected previous row and reports missing roots', () => {
    const containersInfo = createRuntime(1);
    const name = Object.keys(containersInfo)[0];
    const hostRow = createRow({ name, id: `ct-${containersInfo[name].shortId}` });
    const listRoot = createParent([hostRow]);
    const session = grouping.createSession({
        document: { querySelectorAll: () => [hostRow], getElementById: () => listRoot },
        containersInfo
    });
    const folderRow = createRow({ folderId: 'late' });
    session.beginFolder('late', {}, 0);
    assert.deepEqual(session.insertFolderRow('late', folderRow, 1, [name, 'folder-late']), {
        inserted: true,
        strategy: 'after-previous'
    });
    assert.equal(listRoot.children.at(-1), folderRow);

    const disconnected = grouping.createSession({ document: { querySelectorAll: () => [] }, containersInfo: {} });
    disconnected.beginFolder('missing-root', {}, 0);
    assert.deepEqual(disconnected.insertFolderRow('missing-root', createRow({ folderId: 'missing-root' }), 0, []), {
        inserted: false,
        strategy: 'failed'
    });
    assert.equal(disconnected.snapshot().folders.failedShellCount, 1);
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
    assert.match(docker, /dockerFolderGroupingSession\.insertFolderRow\(/);
    assert.match(docker, /dockerFolderGroupingSession\.claim\(id, container_name_in_folder\)/);
    assert.match(docker, /dockerFolderGroupingSession\?\.finishFolder/);
    assert.match(diagnostics, /folderGrouping: cloneValue\(getFolderGroupingDiagnostics\(\)\)/);
});
