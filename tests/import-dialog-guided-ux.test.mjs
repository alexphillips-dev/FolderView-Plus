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
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal\s*\{[\s\S]*?width:\s*min\(566px, calc\(100vw - 1rem\)\) !important;[\s\S]*?min-width:\s*min\(566px, calc\(100vw - 1rem\)\) !important;[\s\S]*?max-width:\s*min\(566px, calc\(100vw - 1rem\)\) !important;[\s\S]*?overflow:\s*hidden !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-content\s*\{[\s\S]*?overflow-y:\s*auto !important;[\s\S]*?overflow-x:\s*hidden !important;/);
    assert.match(css, /--fv-import-content-width:\s*520px;/);
    assert.match(css, /#import-preview-dialog > \*\s*\{[\s\S]*?max-width:\s*var\(--fv-import-content-width\) !important;[\s\S]*?justify-self:\s*center !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane \.ui-dialog-buttonset\s*\{[\s\S]*?max-width:\s*520px !important;[\s\S]*?margin:\s*0 auto !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.import-disclosure,\s*\.ui-dialog\.fv-import-preview-modal \.import-disclosure\[open\]\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?max-width:\s*100% !important;/);
    assert.match(css, /#import-preview-dialog \.import-review-details #import-preview-diff table\s*\{[\s\S]*?table-layout:\s*fixed !important;/);
    assert.match(css, /\.import-mode-choices\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
    assert.match(css, /@media \(max-width: 620px\)/);
    assert.match(css, /#import-preview-dialog\s*\{[\s\S]*?row-gap:\s*0\.55rem !important;[\s\S]*?column-gap:\s*0 !important;/);
    assert.match(runtime, /const shellWidth = Math\.min\(566, Math\.max\(320, Math\.floor\(window\.innerWidth - 16\)\)\);/);
    assert.match(runtime, /const contentWidth = Math\.min\(520, Math\.max\(280, shellWidth - 46\)\);/);
    assert.match(runtime, /const modalWidth = getImportDialogWidths\(\)\.shellWidth;/);
    assert.match(runtime, /maxHeight: modalMaxHeight/);
    assert.match(runtime, /const applyImportDialogLayout = \(\) => \{/);
    assert.match(runtime, /const widget = dialog\.dialog\('widget'\);/);
    assert.match(runtime, /style\.setProperty\('width', `\$\{shellWidth\}px`, 'important'\)/);
    assert.match(runtime, /style\.setProperty\('max-width', `\$\{shellWidth\}px`, 'important'\)/);
    assert.match(runtime, /style\.setProperty\('min-width', `\$\{shellWidth\}px`, 'important'\)/);
    assert.match(runtime, /style\.setProperty\('inline-size', `\$\{shellWidth\}px`, 'important'\)/);
    assert.match(runtime, /dialog\[0\]\.style\.setProperty\('row-gap', '0\.55rem', 'important'\)/);
    assert.match(runtime, /dialog\.children\(\)\.each\(\(_, element\) => \{/);
    assert.match(runtime, /element\.style\.setProperty\('width', `\$\{contentWidth\}px`, 'important'\)/);
    assert.match(runtime, /\.import-disclosures > \.import-disclosure, \.import-disclosure-body, \.import-mode-choice, #import-preview-diff, #import-preview-selection/);
    assert.match(runtime, /resize\.fvimportdialog'[\s\S]*queueImportDialogLayout\(\)/);
    assert.match(runtime, /new window\.ResizeObserver\([\s\S]*actualWidth !== shellWidth[\s\S]*queueImportDialogLayout\(\)/);
    assert.match(css, /#import-preview-dialog \*:not\(i\),[\s\S]*?font-size:\s*1\.2rem !important;/);
    assert.match(css, /#import-preview-dialog \.import-summary-total strong\s*\{[\s\S]*?font-size:\s*1\.55rem !important;/);
    assert.match(css, /#import-preview-dialog \.import-mode-choice-badge,[\s\S]*?#import-preview-dialog \.import-summary-breakdown > span,[\s\S]*?#import-preview-dialog \.import-disclosure > summary small,[\s\S]*?font-size:\s*1\.2rem !important;/);
    assert.match(runtime, /const enforceImportTextMinimum = \(dialogShell\) => \{/);
    assert.match(runtime, /const minimumFontSize = rootFontSize \* 1\.2;/);
    assert.match(runtime, /renderedFontSize \+ 0\.01 < minimumFontSize/);
    assert.match(runtime, /element\.style\.setProperty\('font-size', '1\.2rem', 'important'\)/);
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
    assert.match(runtime, /addClass\('fv-import-dialog-button'\)/);
    assert.match(runtime, /applyImportDialogButtonSkin/);
    assert.match(runtime, /setProperty\('border', '1px solid color-mix\(in srgb, var\(--fvplus-settings-text-primary\) 28%, transparent\)', 'important'\)/);
    assert.match(runtime, /ui-dialog-titlebar-close'[\s\S]*setProperty\('display', 'none', 'important'\)/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane button\s*\{[\s\S]*?border:\s*1px solid var\(--fvplus-settings-button-outline\) !important;[\s\S]*?background:\s*var\(--fvplus-settings-button-bg-top\) !important;[\s\S]*?box-shadow:\s*var\(--fvplus-settings-button-shadow\) !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane button:hover:not\(:disabled\),[\s\S]*?outline:\s*none !important;/);
    assert.match(css, /\.ui-dialog\.fv-import-preview-modal \.ui-dialog-buttonpane \.fv-import-apply-button\s*\{[\s\S]*?background:\s*var\(--fvplus-settings-button-bg-top\) !important;/);
});
