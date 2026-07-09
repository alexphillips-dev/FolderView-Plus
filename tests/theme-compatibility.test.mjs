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
const wizardRuntimePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');
const wizardRuntime = fs.readFileSync(wizardRuntimePath, 'utf8');
const wizardDialogBlocks = Array.from(settingsCss.matchAll(/#fv-setup-assistant-dialog\s*\{[\s\S]*?\n\}/g)).map((match) => match[0]);
const wizardTokenBlock = wizardDialogBlocks.find((block) => /--fv-wizard-text-primary/.test(block)) || '';
const wizardCardBlock = (settingsCss.match(/\.fv-setup-card\s*\{[\s\S]*?\n\}/) || [''])[0];
const wizardCardToplineBlock = (settingsCss.match(/\.fv-setup-card::before\s*\{[\s\S]*?\n\}/) || [''])[0];

test('settings page wraps plugin UI in a theme-safe root container', () => {
    assert.match(settingsPage, /<div id="fv-settings-root" class="fv-theme-safe">/);
    assert.match(settingsPage, /<div id="fv-settings-topbar"><\/div>/);
    assert.doesNotMatch(settingsPage, /fv-settings-action-bar/);
});

test('theme compatibility: global focus and body selectors are scoped to plugin root', () => {
    assert.match(settingsCss, /#fv-settings-root\s*\{\s*[\s\S]*padding-bottom:\s*calc\(1rem\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
    assert.match(settingsCss, /#fv-settings-root button:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root input:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root select:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root textarea:focus-visible/);
    assert.match(settingsCss, /#fv-settings-root a:focus-visible/);
    assert.doesNotMatch(settingsCss, /\nbody\s*\{/);
    assert.doesNotMatch(settingsCss, /\nbutton:focus-visible,\s*\ninput:focus-visible,/);
});

test('theme compatibility: setup wizard mirrors resolved theme class and light-safe token overrides', () => {
    assert.ok(wizardTokenBlock, 'Wizard token block should exist in settings CSS.');
    assert.match(wizardTokenBlock, /color:\s*var\(--fv-wizard-text-primary\)/);
    assert.match(wizardTokenBlock, /--fv-wizard-text-primary:\s*var\(--fvplus-settings-text-primary,\s*#e7eef9\)/);
    assert.match(wizardTokenBlock, /--fv-wizard-text-muted:\s*var\(--fvplus-settings-text-muted,\s*#c5d4e8\)/);
    assert.match(wizardTokenBlock, /--fv-wizard-text-dim:\s*var\(--fvplus-settings-text-dim,\s*#a7bad1\)/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-blue-rgb:\s*77,\s*163,\s*255/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-amber-rgb:\s*255,\s*170,\s*94/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-green-rgb:\s*147,\s*225,\s*159/);
    assert.match(wizardTokenBlock, /--fv-wizard-accent-cyan-rgb:\s*92,\s*213,\s*255/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-info-rgb:\s*77,\s*163,\s*255/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-success-rgb:\s*147,\s*225,\s*159/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-warning-rgb:\s*255,\s*193,\s*94/);
    assert.match(wizardTokenBlock, /--fv-wizard-color-danger-rgb:\s*255,\s*116,\s*116/);
    assert.match(wizardTokenBlock, /--fv-wizard-control-bg:\s*var\(--fvplus-ui-control,\s*var\(--fvplus-graphite-card-raised,\s*#242426\)\)/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-wizard-text-primary:\s*var\(--fvplus-settings-text-primary,\s*#324253\)/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-wizard-control-bg:\s*rgba\(250,\s*246,\s*240,\s*0\.96\)/);
    assert.match(
        settingsCss,
        /#fv-setup-assistant-dialog\s+\.fv-setup-assistant-shell button,\s*\n#fv-setup-assistant-dialog\s+\.fv-setup-assistant-shell \.btn\s*\{[\s\S]*color:\s*var\(--fv-wizard-text-primary\)[\s\S]*background:\s*var\(--fv-wizard-control-bg\)/
    );
    assert.match(settingsCss, /\.fv-setup-assistant-shell input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),[\s\S]*background:\s*var\(--fv-wizard-input-bg\)/);
    assert.match(settingsCss, /\.fv-setup-step-state\.is-pending\s*\{[\s\S]*color:\s*var\(--fv-wizard-pending-text\);[\s\S]*background:\s*var\(--fv-wizard-pill-bg\);/);
    assert.match(settingsCss, /\.fv-setup-card::before\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="env"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="mode"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="bundle"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="preset"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="import-docker"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="import-vm"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-card\[data-fv-card-tone="review"\]\s*\{/);
    assert.match(settingsCss, /\.fv-setup-welcome-screen\s*\{/);
    assert.match(settingsCss, /\.fv-setup-welcome-hero\s*\{/);
    assert.doesNotMatch(settingsCss, /#fv-setup-assistant-dialog\[data-fv-wizard-contrast-tier=/);
    assert.doesNotMatch(settingsCss, /\.fv-setup-contrast-field/);
    assert.doesNotMatch(settingsCss, /\.fv-setup-step-grid > \.fv-setup-card:nth-child/);
    assert.ok(wizardCardBlock, 'Wizard card block should exist in settings CSS.');
    assert.ok(wizardCardToplineBlock, 'Wizard card top-line block should exist in settings CSS.');
    assert.doesNotMatch(wizardCardBlock, /rgba\(\d/);
    assert.doesNotMatch(wizardCardToplineBlock, /rgba\(\d/);
    assert.match(wizardRuntime, /let setupAssistantThemeSurfaceBinding = null;/);
    assert.match(wizardRuntime, /const ensureSetupAssistantThemeSurfaceBinding = \(\) => \{/);
    assert.match(wizardRuntime, /reasonPrefix:\s*'wizard'/);
    assert.match(wizardRuntime, /applySetupAssistantThemeSurface\('render'\);/);
});

test('theme compatibility: semantic settings tokens use host primary token with settings fallback chain', () => {
    assert.match(settingsCss, /--fvplus-theme-text-primary:\s*var\(--text,\s*currentColor\)/);
    assert.match(settingsCss, /--fvplus-settings-text-primary:\s*var\(--fvplus-theme-text-primary,\s*var\(--fvplus-settings-safe-text-primary\)\)/);
    assert.match(settingsCss, /--fvplus-settings-text-muted:\s*var\(--fvplus-theme-text-muted,\s*var\(--fvplus-settings-safe-text-muted\)\)/);
    assert.match(settingsCss, /--fvplus-settings-border-subtle:\s*var\(--fvplus-theme-border-subtle,\s*var\(--fvplus-settings-safe-border-subtle\)\)/);
    assert.match(settingsCss, /--fvplus-settings-surface-muted:\s*var\(--fvplus-theme-surface-muted,\s*var\(--fvplus-settings-safe-surface-muted\)\)/);
    assert.match(settingsCss, /--fvplus-settings-accent:\s*var\(--fvplus-theme-accent,\s*var\(--fvplus-settings-safe-accent\)\)/);
});

test('theme compatibility: light settings surfaces keep readable tree meta and empty chips', () => {
    assert.match(settingsCss, /html\[data-fv-host-theme="white"\] #fv-settings-root,/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\][\s\S]*--fvplus-settings-breadcrumb-text:\s*rgba\(89,\s*103,\s*120,\s*0\.86\)/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\][\s\S]*--fvplus-settings-members-meta-text:\s*rgba\(95,\s*108,\s*123,\s*0\.82\)/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\][\s\S]*--fvplus-settings-nested-meta-text:\s*rgba\(105,\s*117,\s*133,\s*0\.86\)/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\][\s\S]*--fvplus-settings-chip-empty:\s*#667385/);
    assert.match(settingsCss, /\.name-cell-breadcrumb\s*\{[\s\S]*color:\s*var\(--fvplus-settings-breadcrumb-text\);/);
    assert.match(settingsCss, /\.name-cell-members-meta\s*\{[\s\S]*color:\s*var\(--fvplus-settings-members-meta-text\);/);
    assert.match(settingsCss, /\.name-cell-nested-meta\s*\{[\s\S]*color:\s*var\(--fvplus-settings-nested-meta-text\);/);
    assert.match(settingsCss, /\.folder-runtime-status\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-subtle\);[\s\S]*background:\s*var\(--fvplus-settings-surface-muted\);[\s\S]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.match(settingsCss, /\.folder-metric-chip\.is-empty\s*\{[\s\S]*color:\s*var\(--fvplus-settings-chip-empty\);[\s\S]*background:\s*var\(--fvplus-settings-chip-empty-bg\);/);
    assert.match(settingsCss, /\.folder-runtime-status\.is-empty\s*\{[\s\S]*color:\s*var\(--fvplus-settings-chip-empty\);[\s\S]*background:\s*var\(--fvplus-settings-chip-empty-bg\);/);
    assert.match(settingsCss, /\.status-trend\.is-neutral\s*\{[\s\S]*color:\s*var\(--fvplus-settings-chip-empty\);[\s\S]*border-color:\s*var\(--fvplus-settings-chip-empty-border\);[\s\S]*background:\s*var\(--fvplus-settings-chip-empty-bg\);/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.name-cell-breadcrumb\s*\{[^}]*color:\s*var\(--fvplus-settings-breadcrumb-text\) !important;[^}]*opacity:\s*1 !important;/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.name-cell-members-meta\s*\{[^}]*color:\s*var\(--fvplus-settings-members-meta-text\) !important;[^}]*opacity:\s*1 !important;/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.name-cell-nested-meta\s*\{[^}]*color:\s*var\(--fvplus-settings-nested-meta-text\) !important;[^}]*opacity:\s*1 !important;/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.folder-pin-state,[\s\S]*#fv-settings-root\[data-fv-theme-class="light"\] \.folder-runtime-status\s*\{[^}]*color:\s*var\(--fvplus-settings-chip-empty\) !important;[^}]*opacity:\s*1 !important;/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.status-breakdown-chip\.is-empty\s*\{[^}]*color:\s*var\(--fvplus-settings-chip-empty\) !important;[^}]*opacity:\s*1 !important;/);
});

test('theme compatibility: advanced automation, rules, recovery, and operations modules use shared light-safe tokens', () => {
    assert.match(settingsCss, /\.rules-panel\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-panel\);[\s\S]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.match(settingsCss, /\.bulk-step-pill\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-border-faint\);[\s\S]*background:\s*var\(--fvplus-settings-surface-muted\);[\s\S]*color:\s*var\(--fvplus-settings-text-muted\);/);
    assert.match(settingsCss, /\.bulk-summary-value\s*\{[\s\S]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.match(settingsCss, /\.bulk-help-text\s*\{[\s\S]*color:\s*var\(--fvplus-settings-text-muted\);/);
    assert.match(settingsCss, /\.bulk-result-name\s*\{[\s\S]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.match(settingsCss, /\.schedule-hint\s*\{[\s\S]*color:\s*var\(--fvplus-settings-text-muted\);[\s\S]*opacity:\s*1;/);
});

test('settings shared button system covers basic and advanced workspace actions', () => {
    assert.match(settingsCss, /\/\* Shared settings button system \*\/[\s\S]*\.fv-basic-control-btn,[\s\S]*\.fv-basic-add-btn,[\s\S]*\.fv-basic-sort,/);
    assert.match(settingsCss, /\/\* Shared settings button system \*\/[\s\S]*\.fv-theme-token-reset,/);
    assert.match(settingsCss, /\/\* Shared settings button system \*\/[\s\S]*\.fv-rule-builder-actions > button,[\s\S]*\.fv-rule-selection-actions > button,[\s\S]*\.fv-rule-card-actions > button,[\s\S]*\.fv-rule-test-actions > button,/);
    assert.match(settingsCss, /\/\* Shared settings button system \*\/[\s\S]*\[data-fv-rules-source-toggle\],[\s\S]*\[data-fv-operations-source-toggle\],/);
    assert.doesNotMatch(settingsCss, /\.fv-basic-add-btn\s*\{[^}]*linear-gradient/);
    assert.match(settingsCss, /\.fv-rules-source-btn\.is-active\s*\{[\s\S]*background:\s*var\(--fvplus-settings-button-accent-top\) !important;[\s\S]*box-shadow:\s*var\(--fvplus-settings-button-accent-shadow\) !important;/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\[data-fv-rules-source-toggle\]\.is-active,[\s\S]*\[data-fv-operations-source-toggle\]\.is-active,[\s\S]*\.folder-table table td\.actions-cell \.folder-overflow-btn[\s\S]*\)\s*,\s*\n#fv-settings-root \.fv-mode-toggle button\.is-active/);
});

test('settings dark mode buttons use visible white outline tokens', () => {
    assert.match(settingsCss, /--fvplus-settings-button-outline:\s*rgba\(255,\s*255,\s*255,\s*0\.28\);/);
    assert.match(settingsCss, /--fvplus-settings-button-outline-hover:\s*rgba\(255,\s*255,\s*255,\s*0\.42\);/);
    assert.match(settingsCss, /--fvplus-settings-button-outline-active:\s*rgba\(255,\s*255,\s*255,\s*0\.5\);/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fvplus-settings-button-outline:\s*rgba\(190,\s*107,\s*24,\s*0\.12\);/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fvplus-settings-button-outline:\s*rgba\(122,\s*102,\s*72,\s*0\.18\);/);
    assert.match(settingsCss, /\/\* Shared settings button system \*\/[\s\S]*border:\s*1px solid var\(--fvplus-settings-button-outline\) !important;/);
    assert.match(settingsCss, /#fv-settings-root \.fv-docker-start-order-toolbar > button,[\s\S]*border:\s*1px solid var\(--fvplus-settings-button-outline\) !important;/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.status-breakdown-btn,[\s\S]*\.updates-chip[\s\S]*\)\s*\{[\s\S]*border:\s*1px solid var\(--fvplus-settings-button-outline\) !important;/);
});

test('settings page exports host theme name and stamps theme attributes for resolver consumers', () => {
    assert.match(settingsPage, /window\.FolderViewPlusHostThemeName = <\?php echo json_encode\(\(string\)\(\$display\['theme'\] \?\? ''\), JSON_UNESCAPED_SLASHES \| JSON_UNESCAPED_UNICODE\); \?>;/);
    assert.match(settingsPage, /document\.documentElement\?\.setAttribute\('data-fvplus-host-theme', safeThemeName\);/);
    assert.match(settingsPage, /document\.documentElement\?\.setAttribute\('data-fv-host-theme', safeThemeName\);/);
    assert.match(settingsPage, /document\.body\?\.setAttribute\('data-fvplus-host-theme', safeThemeName\);/);
    assert.match(settingsPage, /document\.body\?\.setAttribute\('data-fv-host-theme', safeThemeName\);/);
});
