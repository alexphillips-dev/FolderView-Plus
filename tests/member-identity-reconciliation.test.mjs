import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const identity = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.member-identity.js');

const persistPatches = (request) => {
    const temporary = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(temporary, 'fvplus-identity-'));
    try {
        fs.mkdirSync(path.join(root, 'config'));
        fs.mkdirSync(path.join(root, 'host'));
        fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
        const server = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
        return JSON.parse(execFileSync('php', ['tests/fixtures/member-identity-reconciliation.php', root, server], {
            encoding: 'utf8', timeout: 30000
        }));
    } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), temporary);
        fs.rmSync(root, { recursive: true, force: true });
    }
};

test('a uniquely identified renamed Docker member keeps folder state and action targets', () => {
    const folders = {
        media: {
            name: 'Media',
            containers: ['old-name'],
            hiddenPreviewMembers: ['old-name'],
            memberIdentities: {
                'old-name': {
                    kind: 'docker',
                    image: 'lscr.io/linuxserver/sonarr:latest',
                    composeProject: 'media',
                    mountDestinations: ['/config', '/tv']
                }
            },
            actions: [{ type: 0, containers: ['old-name'], conatiners: ['old-name'] }],
            settings: {
                webui_profiles: [{ id: 'media', name: 'Media tools', containers: ['old-name'] }]
            }
        }
    };
    const runtime = {
        'new-name': {
            name: 'new-name',
            id: '1234567890ab',
            Image: 'lscr.io/linuxserver/sonarr:latest',
            composeProject: 'media',
            Mounts: [{ Destination: '/config' }, { Destination: '/tv' }]
        }
    };

    const result = identity.reconcileFolders('docker', folders, runtime);
    assert.deepEqual(result.folders.media.containers, ['new-name']);
    assert.deepEqual(result.folders.media.hiddenPreviewMembers, ['new-name']);
    assert.deepEqual(result.folders.media.actions[0].containers, ['new-name']);
    assert.deepEqual(result.folders.media.actions[0].conatiners, ['new-name']);
    assert.deepEqual(result.folders.media.settings.webui_profiles[0].containers, ['new-name']);
    assert.equal(result.diagnostics.renamed, 1);
    assert.equal(result.patches.media.renames['old-name'], 'new-name');
});

test('duplicate Docker images remain unresolved unless a stable discriminator produces one winner', () => {
    const folders = {
        tools: {
            containers: ['old-tool'],
            memberIdentities: {
                'old-tool': { kind: 'docker', image: 'example/tool:latest' }
            }
        }
    };
    const runtime = {
        alpha: { name: 'alpha', Image: 'example/tool:latest' },
        beta: { name: 'beta', Image: 'example/tool:latest' }
    };
    const result = identity.reconcileFolders('docker', folders, runtime);
    assert.deepEqual(result.folders.tools.containers, ['old-tool']);
    assert.equal(result.diagnostics.ambiguous.length, 1);
    assert.equal(Object.keys(result.patches).length, 0);
});

test('a duplicate image stays ambiguous even when one matching runtime name is already claimed', () => {
    const result = identity.reconcileFolders('docker', {
        tools: {
            containers: ['alpha', 'old-tool'],
            memberIdentities: {
                alpha: { kind: 'docker', image: 'example/tool:latest' },
                'old-tool': { kind: 'docker', image: 'example/tool:latest' }
            }
        }
    }, {
        alpha: { name: 'alpha', Image: 'example/tool:latest' },
        beta: { name: 'beta', Image: 'example/tool:latest' }
    });

    assert.deepEqual(result.folders.tools.containers, ['alpha', 'old-tool']);
    assert.equal(result.diagnostics.ambiguous.length, 1);
    assert.equal(result.patches.tools?.renames?.['old-tool'], undefined);
});

