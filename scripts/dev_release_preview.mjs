import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseIdentity } from './lib/release-evidence.mjs';

export function prepareDevPreview(root = process.cwd()) {
    const identity = releaseIdentity(root);
    assert.equal(identity.channel, 'dev', 'Preview requires the published dev channel');
    const basename = `folderview.plus-${identity.version}.txz`;
    const archive = `archive/${basename}`;
    const checksum = archive + '.sha256';
    const checksumBytes = fs.readFileSync(path.join(root, checksum));
    assert.equal(checksumBytes.compare(execFileSync('git', ['show', `HEAD:${checksum}`], { cwd: root })), 0,
        'Preview checksum differs from the committed checksum');
    const fields = checksumBytes.toString().trim().split(/\s+/);
    assert.deepEqual(fields, [identity.archiveSha256, basename], 'Current dev package checksum does not match');
    const output = path.join(root, 'tmp/dev-release-preview');
    // Refuse stale files rather than upload unrelated archives on a repeated run.
    const expected = new Set([basename, basename + '.sha256', 'release_notes.md']);
    if (fs.existsSync(output)) assert.ok(fs.readdirSync(output).every(name => expected.has(name)), 'Preview directory contains another version');
    fs.mkdirSync(output, { recursive: true });
    fs.copyFileSync(path.join(root, archive), path.join(output, basename));
    fs.copyFileSync(path.join(root, checksum), path.join(output, basename + '.sha256'));
    execFileSync('bash', ['scripts/build_release_notes.sh', '--version', identity.version, '--output', path.join(output, 'release_notes.md')],
        { cwd: root, env: { ...process.env, FVPLUS_RELEASE_INSTALL_BRANCH: 'dev' }, stdio: 'pipe' });
    return { version: identity.version, archiveSha256: identity.archiveSha256, files: [...expected] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log(`Verified current dev preview: ${JSON.stringify(prepareDevPreview())}`);
}
