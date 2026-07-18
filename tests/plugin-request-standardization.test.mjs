import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const scriptsRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts'
);
const scriptFiles = fs.readdirSync(scriptsRoot)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({
        name,
        source: fs.readFileSync(path.join(scriptsRoot, name), 'utf8')
    }));

test('plugin-owned browser requests use FolderViewPlusRequest exclusively', () => {
    const forbidden = /(?:\$|jq|window\.\$)\.(?:get|post|ajax)\s*\(\s*['"`]\/plugins\/folderview\.plus|(?:window\.)?fetch\s*\(\s*['"`]\/plugins\/folderview\.plus/g;
    const violations = [];
    for (const file of scriptFiles) {
        for (const match of file.source.matchAll(forbidden)) {
            violations.push(`${file.name}:${file.source.slice(0, match.index).split('\n').length}`);
        }
    }
    assert.deepEqual(violations, []);
});

test('variable plugin endpoints for snapshots and icon management use the shared client', () => {
    const read = (name) => fs.readFileSync(path.join(scriptsRoot, name), 'utf8');
    const iconApi = read('folder.editor.icon-api.js');
    const iconPicker = read('folder.editor.icons.js');
    const snapshot = read('folderviewplus.runtime-snapshot.js');
    assert.doesNotMatch(iconApi, /jq\.(?:get|post|ajax)\s*\(/);
    assert.match(iconApi, /requestClient\.uploadJson\(uploadApiPath/);
    assert.match(iconApi, /requestClient\.postJson\(uploadApiPath/);
    assert.match(iconPicker, /requestClient\.getJson\(thirdPartyIconApiPath/);
    assert.match(iconPicker, /requestClient\.getJson\(builtInIconManifestPath/);
    assert.match(snapshot, /requestClient\.buildUrl\(ENDPOINT, query\)/);
});

test('the shared client owns mutation safety, keepalive, tracing, and diagnostics', () => {
    const request = scriptFiles.find((file) => file.name === 'folderviewplus.request.js')?.source || '';
    assert.match(request, /DEFAULT_GET_RETRIES = 1/);
    assert.match(request, /DEFAULT_MUTATION_RETRIES = 0/);
    assert.match(request, /const uploadJson = async/);
    assert.match(request, /const sendKeepalive =/);
    assert.match(request, /const getDiagnostics =/);
    assert.match(request, /sanitizeDiagnosticUrl/);
    assert.match(request, /endpoint\.startsWith\('\/plugins\/folderview\.plus\/'\)/);
    assert.doesNotMatch(request, /ajaxSetup\s*\(/);

    const retryViolations = scriptFiles
        .filter((file) => /(?:postJson|postText|postJsonWithFallback)\([\s\S]{0,500}?retries:\s*[1-9]/.test(file.source))
        .map((file) => file.name);
    assert.deepEqual(retryViolations, []);
});
