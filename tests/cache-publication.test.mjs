import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
for (const kind of ['shared', 'info']) test(`${kind} cache never publishes another writer's incomplete temporary payload`, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-cache-publication-'));
    try {
        for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
        fs.writeFileSync(path.join(root, 'cache.json'), '{"writer":"old"}');
        await Promise.all(['a', 'b'].map(worker => exec('php', [path.resolve('tests/fixtures/cache-publication.php'), server, root, worker, kind], { timeout: 20000 })));
        const observed = JSON.parse(fs.readFileSync(path.join(root, 'observed.json'), 'utf8'));
        assert.equal(observed.valid, true, `published incomplete JSON: ${observed.raw}`);
        const published = JSON.parse(observed.raw);
        assert.equal(kind === 'info' ? published.data.writer : published.writer, 'a');
        assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(root, 'cache.json'), 'utf8')));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const kind of ['shared', 'info']) for (const fault of ['partial', 'rename']) {
    test(`${kind} cache preserves its previous payload and cleans temporary files after ${fault} failure`, async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-cache-failure-'));
        try {
            for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
            const previous = '{"writer":"old"}';
            fs.writeFileSync(path.join(root, 'cache.json'), previous);
            await exec('php', [path.resolve('tests/fixtures/cache-publication.php'), server, root, 'failure', kind, fault], { timeout: 20000 });
            assert.equal(fs.readFileSync(path.join(root, 'cache.json'), 'utf8'), previous);
            assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith('cache.json.tmp')), []);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });
}
