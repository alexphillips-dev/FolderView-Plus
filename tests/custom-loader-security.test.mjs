import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const stylesCustomPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/custom.php');
const scriptsCustomPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/custom.php');

test('custom style loader resolves and validates paths against base override dir', () => {
    assert.match(stylesCustomPhp, /\$baseDir = realpath\(\$stylesDir\);/);
    assert.match(stylesCustomPhp, /\$resolved = realpath\(\$style\['path'\]\);/);
    assert.match(stylesCustomPhp, /strpos\(\$resolved, \$baseDir \. '\/'\) !== 0/);
    assert.match(stylesCustomPhp, /autov\(\$resolved\)/);
});

test('custom script loader resolves and validates paths against base override dir', () => {
    assert.match(scriptsCustomPhp, /\$baseDir = realpath\(\$scriptsDir\);/);
    assert.match(scriptsCustomPhp, /\$resolved = realpath\(\$script\['path'\]\);/);
    assert.match(scriptsCustomPhp, /strpos\(\$resolved, \$baseDir \. '\/'\) !== 0/);
    assert.match(scriptsCustomPhp, /autov\(\$resolved\)/);
});

test('Docker native compatibility mode keeps legacy custom assets inert', () => {
    assert.match(stylesCustomPhp, /\$fvplusDockerLegacyConditionalAssets/);
    assert.match(stylesCustomPhp, /media=\\"not all\\" data-fvplus-docker-legacy-style=\\"true\\"/);
    assert.match(scriptsCustomPhp, /\$fvplusDockerLegacyConditionalAssets/);
    assert.match(scriptsCustomPhp, /FolderViewPlusDockerLoadCustomScripts/);
    assert.match(scriptsCustomPhp, /fvplusDockerCustomScriptsPromise/);
    assert.match(scriptsCustomPhp, /JSON_HEX_TAG \| JSON_HEX_AMP \| JSON_HEX_APOS \| JSON_HEX_QUOT/);
    assert.match(scriptsCustomPhp, /document\.createElement\("script"\)/);
    assert.doesNotMatch(scriptsCustomPhp, /document\.write/);
});
