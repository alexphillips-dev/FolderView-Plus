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
