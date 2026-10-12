import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const runCaptureFixture = (operation, owner = 'environment', extra = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-capture-'));
    for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify({ operation, owner, ...extra }));
    try {
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/transaction-capture.php'),
            path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server'), root], {
            encoding: 'utf8', timeout: 30000, env: {
                ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(root, 'host'),
                FVPLUS_TEST_STORAGE_DIR: path.join(root, 'config'), FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'config/autostart')
            }
        }));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
};
