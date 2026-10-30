import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const server = process.env.FVPLUS_CHANNEL_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const quote = value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
test('installed update and diagnostics channel APIs share manifest parsing, precedence and safe defaults', () => {
    const base = fs.realpathSync(os.tmpdir()); const root = fs.mkdtempSync(path.join(base, 'fvplus-channel-contract-'));
    try {
        const fixtures = [
            { manifests: ['<PLUGINURL>https://fixture.invalid/dev/folderview.plus.plg</PLUGINURL>'], channel: 'dev' },
            { manifests: ['<!ENTITY pluginURL "https://fixture.invalid/main/folderview.plus.plg">'], channel: 'main' },
            { manifests: ['<!ENTITY pluginURL "https://fixture.invalid/DEV/folderview.plus.plg">'], channel: 'dev' },
            { manifests: ['malformed', '<PLUGINURL>https://fixture.invalid/dev/folderview.plus.plg</PLUGINURL>'], channel: 'dev' },
            { manifests: ['<!ENTITY pluginURL "https://fixture.invalid/main/folderview.plus.plg">', '<PLUGINURL>https://fixture.invalid/dev/folderview.plus.plg</PLUGINURL>'], channel: 'main' },
            { manifests: ['<PLUGINURL>https://fixture.invalid/unknown/folderview.plus.plg</PLUGINURL>'], channel: 'main' },
            { manifests: [], channel: 'main' }
        ];
        for (const [index, fixture] of fixtures.entries()) {
            const files = fixture.manifests.map((body, order) => {
                const file = path.join(root, `${index}-${order}.plg`); fs.writeFileSync(file, body); return file;
            });
            const code = `function readInstalledManifestPathCandidates(): array { return [${files.map(quote).join(',')}]; }
                require ${quote(path.join(server, 'lib.update-channel.php'))};
                require ${quote(path.join(server, 'lib.diagnostics-support-bundle.php'))};
                echo json_encode([resolveInstalledPluginChannel(), diagnosticsResolveSupportBundleChannel(), resolveInstalledPluginUpdateManifestUrl()]);`;
            const result = JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8', timeout: 10000 }));
            assert.equal(result[0], fixture.channel); assert.equal(result[1], fixture.channel);
            assert.ok(result[2].endsWith(`/${fixture.channel}/folderview.plus.plg`));
        }
    } finally { assert.equal(path.dirname(fs.realpathSync(root)), base); fs.rmSync(root, { recursive: true, force: true }); }
});
