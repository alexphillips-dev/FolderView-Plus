import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const runConfigWriteFixture = (request) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-config-write-'));
    for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
    try {
        const server = process.env.FVPLUS_CONFIG_WRITE_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
        const env = {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
            FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(root, 'host'),
            FVPLUS_TEST_STORAGE_DIR: path.join(root, 'config')
        };
        const result = JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/config-write.php'),
            server, root], { encoding: 'utf8', timeout: 30000, env
        }));
        if (request.restart) {
            const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
            result.metadata = JSON.parse(execFileSync('php', ['-r', `require ${quote(path.join(server, 'lib.php'))}; echo json_encode(readConfigMetadata(${quote(request.type)}, true));`], {
                encoding: 'utf8', timeout: 30000, env
            }));
        }
        return result;
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

export const runConcurrentConfigWriters = async (type) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-config-concurrent-'));
    const fixture = path.resolve('tests/fixtures/config-write.php');
    const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
    for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
    const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
        FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(root, 'host') };
    const children = [];
    const requestFile = (name, request) => {
        const file = path.join(root, `${name}.json`);
        fs.writeFileSync(file, JSON.stringify({ type, ...request }));
        return file;
    };
    const launch = (name, request) => {
        const child = spawn('php', [fixture, server, root, requestFile(name, request)], { env });
        children.push(child);
        let stdout = ''; let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        const done = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
        });
        // A launch failure must not become an unhandled rejection while awaiting a barrier.
        done.catch(() => {});
        return done;
    };
    const waitFor = async (name) => {
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(path.join(root, name))) {
            if (Date.now() > deadline) throw new Error(`Timed out waiting for ${name}`);
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    };
    try {
        execFileSync('php', [fixture, server, root, requestFile('seed', { seedOnly: true })], { env, timeout: 30000 });
        const failing = launch('failing', { skipSeed: true, pause: true });
        await waitFor('paused');
        const contender = launch('contender', { skipSeed: true, contender: true, stage: 'none', expectedRevision: 1 });
        await waitFor('contender-started');
        const blocked = fs.readFileSync(path.join(root, 'contender-started'), 'utf8') === 'blocked'
            && !fs.existsSync(path.join(root, 'contender-finished'));
        fs.writeFileSync(path.join(root, 'release'), 'release');
        const [failed, winner] = await Promise.all([failing, contender]);
        return { blocked, failed, winner };
    } finally {
        for (const child of children) if (child.exitCode === null) child.kill();
        await Promise.all(children.filter((child) => child.exitCode === null).map((child) => new Promise((resolve) => child.once('close', resolve))));
        fs.rmSync(root, { recursive: true, force: true });
    }
};
