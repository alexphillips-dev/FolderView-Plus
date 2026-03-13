import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');

test('docker sortable refresh is guarded without an empty catch block', () => {
    assert.match(dockerJs, /const \$dockerList = \$\('#docker_list'\)/);
    assert.match(dockerJs, /const sortableInstance = \$dockerList\.data\('ui-sortable'\) \|\| \$dockerList\.data\('sortable'\)/);
    assert.match(dockerJs, /if \(sortableInstance\) \{\s*\$dockerList\.sortable\('refresh'\);/);
    assert.doesNotMatch(
        dockerJs,
        /try\s*\{\s*\$\('#docker_list'\)\.sortable\('refresh'\);\s*\}\s*catch\s*\(e\)\s*\{\s*\}/
    );
});

test('custom action handlers support legacy and corrected container key names', () => {
    for (const source of [dockerJs, vmJs, dashboardJs]) {
        assert.match(source, /Array\.isArray\(act\.conatiners\)/);
        assert.match(source, /Array\.isArray\(act\.containers\)/);
    }
});

test('custom action handlers do not silently no-op on unsupported action modes', () => {
    for (const source of [dockerJs, vmJs, dashboardJs]) {
        assert.doesNotMatch(source, /let ctAction = \(e\) => \{\s*\}/);
        assert.match(source, /let ctAction = null;/);
        assert.match(source, /if \(typeof ctAction === 'function'\)/);
        assert.match(source, /console\.warn\(`folderview\.plus: Unsupported/);
    }
});
