import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const updateNotesPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/update_notes.php');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const libPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'
);

const phpSingleQuote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const runReleaseSummaryHarness = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-update-notes-'));
    const configDir = path.join(tempDir, 'config');
    const sourceDir = path.join(tempDir, 'source');
    const documentRoot = path.join(tempDir, 'document-root');
    const harnessPath = path.join(tempDir, 'update-notes.php');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'version'), '2026.07.15.10\n', 'utf8');
    fs.writeFileSync(path.join(configDir, 'folderview.plus.plg'), `
<CHANGES>
###2026.07.15.10
### Version-specific update summaries
- Fix: Replaced canned update copy with the exact notes recorded for the installed version.
- Test: Added release-note parser coverage.

###2026.07.15.09
### Previous release
- UI/UX: Previous release detail that must not leak into the current summary.
</CHANGES>
`, 'utf8');
    fs.writeFileSync(harnessPath, `<?php
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require_once ${phpSingleQuote(libPath)};
echo json_encode(readCurrentVersionChangeSummary(18), JSON_UNESCAPED_SLASHES);
`, 'utf8');
    try {
        return JSON.parse(execFileSync('php', [harnessPath], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 120000,
            env: {
                ...process.env,
                FVPLUS_TEST_CONFIG_DIR: configDir,
                FVPLUS_TEST_SOURCE_DIR: sourceDir,
                FVPLUS_TEST_DOCUMENT_ROOT: documentRoot
            }
        }));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

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
    assert.match(libPhp, /function buildChangesHeadline\s*\(/);
    assert.match(libPhp, /function filterChangesDetailLines\s*\(/);
    assert.match(libPhp, /function readCurrentVersionChangeSummary\s*\(/);
    assert.match(updateNotesPhp, /'category'\s*=>\s*\(string\)\(\$summary\['category'\]/);
    assert.match(updateNotesPhp, /'categoryLabel'\s*=>\s*\(string\)\(\$summary\['categoryLabel'\]/);
    assert.match(updateNotesPhp, /'headline'\s*=>\s*\(string\)\(\$summary\['headline'\]/);
    assert.match(updateNotesPhp, /'usedFallback'\s*=>/);
    assert.match(updateNotesPhp, /'sourceVersion'\s*=>/);
});

test('update-notes parser keeps section headings and returns exact current-version copy', () => {
    const summary = runReleaseSummaryHarness();

    assert.equal(summary.version, '2026.07.15.10');
    assert.equal(summary.sourceVersion, '2026.07.15.10');
    assert.equal(summary.usedFallback, false);
    assert.equal(summary.headline, 'Version-specific update summaries');
    assert.deepEqual(summary.lines, [
        'Fix: Replaced canned update copy with the exact notes recorded for the installed version.',
        'Test: Added release-note parser coverage.'
    ]);
    assert.ok(summary.lines.every((line) => !line.includes('Previous release detail')));
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

test('update-notes headline has no canned generic release summary', () => {
    const combinedSource = `${libPhp}\n${updateNotesPhp}\n${settingsJs}`;
    assert.doesNotMatch(combinedSource, /This update includes (?:bug fixes|features|new features|security|performance|UI|maintenance)/i);
    assert.match(settingsJs, /const buildUpdateNotesHeadline =/);
    assert.match(settingsJs, /buildUpdateNotesHeadline\(normalizedLines, version\)/);
});
