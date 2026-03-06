import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const thirdPartyEndpointPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/third_party_icons.php'
);
const uploadEndpointPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/upload_custom_icon.php'
);
const pkgBuildPath = path.join(repoRoot, 'pkg_build.sh');

const thirdPartyPhp = fs.readFileSync(thirdPartyEndpointPath, 'utf8');
const uploadPhp = fs.readFileSync(uploadEndpointPath, 'utf8');
const pkgBuild = fs.readFileSync(pkgBuildPath, 'utf8');

const parsePhpStringArray = (source, constantName) => {
    const pattern = new RegExp(`${constantName}\\s*=\\s*\\[([^\\]]+)\\]`, 'm');
    const match = source.match(pattern);
    if (!match) {
        return [];
    }
    return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
};

test('third-party endpoint supports nested folder paths with sanitization', () => {
    assert.match(thirdPartyPhp, /function sanitizeThirdPartyFolderPath\s*\(/);
    assert.match(thirdPartyPhp, /count\(\$parts\)\s*>\s*6/);
    assert.match(thirdPartyPhp, /sanitizeThirdPartyFolderPath\(\$folder,\s*'Folder'\)/);
    assert.match(thirdPartyPhp, /'name'\s*=>\s*\"\$safeName\/\$safeSubName\"/);
});

test('upload endpoint enforces request guard and uploads into images\\/custom', () => {
    assert.match(uploadPhp, /requireMutationRequestGuard\(\)/);
    assert.match(uploadPhp, /return \"\$sourceDir\/images\/custom\"/);
    assert.match(uploadPhp, /const FVPLUS_CUSTOM_ICON_MAX_BYTES = 4194304;/);
    assert.match(uploadPhp, /move_uploaded_file\(/);
    assert.match(uploadPhp, /\/plugins\/folderview\.plus\/images\/custom\//);
});

test('upload endpoint hardens SVG uploads against active content', () => {
    assert.match(uploadPhp, /validateAndNormalizeSvgContent\s*\(/);
    assert.match(uploadPhp, /SVG contains blocked content/);
    assert.match(uploadPhp, /foreignObject/);
    assert.match(uploadPhp, /xlink:href/);
    assert.match(uploadPhp, /LIBXML_NONET/);
});

test('upload and third-party endpoints share the same icon extension allowlist', () => {
    const thirdPartyExt = parsePhpStringArray(thirdPartyPhp, 'FVPLUS_THIRD_PARTY_ICON_EXTENSIONS');
    const uploadExt = parsePhpStringArray(uploadPhp, 'FVPLUS_CUSTOM_ICON_EXTENSIONS');
    assert.deepEqual([...thirdPartyExt].sort(), [...uploadExt].sort());
    assert.ok(thirdPartyExt.includes('ico'));
    assert.ok(thirdPartyExt.includes('svg'));
});

test('pkg_build filters non-icon files in third-party and custom icon folders', () => {
    assert.match(pkgBuild, /should_package_file\(\)/);
    assert.match(pkgBuild, /images\/third-party-icons/);
    assert.match(pkgBuild, /images\/custom/);
    assert.match(pkgBuild, /icon_ext_regex/);
});
