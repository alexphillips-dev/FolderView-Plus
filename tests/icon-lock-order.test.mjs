import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const server = process.env.FVPLUS_ICON_LOCK_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = process.env.FVPLUS_ICON_LOCK_FIXTURE || path.resolve('tests/fixtures/icon-lock-order.php');
test('an initialized icon reader and guarded rename use config-before-icon without inversion', async () => {
    const base = fs.realpathSync(os.tmpdir()); const root = fs.mkdtempSync(path.join(base, 'fvplus-icon-lock-order-'));
    for (const directory of ['config', 'source', 'host', 'temp']) fs.mkdirSync(path.join(root, directory));
    fs.mkdirSync(path.join(root, 'source/images/custom'), { recursive: true });
    fs.writeFileSync(path.join(root, 'source/images/custom/unmanaged.txt'), 'force a public mirror');
    const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
        FVPLUS_TEST_STORAGE_DIR: root, FVPLUS_TEST_SECURITY_STATE_PATH: path.join(root, 'security/state.json'),
        TMP: path.join(root, 'temp'), TEMP: path.join(root, 'temp'), TMPDIR: path.join(root, 'temp') };
    const children = [];
    const launch = operation => {
        const child = spawn('php', [fixture, server, root, operation], { env }); children.push(child);
        let stdout = ''; let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
        const done = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr || stdout)));
        });
        done.catch(() => {}); return done;
    };
    const waitFor = async marker => {
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(path.join(root, marker))) {
            assert.ok(Date.now() < deadline, `timed out waiting for ${marker}`);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    };
    try {
        execFileSync('php', [fixture, server, root, 'seed'], { env, timeout: 30000 });
        const reader = launch('read'); const writer = launch('write');
        await Promise.all(['read-ready', 'write-ready'].map(waitFor));
        fs.writeFileSync(path.join(root, 'start-read'), 'go'); await waitFor('read-holds-icon');
        fs.writeFileSync(path.join(root, 'start-write'), 'go'); await waitFor('write-config-probe');
        assert.equal(fs.readFileSync(path.join(root, 'write-config-probe'), 'utf8'), 'blocked');
        fs.writeFileSync(path.join(root, 'release-read'), 'go');
        const [read, written] = await Promise.all([reader, writer]);
        assert.equal(read.ok, true); assert.equal(written.ok, true); assert.equal(written.name, 'after.png');
    } finally {
        for (const child of children) if (child.exitCode === null) child.kill();
        await Promise.all(children.filter(child => child.exitCode === null).map(child => new Promise(resolve => child.once('close', resolve))));
        assert.equal(path.dirname(fs.realpathSync(root)), base); fs.rmSync(root, { recursive: true, force: true });
    }
});
