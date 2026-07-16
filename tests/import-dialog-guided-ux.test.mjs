import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const page = fs.readFileSync(path.join(pluginRoot, 'FolderViewPlus.page'), 'utf8');
const runtime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.import.js'), 'utf8');
const css = fs.readFileSync(path.join(pluginRoot, 'styles/folderviewplus.css'), 'utf8');

test('import dialog keeps the default view focused on one decision and one summary', () => {
    assert.match(page, /Import <span id="import-preview-kind">folder<\/span> configuration/);
    assert.match(page, /How should existing folders be handled\?/);
    assert.match(page, /class="import-change-summary"/);
    assert.match(page, /Automatic backup included/);
    assert.doesNotMatch(page, /import-preview-journey/);
    assert.doesNotMatch(page, /import-plan-summary/);
    assert.doesNotMatch(page, /import-source-card/);
});

test('plain-language behavior cards remain synchronized with the native import mode', () => {
    for (const mode of ['merge', 'skip', 'replace']) {
        assert.match(page, new RegExp(`data-import-mode-option="${mode}"`));
    }
    assert.match(page, /data-import-mode-option="merge"[\s\S]*Merge safely/);
    assert.match(page, /data-import-mode-option="skip"[\s\S]*Add new only/);
    assert.match(page, /data-import-mode-option="replace"[\s\S]*Replace exactly/);
    assert.match(runtime, /const syncModeChoiceUi = \(\) => \{/);
    assert.match(runtime, /button\.toggleClass\('is-selected', selected\)\.attr\('aria-pressed', selected \? 'true' : 'false'\)/);
    assert.match(runtime, /modeSelect\.val\(requestedMode\);\s*renderPreview\(\);/);
});

test('advanced import controls and destructive review safeguards remain available', () => {
    for (const id of [
        'import-dry-run-only',
        'import-preview-first-toggle',
        'import-preview-diff',
        'import-preview-selection',
        'import-review-ack',
        'import-preview-text'
    ]) {
        assert.match(page, new RegExp(`id="${id}"`));
    }
    assert.doesNotMatch(page, /id="import-preset-(?:select|save|default|delete)"/);
    assert.match(runtime, /reviewAckRow\.css\('display', requireAck \? 'flex' : 'none'\)/);
    assert.match(runtime, /applyButton\.prop\('disabled', selectedCount <= 0 \|\| \(requireAck && !isImportReviewAcked\(\)\)\)/);
});

test('secondary information is hidden behind clear progressive-disclosure sections', () => {
    assert.match(page, /class="import-disclosure import-review-details"/);
    assert.match(page, /Review planned changes/);
    assert.match(page, /class="import-disclosure import-secondary-options"/);
    assert.match(page, /<strong>Safety options<\/strong>/);
    assert.match(page, /<small>Preview and confirmation<\/small>/);
    assert.match(page, /class="import-disclosure import-source-details"/);
    assert.match(page, /<strong>File details<\/strong>/);
    assert.doesNotMatch(page, /class="import-disclosure[^>]*" open/);
});

test('import modal is compact, bounded, and responsive', () => {
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal\s*\{[\s\S]*?width:\s*min\(760px, calc\(100vw - 1rem\)\) !important;[\s\S]*?overflow:\s*hidden !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-content\s*\{[\s\S]*?overflow-y:\s*auto !important;[\s\S]*?overflow-x:\s*hidden !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.import-disclosure,\s*\.ui-dialog\.fv-import-preview-modal \.import-disclosure\[open\]\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?max-width:\s*100% !important;/);
    assert.match(css, /#import-preview-dialog \.import-review-details #import-preview-diff table\s*\{[\s\S]*?table-layout:\s*fixed !important;/);
    assert.match(css, /\.import-mode-choices\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
    assert.match(css, /@media \(max-width: 620px\)/);
    assert.match(runtime, /const modalWidth = Math\.min\(760, Math\.max\(320, Math\.floor\(window\.innerWidth \* 0\.94\)\)\);/);
    assert.match(runtime, /maxHeight: modalMaxHeight/);
});

test('change summary is concise and only surfaces warnings when action is needed', () => {
    assert.match(runtime, /class="import-summary-total"/);
    assert.match(runtime, /class="import-summary-breakdown"/);
    assert.match(runtime, /statusMessage = 'Preview only is enabled\. No changes will be saved\.'/);
    assert.match(runtime, /statusMessage = `\$\{selectedDeletes\} folder/);
    assert.match(runtime, /\.toggle\(statusMessage !== ''\)/);
    assert.doesNotMatch(runtime, /What happens when you continue/);
    assert.doesNotMatch(runtime, /import-impact-card/);
});

test('import dialog actions use scoped theme-token styling without browser focus outlines', () => {
    assert.match(runtime, /addClass\('fv-import-apply-button'\)/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane button\s*\{[\s\S]*?border:\s*1px solid var\(--fvplus-settings-button-outline\) !important;[\s\S]*?background:\s*var\(--fvplus-settings-button-bg-top\) !important;[\s\S]*?box-shadow:\s*var\(--fvplus-settings-button-shadow\) !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane button:hover:not\(:disabled\),[\s\S]*?outline:\s*none !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane \.fv-import-apply-button\s*\{[\s\S]*?background:\s*var\(--fvplus-settings-button-bg-top\) !important;/);
});
