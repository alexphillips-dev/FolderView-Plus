import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');
const wizardDialogBlocks = Array.from(settingsCss.matchAll(/#fv-setup-assistant-dialog\s*\{[\s\S]*?\n\}/g)).map((match) => match[0]);
const wizardTokenBlock = wizardDialogBlocks.find((block) => /--fv-wizard-text-primary/.test(block)) || '';
const wizardCardBlock = (settingsCss.match(/\.fv-setup-card\s*\{[\s\S]*?\n\}/) || [''])[0];
const wizardCardToplineBlock = (settingsCss.match(/\.fv-setup-card::before\s*\{[\s\S]*?\n\}/) || [''])[0];

test('settings page wraps plugin UI in a theme-safe root container', () => {
    assert.match(settingsPage, /<div id="fv-settings-root" class="fv-theme-safe">/);
    assert.match(settingsPage, /<div id="fv-settings-topbar"><\/div>/);
    assert.match(settingsPage, /<div id="fv-settings-action-bar"><\/div>/);
});

test('theme compatibility: global focus and body selectors are scoped to plugin root', () => {
    assert.match(settingsCss, /#fv-settings-root\s*\{\s*[\s\S]*padding-bottom:\s*calc\(64px\s*\+\s*var\(--fv-unraid-bottom-bar-offset\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
    assert.match(settingsCss, /#fv-settings-root button:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root input:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root select:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root textarea:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root a:focus-visible/);
    assert.doesNotMatch(settingsCss, /\nbody\s*\{/);
    assert.doesNotMatch(settingsCss, /\nbutton:focus-visible,\s*\ninput:focus-visible,/);
});

test('theme compatibility: setup wizard enforces theme-safe dark contrast tokens', () => {
    assert.ok(wizardTokenBlock, 'Wizard token block should exist in settings CSS.');
    assert.match(wizardTokenBlock, /color-scheme:\s*dark/);
    assert.match(wizardTokenBlock, /--fv-wizard-text-primary:\s*#e7eef9/);
    assert.match(wizardTokenBlock, /--fv-wizard-text-muted:\s*#c5d4e8/);
    assert.match(wizardTokenBlock, /--fv-wizard-text-dim:\s*#a7bad1/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-blue-rgb:\s*77,\s*163,\s*255/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-amber-rgb:\s*255,\s*170,\s*94/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-green-rgb:\s*147,\s*225,\s*159/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-cyan-rgb:\s*92,\s*213,\s*255/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-info-rgb:\s*77,\s*163,\s*255/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-success-rgb:\s*147,\s*225,\s*159/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-warning-rgb:\s*255,\s*193,\s*94/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-danger-rgb:\s*255,\s*116,\s*116/);
    assert.doesNotMatch(wizardTokenBlock, /--fv-wizard-text-primary:\s*var\(--fvplus-settings-text-primary\)/);
    assert.doesNotMatch(wizardTokenBlock, /--fv-wizard-text-primary:\s*var\(--text/);
    assert.match(
        settingsCss,
        /#fv-setup-assistant-dialog\s+\.fv-setup-assistant-shell button,\s*\n#fv-setup-assistant-dialog\s+\.fv-setup-assistant-shell \.btn\s*\{[\s\S]*color:\s*var\(--fv-wizard-text-primary\)/
    );
    assert.match(settingsCss, /\.fv-setup-card::before\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="env"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="mode"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="bundle"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="preset"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="import-docker"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="import-vm"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="review"\]\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\[data-fv-wizard-contrast-tier="high"\]\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\[data-fv-wizard-contrast-tier="max"\]\s*\{/);
    assert.doesNotMatch(settingsCss, /\.fv-setup-step-grid > \.fv-setup-card:nth-child/);
    assert.ok(wizardCardBlock, 'Wizard card block should exist in settings CSS.');
    assert.ok(wizardCardToplineBlock, 'Wizard card top-line block should exist in settings CSS.');
    assert.doesNotMatch(wizardCardBlock, /rgba\(\d/);
    assert.doesNotMatch(wizardCardToplineBlock, /rgba\(\d/);
});

test('theme compatibility: semantic settings tokens use resolver-first fallback chain', () => {
    assert.match(settingsCss, /--fvplus-theme-text-primary:\s*var\(--text,\s*currentColor\)/);
    assert.match(settingsCss, /--fvplus-settings-text-primary:\s*var\(--fvplus-theme-text-primary,\s*var\(--fvplus-settings-safe-text-primary\)\)/);
    assert.match(settingsCss, /--fvplus-settings-text-muted:\s*var\(--fvplus-theme-text-muted,\s*var\(--fvplus-settings-safe-text-muted\)\)/);
    assert.match(settingsCss, /--fvplus-settings-border-subtle:\s*var\(--fvplus-theme-border-subtle,\s*var\(--fvplus-settings-safe-border-subtle\)\)/);
    assert.match(settingsCss, /--fvplus-settings-surface-muted:\s*var\(--fvplus-theme-surface-muted,\s*var\(--fvplus-settings-safe-surface-muted\)\)/);
    assert.match(settingsCss, /--fvplus-settings-accent:\s*var\(--fvplus-theme-accent,\s*var\(--fvplus-settings-safe-accent\)\)/);
});