test('VM members reconcile by UUID and live members backfill their identities', () => {
    const renamed = identity.reconcileFolders('vm', {
        lab: {
            containers: ['Old VM'],
            memberIdentities: { 'Old VM': { kind: 'vm', uuid: 'vm-uuid-1' } }
        }
    }, {
        'New VM': { name: 'New VM', uuid: 'vm-uuid-1' }
    });
    assert.deepEqual(renamed.folders.lab.containers, ['New VM']);

    const backfilled = identity.reconcileFolders('vm', {
        lab: { containers: ['Current VM'] }
    }, {
        'Current VM': { name: 'Current VM', uuid: 'vm-uuid-2' }
    });
    assert.equal(backfilled.folders.lab.memberIdentities['Current VM'].uuid, 'vm-uuid-2');
    assert.equal(backfilled.diagnostics.backfilled, 1);
});

test('identity writes preserve a newer manual claim in a different folder', () => {
    const uuid = '00000000-0000-0000-0000-000000000001';
    const folders = { source: { containers: ['Old'], memberIdentities: { Old: { kind: 'vm', uuid } } },
        destination: { containers: [] } };
    const inventory = { Renamed: { name: 'Renamed', uuid } };
    const { patches } = identity.reconcileFolders('vm', folders, inventory);
    const saved = persistPatches({ folders, patches, inventory, assignTo: 'destination' });
    assert.equal(saved.result.renameCount, 0);
    assert.equal(saved.result.metadata.folderRevision, saved.before.folderRevision);
    assert.deepEqual(saved.folders.source.containers, ['Old']);
    assert.deepEqual(saved.folders.destination.containers, ['Renamed']);
});

test('a renamed VM keeps its UUID even after another VM takes its old name', () => {
    const uuid = '00000000-0000-0000-0000-000000000001';
    const replacementUuid = '00000000-0000-0000-0000-000000000002';
    const prefix = 'x'.repeat(64);
    const folderId = prefix + 'target';
    const folders = { [prefix]: { containers: ['Old'] },
        [folderId]: { containers: ['Old'], memberIdentities: { Old: { kind: 'vm', uuid } } } };
    const inventory = { Old: { name: 'Old', uuid: replacementUuid }, Renamed: { name: 'Renamed', uuid } };
    const { folders: optimistic, patches } = identity.reconcileFolders('vm', folders, inventory);
    assert.deepEqual(optimistic[folderId].containers, ['Renamed']);
    const saved = persistPatches({ folders, patches });
    assert.equal(saved.result.renameCount, 1);
    assert.deepEqual(saved.folders[prefix].containers, ['Old']);
    assert.deepEqual(saved.folders[folderId].containers, ['Renamed']);
    assert.equal(saved.folders[folderId].memberIdentities.Renamed.uuid, uuid);
    const unavailable = identity.reconcileFolders('vm', { [folderId]: folders[folderId] }, { Old: inventory.Old });
    assert.equal(Object.hasOwn(unavailable.patches, folderId), false);
});

test('editor, server, and runtime wire identity and per-member preview persistence', () => {
    const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
    const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
    const serverLib = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.folder-mutations.php');
    const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
    const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

    assert.match(folderPage, /folder\.member-identity\.js/);
    assert.match(folderPage, /Show in preview/);
    assert.match(folderJs, /hiddenPreviewMembers:\s*preservedHiddenPreviewMembers/);
    assert.match(folderJs, /memberIdentities,/);
    assert.match(serverLib, /function applyFolderMemberIdentityPatches/);
    assert.match(serverLib, /member_identity_reconcile/);
    assert.match(dockerJs, /reconcileDockerMemberIdentities\(folders, containersInfo\)/);
    assert.match(vmJs, /reconcileVmMemberIdentities\(folders, vmInfo\)/);
    assert.match(dockerJs, /hiddenPreviewSet\.has\(container_name_in_folder\)/);
    assert.match(vmJs, /hiddenPreviewSet\.has\(container\)/);
});
