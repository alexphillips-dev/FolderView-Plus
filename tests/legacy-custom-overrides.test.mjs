import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const stylesCustomPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/custom.php');
const scriptsCustomPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/custom.php');

test('legacy custom override directories remain supported for styles and scripts', () => {
    assert.match(
        libPhp,
        /const FVPLUS_LEGACY_CONFIG_DIRS = \[[\s\S]*'\/boot\/config\/plugins\/folder\.view3'[\s\S]*'\/boot\/config\/plugins\/folder\.view2'[\s\S]*'\/boot\/config\/plugins\/folder\.view'[\s\S]*\];/
    );
    assert.match(
        libPhp,
        /function getCustomOverrideDirs\(string \$kind\): array[\s\S]*\$currentDir = "\$configDir\/\$safeKind";[\s\S]*foreach \(getLegacyConfigDirCandidates\(\) as \$legacyDir\)[\s\S]*\$path = "\$legacyDir\/\$safeKind";/
    );
});

test('custom style/script loaders keep type-aware matching and disabled suffix support', () => {
    assert.match(stylesCustomPhp, /getCustomOverrideDirs\('styles'\)/);
    assert.match(stylesCustomPhp, /dirToArrayOfFiles\(pathToMultiDimArray\(\$stylesDir\),\s*"\/\\\.\.\*\{\$type\}\.\*\\\.css\$\/",\s*"\/\.\*\\\.disabled\$\/"\)/);

    assert.match(scriptsCustomPhp, /getCustomOverrideDirs\('scripts'\)/);
    assert.match(scriptsCustomPhp, /dirToArrayOfFiles\(pathToMultiDimArray\(\$scriptsDir\),\s*"\/\\\.\.\*\{\$type\}\.\*\\\.js\$\/",\s*"\/\.\*\\\.disabled\$\/"\)/);
});
