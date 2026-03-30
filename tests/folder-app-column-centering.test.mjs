import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');
const dockerModulesJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.modules.js');

test('docker folder application column centers a left-aligned content block between mover and menu', () => {
    assert.match(dockerCss, /\.folder-name-sub\s*\{[\s\S]*display:\s*grid/);
    assert.match(dockerCss, /\.folder-name-sub\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
    assert.match(dockerCss, /\.folder-name-sub > \.folder-outer\s*\{[\s\S]*justify-self:\s*center/);
    assert.match(dockerCss, /\.folder-name-sub > \.folder-dropdown\s*\{[\s\S]*justify-self:\s*end/);
    assert.match(dockerCss, /\.folder-outer\s*\{[\s\S]*justify-content:\s*flex-start/);
    assert.match(dockerCss, /\.folder-inner\s*\{[\s\S]*align-items:\s*flex-start/);
    assert.match(dockerCss, /\.folder-inner\s*\{[\s\S]*text-align:\s*left/);
    assert.match(dockerModulesJs, /sub\.style\.setProperty\('display', 'grid', 'important'\);/);
    assert.match(dockerModulesJs, /sub\.style\.setProperty\('grid-template-columns', 'minmax\(0, 1fr\) auto minmax\(0, 1fr\)', 'important'\);/);
    assert.match(dockerModulesJs, /sub\.style\.setProperty\('right', 'var\(--fvplus-docker-folder-right-gutter, 28px\)', 'important'\);/);
});

test('vm folder application column centers a left-aligned content block between mover and menu', () => {
    assert.match(vmCss, /\.folder-name-sub\s*\{[\s\S]*display:\s*grid/);
    assert.match(vmCss, /\.folder-name-sub\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
    assert.match(vmCss, /\.folder-name-sub > \.folder-outer\s*\{[\s\S]*justify-self:\s*center/);
    assert.match(vmCss, /\.folder-name-sub > \.folder-dropdown\s*\{[\s\S]*justify-self:\s*end/);
    assert.match(vmCss, /\.folder-outer\s*\{[\s\S]*justify-content:\s*flex-start/);
    assert.match(vmCss, /\.folder-inner\s*\{[\s\S]*align-items:\s*flex-start/);
    assert.match(vmCss, /\.folder-inner\s*\{[\s\S]*text-align:\s*left/);
});
