import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const migrationFixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/imports/folderview3-envelope-v1.json'), 'utf8'));
export const runMigrationFixture = (request = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-migration-remediation-'));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify({ bundle: migrationFixture, ...request }));
    try {
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/folderview3-migration.php'), root,
            path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server')], { encoding: 'utf8', timeout: 30000 }));
    } finally {
        const resolved = path.resolve(root);
        if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('fvplus-migration-remediation-')) throw new Error('Unexpected fixture cleanup path');
        fs.rmSync(resolved, { recursive: true, force: true });
    }
};
