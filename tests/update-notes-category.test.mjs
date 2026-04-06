import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const updateNotesPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/update_notes.php');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');

test('update-notes backend provides current-version-only categorized summary', () => {
    assert.match(libPhp, /function readInstalledManifestPathCandidates\s*\(/);
    assert.match(libPhp, /function readChangesSummaryForVersion\s*\(/);
    assert.match(libPhp, /function readChangesSummaryForVersion\(string \$version, int \$maxLines = 14, bool \$allowFallback = true\): array/);
    assert.match(libPhp, /function extractPreviousChangesEntry\s*\(/);
    assert.match(libPhp, /function buildUniqueCurrentChangesLines\s*\(/);
    assert.match(libPhp, /function filterBoilerplateChangesLines\s*\(/);
    assert.match(libPhp, /function isChangesBoilerplateLine\s*\(/);
    assert.match(libPhp, /filterBoilerplateChangesLines\(\$displayLines\)/);
    assert.match(libPhp, /buildUniqueCurrentChangesLines\(\$displayLines,\s*\(array\)\(\$previousEntry\['lines'\]/);
    assert.match(libPhp, /readChangesSummaryForVersion\(readInstalledVersion\(\), \$maxLines, false\)/);
    assert.match(libPhp, /'maintenance'\s*=>\s*\[[^\]]*'release'[^\]]*'metadata'[^\]]*'packaging'[^\]]*'sync'/);
    assert.match(libPhp, /function classifyChangesCategory\s*\(/);
    assert.match(libPhp, /function readCurrentVersionChangeSummary\s*\(/);
    assert.match(updateNotesPhp, /'category'\s*=>\s*\(string\)\(\$summary\['category'\]/);
    assert.match(updateNotesPhp, /'categoryLabel'\s*=>\s*\(string\)\(\$summary\['categoryLabel'\]/);
    assert.match(updateNotesPhp, /'headline'\s*=>\s*\(string\)\(\$summary\['headline'\]/);
    assert.match(updateNotesPhp, /'usedFallback'\s*=>/);
    assert.match(updateNotesPhp, /'sourceVersion'\s*=>/);
});

test('update-notes UI renders category and headline before changelog list', () => {
    assert.match(settingsJs, /const UPDATE_NOTES_CATEGORY_META = \{/);
    assert.match(settingsJs, /const normalizeUpdateNotesCategoryId =/);
    assert.match(settingsJs, /fv-update-notes-summary/);
    assert.match(settingsJs, /fv-update-notes-category/);
    assert.match(settingsJs, /fv-update-notes-headline/);
    assert.match(settingsCss, /\.fv-update-notes-summary\s*\{/);
    assert.match(settingsCss, /\.fv-update-notes-category\s*\{/);
    assert.match(settingsCss, /\.fv-update-notes-headline\s*\{/);
});
