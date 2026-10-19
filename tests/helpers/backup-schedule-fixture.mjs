import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.resolve('tests/fixtures/backup-schedule.php');
export function createBackupScheduleFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-backup-schedule-'));
    for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
    const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
        FVPLUS_TEST_DOCUMENT_ROOT: path.join(root, 'host'), FVPLUS_TEST_STORAGE_DIR: root };
    const args = request => { const file = path.join(root, `request-${Math.random()}.json`); fs.writeFileSync(file, JSON.stringify(request)); return [fixture, server, file]; };
    return { root, env, args, run: request => JSON.parse(execFileSync('php', args(request), { env, encoding: 'utf8', timeout: 20000 })),
        close: () => {
            if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('fvplus-backup-schedule-')) throw new Error('Unsafe fixture cleanup path');
            fs.rmSync(root, { recursive: true, force: true });
        } };
}
export function runBackupScheduleFixture(type, scenario) {
    const fixture = createBackupScheduleFixture();
    try { return fixture.run({ type, scenario }); } finally { fixture.close(); }
}
