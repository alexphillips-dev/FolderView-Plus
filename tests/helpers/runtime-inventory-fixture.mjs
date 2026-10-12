import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const runInventoryRepair = (request) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-inventory-'));
    for (const dir of ['config', 'source', 'host', 'cache']) fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
    try {
        const server = process.env.FVPLUS_INVENTORY_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
        const fixtureServer = path.join(root, 'server');
        fs.cpSync(server, fixtureServer, { recursive: true });
        fs.cpSync(path.join(server, '../langs'), path.join(root, 'langs'), { recursive: true });
        const core = path.join(fixtureServer, 'lib.php');
        const source = fs.readFileSync(core, 'utf8');
        const cacheRoot = path.join(root, 'cache').replaceAll('\\', '/');
        // Isolate the host's fixed cache directory; exercise the real cache reader/writer unchanged.
        assertCacheRoot(source);
        fs.writeFileSync(core, source.replace("$cacheRoot = '/tmp/folderview.plus-cache';", `$cacheRoot = '${cacheRoot}';`));
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/runtime-inventory.php'),
            fixtureServer, root], {
            encoding: 'utf8', timeout: 30000, env: { ...process.env,
                FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
                FVPLUS_TEST_DOCUMENT_ROOT: path.join(root, 'host'), FVPLUS_TEST_STORAGE_DIR: path.join(root, 'config'),
                FVPLUS_TEST_CACHE_DIR: path.join(root, 'cache') }
        }));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

const assertCacheRoot = (source) => {
    if (!source.includes("$cacheRoot = '/tmp/folderview.plus-cache';")) throw new Error('Host cache isolation seam changed');
};
