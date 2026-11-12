import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const fixture = (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-tooling-path-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
};
const bash = (dir, args, env = {}) => execFileSync('bash', args, {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe']
});

for (const outputDirectory of ['archive', 'custom-output']) {
    test(`whole synthetic package passes ${outputDirectory} to install smoke`, (t) => {
        const dir = fixture(t);
        for (const file of ['pkg_build.sh', 'scripts/lib.sh', 'folderview.plus.plg', 'folderview.plus.xml']) {
            write(path.join(dir, file), fs.readFileSync(path.join(root, file), 'utf8'));
        }
        write(path.join(dir, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/fixture.txt'), 'Synthetic payload only\n');
        for (const name of ['icon_asset_pack_guard', 'ensure_plg_changes_entry', 'release_guard']) {
            write(path.join(dir, `scripts/${name}.sh`), '#!/usr/bin/env bash\nexit 0\n');
        }
        write(path.join(dir, 'scripts/generate_runtime_integrity_manifest.mjs'), '');
        write(path.join(dir, 'fake-bin/node'), '#!/usr/bin/env bash\nexit 0\n');
        fs.chmodSync(path.join(dir, 'fake-bin/node'), 0o755);
        write(path.join(dir, 'scripts/install_smoke.sh'), `#!/usr/bin/env bash
set -euo pipefail
source scripts/lib.sh
archive="$(fvplus::archive_file "$PWD" "$(fvplus::read_plg_version folderview.plus.plg)")"
test -f "$archive"
printf '%s' "$archive" > smoke-archive.txt
`);
        bash(dir, ['pkg_build.sh', '--branch', 'dev', '--output-dir', outputDirectory, '--no-prune-archives', '--install-smoke'], {
            PATH: `${path.join(dir, 'fake-bin')}${path.delimiter}${process.env.PATH || ''}`,
            FVPLUS_HISTORICAL_REBUILD: '1', FVPLUS_VERSION_OVERRIDE: '2020.01.01.01', FVPLUS_ARCHIVE_DIR: ''
        });
        assert.equal(fs.readFileSync(path.join(dir, 'smoke-archive.txt'), 'utf8'), path.join(dir, outputDirectory, 'folderview.plus-2020.01.01.01.txz'));
    });
}

test('shared and install-smoke path classification follows executable runtime instead of mount location', (t) => {
    const dir = fixture(t);
    write(path.join(dir, 'lib.sh'), fs.readFileSync(path.join(root, 'scripts/lib.sh'), 'utf8'));
    const smoke = fs.readFileSync(path.join(root, 'scripts/install_smoke.sh'), 'utf8');
    const predicate = smoke.match(/^command_uses_windows_path_translation\(\) \{[\s\S]*?^\}/m)?.[0];
    assert.ok(predicate, 'exercise the actual smoke runtime predicate');
    write(path.join(dir, 'probe.sh'), `#!/usr/bin/env bash
set -euo pipefail
source ./lib.sh
${predicate}
wslpath() { printf 'WINDOWS:%s\\n' "$2"; }
for command_path in /usr/bin/node /mnt/c/tools/node /mnt/c/tools/php /mnt/c/tools/node.exe /tmp/fvplus-bash-shims/node; do
  printf '%s|' "$(fvplus::path_for_command "$command_path" /tmp/fixture.js)"
  if command_uses_windows_path_translation "$command_path"; then printf 'windows\\n'; else printf 'native\\n'; fi
done
`);
    assert.deepEqual(bash(dir, ['probe.sh']).trim().split('\n'), [
        '/tmp/fixture.js|native', '/tmp/fixture.js|native', '/tmp/fixture.js|native',
        'WINDOWS:/tmp/fixture.js|windows', 'WINDOWS:/tmp/fixture.js|windows'
    ]);
});
