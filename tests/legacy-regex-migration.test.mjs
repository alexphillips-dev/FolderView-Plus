import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const rulesPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.rules.js');
const libPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const endpointPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/migrate_legacy_regex.php');
const chromePath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js');

const rulesSource = fs.readFileSync(rulesPath, 'utf8');
const libSource = `${fs.readFileSync(libPath, 'utf8')}\n${fs.readFileSync(path.join(path.dirname(libPath), 'lib.folder-rules.php'), 'utf8')}`;
const endpointSource = fs.readFileSync(endpointPath, 'utf8');
const chromeSource = fs.readFileSync(chromePath, 'utf8');
const sandboxWindow = {};
vm.runInNewContext(rulesSource, { window: sandboxWindow });
const migrationPreview = sandboxWindow.FolderViewPlusFolderEditorRules.buildLegacyRegexMigrationPreview;

test('legacy regex migration preview reports matches, advanced conflicts, and legacy overlaps', () => {
    const preview = migrationPreview({
        pattern: '^media-',
        folderId: 'media',
        items: [
            { Name: 'media-sonarr', Type: 'docker' },
            { Name: 'other-app', Type: 'docker' }
        ],
        folders: {
            media: { name: 'Media', regex: '^media-' },
            overlap: { name: 'Overlap', regex: 'sonarr$' }
        },
        rules: [{ id: 'existing', folderId: 'other', effect: 'include', kind: 'name_regex', pattern: '^media-' }],
        utils: {
            getAutoRuleDecision: ({ name }) => name === 'media-sonarr'
                ? { assignedRule: { folderId: 'other' }, blockedBy: null }
                : { assignedRule: null, blockedBy: null }
        }
    });

    assert.equal(preview.valid, true);
    assert.deepEqual(Array.from(preview.matches), ['media-sonarr']);
    assert.deepEqual(Array.from(preview.advancedConflicts), ['media-sonarr']);
    assert.deepEqual(Array.from(preview.overlappingLegacyFolders), ['Overlap']);
});

test('legacy regex migration preview rejects an invalid expression', () => {
    const preview = migrationPreview({ pattern: '[', folderId: 'media', items: [], folders: {}, rules: [], utils: null });
    assert.equal(preview.valid, false);
    assert.match(preview.error, /regular expression|unterminated|invalid/i);
});

test('legacy regex migration preserves meaningful leading and trailing pattern whitespace', () => {
    const preview = migrationPreview({
        pattern: ' ^media$',
        folderId: 'media',
        items: [{ Name: 'media', Type: 'docker' }],
        folders: {},
        rules: [],
        utils: null
    });
    assert.deepEqual(Array.from(preview.matches), []);
});

test('legacy compatibility UI is advanced-first and hides empty legacy data', () => {
    assert.match(chromeSource, /rules:\s*\[[\s\S]*key:\s*'auto-rules'[\s\S]*key:\s*'regex'/);
    assert.match(rulesSource, /panel\.hidden = pattern === '';/);
    assert.match(rulesSource, /hasUnsavedChanges\(\)/);
    assert.match(rulesSource, /Convert to Auto-Rule/);
    assert.match(rulesSource, /Edit invalid pattern/);
    assert.match(rulesSource, /onLegacyRegexConverted\(response\)/);
});

test('legacy conversion endpoint uses guarded transactional migration with rollback and backup', () => {
    assert.match(endpointSource, /requireMutationRequestGuard\(\);/);
    assert.match(endpointSource, /migrateLegacyRegexToAutoRule\(\$type, \$folderId, \$expectedPattern\)/);
    assert.match(libSource, /function migrateLegacyRegexToAutoRule\(/);
    assert.match(libSource, /hash_equals\(\$legacyPattern, \$expectedPattern\)/);
    assert.match(libSource, /\$legacyPattern = \(string\)\(\$folders\[\$folderId\]\['regex'\] \?\? ''\);/);
    assert.match(libSource, /normalizeBool\(\$rule\['enabled'\] \?\? true, true\) === true/);
    assert.match(libSource, /createBackupSnapshot\(\$type, 'before-legacy-regex-conversion'\)/);
    assert.match(libSource, /writeTypePrefs\(\$type, \$nextPrefs\);[\s\S]*writeRawFolderMap\(\$type, \$nextFolders\);/);
    assert.match(libSource, /writeTypePrefs\(\$type, \$prefs\);[\s\S]*writeRawFolderMap\(\$type, \$folders\);/);
    assert.match(libSource, /\$nextFolders\[\$folderId\]\['regex'\] = '';/);
    assert.match(libSource, /\/\/ Converted legacy matching is a fallback\. Existing advanced policy keeps priority\.[\s\S]*\$rules\[\] = \$existingRule;/);
});

test('PHP auto-rule engine returns on the first matching include or exclude', () => {
    const decisionBody = libSource.match(/function autoRuleDecision\([\s\S]*?\n    \}/)?.[0] || '';
    assert.doesNotMatch(decisionBody, /firstIncludeRule/);
    assert.match(decisionBody, /if \(\$effect === 'exclude'\)[\s\S]*'blockedBy' => \$rule[\s\S]*return \[[\s\S]*'assignedRule' => \$rule/);
});
