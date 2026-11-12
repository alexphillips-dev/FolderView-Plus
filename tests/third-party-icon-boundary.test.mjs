import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/third-party-icon-boundary.php', import.meta.url));
const run = linked => {
    const mode = linked ? 'linked' : 'directory';
    const command = process.platform === 'win32' ? 'wsl.exe' : 'php';
    const args = process.platform === 'win32'
        ? ['--exec', '/usr/bin/php', fixture.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/mnt/' + drive.toLowerCase()), mode]
        : [fixture, mode];
    return JSON.parse(execFileSync(command, args, { encoding: 'utf8' }));
};

for (const linked of [false, true]) {
    test(`third-party icon boundary protects files, listings and caches with ${linked ? 'installed root link' : 'directory root'}`, () => {
        const result = run(linked);
        for (const key of ['folderEscapeRejected', 'folderListEscapeRejected', 'fileSiblingRejected', 'fileOutsideRejected', 'oldCacheIgnored']) {
            assert.equal(result[key], true, key);
        }
        for (const key of ['insideFile', 'insideLink', 'insideAlias', 'siblingDirectory']) assert.equal(result[key], true, key);
        assert.equal(result.linkedBase, linked);
        assert.deepEqual(result.icons, ['inside-link.svg', 'inside.svg']);
        assert.equal(result.count, 2);
        assert.deepEqual(result.folders, ['Alias', 'Allowed', 'Allowed-sibling']);
        assert.deepEqual(result.indexPaths, ['Alias/inside-link.svg', 'Alias/inside.svg', 'Allowed/inside-link.svg', 'Allowed/inside.svg', 'Allowed-sibling/sibling.svg']);
    });
}
