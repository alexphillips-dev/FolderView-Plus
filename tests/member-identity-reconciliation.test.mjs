import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const identity = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.member-identity.js');

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
            actions: [{ type: 0, containers: ['old-name'], conatiners: ['old-name'] }]
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

test('editor, server, and runtime wire identity and per-member preview persistence', () => {
    const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
    const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
    const serverLib = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
    const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
    const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

    assert.match(folderPage, /folder\.member-identity\.js/);
    assert.match(folderPage, /Show in preview/);
    assert.match(folderJs, /hiddenPreviewMembers:\s*nextHiddenPreviewMembers/);
    assert.match(folderJs, /memberIdentities,/);
    assert.match(serverLib, /function applyFolderMemberIdentityPatches/);
    assert.match(serverLib, /member_identity_reconcile/);
    assert.match(dockerJs, /reconcileDockerMemberIdentities\(folders, containersInfo\)/);
    assert.match(vmJs, /reconcileVmMemberIdentities\(folders, vmInfo\)/);
    assert.match(dockerJs, /hiddenPreviewSet\.has\(container_name_in_folder\)/);
    assert.match(vmJs, /hiddenPreviewSet\.has\(container\)/);
});
