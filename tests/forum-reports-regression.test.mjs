import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const require = createRequire(import.meta.url);
const ordering = require(path.join(root, 'scripts/runtime.folder-ordering.js'));
const docker = read('scripts/docker.js');

test('mixed root order survives repeated reconciliation and folder sorting', () => {
    const folders = { a: {}, b: {}, c: {} };
    let saved = ['folder-a', 'folder-b', 'one', 'two', 'folder-c'];
    for (let i = 0; i < 3; i++) {
        saved = ordering.reconcileOrderWithFolderSlots(['one', 'two'], saved, folders).order;
        assert.deepEqual(saved, ['folder-a', 'folder-b', 'one', 'two', 'folder-c']);
    }
    assert.deepEqual(ordering.reorderFolderSlotsInBaseOrder(saved, folders, { sortMode: 'alpha' }, {
        orderFolders: () => ({ c: {}, b: {}, a: {} })
    }), ['folder-c', 'folder-b', 'one', 'two', 'folder-a']);
    assert.deepEqual(ordering.reconcileOrderWithFolderSlots(['one', 'two', 'new'], [...saved, 'folder-stale', 'one'], folders).order,
        [...saved, 'new']);
});

test('PHP order response preserves mixed slots before browser hydration', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-order-test-'));
    try {
        fs.mkdirSync(path.join(tmp, 'dockerMan'));
        fs.writeFileSync(path.join(tmp, 'dockerMan/userprefs.cfg'), '0="folder-b"\n1="one"\n2="folder-a"\n3="two"\n4="folder-stale"\n');
        const body = read('server/lib.php').match(/function readUserPrefs\(string \$type\) : string \{[\s\S]*?\n    \}\n/)[0]
            .replace('$userPrefsDir = "/boot/config/plugins";', '$userPrefsDir = getenv("FV_ORDER_TEST_DIR");');
        const helper = read('server/lib.docker-order.php').match(/function fvplus_append_unique_name\([\s\S]*?\n    \}/)[0];
        const script = `${helper}\n${body}
            function readRawFolderMap($type) { return ['a'=>[], 'b'=>[], 'c'=>[]]; }
            function reorderFolderMapByPrefs($type, $folders) { return $folders; }
            function readTypePrefs($type) { return ['sortMode'=>getenv('FV_ORDER_TEST_SORT')]; }
            echo readUserPrefs('docker');`;
        for (const [sort, expected] of [
            ['created', ['folder-c', 'folder-b', 'one', 'folder-a', 'two']],
            ['manual', ['folder-c', 'folder-a', 'one', 'folder-b', 'two']]
        ]) {
            const result = spawnSync('php', ['-r', script], { encoding: 'utf8', env: { ...process.env, FV_ORDER_TEST_DIR: tmp, FV_ORDER_TEST_SORT: sort } });
            assert.equal(result.status, 0, result.stderr);
            assert.deepEqual(JSON.parse(result.stdout), expected);
        }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('hybrid devices keep mouse hover while touch-only devices use click on Docker and VM', () => {
    for (const [source, constant] of [[docker, 'FOLDER_VIEW_TOUCH_MODE'], [read('scripts/vm.js'), 'FV_VM_TOUCH_MODE']]) {
        const body = source.match(new RegExp(`const ${constant} = \\(\\(\\) => \\{([\\s\\S]*?)\\n\\}\\)\\(\\);`))[1];
        for (const [touchOnly, hybrid, expected] of [[false, false, false], [true, false, true], [true, true, false]]) {
            const result = vm.runInNewContext(`(()=>{${body}})()`, {
                window: { ontouchstart: null, matchMedia: (query) => ({ matches: query.includes('any-hover') ? hybrid : touchOnly }) },
                navigator: { maxTouchPoints: 5 }
            });
            assert.equal(result, expected);
        }
    }
});

test('stopped preview icons receive grayscale in icon-and-label and icon-only modes', () => {
    const expression = docker.match(/const shouldGrayscaleByStatus = ([^;]+);/)[1];
    for (const previewMode of [1, 2]) {
        for (const state of [true, false]) {
            assert.equal(vm.runInNewContext(expression, { previewMode, previewStatusMode: 'grayscale', entry: { state } }), !state);
        }
    }
});

test('empty multipart response recovers through inline upload exactly once; ordinary errors do not retry', async () => {
    const sandbox = {
        module: { exports: {} }, Error, FormData, File,
        FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,aWNvbg=='; this.onload(); } }
    };
    vm.runInNewContext(read('scripts/folder.editor.icon-api.js'), sandbox);
    const file = new File(['icon'], 'test.png', { type: 'image/png' });
    for (const recoverable of [true, false]) {
        let uploads = 0; let fallbacks = 0;
        const api = sandbox.module.exports.createApi({ allowedExtensions: ['png'], iconUploadApiPath: '/upload', requestClient: {
            uploadJson: async () => { uploads++; throw new Error(recoverable ? 'JSON response from /upload was empty.' : 'Permission denied.'); },
            postJson: async (_url, body) => { fallbacks++; assert.equal(body.icon_inline_name, 'test.png'); return { ok: true, url: '/test.png' }; }
        } });
        if (recoverable) assert.equal((await api.uploadCustomIconFile(file)).url, '/test.png');
        else await assert.rejects(api.uploadCustomIconFile(file), /Permission denied/);
        assert.equal(uploads, 1); assert.equal(fallbacks, recoverable ? 1 : 0);
    }
});

test('defaults submit saves only the transferable profile with revision checking and no folder mutation', async () => {
    const source = read('scripts/folder.js');
    const submit = source.match(/const submitForm = async \(e, saveAsCopy = false\) => \{([\s\S]*?)\n\};/)[1];
    const transfer = require(path.join(root, 'scripts/folder.settings-transfer.js')).createApi({});
    for (const reject of [false, true]) {
        const calls = [];
        const location = { href: '/Docker/Folder?defaults=1', pathname: '/Docker/Folder' };
        const context = {
            window: { FolderViewPlusFoundationModules: { folderDefaults: require(path.join(root, 'scripts/folder.editor.defaults.js')) } },
            validateForm: () => true, editingFolderDefaults: true,
            buildFolderPayloadFromForm: () => ({ name: '', containers: ['private-member'], settings: { preview: 2, webui_profiles: [{ id: 'private' }] }, icon: '/icon.png', actions: [] }),
            activeFolderEditorFolderId: '', folderId: '', type: 'docker', allFoldersById: {},
            getFolderSettingsTransferApi: () => transfer, folderEditorTypePrefs: { _metadata: { prefsRevision: 7 } },
            securePost: async (url, payload) => { calls.push({ url, payload }); if (reject) throw new Error('Conflict'); },
            suppressUnloadPrompt: false, location, extractAjaxErrorMessage: (error) => error.message, alert: () => {}
        };
        await vm.runInNewContext(`(async(e,saveAsCopy=false)=>{${submit}})`, context)({});
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, '/plugins/folderview.plus/server/prefs.php');
        assert.equal(calls[0].payload.expectedRevision, 7);
        const profile = JSON.parse(calls[0].payload.prefs).folderDefaults.profile;
        assert.equal(profile.settings.preview, 2);
        assert.equal(profile.settings.webui_profiles, undefined);
        assert.equal(profile.containers, undefined);
        assert.equal(location.href, reject ? '/Docker/Folder?defaults=1' : '/Settings/FolderViewPlus');
    }
});
