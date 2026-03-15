import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pagePath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const jsPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const importJsPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js');
const cssPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const libPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

const page = fs.readFileSync(pagePath, 'utf8');
const script = fs.readFileSync(jsPath, 'utf8');
const importScript = fs.readFileSync(importJsPath, 'utf8');
const runtimeScript = `${script}\n${importScript}`;
const css = fs.readFileSync(cssPath, 'utf8');
const libPhp = fs.readFileSync(libPath, 'utf8');

test('type prefs include server-side import presets', () => {
    assert.match(libPhp, /'importPresets'\s*=>\s*\[/);
    assert.match(libPhp, /function normalizeTypeImportPresets\(/);
    assert.match(libPhp, /\$normalized\['importPresets'\]\s*=\s*normalizeTypeImportPresets/);
});

test('backup snapshots include prefs payload for compare', () => {
    assert.match(libPhp, /'prefs'\s*=>\s*\$prefs/);
    assert.match(libPhp, /function readBackupSnapshot\(/);
    assert.match(libPhp, /'prefs'\s*=>\s*\$prefs/);
});

test('backup compare UI includes preference toggle and compare section', () => {
    assert.match(page, /id="docker-backup-compare-include-prefs"/);
    assert.match(page, /id="vm-backup-compare-include-prefs"/);
    assert.match(page, /id="backup-compare-prefs"/);
});

test('import presets persist through server prefs and not local storage', () => {
    assert.match(script, /const persistImportPresetStoreTypeToServer = async/);
    assert.match(script, /await postPrefs\(resolvedType, nextPrefs\)/);
    assert.doesNotMatch(script, /localStorage\.setItem\(IMPORT_PRESET_STORAGE_KEY/);
});

test('import selection and compare tables include pagination and live counters', () => {
    assert.match(script, /let importDiffPagingState = \{/);
    assert.match(script, /let backupCompareDiffPagingState = \{/);
    assert.match(runtimeScript, /renderOperationSelection\(updateSelectionSummary\)/);
    assert.match(runtimeScript, /Create: \$\{selectedCreates\}\/\$\{currentOperations\.creates\.length\}/);
    assert.match(runtimeScript, /class="fv-import-diff-prev"/);
    assert.match(runtimeScript, /class="fv-backup-diff-prev"/);
});

test('pagination and compare preference styles exist', () => {
    assert.match(css, /\.fv-table-pager\s*\{/);
    assert.match(css, /\.backup-compare-prefs\s*\{/);
    assert.match(css, /\.backup-compare-prefs-toggle\s*\{/);
});
