import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const page = fs.readFileSync(path.join(pluginRoot, 'FolderViewPlus.page'), 'utf8');
const runtime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.import.js'), 'utf8');
const css = fs.readFileSync(path.join(pluginRoot, 'styles/folderviewplus.css'), 'utf8');

test('import dialog walks users through behavior, review, and confirmation', () => {
    assert.match(page, /Guided configuration import/);
    assert.match(page, /Choose behavior[\s\S]*Review changes[\s\S]*Confirm and apply/);
    assert.match(page, /Choose how existing folders are handled/);
    assert.match(page, /Review what will change/);
    assert.match(page, /Confirm the safety check/);
    assert.match(page, /Protected by an automatic backup/);
    assert.match(page, /id="import-plan-summary"/);
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
        'import-preset-select',
        'import-preset-save',
        'import-preset-default',
        'import-preset-delete',
        'import-dry-run-only',
        'import-preview-first-toggle',
        'import-preview-diff',
        'import-preview-selection',
        'import-review-ack',
        'import-preview-text'
    ]) {
        assert.match(page, new RegExp(`id="${id}"`));
    }
    assert.match(runtime, /reviewAckRow\.css\('display', requireAck \? 'flex' : 'none'\)/);
    assert.match(runtime, /applyButton\.prop\('disabled', selectedCount <= 0 \|\| \(requireAck && !isImportReviewAcked\(\)\)\)/);
});

test('import modal uses one bounded vertical scroller and responsive single-column layouts', () => {
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal\s*\{[\s\S]*?overflow:\s*hidden !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-content\s*\{[\s\S]*?overflow-y:\s*auto !important;[\s\S]*?overflow-x:\s*hidden !important;/);
    assert.match(css, /@media \(max-width: 820px\)\s*\{[\s\S]*?\.import-mode-choices,[\s\S]*?grid-template-columns:\s*1fr;/);
    assert.match(runtime, /const modalWidth = Math\.min\(960, Math\.max\(320, Math\.floor\(window\.innerWidth \* 0\.94\)\)\);/);
    assert.match(runtime, /maxHeight: modalMaxHeight/);
});

test('import dialog actions use scoped theme-token styling without browser focus outlines', () => {
    assert.match(runtime, /addClass\('fv-import-apply-button'\)/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane button\s*\{[\s\S]*?box-shadow:\s*none !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane button:hover:not\(:disabled\),[\s\S]*?outline:\s*none !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane \.fv-import-apply-button/);
});
