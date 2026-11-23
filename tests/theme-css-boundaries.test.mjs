import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
function run(input) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-theme-github-'));
    try {
        for (const dir of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, dir));
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/theme-css-boundaries.php'), server, Buffer.from(JSON.stringify(input)).toString('base64')], {
            encoding: 'utf8',
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(root, 'host') }
        }));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}
for (const css of [
    String.raw`body { background: u\72l("https://synthetic.invalid/test"); }`,
    String.raw`body { background: \75\72\6c("https://synthetic.invalid/test"); }`,
    String.raw`body { background: url("\68ttps://synthetic.invalid/test"); }`,
    String.raw`body { background: url("\000068 ttps://synthetic.invalid/test"); }`,
    String.raw`@\69mport "https://synthetic.invalid/test";`,
    String.raw`body { background: url("\2f\2f synthetic.invalid/test"); }`,
    String.raw`body { background: url("data:text/\68tml,test"); }`,
    String.raw`body { width: e\78pression(alert(1)); }`,
    String.raw`body { behavior: \75rl(test.htc); }`,
    'body { background: url("ht\\\ntps://synthetic.invalid/test"); }',
    String.raw`body { background: \url("https://synthetic.invalid/test"); }`
]) test(`theme scanner rejects escaped unsafe CSS: ${JSON.stringify(css)}`, () => {
    assert.ok(run({ css }).severe.length > 0);
});
for (const css of [
    '.fixture { color: red; }',
    String.raw`.\31 23 { background: url("/plugins/folderview.plus/images/local.png"); }`,
    'body { background: url("data:image/png;base64,AAAA"); }',
    'body { filter: url("#local-filter"); }',
    String.raw`.fixture::before { content: "\2764"; }`
]) test(`theme scanner preserves ordinary CSS: ${JSON.stringify(css)}`, () => {
    assert.deepEqual(run({ css }), { warnings: [], severe: [] });
});
for (const suffix of ['themes', 'themes/']) test(`GitHub theme directory ${suffix} excludes siblings and different-case paths`, () => {
    const imported = run({ source: `owner/repo/tree/main/${suffix}`, paths: ['themes/docker.css', 'themes/nested/vm.css', 'themes-extra/docker.css', 'Themes/dashboard.css', 'themes.css'] });
    assert.deepEqual(imported.files.map(file => file.path), ['themes/docker.css', 'themes/nested/vm.css']);
});
test('GitHub repository root and direct-file imports retain their scope', () => {
    assert.equal(run({ source: 'owner/repo', paths: ['themes/docker.css', 'other/vm.css'] }).files.length, 2);
    const imported = run({ source: 'https://github.com/owner/repo/blob/main/themes/docker.css', paths: ['themes/docker.css', 'other/vm.css'] });
    assert.deepEqual(imported.files.map(file => file.path), ['themes/docker.css']);
});

test('qualified GitHub branch and tag links preserve the exact ref and reviewed CSS', () => {
    for (const [url, ref] of [
        ['https://raw.githubusercontent.com/owner/repo/refs/heads/main/themes/docker.css', 'refs/heads/main'],
        ['https://github.com/owner/repo/raw/refs/tags/v1/themes/docker.css', 'refs/tags/v1'],
        ['https://raw.githubusercontent.com/owner/repo/refs/heads/feature/rc/themes/docker.css', 'refs/heads/feature/rc'],
        ['https://raw.githubusercontent.com/owner/repo/feature/rc/themes/docker.css', 'refs/heads/feature/rc']
    ]) {
        const theme = run({ run: 'review', source: url, paths: ['themes/docker.css', 'other/vm.css'] });
        assert.equal(theme.source.branch, ref);
        assert.equal(theme.source.commitSha, 'a'.repeat(40));
        assert.deepEqual(theme.files.map(file => file.path), ['themes/docker.css']);
        assert.equal(theme.files[0].content, '.fixture { color: red; }');
    }
});

test('GitHub theme discovery is read-only and closed over a verified immutable CSS bundle', () => {
    assert.deepEqual(run({ run: 'workflow' }), {
        directories: ['', 'classic', 'compact'],
        readOnly: true,
        pinnedImport: true,
        scopedImport: true,
        unrelatedUpdateCount: 0,
        changedUpdateCount: 1,
        isolatedUpdateCheck: true,
        unavailableCheckPreserved: true,
        missing: true,
        mismatch: true,
        bulk: true,
        truncated: true,
        concurrentPreserved: true,
        bulkCompleted: true,
        rawRequestsPinned: true
    });
});
