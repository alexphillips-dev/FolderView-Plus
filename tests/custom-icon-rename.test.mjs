import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.resolve('tests/fixtures/custom-icon-rename.php');
const run = request => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-rename-'));
    for (const dir of ['config', 'source', 'host', 'temp']) fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify({ kind: 'unused', ...request }));
    try {
        return JSON.parse(execFileSync('php', [fixture, server, root], { encoding: 'utf8', timeout: 30000,
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
                TMP: path.join(root, 'temp'), TEMP: path.join(root, 'temp'), TMPDIR: path.join(root, 'temp') } }));
    } finally {
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    }
};
const aliases = ['/plugins/folderview.plus/images/custom/before.png?v=7#icon',
    '/usr/local/emhttp/plugins/folderview.plus/images/custom/before.png',
    'plugins/folderview.plus/images/custom/before.png',
    'https://fixture.invalid/plugins/folderview.plus/images/custom/%62efore.png'];

for (const type of ['docker', 'vm']) for (const kind of ['folder', 'defaults', 'group']) {
    test(`rename refuses ${type} ${kind} references without changing icon, metadata, mirror or saved state`, () => {
        for (const reference of aliases) {
            const result = run({ type, kind, reference });
            assert.match(result.error || '', /Remove or replace.*references.*renaming/i);
            assert.deepEqual(result.after, result.before);
        }
    });
}
test('rename refuses the current unsaved editor selection', () => {
    const result = run({ selectedIcon: aliases[0] });
    assert.match(result.error || '', /Remove or replace.*references.*renaming/i);
    assert.deepEqual(result.after, result.before);
});
test('unused rename normalizes the extension and updates real metadata and public copy', () => {
    const result = run({});
    assert.equal(result.error, null);
    assert.equal(result.response.icon.name, 'after.png');
    assert.equal(result.after['config/images/custom/before.png'], undefined);
    assert.deepEqual(result.after['config/images/custom/after.png'], result.before['config/images/custom/before.png']);
    assert.equal(result.after['source/images/custom/after.png'][0], result.before['source/images/custom/before.png'][0]);
});
test('same-name no-op is allowed even for a referenced icon; collision preserves all bytes', () => {
    const noop = run({ kind: 'folder', reference: aliases[0], to: 'before.png' });
    assert.equal(noop.error, null);
    assert.equal(noop.response.icon.name, 'before.png');
    assert.deepEqual(noop.after, noop.before);
    const collision = run({ collision: true });
    assert.match(collision.error, /already exists/);
    assert.deepEqual(collision.after, collision.before);
});
for (const fault of ['metadata', 'mirror']) {
    test(`failed ${fault} stage restores real icon bytes, metadata, public copies and permissions`, () => {
        const result = run({ fault });
        assert.match(result.error || '', /Synthetic .*failure/);
        assert.deepEqual(result.after, result.before);
    });
}
test('unknown reference state refuses rename without repairing or rewriting configuration', () => {
    const result = run({ corrupt: true });
    assert.match(result.error || '', /references could not be verified/);
    assert.deepEqual(result.after, result.before);
});

test('concurrent folder save, rename and delete retain the saved reference and serialize icon mutations', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-concurrent-'));
    for (const dir of ['config', 'source', 'host', 'temp']) fs.mkdirSync(path.join(root, dir));
    const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: root + '/config', FVPLUS_TEST_SOURCE_DIR: root + '/source',
        TMP: root + '/temp', TEMP: root + '/temp', TMPDIR: root + '/temp' };
    const children = [];
    const requestFile = (name, request) => {
        const file = root + '/' + name + '.json';
        fs.writeFileSync(file, JSON.stringify({ kind: 'unused', ...request })); return file;
    };
    const launch = (name, request) => {
        const child = spawn('php', [fixture, server, root, requestFile(name, request)], { env });
        children.push(child); let stdout = '', stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
        const done = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
        });
        done.catch(() => {}); return done;
    };
    const waitFor = async name => {
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(root + '/' + name)) {
            if (Date.now() > deadline) throw new Error('Fixture barrier timeout: ' + name);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    };
    try {
        execFileSync('php', [fixture, server, root, requestFile('seed', { seedOnly: true })], { env, timeout: 30000 });
        const save = launch('save', { skipSeed: true, holdSave: true, waitStart: 'start-save', ready: 'save-ready' });
        const rename = launch('rename', { skipSeed: true, contender: true, waitStart: 'start-rename', ready: 'rename-ready' });
        const remove = launch('delete', { skipSeed: true, action: 'delete', waitStart: 'start-delete', ready: 'delete-ready' });
        await Promise.all(['save-ready', 'rename-ready', 'delete-ready'].map(waitFor));
        fs.writeFileSync(root + '/start-save', 'ready'); await waitFor('save-locked');
        fs.writeFileSync(root + '/start-rename', 'ready');
        fs.writeFileSync(root + '/start-delete', 'ready');
        fs.writeFileSync(root + '/release-save', 'ready');
        const [saved, renamed, deleted] = await Promise.all([save, rename, remove]);
        assert.equal(saved.saved, true);
        assert.match(renamed.error, /Remove or replace/);
        assert.match(deleted.error, /in use/);
        assert.equal(JSON.parse(fs.readFileSync(root + '/config/docker.json', 'utf8')).concurrent.icon,
            '/plugins/folderview.plus/images/custom/before.png');
        assert.equal(fs.existsSync(root + '/config/images/custom/before.png'), true);
        assert.equal(fs.existsSync(root + '/config/images/custom/after.png'), false);
    } finally {
        for (const child of children) if (child.exitCode === null) child.kill();
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    }
});
