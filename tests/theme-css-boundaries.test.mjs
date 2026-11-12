import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
function run(input) {
    return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/theme-css-boundaries.php'), server, Buffer.from(JSON.stringify(input)).toString('base64')], { encoding: 'utf8' }));
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
    const imported = run({ source: 'https://github.com/owner/repo/blob/main/themes/docker.css', paths: [] });
    assert.deepEqual(imported.files.map(file => file.path), ['themes/docker.css']);
});
