import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');

const parseSectionHeadings = () => {
    const tags = settingsPage.match(/<h2\b[^>]*>/g) || [];
    return tags
        .filter((tag) => tag.includes('data-fv-section='))
        .map((tag) => {
            const key = (tag.match(/data-fv-section="([^"]+)"/) || [])[1] || '';
            return {
                key,
                advanced: /data-fv-advanced="1"/.test(tag),
                hasGroup: /data-fv-advanced-group="[^"]+"/.test(tag)
            };
        })
        .filter((heading) => heading.key !== '');
};

test('advanced section metadata remains complete for mobile-aware section toggles', () => {
    const headings = parseSectionHeadings();
    assert.ok(headings.length > 0, 'Expected at least one settings section heading');
    const advanced = headings.filter((heading) => heading.advanced);
    assert.ok(advanced.length > 0, 'Expected at least one advanced settings section heading');

    for (const heading of advanced) {
        assert.equal(
            heading.hasGroup,
            true,
            `Advanced section "${heading.key}" must include data-fv-advanced-group`
        );
    }
});

test('settings runtime keeps generic mobile/advanced heading tap handling', () => {
    assert.match(settingsJs, /querySelectorAll\('h2\[data-fv-section\]'\)/);
    assert.match(settingsJs, /const toggleAdvancedSectionByKey = \(sectionKey\) =>/);
    assert.match(settingsJs, /click\.fvsectionheader/);
    assert.match(settingsJs, /h2\[data-fv-section\]\[data-fv-advanced="1"\]/);
    assert.match(settingsJs, /shouldUseMobileSectionToggle/);
});

test('settings stylesheet keeps required mobile advanced accordion rules', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /h2\[data-fv-section\]\[data-fv-advanced="1"\]/);
    assert.match(settingsCss, /\.fv-section-toggle::before/);
    assert.match(settingsCss, /\.fv-section-toggle\.is-collapsed::before/);
    assert.match(settingsCss, /\.fv-advanced-tabs/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\s*\{[\s\S]*width:\s*100dvw/);
    assert.match(settingsCss, /\.fv-setup-step-list\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(settingsCss, /\.fv-settings-right\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto\s*auto/);
});

test('settings action bar reserves space above Unraid bottom status bar', () => {
    assert.match(settingsCss, /--fv-unraid-bottom-bar-offset:\s*36px/);
    assert.match(settingsCss, /bottom:\s*calc\(var\(--fv-unraid-bottom-bar-offset\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
    assert.match(settingsCss, /padding-bottom:\s*calc\(64px\s*\+\s*var\(--fv-unraid-bottom-bar-offset\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
});

test('mobile action bar stays compact and horizontally scrollable', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /#fv-settings-action-bar\s*\{[\s\S]*max-width:\s*calc\(100%\s*-\s*1rem\)/);
    assert.match(settingsCss, /\.fv-action-status\s*\{[\s\S]*display:\s*none/);
    assert.match(settingsCss, /\.fv-action-more\s*\{[\s\S]*display:\s*inline-flex/);
    assert.match(settingsCss, /\.fv-save-dock\[data-more-open="1"\]\s*\.fv-action-buttons-secondary\s*\{[\s\S]*display:\s*flex/);
    assert.match(settingsCss, /\.fv-action-buttons\s*\{[\s\S]*flex-wrap:\s*nowrap/);
    assert.match(settingsCss, /\.fv-action-buttons\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(settingsCss, /\.fv-action-buttons > button\s*\{[\s\S]*flex:\s*0 0 auto/);
});
