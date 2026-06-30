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
const settingsScriptPaths = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-metadata.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-table.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.row-details.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard-smart-detect.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.updates.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
].map((relativePath) => path.join(repoRoot, relativePath));
const folderCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css'
);
const folderPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page'
);
const folderJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const folderRulesJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.rules.js'
);
const folderParentPickerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.parent-picker.js'
);
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const dockerPreviewActionsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.preview-actions.js'
);
const dockerRuntimeHierarchyJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js'
);
const dockerRuntimeActionsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);
const dashboardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');
const settingsRuntime = settingsScriptPaths.map((scriptPath) => fs.readFileSync(scriptPath, 'utf8')).join('\n');
const settingsJs = settingsRuntime;
const folderPage = fs.readFileSync(folderPagePath, 'utf8');
const folderCss = fs.readFileSync(folderCssPath, 'utf8');
const folderJs = fs.readFileSync(folderJsPath, 'utf8');
const folderRulesJs = fs.readFileSync(folderRulesJsPath, 'utf8');
const folderParentPickerJs = fs.readFileSync(folderParentPickerJsPath, 'utf8');
const folderStateJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.state.js'),
    'utf8'
);
const folderMembersJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.members.js'),
    'utf8'
);
const folderChromeJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js'),
    'utf8'
);
const folderPreviewJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview.js'),
    'utf8'
);
const folderPreviewRuntimeJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview-runtime.js'),
    'utf8'
);
const folderTypeDockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-docker.js'),
    'utf8'
);
const folderTypeVmJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-vm.js'),
    'utf8'
);
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const dockerPreviewActionsJs = fs.readFileSync(dockerPreviewActionsJsPath, 'utf8');
const dockerRuntimeHierarchyJs = fs.readFileSync(dockerRuntimeHierarchyJsPath, 'utf8');
const dockerRuntimeActionsJs = fs.readFileSync(dockerRuntimeActionsJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');
const dashboardJs = fs.readFileSync(dashboardJsPath, 'utf8');

test('settings page includes smoke-test-critical containers and scripts', () => {
    assert.match(settingsPage, /id="import-preview-dialog"/);
    assert.match(settingsPage, /id="backup-compare-dialog"/);
    assert.match(settingsPage, /id="docker-backup-compare-left"/);
    assert.match(settingsPage, /id="vm-backup-compare-left"/);
    assert.match(settingsPage, /id="import-apply-progress-overlay"/);
    assert.match(settingsPage, /id="import-apply-progress-dialog"/);
    assert.match(settingsPage, /id="fv-setup-assistant-overlay"/);
    assert.match(settingsPage, /id="fv-setup-assistant-dialog"/);
    assert.match(settingsPage, /id="fv-setup-assistant-content"/);
    assert.doesNotMatch(settingsPage, /id="fv-settings-action-bar"/);
    assert.match(settingsPage, /id="fv-runtime-resolved-panel"/);
    assert.match(settingsPage, /folderviewplus\.request\.js/);
    assert.match(settingsPage, /folderviewplus\.theme-resolver\.js/);
    assert.match(settingsPage, /folderviewplus\.chrome\.js/);
    assert.match(settingsPage, /folderviewplus\.dirty\.js/);
    assert.match(settingsPage, /folderviewplus\.settings-table\.js/);
    assert.match(settingsPage, /folderviewplus\.smart-detect-config\.js/);
    assert.match(settingsPage, /folderviewplus\.activity-diagnostics\.js/);
    assert.match(settingsPage, /folderviewplus\.row-details\.js/);
    assert.match(settingsPage, /folderviewplus\.wizard-smart-detect\.js/);
    assert.match(settingsPage, /folderviewplus\.wizard\.js/);
    assert.match(settingsPage, /folderviewplus\.import\.js/);
    assert.match(settingsPage, /folderviewplus\.updates\.js/);
    assert.match(settingsPage, /Last changed/);
    assert.match(settingsPage, /Pinned/);
    assert.match(settingsPage, /Updates/);
    assert.match(settingsPage, /Health/);
    assert.match(settingsPage, /Autostart/);
    assert.match(settingsPage, /Resources/);
    assert.match(settingsPage, /id="docker-col-status"/);
    assert.match(settingsPage, /id="docker-col-members"/);
    assert.match(settingsPage, /id="docker-col-rules"/);
    assert.match(settingsPage, /id="docker-col-last-changed"/);
    assert.match(settingsPage, /id="docker-col-pinned"/);
    assert.match(settingsPage, /id="docker-col-signals"/);
    assert.match(settingsPage, /id="docker-table-name-width"/);
    assert.match(settingsPage, /id="docker-table-actions-width"/);
    assert.match(settingsPage, /id="docker-table-reset-visibility"/);
    assert.match(settingsPage, /id="docker-table-reset-widths"/);
    assert.match(settingsPage, /id="docker-health-critical-threshold"/);
    assert.match(settingsPage, /id="docker-health-profile"/);
    assert.match(settingsPage, /id="docker-health-updates-mode"/);
    assert.match(settingsPage, /id="docker-health-all-stopped-mode"/);
    assert.match(settingsPage, /id="vm-col-status"/);
    assert.match(settingsPage, /id="vm-col-members"/);
    assert.match(settingsPage, /id="vm-col-rules"/);
    assert.match(settingsPage, /id="vm-col-last-changed"/);
    assert.match(settingsPage, /id="vm-col-pinned"/);
    assert.match(settingsPage, /id="vm-col-autostart"/);
    assert.match(settingsPage, /id="vm-col-resources"/);
    assert.match(settingsPage, /id="vm-table-name-width"/);
    assert.match(settingsPage, /id="vm-table-actions-width"/);
    assert.match(settingsPage, /id="vm-table-reset-visibility"/);
    assert.match(settingsPage, /id="vm-table-reset-widths"/);
    assert.match(settingsPage, /id="vm-health-critical-threshold"/);
    assert.match(settingsPage, /id="vm-health-profile"/);
    assert.match(settingsPage, /id="vm-health-updates-mode"/);
    assert.match(settingsPage, /id="vm-health-all-stopped-mode"/);
    assert.match(settingsPage, /id="vm-resource-warn-vcpu"/);
    assert.match(settingsPage, /id="vm-resource-critical-vcpu"/);
    assert.match(settingsPage, /id="vm-resource-warn-gib"/);
    assert.match(settingsPage, /id="vm-resource-critical-gib"/);
    assert.match(settingsPage, /id="fv-first-run-panel"/);
    assert.doesNotMatch(settingsPage, /id="docker-folder-editor-modern"/);
    assert.doesNotMatch(settingsPage, /id="vm-folder-editor-modern"/);
    assert.doesNotMatch(settingsPage, /Use new folder settings page/);
});

test('folder page ships the modern editor runtime only', () => {
    assert.match(folderPage, /\$folderEditorPageBuildVersion = readInstalledVersion\(\);/);
    assert.match(folderPage, /\$folderEditorPageMode = 'modern';/);
    assert.match(folderPage, /\$folderEditorPageModeSource = 'modern-only';/);
    assert.match(folderPage, /folderviewplus\.theme-resolver\.js/);
    assert.match(folderPage, /folder\.editor\.icon-api\.js/);
    assert.match(folderPage, /folder\.editor\.shared\.js/);
    assert.match(folderPage, /folder\.editor\.schema\.js/);
    assert.match(folderPage, /folder\.editor\.preview\.js/);
    assert.match(folderPage, /folder\.editor\.hierarchy\.js/);
    assert.match(folderPage, /folder\.editor\.chrome\.js/);
    assert.match(folderPage, /class="folder-btn-apply-settings"/);
    assert.match(folderPage, /applyFolderSettingsToFolders\(\); return false;/);
    assert.match(folderPage, /folder\.js/);
    assert.doesNotMatch(folderPage, /folder\.legacy\.js/);
    assert.match(folderChromeJs, /FolderViewPlusRefreshModernEditorChromeLayout/);
    assert.match(folderChromeJs, /FolderViewPlusRevealModernEditorStage/);
    assert.match(folderChromeJs, /const getModernStage = \(form\) =>/);
    assert.match(folderChromeJs, /id="fvSectionState-\$\{sectionKey\}"/);
    assert.match(folderChromeJs, /data-section-action="revert"/);
    assert.match(folderChromeJs, /data-section-action="defaults"/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorResolvedMode =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorModeSource =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorPageBuildVersion =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorRuntimeLoaded = false;/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorRuntimeBootStage = 'page-bootstrap';/);
    assert.match(folderPage, /FolderViewPlusMarkFolderEditorRuntimeScriptEvent/);
    assert.match(folderPage, /bootFolderEditorRuntimePage/);
    assert.match(folderPage, /data-fv-folder-editor-boot-managed="1"/);
    assert.match(folderPage, /icon-picker\.runtime\.js/);
    assert.match(folderPage, /runtime-script-still-pending/);
    assert.match(folderPage, /const runtimeMode = 'modern';/);
    assert.match(folderPage, /const scriptQueue = \[[\s\S]*icon-picker\.runtime\.js[\s\S]*folder\.editor\.hierarchy\.js[\s\S]*folder\.editor\.chrome\.js[\s\S]*folder\.editor\.type-docker\.js[\s\S]*folder\.editor\.type-vm\.js[\s\S]*folder\.js/);
    assert.match(folderPage, /boot=\$\{encodeURIComponent\(bootNonce\)\}/);
    assert.match(folderJs, /\(function fvplusFolderEditorRuntimeScope\(window, \$\) \{/);
    assert.match(folderJs, /modernFolderEditorEnabled/);
    assert.match(folderJs, /const folderEditorShared = window\.FolderViewPlusFolderEditorShared \|\| null;/);
    assert.match(folderJs, /const folderEditorSchema = window\.FolderViewPlusFolderEditorSchema \|\| null;/);
    assert.match(folderJs, /const folderEditorPreview = window\.FolderViewPlusFolderEditorPreview \|\| null;/);
    assert.match(folderJs, /let folderEditorSharedApi = null;/);
    assert.match(folderJs, /const getFolderEditorSharedApi = \(\) =>/);
    assert.match(folderJs, /folderEditorSharedApi = folderEditorShared\.createApi\(/);
    assert.match(folderJs, /folderEditorBootstrapMissingModules\.push\('folder\.editor\.icon-api\.js'\)/);
    assert.match(folderJs, /const normalizeParentFolderId = \(value\) => String\(value \|\| ''\)\.trim\(\);/);
    assert.match(folderJs, /const folderEditorResetHelpers = typeof folderEditorShared\?\.createResetHelpers === 'function'/);
    assert.match(folderJs, /const modernEditorSchema = typeof folderEditorSchema\?\.createModernSchema === 'function'/);
    assert.match(folderJs, /let folderEditorPreviewRuntimeApi = null;/);
    assert.match(folderJs, /const getFolderEditorPreviewRuntimeApi = \(\) =>/);
    assert.match(folderJs, /folderEditorPreviewRuntimeApi = folderEditorPreviewRuntimeModule\.createApi\(/);
    assert.match(folderJs, /const applyFolderSettingsToFolders = async \(\) => \{/);
    assert.match(folderJs, /window\.applyFolderSettingsToFolders = applyFolderSettingsToFolders;/);
    assert.match(folderJs, /if \(modernFolderEditorEnabled\) \{[\s\S]*FolderViewPlusRefreshModernEditorChromeLayout/);
    assert.match(folderJs, /\.off\('click\.fvEditorSectionSync'\)/);
    assert.match(folderJs, /\.on\('click\.fvEditorSectionSync', function onModernSectionClick\(\) \{\s*setActiveEditorSection\(\$\(this\)\.data\('target'\)\);/);
    assert.match(folderJs, /function updateForm\(\) \{/);
    assert.match(folderJs, /const startFolderEditorRuntime = async \(\) => \{/);
    assert.match(folderJs, /void startFolderEditorRuntime\(\)\.catch\(\(error\) => \{/);
    assert.match(folderJs, /FolderViewPlusReportFolderEditorBootstrap/);
    assert.match(folderJs, /summary:\s*'Folder editor runtime script loaded\.'/);
    assert.match(folderPreviewJs, /#fvLivePreviewCanvas/);
    assert.match(settingsJs, /const settingsTableModule = window\.FolderViewPlusSettingsTable \|\| null;/);
    assert.match(settingsJs, /bootstrapMissingModules\.push\('folderviewplus\.settings-table\.js'\)/);
    assert.match(folderCss, /\.canvas form\.folder-editor-form,\s*[\s\S]*#fvEditorChrome\s*\{[\s\S]*--fv-editor-text-primary:\s*var\(--fvplus-editor-text-primary/);
    assert.match(folderCss, /\.fv-modern-editor-stage\s*\{/);
    assert.match(folderCss, /\.fv-modern-editor-stage\.is-pending > #fvEditorChrome,/);
    assert.match(folderCss, /\.fv-modern-editor-stage\.is-pending > #fvEditorNavDock,/);
    assert.doesNotMatch(folderCss, /data-fv-page-mode="legacy"/);
    assert.match(folderCss, /\.fv-editor-nav-dock\s*\{[\s\S]*border:\s*1px solid var\(--fv-editor-border\);[\s\S]*border-radius:\s*14px;/);
    assert.match(folderCss, /\.fv-section-nav > button\s*\{[\s\S]*color:\s*var\(--fv-editor-text-primary\);/);
    assert.doesNotMatch(folderChromeJs, /data-mode="basic"/);
    assert.doesNotMatch(folderChromeJs, /data-mode="advanced"/);
    assert.match(folderCss, /--fv-editor-control-border:\s*var\(--fvplus-editor-control-border,\s*var\(--fv-editor-border\)\)/);
    assert.match(folderCss, /--fv-editor-block-border:\s*var\(--fvplus-editor-block-border,\s*var\(--fv-editor-border\)\)/);
    assert.match(folderCss, /--fv-editor-hero-icon-border:\s*var\(--fvplus-editor-hero-icon-border,\s*var\(--fv-editor-border\)\)/);
    assert.match(folderCss, /--fv-editor-title-accent:\s*var\(--fvplus-editor-title-accent,\s*#ff9a3c\)/);
    assert.match(folderCss, /--fv-editor-title-accent:\s*var\(--fvplus-editor-title-accent,\s*#be6b18\)/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-editor-control-border:\s*var\(--fv-editor-border\);/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-editor-block-border:\s*var\(--fv-editor-border\);/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-editor-hero-icon-border:\s*var\(--fv-editor-border\);/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-editor-button-accent-fg:\s*#fff8f1;/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-editor-button-accent-top:\s*#cf7a22;/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fv-editor-button-accent-bottom:\s*#b76518;/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\] \.folder-btn-submit\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fv-editor-button-bg-top\),\s*var\(--fv-editor-button-bg-bottom\)\) !important;[\s\S]*color:\s*var\(--fv-editor-button-fg\) !important;/);
    assert.match(folderCss, /#fvEditorActionBar \.folder-btn-apply-settings,/);
    assert.match(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\] \.folder-btn-submit:hover,[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fv-editor-button-hover-top\),\s*var\(--fv-editor-button-hover-bottom\)\) !important;/);
    assert.doesNotMatch(folderChromeJs, /class="fv-editor-mode"/);
    assert.match(folderCss, /#fvEditorChrome \.fv-editor-kicker,\s*[\s\S]*color:\s*var\(--fv-editor-title-accent\) !important;/);
    assert.match(folderCss, /\.fv-section-heading-copy > h3\s*\{[\s\S]*color:\s*var\(--fv-editor-title-accent\);/);
    assert.match(folderCss, /\.canvas form\.folder-editor-form \.fv-section-heading-copy > h3\s*\{[\s\S]*color:\s*var\(--fv-editor-title-accent\) !important;/);
    assert.match(folderCss, /\.fv-modern-field-row > dl > dt\s*\{[\s\S]*color:\s*var\(--fv-editor-title-accent\);/);
    assert.match(folderCss, /\.fv-section-heading-copy > p\s*\{[\s\S]*color:\s*var\(--fv-editor-muted\);/);
    assert.match(folderCss, /\.fv-modern-field-row input\[type="text"\],[\s\S]*background:\s*var\(--fv-editor-input-bg\)/);
    assert.match(folderCss, /\.fv-editor-hero-icon\s*\{[\s\S]*border:\s*1px solid var\(--fv-editor-hero-icon-border\);/);
    assert.match(folderCss, /\.fv-inherited-badge\s*\{[\s\S]*padding:\s*0\.02em 0\.32em;[\s\S]*font-size:\s*0\.68rem;[\s\S]*text-transform:\s*uppercase;/);
    assert.doesNotMatch(folderCss, /#fvEditorActionBar\[data-fv-theme-class="light"\] \.folder-btn-submit:disabled\s*\{/);
});

test('settings no longer renders a mobile action bar and keeps import progress viewport guards', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.doesNotMatch(settingsCss, /#fv-settings-action-bar/);
    assert.doesNotMatch(settingsCss, /\.fv-settings-action-wrap\s*\{/);
    assert.doesNotMatch(settingsCss, /\.fv-action-buttons\s*\{/);
    assert.match(settingsCss, /#import-apply-progress-dialog\s*\{[\s\S]*width:\s*min\(560px,\s*calc\(100vw\s*-\s*2rem\)\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)\s*\{[\s\S]*#import-apply-progress-dialog/);
});

test('sort toggle note has anti-clipping layout guards', () => {
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*display:\s*grid/);
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*padding:\s*0 0\.7rem 0 0/);
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*overflow:\s*visible/);
    assert.match(settingsCss, /\.toolbar-sort-toggle-main\s*\{[\s\S]*flex:\s*1 1 auto/);
    assert.match(settingsCss, /\.toolbar-sort-toggle-note\s*\{[\s\S]*justify-self:\s*end/);
    assert.match(settingsCss, /\.toolbar-sort-toggle-note\s*\{[\s\S]*padding-right:\s*0\.2rem/);
});

test('settings and setup assistant expose extended folder sort mode options', () => {
    assert.match(settingsPage, /<option value="created_newest">Created newest first<\/option>/);
    assert.match(settingsPage, /<option value="created_oldest">Created oldest first<\/option>/);
    assert.match(settingsPage, /<option value="updated_newest">Last updated newest first<\/option>/);
    assert.match(settingsPage, /<option value="name_desc">Name \(Z-A\)<\/option>/);
    assert.match(settingsJs, /value="created_newest" \$\{behavior\.sortMode === 'created_newest' \? 'selected' : ''\}>Created newest first/);
    assert.match(settingsJs, /value="created_oldest" \$\{behavior\.sortMode === 'created_oldest' \? 'selected' : ''\}>Created oldest first/);
    assert.match(settingsJs, /value="updated_newest" \$\{behavior\.sortMode === 'updated_newest' \? 'selected' : ''\}>Last updated newest first/);
    assert.match(settingsJs, /value="name_desc" \$\{behavior\.sortMode === 'name_desc' \? 'selected' : ''\}>Name \(Z-A\)/);
});

test('folder tables avoid unnecessary horizontal scrollbar in basic view', () => {
    assert.match(settingsCss, /\.folder-table\s*\{[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.folder-table > \*\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*box-sizing:\s*border-box/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden/);
    assert.match(settingsCss, /\.folder-table \.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.folder-table \.table-wrap::-webkit-scrollbar\s*\{[\s\S]*display:\s*none/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*table-layout:\s*auto/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*max-width:\s*100%/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.folder-table table th,\s*[\s\S]*\.folder-table table td\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*border-collapse:\s*collapse/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*border-spacing:\s*0/);
});

test('mobile folder table hides Order column and routes controls to overflow menu', () => {
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th:nth-child\(3\)/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th:nth-child\(4\)/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th\.col-status/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*td\.status-cell/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(3\)/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(4\)/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th\.col-status/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*td\.status-cell/);
    assert.match(settingsCss, /\.folder-overflow-btn\s*\{[\s\S]*display:\s*none/);
    assert.match(settingsCss, /\.actions-cell[\s\S]*\.folder-action-btn:not\(\.folder-overflow-btn\)[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /\.actions-cell[\s\S]*\.folder-overflow-btn[\s\S]*display:\s*inline-flex !important/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th:nth-child\(1\)[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th:nth-child\(2\)[\s\S]*width:\s*78%/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th:nth-child\(10\)[\s\S]*width:\s*22%/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*th:nth-child\(2\)[\s\S]*padding-left:\s*0\.45rem/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*\.folder-overflow-btn[\s\S]*width:\s*24px/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*\.row-order-actions\s*\{[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(1\)[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(2\)[\s\S]*width:\s*78%/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(10\)[\s\S]*width:\s*22%/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*\.folder-overflow-btn[\s\S]*width:\s*24px/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*\.row-order-actions[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root \.folder-tree-toggle[\s\S]*appearance:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root \.folder-tree-toggle[\s\S]*box-shadow:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root \.folder-tree-toggle::before,\s*[\s\S]*#fv-settings-root \.folder-tree-toggle::after[\s\S]*content:\s*none !important/);
    assert.match(settingsCss, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*left:\s*calc\(env\(safe-area-inset-left\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*right:\s*calc\(env\(safe-area-inset-right\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*top:\s*calc\(env\(safe-area-inset-top\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*bottom:\s*calc\(env\(safe-area-inset-bottom\) \+ 0\.5rem\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*overflow-y:\s*auto !important/);
    assert.match(settingsCss, /@media \(max-width: 760px\)[\s\S]*\.sweet-alert\.fv-row-quick-actions-modal[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsJs, /class="folder-action-btn folder-overflow-btn"/);
    assert.match(settingsJs, /data-fv-overflow-type="\$\{escapeHtml\(type\)\}"/);
    assert.match(settingsJs, /data-fv-overflow-id="\$\{escapeHtml\(id\)\}"/);
    assert.match(settingsJs, /const overflowSelector = `\$\{tbodySelector\} \.folder-overflow-btn`;/);
    assert.match(settingsJs, /on\(`click\$\{namespace\}`, overflowSelector/);
    assert.match(settingsJs, /on\(`touchend\$\{namespace\}`, overflowSelector/);
    assert.match(settingsJs, /\$\('\.sweet-alert'\)\.removeClass\('fv-row-quick-actions-modal'\);/);
    assert.match(settingsJs, /const modal = \$\('\.sweet-alert:visible'\);/);
    assert.match(settingsJs, /modal\.addClass\('fv-row-quick-actions-modal'\);/);
    assert.match(settingsJs, /const hideOrderControls = compactMobileLayout && !mobileTreeReorderMode;/);
    assert.match(settingsJs, /const orderCellHtml = hideOrderControls[\s\S]*\?\s*''/);
    assert.match(settingsJs, /const openFolderRowQuickActions = \(type, folderId, event = null\) =>/);
    assert.match(settingsJs, /registerWindowActions\(window,\s*\{[\s\S]*openFolderRowQuickActions[\s\S]*\}\);/);
    assert.match(settingsJs, /const renderFolderQuickActionSummaryHtml = \(summary\) =>/);
    assert.match(settingsJs, /const toggleVmRowDetailsDrawer = \(folderId\) =>/);
    assert.match(settingsJs, /data-fv-vm-drawer-action/);
    assert.match(settingsJs, /const runVmRowDrawerAction = async \(action, folderId\) =>/);
    assert.match(settingsCss, /\.fv-row-details-panel\s*\{/);
    assert.match(settingsCss, /\.fv-row-details-grid\s*\{/);
});

test('nested folder expansion avoids duplicate parent previews and keeps child-only reveal path', () => {
    assert.match(dockerJs, /const getDirectMemberRowsForFolder = \(folderId\) =>/);
    assert.match(dockerJs, /const dropDownButton = \(id,\s*persistState = true\) => \{[\s\S]*hierarchyApi\.dropDownButton\(id,\s*persistState\);/);
    assert.match(dockerRuntimeHierarchyJs, /const hasChildren = folderHasChildren\(id\);/);
    assert.match(dockerRuntimeHierarchyJs, /const \$directMemberRows = getDirectMemberRowsForFolder\(id\);/);
    assert.match(dockerRuntimeHierarchyJs, /hideNestedDescendants\(id\);/);
    assert.match(dockerRuntimeHierarchyJs, /showDirectNestedChildren\(id,\s*\$childAnchor\);/);
    assert.match(dockerRuntimeHierarchyJs, /syncParentFolderVisualState\(id,\s*true\);/);
    assert.match(dockerRuntimeHierarchyJs, /syncParentFolderVisualState\(id,\s*false\);/);
    assert.match(dockerRuntimeHierarchyJs, /buildRuntimeContainerMapForFolder\(id,\s*false\)/);
    assert.match(dockerRuntimeHierarchyJs, /const \$rowsToMove = \$directRows\.length \? \$directRows : \$fallbackRows;/);
    assert.match(dockerRuntimeHierarchyJs, /When expanded, keep parent-level containers visible but avoid duplicating descendants\./);
    assert.match(dockerRuntimeHierarchyJs, /\$folderRow\.after\(\$directMemberRows\);/);
    assert.match(dockerRuntimeHierarchyJs, /Expanded parent folder\. Showing direct members, then nested children\./);
    assert.match(dockerRuntimeHierarchyJs, /\.addClass\('fv-nested-hidden'\)\.hide\(\);/);
    assert.match(dockerJs, /webui:\s*ct\.info\.State\.WebUi \|\| ct\.info\.State\.TSWebUi \|\| ''/);
    assert.match(dockerJs, /shell:\s*ct\.info\.Shell \|\| '\/bin\/sh'/);
    assert.match(dockerPreviewActionsJs, /openTerminal\('docker', containerName, shellValue\);/);
    assert.match(dockerPreviewActionsJs, /openTerminal\('docker', containerName, '\.log'\);/);
    assert.match(dockerRuntimeHierarchyJs, /const allowWebuiQuickAction = quickActionPrefs\.preview_webui === true;/);
    assert.match(dockerRuntimeHierarchyJs, /const allowConsoleQuickAction = quickActionPrefs\.preview_console === true;/);
    assert.match(dockerRuntimeHierarchyJs, /const allowLogsQuickAction = quickActionPrefs\.preview_logs === true;/);
    assert.doesNotMatch(dockerJs, /nestedParentPreview \|\| quickActionPrefs\.preview_webui === true/);
    assert.doesNotMatch(dockerJs, /nestedParentPreview \|\| quickActionPrefs\.preview_console === true/);
    assert.doesNotMatch(dockerJs, /nestedParentPreview \|\| quickActionPrefs\.preview_logs === true/);
    assert.match(dockerJs, /const shouldRenderPreviewWebuiPlaceholder = \(settings = \{\}, webuiQuickActionEnabled = false\) =>/);
    assert.match(dockerJs, /const appendPreviewWebuiPlaceholder = \(\$target\) =>/);
    assert.match(dockerJs, /const hasUnresolvedWebuiTemplateTokens = \(value\) =>/);
    assert.match(dockerJs, /const resolvePreferredWebuiValue = \(\.\.\.candidates\) =>/);
    assert.match(dockerJs, /const appendDockerPreviewActionButtons = \(\$target,\s*settings = \{\},\s*containerName = '',\s*shellValue = '\/bin\/sh',\s*webuiUrl = ''\) =>/);
    assert.match(dockerRuntimeHierarchyJs, /appendDockerPreviewActionButtons\(\$actionsTarget,\s*\{[\s\S]*preview_webui:\s*allowWebuiQuickAction,[\s\S]*preview_console:\s*allowConsoleQuickAction,[\s\S]*preview_logs:\s*allowLogsQuickAction[\s\S]*\},\s*containerName,\s*shellValue,\s*webuiUrl\);/);
    assert.match(dockerJs, /const previewWebuiUrl = getSafeWebuiUrl\(newFolder\[container_name_in_folder\]\?\.webui \|\| ct\.info\.State\.WebUi \|\| ct\.info\.State\.TSWebUi \|\| ''\);/);
    assert.match(dockerJs, /appendDockerPreviewActionButtons\(\$targetForAppend,\s*folder\.settings,\s*ct\.info\.Name,\s*ct\.info\.Shell,\s*previewWebuiUrl\);/);
    assert.match(dockerPreviewActionsJs, /utils\.resolvePreviewActionPrefs\(settings\)/);
    assert.match(dockerPreviewActionsJs, /if \(actionPrefs\.preview_webui && webuiUrl\)/);
    assert.match(dockerPreviewActionsJs, /if \(actionPrefs\.preview_console && containerName\)/);
    assert.match(dockerPreviewActionsJs, /if \(actionPrefs\.preview_logs && containerName\)/);
    assert.match(vmJs, /const parentId = normalizeFolderParentId\(source\[id\]\?\.parentId \|\| source\[id\]\?\.parent_id \|\| ''\);/);
});

test('folder editor keeps left-alignment runtime and stylesheet guards', () => {
    assert.match(folderJs, /const enforceLeftAlignedSettingsLayout = \(\) =>/);
    assert.match(folderJs, /const setVisibleMemberSelection = \(checked\) =>/);
    assert.match(folderJs, /const getFolderEditorStateApi = \(\) =>/);
    assert.match(folderJs, /const getFolderEditorMembersApi = \(\) =>/);
    assert.match(folderMembersJs, /const MEMBER_REGEX_SEARCH_FILTER = 'contains_regex';/);
    assert.match(folderJs, /const ensureInheritedFieldControls = \(\) =>/);
    assert.match(folderJs, /id="fvHeroDefaults"/);
    assert.match(folderJs, /id="fvMemberStateFilter"/);
    assert.match(folderJs, /id="fvMemberIncludeVisible"/);
    assert.match(folderJs, /id="fvMemberExcludeVisible"/);
    assert.match(folderJs, /id="fvMemberChipIncluded"/);
    assert.match(folderJs, /class="fv-inherit-btn"/);
    assert.match(folderStateJs, /actions\.prop\('hidden', isInherited\);/);
    assert.doesNotMatch(folderJs, /Using global/);
    assert.match(folderJs, /fv-force-left-v2 marker/);
    assert.match(folderJs, /fv-force-left-v3 marker/);
    assert.match(folderJs, /const validateHealthWarnThreshold = \(\) =>/);
    assert.match(folderJs, /const validateHealthCriticalThreshold = \(\) =>/);
    assert.match(folderJs, /const validateHealthPolicySelects = \(\) =>/);
    assert.match(folderJs, /health_warn_stopped_percent/);
    assert.match(folderJs, /health_critical_stopped_percent/);
    assert.match(folderJs, /health_profile/);
    assert.match(folderJs, /health_updates_mode/);
    assert.match(folderJs, /health_all_stopped_mode/);
    assert.match(folderJs, /const collectValidationWarnings = \(\) =>/);
    assert.match(folderJs, /const NO_MEMBERS_SELECTED_INFO = 'No members are currently selected in this folder\.';/);
    assert.doesNotMatch(folderJs, /Regex is empty, so only manual assignment will be used for this folder\./);
    assert.match(folderJs, /summary\.removeClass\('invalid warning info ready'\)/);
    assert.match(folderJs, /summary\.addClass\('info'\)\.text\(`Info: \$\{infoWarnings\.length\} note/);
    assert.match(folderJs, /const suggestDefaultsFromMembers = \(\) =>/);
    assert.match(folderJs, /const buildRegexSuggestionFromNames = \(names\) =>/);
    assert.match(folderJs, /const applyAdvancedMode = \(\) =>/);
    assert.match(folderJs, /const toggleAdvancedSectionCollapse = \(sectionKey\) =>/);
    assert.match(folderJs, /<option value="contains_regex">Contains regex<\/option>/);
    assert.match(folderMembersJs, /new RegExp\(rawQuery, 'i'\)/);
    assert.match(folderMembersJs, /queryRegex \? queryRegex\.test\(rawName\) : false/);
    assert.match(folderMembersJs, /Regex search members/);
    assert.match(folderMembersJs, /Invalid regex: \$\{error\.message\}/);
    assert.match(folderJs, /Filter member list/);
    assert.match(folderJs, /ComposeProject/);
    assert.match(folderJs, /UpdateAvailable/);
    assert.match(folderJs, /id="fvSuggestDefaults"/);
    assert.match(folderChromeJs, /id="fvDockerSignalsShell"/);
    assert.match(folderChromeJs, /class="fv-live-stat-card"/);
    assert.doesNotMatch(folderChromeJs, /Regex simulator/);
    assert.match(folderChromeJs, /id="fvHeroDefaults"/);
    assert.match(folderChromeJs, /const collectInheritedConstraintTokens = \(row, boundary\) =>/);
    assert.match(folderChromeJs, /findBasicByFieldName\(form, 'folder_webui_url'\)/);
    assert.match(folderChromeJs, /findBasicByFieldName\(form, 'preview_vertical_bars_color'\)/);
    assert.match(folderChromeJs, /findBasicByFieldName\(form, 'preview_border_color'\)/);
    assert.match(folderChromeJs, /const getFolderEditorTypeApi = \(\) =>/);
    assert.match(folderChromeJs, /const mergeSectionRows = \(baseRows,\s*extraRows\) =>/);
    assert.match(folderChromeJs, /const syncActionLaunchPlacement = \(form\) =>/);
    assert.doesNotMatch(folderChromeJs, /fvLiveSurfaceLabel/);
    assert.doesNotMatch(folderChromeJs, /data-surface="dashboard"/);
    assert.match(folderChromeJs, /if \(row\.querySelector\('\[name="regex"\]'\)\) \{\s*row\.classList\.add\('is-compact-text-row'/);
    assert.match(folderChromeJs, /shell\.classList\.toggle\('is-members-shell', sectionKey === 'members'\)/);
    assert.match(folderChromeJs, /if \(row\.querySelector\('\[name="name"\]'\)\) \{/);
    assert.match(folderChromeJs, /row\.classList\.remove\('fv-modern-order-row', 'is-wide-row', 'is-icon-row', 'is-status-row', 'is-actions-row', 'is-toggle-row', 'is-color-row', 'is-name-row', 'is-parent-row', 'is-url-row', 'is-webui-url-row', 'is-compact-text-row', 'is-webui-row', 'is-members-row', 'is-rules-row', 'is-actions-list-row', 'is-actions-launch-row'\);/);
    assert.match(folderChromeJs, /if \(row\.querySelector\('\[name="folder_webui"\]'\)\) \{/);
    assert.match(folderChromeJs, /if \(row\.querySelector\('\.custom-action-wrapper'\)\) \{\s*row\.classList\.add\('is-actions-list-row', 'is-wide-row'\);/);
    assert.match(folderChromeJs, /if \(row\.querySelector\('a\.custom-action'\) && !row\.querySelector\('\.custom-action-wrapper'\)\) \{\s*row\.classList\.add\('is-actions-launch-row'\);/);
    assert.doesNotMatch(folderChromeJs, /row\.classList\.add\('is-actions-row', 'is-wide-row'\);/);
    assert.doesNotMatch(folderChromeJs, /if \(row\.querySelector\('\[name="regex"\]'\)\) \{\s*row\.classList\.add\('is-wide-row'\);/);
    assert.match(folderTypeDockerJs, /findBasicByFieldName\(form,\s*'context_trigger'\)/);
    assert.match(folderTypeDockerJs, /findBasicByFieldName\(form,\s*'context_graph'\)/);
    assert.match(folderTypeDockerJs, /findBasicByFieldName\(form,\s*'context_graph_time'\)/);
    assert.match(folderPreviewRuntimeJs, /\$\('\[constraint\*="context_graph-"\]'\)\.hide\(\);/);
    assert.match(folderPreviewRuntimeJs, /context_graph-\$\{form\.context_graph\?\.value\}/);
    assert.match(folderPreviewRuntimeJs, /form\.preview_border\?\.checked === true\) \{/);
    assert.match(folderPreviewRuntimeJs, /applyTypePreviewConstraints = typeof deps\.applyTypePreviewConstraints === 'function'/);
    assert.match(folderPreviewRuntimeJs, /applyTypePreviewConstraints\(\{ \$,\s*form \}\);/);
    assert.match(folderTypeVmJs, /activeJq\('\[constraint\*="docker"\]'\)\.hide\(\);/);
    assert.doesNotMatch(folderPage, /Lasciate ogne speranza/);
    assert.doesNotMatch(folderPage, /Site for testing your regex/);
    assert.doesNotMatch(folderCss, /\.canvas form\.folder-editor-form \.fv-section-shell > \.fv-section-shell-body > \.basic:not\(.order-section\),/);
    assert.match(folderCss, /\.canvas form\.folder-editor-form\.fv-force-left-v3 \.fv-modern-field-row > dl/);
    assert.match(folderCss, /\.canvas form\.folder-editor-form\[data-fv-page-mode="modern"\]\.fv-modern-editor-booting > \.basic/);
    assert.match(folderCss, /\.fv-editor-boot-placeholder/);
    assert.match(folderJs, /const normalizeEditorMode = \(\) => 'advanced';/);
    assert.match(folderJs, /const getVisibleEditorSectionKeys = \(\) => Object\.entries\(SECTION_META\)/);
    assert.match(folderCss, /\.fv-section-nav\s*\{[\s\S]*flex:\s*1 1 520px;/);
    assert.match(folderCss, /\.fv-section-collapse/);
    assert.match(folderCss, /\.fv-docker-signals/);
    assert.match(folderCss, /\.fv-live-chip-panel/);
    assert.match(folderCss, /\.fv-live-stat-card/);
    assert.match(folderCss, /\.fv-live-folder-head\s*\{/);
    assert.match(folderCss, /\.fv-live-folder-head\s*\{[\s\S]*align-self:\s*center;/);
    assert.match(folderCss, /\.fv-live-preview-row\s*\{[\s\S]*grid-template-columns:\s*max-content minmax\(0, 1fr\);/);
    assert.match(folderCss, /\.fv-live-member-lane\s*\{[\s\S]*padding-left:\s*0\.45rem;/);
    assert.match(folderCss, /\.fv-live-member > img\s*\{[\s\S]*width:\s*36px;[\s\S]*height:\s*36px;/);
    assert.match(folderCss, /\.fv-live-preview-row\.is-minimal \.fv-live-chevron/);
    assert.match(folderCss, /\.fv-live-preview-row\.is-boxed \.fv-live-chevron/);
    assert.match(folderCss, /\.fv-live-preview-row\.is-ghost \.fv-live-chevron/);
    assert.match(folderCss, /\.fv-live-preview-row\.is-pill \.fv-live-chevron/);
    assert.match(folderCss, /\.fv-live-preview-row\.is-filled \.fv-live-chevron/);
    assert.match(folderCss, /--fv-live-chevron-color/);
    assert.match(folderCss, /--fv-live-chevron-hover-bg/);
    assert.match(folderCss, /--fv-live-chevron-min-width/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-actions-launch-row,\s*[\s\S]*\.fv-modern-field-row\.is-compact-text-row\s*\{[\s\S]*width:\s*min\(100%, 560px\);[\s\S]*max-width:\s*560px;/);
    assert.match(folderCss, /\.fv-modern-field-row \.custom-action\s*\{/);
    assert.match(folderCss, /\.fv-folder-action-dialog\.ui-dialog\s*\{/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="rules"\] \.fv-section-shell-body\s*\{[\s\S]*display:\s*flex !important;/);
    assert.match(folderCss, /\.fv-folder-action-dialog \.dialogCustomAction dl\s*\{[\s\S]*flex-direction:\s*column;/);
    assert.match(folderJs, /dialogWidget\.addClass\('fv-folder-action-dialog'\);/);
    assert.match(folderJs, /width:\s*420,/);
    assert.match(folderCss, /\.fv-live-preview-row \.fv-live-chevron\s*\{[\s\S]*background:\s*var\(--fv-live-chevron-bg, transparent\) !important;/);
    assert.match(folderCss, /\.fv-live-preview-row \.fv-live-chevron\s*\{[\s\S]*appearance:\s*none !important;/);
    assert.match(folderCss, /\.fv-live-preview-row\.is-minimal \.fv-live-chevron\s*\{[\s\S]*color:\s*var\(--fv-live-chevron-color, var\(--fv-chevron-color\)\) !important;/);
    assert.match(folderCss, /\.fv-live-chevron\s*\{[\s\S]*min-width:\s*var\(--fv-live-chevron-min-width, 12px\);[\s\S]*height:\s*var\(--fv-live-chevron-height, 16px\);[\s\S]*padding:\s*var\(--fv-live-chevron-padding, 0 2px\);/);
    assert.match(folderCss, /\.order-buttons > button,\s*[\s\S]*\.order-buttons > button > i\s*\{[\s\S]*color:\s*var\(--fv-editor-title-accent\) !important;/);
    assert.match(folderCss, /\.order-buttons > button:hover,\s*[\s\S]*\.order-buttons > button:focus-visible,\s*[\s\S]*\.order-buttons > button:hover > i,\s*[\s\S]*\.order-buttons > button:focus-visible > i\s*\{[\s\S]*color:\s*var\(--fv-editor-title-accent\) !important;/);
    assert.match(folderCss, /\.item\.fv-member-row-draggable\s*\{[\s\S]*cursor:\s*grab;/);
    assert.match(folderCss, /\.item\.is-dragging\s*\{[\s\S]*background:\s*var\(--fv-editor-control-surface-active\);/);
    assert.match(folderCss, /\.member-drag-handle\.is-disabled\s*\{[\s\S]*cursor:\s*not-allowed;/);
    assert.match(folderJs, /class="member-drag-handle"/);
    assert.match(folderJs, /bindMemberDragReorder\(\);/);
    assert.match(folderCss, /\.fv-live-insights\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.doesNotMatch(folderCss, /\.fv-preview-surface-switch/);
    assert.doesNotMatch(folderCss, /\.fv-preview-surface-btn/);
    assert.doesNotMatch(folderCss, /\.fv-live-preview-row\.surface-dashboard/);
    assert.doesNotMatch(folderCss, /\.fv-live-preview-row\.surface-nested/);
    assert.match(folderCss, /\.fv-field-inherit-tools/);
    assert.match(folderCss, /\.fv-field-inherit-tools\[hidden\]\s*\{[\s\S]*display:\s*none !important;/);
    assert.match(folderCss, /\.fv-using-inherited \.fv-field-inherit-tools\s*\{[\s\S]*display:\s*none !important;/);
    assert.match(folderCss, /\.fv-inherit-btn\s*\{[\s\S]*min-width:\s*108px;[\s\S]*min-height:\s*34px;[\s\S]*font-size:\s*0\.98rem;[\s\S]*white-space:\s*nowrap;/);
    assert.match(folderCss, /\.fv-member-tools-main/);
    assert.match(folderCss, /\.fv-member-tools-filters/);
    assert.match(folderCss, /\.fv-member-tools-actions/);
    assert.match(folderCss, /\.fv-member-tools-filters > input\[type="text"\]\[aria-invalid="true"\]/);
    assert.match(folderCss, /\.fv-member-chip-row/);
    assert.match(folderCss, /\.fv-member-chip/);
    assert.match(folderCss, /\.fv-section-shell\.is-members-shell \.fv-section-shell-body/);
    assert.match(folderCss, /\.custom-action-wrapper > div/);
    assert.match(folderCss, /\.fv-modern-section-grid\s*\{[\s\S]*minmax\(280px,\s*1fr\)[\s\S]*align-items:\s*start;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="preview"\] \.fv-modern-section-grid,\s*[\s\S]*align-items:\s*stretch;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="preview"\] \.fv-modern-field-row,\s*[\s\S]*align-self:\s*stretch;/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-icon-row,\s*[\s\S]*\.fv-modern-field-row\.is-status-row\s*\{[\s\S]*max-width:\s*780px;/);
    assert.match(folderCss, /\.fv-modern-field-row\s*\{[\s\S]*min-height:\s*72px;[\s\S]*align-self:\s*start;[\s\S]*border:\s*1px solid var\(--fv-editor-block-border\);[\s\S]*box-sizing:\s*border-box;/);
    assert.match(folderCss, /\.fv-modern-group-list\.is-status-list\s*\{[\s\S]*max-width:\s*780px;/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-name-row input\[type="text"\]\s*\{[\s\S]*420px/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-compact-text-row input\[type="text"\],\s*[\s\S]*280px/);
    assert.match(folderCss, /\.fv-modern-field-row input\[type="text"\],\s*[\s\S]*display:\s*inline-block !important;[\s\S]*width:\s*min\(100%, 420px\) !important;[\s\S]*min-width:\s*180px !important;[\s\S]*height:\s*38px !important;[\s\S]*min-height:\s*38px !important;[\s\S]*font-size:\s*1\.02rem;/);
    assert.match(folderCss, /\.fv-modern-field-row textarea\s*\{[\s\S]*display:\s*inline-block !important;[\s\S]*width:\s*min\(100%, 420px\) !important;[\s\S]*min-width:\s*220px !important;[\s\S]*font-size:\s*1\.02rem;/);
    assert.match(folderCss, /\.fv-modern-field-row textarea\s*\{[\s\S]*min-height:\s*108px !important;/);
    assert.match(folderCss, /\.fv-modern-field-row > dl > dt\s*\{[\s\S]*font-size:\s*1rem;/);
    assert.match(folderCss, /\.fv-modern-field-row > dl,\s*[\s\S]*display:\s*flex !important;[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*0\.52em;/);
    assert.match(folderCss, /\.fv-modern-field-row > dl > dd\s*\{[\s\S]*padding-top:\s*0\.08em !important;/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-actions-list-row\s*\{[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*min-height:\s*112px;/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-actions-list-row \.custom-action-wrapper:empty::before/);
    assert.match(folderCss, /table\.sortable\s*\{[\s\S]*border:\s*1px solid var\(--fv-editor-block-border\);[\s\S]*background:\s*[\s\S]*var\(--fv-editor-panel\)[\s\S]*color:\s*var\(--fv-editor-text-primary\);/);
    assert.match(folderCss, /table\.sortable thead th\s*\{[\s\S]*background:\s*var\(--fv-editor-control-surface\);[\s\S]*color:\s*var\(--fv-editor-muted\);[\s\S]*border-bottom:\s*1px solid var\(--fv-editor-block-border\);/);
    assert.match(folderCss, /table\.sortable tbody tr:hover\s*\{[\s\S]*background:\s*var\(--fv-editor-control-surface-hover\);/);
    assert.match(folderCss, /\.item\s*\{[\s\S]*border-bottom:\s*1px solid var\(--fv-editor-block-border\);/);
    assert.match(folderCss, /\.custom-action-wrapper > div\s*\{[\s\S]*border:\s*1px solid var\(--fv-editor-block-border\);/);
    assert.match(folderCss, /\.fv-section-state-badge\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;/);
    assert.match(folderCss, /\.fv-modern-field-row\.is-actions-launch-row > dl > dt\s*\{[\s\S]*display:\s*none;/);
    assert.match(folderCss, /:is\([\s\S]*\.fv-inline-reset-btn,[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fv-editor-button-quiet-top\),\s*var\(--fv-editor-button-quiet-bottom\)\) !important;/);
    assert.match(folderCss, /\.fv-validation-details/);
    assert.match(folderCss, /\.fv-validation-summary\.info/);
    assert.match(folderCss, /\.fv-validation-details\.info/);
    assert.match(folderCss, /\.fv-section-nav > button\.is-active/);
    assert.match(folderCss, /\.fv-orphan-editor-row/);
});

test('folder editor exposes folder-scoped advanced auto-rules for saved folders', () => {
    assert.match(folderJs, /const folderEditorRulesModule = window\.FolderViewPlusFolderEditorRules \|\| null;/);
    assert.match(folderJs, /const getFolderEditorRulesApi = \(\) =>/);
    assert.match(folderJs, /folderEditorRulesModule\?\.createApi/);
    assert.match(folderJs, /refreshFolderAutoRulesPanel = \(options = \{\}\) =>/);
    assert.match(folderRulesJs, /const rawRulesConfig = deps\.ruleConfig && typeof deps\.ruleConfig === 'object' \? deps\.ruleConfig : defaultRulesConfig;/);
    assert.match(folderJs, /ruleConfig: getFolderEditorTypeApi\(\)\?\.getRulesConfig\?\.\(\) \|\| null/);
    assert.match(folderRulesJs, /panel\.id = 'fvFolderAutoRulesPanel';/);
    assert.match(folderRulesJs, /panel\.className = 'basic fv-modern-field-row is-rules-row fv-folder-auto-rules-panel';/);
    assert.match(folderRulesJs, /Save this folder first to create advanced rules\./);
    assert.match(folderRulesJs, /Open full Rules workspace/);
    assert.match(folderRulesJs, /const fullRulesWorkspaceHref = `\/Settings\/FolderViewPlus\?fvMode=advanced&fvAdvancedTab=rules&fvSection=auto-assignment&fvRulesType=\$\{encodeURIComponent\(type\)\}`;/);
    assert.match(folderRulesJs, /Create regex-based plugin rules directly from the folder editor without leaving this page\./);
    assert.match(folderRulesJs, /<dt>Advanced auto-rules:<\/dt>/);
    assert.match(folderRulesJs, /<blockquote class="inline_help">/);
    assert.match(folderRulesJs, /\/plugins\/folderview\.plus\/server\/prefs\.php\?type=\$\{encodeURIComponent\(type\)\}/);
    assert.match(folderRulesJs, /requestClient\.postJson\('\/plugins\/folderview\.plus\/server\/prefs\.php'/);
    assert.match(folderPage, /'\/plugins\/folderview\.plus\/scripts\/folder\.editor\.rules\.js'/);
    assert.match(folderCss, /#fvFolderAutoRulesPanel\.fv-folder-auto-rules-panel/);
    assert.match(folderCss, /#fvFolderAutoRulesPanel\.fv-folder-auto-rules-panel > dl > dd/);
    assert.match(folderCss, /#fvFolderAutoRulesPanel\.fv-folder-auto-rules-panel\s*\{[\s\S]*max-width:\s*680px/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="rules"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.82fr\)\s+minmax\(0,\s*1\.18fr\)/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="rules"\] \.fv-modern-group-list\s*\{/);
    assert.match(folderCss, /\.fv-folder-auto-rules-builder\s*\{/);
    assert.match(folderCss, /\.fv-folder-auto-rules-link\s*\{/);
    assert.match(folderCss, /\.fv-folder-auto-rule-card\s*\{/);
    assert.match(folderCss, /\.fv-folder-auto-rules-builder input\[type="text"\]\[aria-invalid="true"\]/);
});

test('folder editor uses searchable parent picker and grouped tab panels', () => {
    assert.match(folderJs, /const folderParentPickerModule = window\.FolderViewPlusFolderEditorParentPicker \|\| null;/);
    assert.match(folderJs, /\.fv-section-shell > \.fv-section-shell-body > \.fv-editor-panel \.fv-editor-panel-body > \.basic/);
    assert.match(folderJs, /const getFolderEditorParentPickerApi = \(\(\) =>/);
    assert.match(folderJs, /const refreshParentFolderChooser = \(foldersMap,\s*selectedParentId = '',\s*blockedIds = new Set\(\)\) =>/);
    assert.match(folderJs, /parentPickerApi\.render\(\{/);
    assert.match(folderParentPickerJs, /const createApi = \(deps = \{\}\) =>/);
    assert.match(folderParentPickerJs, /id = 'fvParentFolderPicker'/);
    assert.match(folderParentPickerJs, /Search folders by name or path/);
    assert.match(folderParentPickerJs, /window\.FolderViewPlusFolderEditorParentPicker = Object\.freeze\(\{/);
    assert.match(folderPage, /'\/plugins\/folderview\.plus\/scripts\/folder\.editor\.parent-picker\.js'/);
    assert.match(folderChromeJs, /const SECTION_PANEL_META = \{/);
    assert.match(folderChromeJs, /general:\s*\[[\s\S]*key:\s*'identity'[\s\S]*key:\s*'parent'[\s\S]*key:\s*'icon'/);
    assert.match(folderChromeJs, /members:\s*\[[\s\S]*key:\s*'member-manager'/);
    assert.match(folderChromeJs, /preview:\s*\[[\s\S]*key:\s*'layout'[\s\S]*key:\s*'child-folders'[\s\S]*key:\s*'appearance'[\s\S]*key:\s*'quick-actions'[\s\S]*key:\s*'context'/);
    assert.match(folderChromeJs, /chevron:\s*\[[\s\S]*key:\s*'style'[\s\S]*key:\s*'color'/);
    assert.match(folderChromeJs, /status:\s*\[[\s\S]*key:\s*'status-colors'[\s\S]*key:\s*'accent'[\s\S]*key:\s*'thresholds'[\s\S]*advancedOnly:\s*true[\s\S]*key:\s*'health'[\s\S]*advancedOnly:\s*true/);
    assert.match(folderChromeJs, /rules:\s*\[[\s\S]*key:\s*'regex'[\s\S]*key:\s*'auto-rules'[\s\S]*keepEmpty:\s*true/);
    assert.match(folderChromeJs, /actions:\s*\[[\s\S]*key:\s*'folder-actions'/);
    assert.match(folderChromeJs, /advanced:\s*\[[\s\S]*key:\s*'action-behavior'[\s\S]*key:\s*'expansion'[\s\S]*key:\s*'dashboard'[\s\S]*key:\s*'docker'/);
    assert.match(folderChromeJs, /const ensureEditorPanel = \(body,\s*sectionKey,\s*panelDef\) =>/);
    assert.match(folderChromeJs, /panel\.className = 'fv-editor-panel';/);
    assert.match(folderChromeJs, /const keepEmpty = panelDef\?\.keepEmpty === true;/);
    assert.match(folderChromeJs, /const panelDefs = SECTION_PANEL_META\[sectionKey\] \|\| \[\];/);
    assert.match(folderChromeJs, /const activePanelKeys = new Set\(panelDefs\.map/);
    assert.match(folderChromeJs, /if \(!activePanelKeys\.has\(panelKey\)\) \{[\s\S]*panel\.remove\(\);/);
    assert.match(folderChromeJs, /let currentMode = ADVANCED_MODE;/);
    assert.match(folderChromeJs, /body\.classList\.toggle\('fv-section-panel-grid', Boolean\(editorPanels\)\);/);
    assert.match(folderChromeJs, /row\.querySelector\('\[name="parent_folder_id"\]'\)/);
    assert.match(folderChromeJs, /row\.classList\.add\('is-parent-row'\)/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.92fr\)\s+minmax\(0,\s*1\.08fr\);[\s\S]*grid-template-areas:[\s\S]*"identity identity"[\s\S]*"parent icon";/);
    assert.match(folderCss, /\.fv-editor-panel\s*\{[\s\S]*border:\s*1px solid var\(--fv-editor-block-border\);[\s\S]*border-radius:\s*12px;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="status"\] \.fv-section-shell-body\.fv-section-panel-grid,[\s\S]*\.fv-section-shell\[data-section-shell="advanced"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="advanced"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-areas:[\s\S]*"action expansion"[\s\S]*"dashboard docker";/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="advanced"\] \.fv-editor-panel\[data-editor-panel="dashboard"\]\s*\{[\s\S]*grid-area:\s*dashboard;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="advanced"\] \.fv-editor-panel\[data-editor-panel="docker"\]\s*\{[\s\S]*grid-area:\s*docker;/);
    assert.doesNotMatch(folderCss, /\.fv-editor-panel\[data-editor-panel="dashboard"\]\s*\{[^}]*grid-column:\s*1 \/ -1;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="status"\] \.fv-editor-panel\[data-editor-panel="thresholds"\],[\s\S]*\.fv-section-shell\[data-section-shell="status"\] \.fv-editor-panel\[data-editor-panel="health"\]\s*\{[\s\S]*grid-column:\s*1 \/ -1;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="status"\] \.fv-editor-panel\[data-editor-panel="thresholds"\] \.fv-editor-panel-body,[\s\S]*\.fv-section-shell\[data-section-shell="status"\] \.fv-editor-panel\[data-editor-panel="health"\] \.fv-editor-panel-body\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\);/);
    assert.match(folderChromeJs, /const ensureAccentControlPlacement = \(form\) =>/);
    assert.match(folderChromeJs, /root\.FolderViewPlusEnsureAccentControlPlacement = ensureAccentControlPlacement;/);
    assert.match(folderChromeJs, /toggleGroup\.className = 'fv-accent-toggle-group';/);
    assert.match(folderChromeJs, /accentControls\.closest\('\.fv-accent-control-row'\)/);
    assert.match(folderJs, /FolderViewPlusEnsureAccentControlPlacement\(getForm\(\)\)/);
    assert.match(folderPage, /<div class="fv-accent-control-row">[\s\S]*<div class="fv-accent-enable-control">[\s\S]*name="folder_accent_enabled"[\s\S]*<div class="fv-accent-inline-controls"/);
    assert.match(folderCss, /\.fv-accent-control-row\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*max-content max-content;/);
    assert.match(folderCss, /\.fv-accent-toggle-group\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*min-width:\s*78px;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="status"\] \.fv-editor-panel\[data-editor-panel="accent"\] \.fv-modern-field-row\s*\{[\s\S]*min-height:\s*72px;[\s\S]*padding-bottom:\s*0\.12em;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="status"\] \.fv-editor-panel\[data-editor-panel="accent"\] \.fv-modern-field-row > dl > dd\.fv-accent-color-dd\s*\{[\s\S]*display:\s*flex !important;[\s\S]*flex-wrap:\s*nowrap;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="preview"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="preview"\] \.fv-editor-panel \.fv-editor-panel-body\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(210px,\s*1fr\)\);/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="rules"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.82fr\)\s+minmax\(0,\s*1\.18fr\);/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="actions"\] \.fv-section-shell-body\.fv-section-panel-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    assert.match(folderRulesJs, /const panelHost = rootDocument\.querySelector\('\.fv-section-shell\[data-section-shell="rules"\] \.fv-editor-panel\[data-editor-panel="auto-rules"\] \.fv-editor-panel-body'\);/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-editor-panel\[data-editor-panel="identity"\]\s*\{[\s\S]*grid-area:\s*identity;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-editor-panel\[data-editor-panel="identity"\] \.fv-editor-panel-body\s*\{[\s\S]*grid-template-columns:\s*minmax\(220px,\s*1fr\)\s+minmax\(180px,\s*0\.7fr\);/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-parent-row\s*\{[\s\S]*min-height:\s*0;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-parent-row > dl,[\s\S]*\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-parent-row \.fv-parent-picker-list\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-icon-row\s*\{[\s\S]*min-height:\s*0;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-icon-row > dl,[\s\S]*\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-icon-row \.fv-icon-picker-panel\s*\{[\s\S]*width:\s*100% !important;[\s\S]*max-width:\s*none !important;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-icon-row \.fv-icon-picker-item\s*\{[\s\S]*border-color:\s*transparent !important;[\s\S]*background:\s*transparent !important;[\s\S]*box-shadow:\s*none !important;/);
    assert.match(folderCss, /\.fv-section-shell\[data-section-shell="general"\] \.fv-modern-field-row\.is-icon-row \.fv-icon-picker-item\.is-selected\s*\{[\s\S]*box-shadow:\s*inset 3px 0 0 var\(--fv-editor-title-accent\) !important;/);
    assert.match(folderCss, /\.fv-parent-picker-shell/);
    assert.match(folderCss, /\.fv-parent-picker-list\s*\{[\s\S]*display:\s*flex;[\s\S]*border:\s*1px solid var\(--fv-editor-block-border\);[\s\S]*background:\s*var\(--fv-editor-inset-surface\);/);
    assert.match(folderCss, /\.fv-parent-picker-option\s*\{[\s\S]*margin:\s*0 !important;[\s\S]*border-top:\s*1px solid var\(--fv-editor-block-border\) !important;/);
    assert.match(folderCss, /\.fv-parent-picker-option:hover,[\s\S]*background:\s*var\(--fv-editor-control-surface-hover\) !important;/);
    assert.match(folderCss, /\.fv-parent-picker-pinned\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb,\s*var\(--fv-editor-accent\) 28%,\s*var\(--fv-editor-block-border\)\);/);
    assert.match(folderCss, /\.fv-parent-picker-option\.is-selected\s*\{[\s\S]*linear-gradient\(90deg,\s*var\(--fv-editor-accent-soft\),\s*transparent 42%\),[\s\S]*var\(--fv-editor-control-surface\) !important;/);
    assert.match(folderCss, /\.fv-parent-picker-search-input/);
});

test('folder editor page ships the redesign bootstrap and chrome anchors', () => {
    assert.match(folderPage, /<form class="folder-editor-form fv-modern-editor-booting" data-fv-page-mode="modern"/);
    assert.match(folderPage, /fv-modern-editor-booting/);
    assert.match(folderPage, /id="fvModernEditorStage" class="fv-modern-editor-stage is-pending"/);
    assert.doesNotMatch(folderPage, /id="fvLegacyEditorScaffold"/);
    assert.match(folderPage, /id="fvEditorBootPlaceholder"/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorPageMode =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorResolvedMode =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorModeSource =/);
    assert.match(folderPage, /\$folderEditorPageModeSource = 'modern-only';/);
    assert.doesNotMatch(folderPage, /\$_GET\['editor'\]/);
    assert.doesNotMatch(folderPage, /\$_GET\['editorMode'\]/);
    assert.doesNotMatch(folderPage, /\$_GET\['mode'\]/);
    assert.doesNotMatch(folderPage, /readTypePrefs\('docker'\)/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorPageType =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorRequestedId =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorResolvedId =/);
    assert.match(folderPage, /window\.FolderViewPlusFolderEditorBootstrapContext =/);
    assert.match(folderPage, /<option value="ghost">Ghost<\/option>/);
    assert.match(folderPage, /<option value="pill">Pill<\/option>/);
    assert.match(folderPage, /<option value="filled">Filled<\/option>/);
    assert.match(folderJs, /const initEditorChrome = \(\) =>/);
    assert.match(folderJs, /const applyEditorPluginDefaults = \(\) =>/);
    assert.doesNotMatch(folderChromeJs, /fvChangeSummaryLabel/);
    assert.doesNotMatch(folderChromeJs, /fvLiveInheritance/);
    assert.match(folderJs, /window\.applyEditorPluginDefaults = applyEditorPluginDefaults;/);
    assert.match(folderJs, /window\.suggestDefaultsFromMembers = suggestDefaultsFromMembers;/);
    assert.match(folderPreviewJs, /<div class="fv-live-folder-head">/);
    assert.match(folderPreviewJs, /<span class="fv-live-chevron fv-live-chevron-\$\{dropdownStyle\}" aria-hidden="true">/);
    assert.match(folderPreviewJs, /liveChevron\.style\.setProperty\('--fv-live-chevron-color'/);
    assert.match(folderPreviewJs, /livePreviewRow\.style\.setProperty\('--fv-live-chevron-color'/);
    assert.match(folderChromeJs, /id="fvRestoreSavedValues"/);
    assert.match(folderChromeJs, /editorPageMode !== 'modern'/);
    assert.doesNotMatch(folderChromeJs, /data-mode="basic"/);
    assert.match(folderChromeJs, /id="fvLivePreviewCanvas"/);
    assert.match(folderChromeJs, /id="fvLivePanel"[\s\S]*id="fvEditorNavDock"/);
    assert.doesNotMatch(folderChromeJs, /id="fvEditorChrome"[\s\S]*<div class="fv-editor-nav-row">[\s\S]*id="fvLivePanel"/);
    assert.match(folderChromeJs, /const bindTopButtons = \(form\) =>/);
    assert.match(folderChromeJs, /const runIfAvailable = \(fnName, fallbackSelector = ''\) =>/);
    assert.match(folderChromeJs, /stage\.insertAdjacentHTML\('afterbegin', buildTopChrome\(\)\);/);
    assert.match(folderChromeJs, /stage\.classList\.remove\('is-pending'\);/);
    assert.match(folderChromeJs, /form\.classList\.remove\('fv-modern-editor-booting'\);/);
    assert.match(folderChromeJs, /form\.classList\.add\('fv-modern-editor-ready'\);/);
    assert.match(folderChromeJs, /bindButton\('#fvRestoreSavedValues', 'resetUnsavedChanges', '\.folder-btn-reset'\);/);
    assert.match(folderChromeJs, /bindButton\('#fvApplyPluginDefaults', 'applyEditorPluginDefaults'\);/);
    assert.match(folderChromeJs, /bindButton\('#fvSuggestDefaults', 'suggestDefaultsFromMembers'\);/);
    assert.match(folderChromeJs, /data-target="\$\{key\}"/);
    assert.doesNotMatch(folderChromeJs, /data-mode="advanced"/);
    assert.doesNotMatch(folderPage, /scripts\/folder\.js[^?]*"\s*defer/);
    assert.match(folderJs, /if \(modernFolderEditorEnabled && typeof window\.FolderViewPlusRevealModernEditorStage === 'function'\) \{/);
});

test('prefs endpoint no longer rewrites retired folder editor mode flags', () => {
    const prefsPhp = fs.readFileSync(
        path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/prefs.php'),
        'utf8'
    );
    assert.doesNotMatch(prefsPhp, /array_key_exists\('folderEditorMode', \$decoded\)/);
    assert.doesNotMatch(prefsPhp, /\$decoded\['folderEditorModeExplicit'\] = true;/);
    assert.match(prefsPhp, /\$dockerOrderChanged = \$type === 'docker' && \(/);
    assert.match(prefsPhp, /if \(\$dockerOrderChanged\) \{\s*syncContainerOrder\('docker'\);\s*\}/);
});

test('runtime folder editor routes defer editor mode resolution to Folder.page server prefs', () => {
    assert.doesNotMatch(dockerJs, /params\.set\(\s*'editor'/);
    assert.doesNotMatch(vmJs, /params\.set\(\s*'editor'/);
    assert.doesNotMatch(dashboardJs, /params\.set\(\s*'editor'/);
    assert.match(dockerRuntimeActionsJs, /params\.set\(\s*'type',\s*'docker'/);
    assert.match(vmJs, /params\.set\(\s*'type',\s*'vm'/);
    assert.doesNotMatch(dashboardJs, /params\.set\(\s*'type',\s*resolvedType/);
});

test('settings runtime uses extracted chrome module and shared request wrapper', () => {
    assert.match(settingsJs, /const requestClient = window\.FolderViewPlusRequest \|\| null;/);
    assert.match(settingsJs, /const settingsChrome = window\.FolderViewPlusSettingsChrome \|\| null;/);
    assert.match(settingsJs, /const dirtyTracker = window\.FolderViewPlusDirtyTracker \|\| null;/);
    assert.match(settingsJs, /const SETUP_ASSISTANT_DONE_STORAGE_KEY = 'fv\.settings\.setupAssistant\.v2\.done';/);
    assert.match(settingsJs, /const SETUP_ASSISTANT_DRAFT_STORAGE_KEY = 'fv\.settings\.setupAssistant\.v2\.draft';/);
    assert.match(settingsJs, /const SETUP_ASSISTANT_PRESETS_STORAGE_KEY = 'fv\.settings\.setupAssistant\.v2\.presets';/);
    assert.match(settingsJs, /const RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY = 'fv\.runtimeConflict\.active\.v1';/);
    assert.match(settingsJs, /const RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY = 'fv\.runtimeConflict\.resolvedPending\.v1';/);
    assert.match(settingsJs, /const TABLE_UI_STATE_STORAGE_KEY = 'fv\.settings\.tableUiState\.v1';/);
    assert.match(settingsJs, /const ensureAdvancedDataLoaded = async \(options = \{\}\) =>/);
    assert.doesNotMatch(settingsJs, /const ensureAdvancedDataLoaded = async \(\{ force = false \} = \{\}\) =>[\s\S]*arguments\[0\]/);
    assert.doesNotMatch(settingsJs, /const ACTION_DOCK_SIDE_STORAGE_KEY = 'fv\.settings\.actionDockSide\.v1';/);
    assert.match(settingsJs, /const INSTANT_PERSIST_ONCHANGE_TOKENS = Object\.freeze\(/);
    assert.match(settingsJs, /const isInstantPersistInput = \(input\) =>/);
    assert.match(settingsJs, /return INSTANT_PERSIST_ONCHANGE_TOKENS\.some\(\(token\) => handler\.includes\(token\)\);/);
    assert.match(settingsJs, /const getChangedTrackedInputs = \(\) =>/);
    assert.match(settingsJs, /dirtyTracker\.getChangedInputs\(/);
    assert.match(settingsJs, /dirtyTracker\.captureBaseline\(/);
    assert.match(settingsJs, /const advancedDataLoadState = \{/);
    assert.match(settingsJs, /const UNDO_WINDOW_MS = 10000;/);
    assert.match(settingsJs, /const buildModuleEmptyTableRow = \(title, help, colspan = 1\) =>/);
    assert.match(settingsJs, /const focusFolderRow = \(type, folderId\) =>/);
    assert.match(settingsJs, /const showActionSummaryToast = \(\{/);
    assert.doesNotMatch(settingsJs, /setActionDockExpanded/);
    assert.doesNotMatch(settingsJs, /setActionDockMoreOpen/);
    assert.doesNotMatch(settingsJs, /fv-save-dock/);
    assert.doesNotMatch(settingsJs, /fv-action-more/);
    assert.doesNotMatch(settingsJs, /fv-action-save-close/);
    assert.doesNotMatch(settingsJs, /fv-settings-action-wrap/);
    assert.doesNotMatch(settingsJs, /fv-action-reset-section/);
    assert.match(settingsJs, /const getTrackedInputs = \(\) => \{/);
    assert.match(settingsJs, /dirtyTracker && typeof dirtyTracker\.getTrackedInputs === 'function'/);
    assert.match(settingsJs, /resolveAffectedFolderIdsFromOperations\(resolvedType, operations\)/);
    assert.match(settingsRuntime, /const SETUP_ASSISTANT_EXPERIENCE_MODES = new Set\(\['guided', 'expert'\]\);/);
    assert.match(settingsRuntime, /const SETUP_ASSISTANT_APPLY_SAFETY_MODES = new Set\(\['auto', 'strict', 'fast'\]\);/);
    assert.match(settingsRuntime, /const SETUP_ASSISTANT_ENV_PRESETS = \{/);
    assert.match(settingsRuntime, /const normalizeSetupAssistantExperienceMode = \(value\) =>/);
    assert.match(settingsRuntime, /const normalizeSetupAssistantSafetyMode = \(value\) =>/);
    assert.match(settingsRuntime, /const decorateSetupAssistantChipRows = \(\) =>/);
    assert.match(settingsRuntime, /const detectSetupAssistantDefaultsFromContext = \(context = null\) =>/);
    assert.match(settingsRuntime, /const openSetupAssistant = \(force = false\) =>/);
    assert.match(settingsRuntime, /const applySetupAssistantPlan = async \(\) =>/);
    assert.match(settingsRuntime, /const retrySetupAssistantFailures = async \(failures = \[\]\) =>/);
    assert.match(settingsRuntime, /const restoreSetupAssistantDraftFromStorage = \(\) =>/);
    assert.match(settingsRuntime, /const buildSetupAssistantImpactSummary = \(\) =>/);
    assert.match(settingsRuntime, /const getSetupAssistantImpactDelta = \(currentImpact, baselineImpact = null\) =>/);
    assert.match(settingsRuntime, /const buildSetupAssistantStepStatusMap = \(\) =>/);
    assert.match(settingsRuntime, /status = 'pending';/);
    assert.match(settingsRuntime, /const getSetupAssistantStepValidation = \(stepKey = currentSetupAssistantStepKey\(\)\) =>/);
    assert.match(settingsRuntime, /const previewSetupAssistantRuleMatches = \(type, pattern\) =>/);
    assert.match(settingsRuntime, /const handleSetupAssistantDialogKeydown = \(event\) =>/);
    assert.match(settingsRuntime, /const jumpSetupAssistantToStep = \(targetIndex\) =>/);
    assert.match(settingsRuntime, /const buildSetupAssistantClipboardSummary = \(\) =>/);
    assert.match(settingsRuntime, /const copySetupAssistantSummaryToClipboard = async \(\) =>/);
    assert.match(settingsJs, /const syncRuntimeConflictResolutionBanner = \(\) =>/);
    assert.match(settingsJs, /Conflict removed\. FolderView Plus is active again\./);
    assert.match(settingsJs, /runQuickSetupWizard = \(force = false, options = \{\}\) => \{/);
    assert.match(settingsRuntime, /openSetupAssistant\(force === true\);/);
    assert.match(settingsRuntime, /const bindSetupAssistantEvents = \(\) =>/);
    assert.match(settingsRuntime, /markSetupAssistantCompletedLocal\(\);/);
    assert.match(settingsRuntime, /id="fv-setup-dry-run"/);
    assert.match(settingsRuntime, /id="fv-setup-copy-summary"/);
    assert.match(settingsRuntime, /id="fv-setup-discard-draft"/);
    assert.match(settingsRuntime, /id="fv-setup-skip-review"/);
    assert.match(settingsRuntime, /FolderView Plus helps group related apps, preview changes before they are applied, and optionally keep future apps organized automatically\./);
    assert.match(settingsRuntime, /id="fv-setup-begin" class="fv-setup-primary-action"/);
    assert.match(settingsRuntime, /id="fv-setup-close-welcome"/);
    assert.match(settingsRuntime, /id="fv-setup-continue-draft"/);
    assert.match(settingsRuntime, /Nothing changes until you review the final setup plan and choose to apply it\./);
    assert.match(settingsRuntime, /data-fv-focus-mode="\$\{focusModeEnabled \? '1' : '0'\}"/);
    assert.doesNotMatch(settingsRuntime, /id="fv-setup-focus-mode"/);
    assert.doesNotMatch(settingsRuntime, /id="fv-setup-contrast-mode"/);
    assert.doesNotMatch(settingsRuntime, /Suggested improvements/);
    assert.doesNotMatch(settingsRuntime, /Use Focus mode/);
    assert.doesNotMatch(settingsRuntime, />Contrast</);
    assert.match(settingsRuntime, /name="fv-setup-safety-mode"/);
    assert.doesNotMatch(settingsRuntime, /<h4>Default settings mode<\/h4>/);
    assert.doesNotMatch(settingsRuntime, /<h4>Quick start bundle<\/h4>/);
    assert.doesNotMatch(settingsRuntime, /<h4>Saved wizard presets<\/h4>/);
    assert.match(settingsRuntime, /Dry run only \(preview changes, do not modify folders\)/);
    assert.match(settingsJs, /const shouldRunWizard = !isWizardCompletedServerSide\(\) && !isSetupAssistantCompletedLocal\(\);/);
    assert.match(settingsJs, /runQuickSetupWizard\(false, \{ source: 'auto-first-run' \}\);/);
    assert.match(settingsJs, /const apiPostJson = async \(url, data = \{\}, options = \{\}\) =>/);
    assert.match(settingsJs, /const topbarHtml = settingsChrome && typeof settingsChrome\.getTopbarHtml === 'function'/);
    assert.match(settingsJs, /const enforceNoHorizontalOverflow = \(\) =>/);
    assert.match(settingsJs, /const initOverflowGuard = \(\) =>/);
    assert.match(settingsJs, /window\.addEventListener\('resize', enforceNoHorizontalOverflow\)/);
    assert.match(settingsJs, /initOverflowGuard\(\);/);
    assert.match(settingsJs, /syncRuntimeConflictResolutionBanner\(\);/);
    assert.match(settingsJs, /registerWindowActions\(window,\s*\{[\s\S]*compareBackupSnapshots[\s\S]*copyFolderId[\s\S]*toggleDockerUpdatesFilter[\s\S]*\}\);/);
    assert.match(settingsJs, /const evaluateDockerFolderHealth = \(folder, members, countsByState, updateCount, fallbackWarnThreshold\) =>/);
    assert.match(settingsJs, /const toggleHealthSeverityFilter = \(type = 'docker', severity = 'all'\) =>/);
    assert.match(settingsJs, /registerWindowActions\(window,\s*\{[\s\S]*toggleHealthSeverityFilter[\s\S]*\}\);/);
    assert.match(settingsJs, /toggleHealthSeverityFilter\('\$\{type\}','\$\{escapeHtml\(healthStatus\.filterSeverity\)\}'\)/);
    assert.match(settingsJs, /root\.FolderViewPlusRowDetails = factory\(\);/);
    assert.match(settingsJs, /const getRowDetailsApi = \(\(\) =>/);
    assert.match(settingsJs, /cachedApi = rowDetailsModule\.createApi\(/);
    assert.match(settingsJs, /const showFolderHealthBreakdown = \(\.\.\.args\) => getRowDetailsApi\(\)\.showFolderHealthBreakdown\(\.\.\.args\);/);
    assert.match(settingsJs, /registerWindowActions\(window,\s*\{[\s\S]*showFolderHealthBreakdown[\s\S]*\}\);/);
    assert.match(settingsJs, /class="health-breakdown-btn"/);
    assert.doesNotMatch(settingsJs, /Advanced sections/);
    assert.match(settingsJs, /id="fv-advanced-compact" class="fv-advanced-compact" title="\$\{escapeHtml\(compactLabel\)\}" aria-label="\$\{escapeHtml\(compactLabel\)\}"/);
    assert.doesNotMatch(settingsJs, /toggle\.textContent = 'Compact';/);
    assert.match(settingsJs, /const toggleLabel = expanded \? 'Compact section' : 'Expand section';/);
    assert.match(settingsJs, /section\.toggle\.setAttribute\('aria-label', `\$\{toggleLabel\}: \$\{section\.title \|\| section\.key\}`\);/);
    assert.match(settingsJs, /const folderMatchesStatusFilter = \(statusFilterMode, countsByState, totalMembers\) =>/);
    assert.match(settingsJs, /const applyColumnVisibility = \(type\) =>/);
    assert.match(settingsJs, /const SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE = Object\.freeze\(/);
    assert.match(settingsJs, /const buildPresetColumnVisibilityForType = \(type, preset = 'balanced'\) =>/);
    assert.match(settingsJs, /const getSettingsTablePrefs = \(type, prefsOverride = null\) =>/);
    assert.match(settingsJs, /const syncSettingsTableStateFromPrefs = \(type, prefsOverride = null\) =>/);
    assert.match(settingsJs, /const renderSettingsTableLayoutControls = \(type\) =>/);
    assert.match(settingsJs, /const TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE = Object\.freeze\(/);
    assert.match(settingsJs, /const applyColumnWidths = \(type\) =>/);
    assert.match(settingsJs, /const bindTableColumnResizers = \(type\) =>/);
    assert.match(settingsJs, /const renderColumnVisibilityControls = \(type\) =>/);
    assert.match(settingsJs, /const changeColumnVisibility = async \(type, key, checked\) =>/);
    assert.match(settingsJs, /const changeSettingsTableColumnWidthPreset = async \(type, key, value\) =>/);
    assert.match(settingsJs, /const applySettingsTablePreset = async \(type, preset\) =>/);
    assert.match(settingsJs, /const resetSettingsTableColumns = async \(type, mode = 'visibility'\) =>/);
    assert.match(settingsJs, /registerWindowActions\(window,\s*\{[\s\S]*changeColumnVisibility[\s\S]*changeSettingsTableColumnWidthPreset[\s\S]*applySettingsTablePreset[\s\S]*resetSettingsTableColumns[\s\S]*\}\);/);
    assert.match(settingsJs, /toggleStatusFilter\('\$\{type\}','\$\{escapeHtml\(statusPrimaryKey\)\}'\)/);
    assert.match(settingsJs, /return 'good health';/);
    assert.match(settingsJs, /return 'warn health';/);
    assert.match(settingsJs, /return 'critical health';/);
    assert.match(settingsJs, /return 'empty health';/);
    assert.match(settingsJs, /const isDockerUpdateAvailable = \(itemInfo\) =>/);
    assert.match(settingsJs, /state\?\.manager === 'dockerman'/);
    assert.match(settingsJs, /state\?\.Updated === false/);
    assert.match(settingsJs, /const formatGiBFromKiB = \(kibValue\) =>/);
    assert.match(settingsJs, /const evaluateVmResourceBadge = \(resourceTotals, healthPrefs\) =>/);
    assert.match(settingsJs, /vmResourceWarnVcpus/);
    assert.match(settingsJs, /vmResourceCriticalVcpus/);
    assert.match(settingsJs, /vmResourceWarnGiB/);
    assert.match(settingsJs, /vmResourceCriticalGiB/);
    assert.match(settingsJs, /storageBytesTotal/);
    assert.match(settingsJs, /fa-database/);
    assert.match(settingsJs, /autostart-chip/);
    assert.match(settingsJs, /vm-resource-stack/);
    assert.match(settingsJs, /const persistImportPresetStoreTypeToServer = async/);
    assert.match(settingsRuntime, /const resolveImportTrustInfo = \(parsed\) =>/);
    assert.match(settingsRuntime, /label:\s*'Trust'/);
    assert.match(settingsRuntime, /is-trust-\$\{trust\.level\}/);
    assert.match(settingsJs, /const ensureAdvancedDataLoaded = async \(options = \{\}\) =>/);
    assert.match(settingsJs, /const refreshCoreData = async \(\) =>/);
    assert.match(settingsJs, /if \(settingsUiState\.mode === 'advanced'\) \{[\s\S]*await refreshAll\(\);[\s\S]*\} else \{[\s\S]*await refreshCoreData\(\);[\s\S]*\}/);
    assert.match(settingsCss, /\.folder-action-btn\s*\{/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.folder-table table td\.actions-cell \.folder-action-btn:not\(\.folder-overflow-btn\),[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-settings-button-quiet-top\),\s*var\(--fvplus-settings-button-quiet-bottom\)\) !important;/);
    assert.doesNotMatch(settingsCss, /\.fv-col-resizer/);
    assert.doesNotMatch(settingsCss, /body\.fv-column-resize-active/);
    assert.match(settingsCss, /\.fv-runtime-resolved-panel\s*\{/);
    assert.match(settingsCss, /\.fv-runtime-resolved-actions\s*\{/);
    assert.match(settingsCss, /\.updates-chip\s*\{/);
    assert.match(settingsCss, /\.updates-chip\s*\{[\s\S]*border:\s*0 !important/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.updates-chip[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-settings-button-quiet-top\),\s*var\(--fvplus-settings-button-quiet-bottom\)\) !important;/);
    assert.match(settingsCss, /\.health-chip\s*\{/);
    assert.match(settingsCss, /\.health-chip\s*\{[\s\S]*border:\s*0 !important/);
    assert.match(settingsCss, /\.health-chip\s*\{[\s\S]*border-radius:\s*7px !important/);
    assert.match(settingsCss, /\.health-chip\.folder-metric-chip\.is-ok\s*\{/);
    assert.match(settingsCss, /\.folder-metric-chip\.is-maintenance\s*\{/);
    assert.match(settingsCss, /\.health-breakdown-btn\s*\{/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.health-breakdown-btn,[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-settings-button-quiet-top\),\s*var\(--fvplus-settings-button-quiet-bottom\)\) !important;/);
    assert.match(settingsCss, /\.health-chip\.is-filter-active\s*\{/);
    assert.match(settingsCss, /\.autostart-chip\s*\{/);
    assert.match(settingsCss, /\.vm-resource-stack\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\.is-cpu\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\.is-ram\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\.is-storage\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\.is-good\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\.is-warn\s*\{/);
    assert.match(settingsCss, /\.vm-resource-chip\.is-critical\s*\{/);
    assert.match(settingsCss, /\.preview-meta-item\.is-trust-trusted\s*\{/);
    assert.match(settingsCss, /\.preview-meta-item\.is-trust-legacy\s*\{/);
    assert.match(settingsCss, /\.preview-meta-item\.is-trust-untrusted\s*\{/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.fv-advanced-tab,[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-settings-button-bg-top\),\s*var\(--fvplus-settings-button-bg-bottom\)\) !important;/);
    assert.match(settingsCss, /\.fv-advanced-compact i\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-overlay\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\s*\{/);
    assert.match(settingsCss, /\.fv-setup-assistant-shell\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-list\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-jump\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center/);
    assert.match(settingsCss, /\.fv-setup-step-state\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-state\.is-pending\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-delta\s*\{/);
    assert.match(settingsCss, /\.fv-setup-nav-note\s*\{/);
    assert.match(settingsCss, /\.fv-setup-welcome-screen\s*\{/);
    assert.match(settingsCss, /\.fv-setup-welcome-hero\s*\{[\s\S]*grid-template-columns:\s*74px minmax\(0,\s*1fr\)/);
    assert.match(settingsCss, /\.fv-setup-welcome-benefits\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(settingsCss, /\.fv-setup-welcome-safety\s*\{/);
    assert.match(settingsCss, /\.fv-setup-profile-hero\s*\{/);
    assert.match(settingsCss, /\.fv-setup-profile-choice\s*\{/);
    assert.match(settingsCss, /\.fv-setup-import-hero\s*\{/);
    assert.match(settingsCss, /\.fv-setup-import-card\s*\{/);
    assert.match(settingsCss, /\.fv-setup-rules-hero\s*\{/);
    assert.match(settingsCss, /\.fv-setup-rule-row\s*\{/);
    assert.match(settingsCss, /\.fv-setup-behavior-hero\s*\{/);
    assert.match(settingsCss, /\.fv-setup-review-hero\s*\{/);
    assert.match(settingsCss, /\.fv-setup-review-stats\s*\{/);
    assert.match(settingsCss, /\.fv-setup-progress-track > span\s*\{/);
    assert.match(settingsCss, /\.fv-setup-draft-banner\s*\{/);
    assert.match(settingsCss, /\.fv-setup-validation-box\s*\{/);
    assert.match(settingsCss, /\.fv-setup-env-grid\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-jump\s*\{/);
    assert.match(settingsCss, /\.fv-setup-quick-preset\.is-active\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog :is\(button, input, select, textarea, \[tabindex\]\):focus-visible/);
    assert.match(settingsCss, /@media \(prefers-reduced-motion: reduce\)\s*\{/);
    assert.match(settingsCss, /\.fv-setup-assistant-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(190px,\s*230px\)\s*minmax\(0,\s*1fr\)/);
    assert.match(settingsCss, /\.fv-setup-assistant-sidebar\s*\{[\s\S]*padding:\s*0\.65rem 0\.62rem/);
    assert.match(settingsCss, /\.fv-setup-rule-preview\.is-match\s*\{/);
    assert.match(settingsCss, /--fv-wizard-font-103:\s*1\.03rem/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\s*\{[\s\S]*transform:\s*translate\(-50%,\s*-50%\)/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\s*\{[\s\S]*width:\s*min\(1180px,\s*calc\(100vw\s*-\s*2rem\)\)/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\s*\{[\s\S]*height:\s*min\(82vh,\s*810px\)/);
    assert.match(settingsCss, /\.fv-setup-step-list li\s*\{[\s\S]*font-size:\s*var\(--fv-wizard-font-103\)/);
    assert.match(settingsCss, /\.fv-setup-assistant-head h4\s*\{[\s\S]*font-size:\s*var\(--fv-wizard-font-118\)/);
    assert.match(settingsCss, /\.fv-setup-quick-preset\s*\{[\s\S]*white-space:\s*normal/);
    assert.match(settingsCss, /--fv-advanced-module-height:\s*clamp\(/);
    assert.match(settingsCss, /h2\[data-fv-advanced="1"\] \+ \.backup-grid \.rules-panel[\s\S]*overflow-y:\s*auto/);
    assert.match(settingsCss, /\.fv-advanced-controls\s*\{[\s\S]*display:\s*inline-flex/);
    assert.match(settingsCss, /\.fv-advanced-controls\s*\{[\s\S]*width:\s*auto/);
    assert.match(settingsCss, /\.fv-advanced-compact\s*\{[\s\S]*width:\s*24px/);
    assert.match(settingsCss, /\.fv-advanced-compact\s*\{[\s\S]*font-size:\s*0/);
    assert.match(settingsCss, /\.fv-section-toggle\s*\{[\s\S]*width:\s*24px/);
    assert.match(settingsCss, /\.fv-section-toggle\s*\{[\s\S]*font-size:\s*0/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.fv-section-toggle,[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-settings-button-quiet-top\),\s*var\(--fvplus-settings-button-quiet-bottom\)\) !important;/);
    assert.match(settingsCss, /\.status-cell-content\s*\{/);
    assert.match(settingsCss, /\.folder-table table td\.status-cell\s*\{[\s\S]*text-align:\s*left/);
    assert.match(settingsCss, /\.folder-table table th\.fv-col-hidden,\s*[\s\S]*\.folder-table table td\.fv-col-hidden\s*\{[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /\.status-cell-content\s*\{[\s\S]*justify-content:\s*flex-start/);
    assert.match(settingsCss, /\.status-chip-list\s*\{/);
    assert.match(settingsCss, /\.status-chip-list\s*\{[\s\S]*justify-content:\s*flex-start/);
    assert.match(settingsCss, /\.status-chip-list\s*\{[\s\S]*flex-wrap:\s*nowrap/);
    assert.match(settingsCss, /\.status-breakdown-list\s*\{/);
    assert.match(settingsCss, /\.status-breakdown-chip\s*\{/);
    assert.match(settingsCss, /\.status-breakdown-btn\s*\{[\s\S]*width:\s*22px !important/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*\.status-breakdown-btn,[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-settings-button-quiet-top\),\s*var\(--fvplus-settings-button-quiet-bottom\)\) !important;/);
    assert.match(settingsJs, /class="status-cell"><span class="status-cell-content \$\{statusDisplayClass\}"><button type="button" class="status-breakdown-btn"[\s\S]*\$\{statusSummaryChipHtml\}\$\{statusBreakdownHtml\}\$\{statusTrendHtml\}/);
    assert.match(settingsCss, /\.folder-metric-chip\.is-danger\s*\{/);
    assert.match(settingsCss, /\.folder-metric-chip\s*\{/);
    assert.match(settingsCss, /\.folder-pin-state,\s*[\s\S]*\.folder-metric-chip\s*\{/);
    assert.match(settingsJs, /class="fv-settings-search-block"[\s\S]*class="fv-mode-toggle"/);
    assert.doesNotMatch(settingsCss, /\.fv-settings-search-block\s*\{[\s\S]*margin-right:\s*0\.35rem/);
    assert.doesNotMatch(settingsCss, /\.fv-settings-search-block\s*\{[\s\S]*border-right:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.08\)/);
    assert.match(settingsCss, /#fv-settings-topbar\s*\{[\s\S]*justify-content:\s*flex-start/);
    assert.match(settingsCss, /\.fv-settings-left\s*\{[\s\S]*margin-right:\s*auto/);
    assert.match(settingsCss, /\.fv-settings-right\s*\{[\s\S]*flex-wrap:\s*nowrap/);
    assert.match(settingsCss, /\.fv-settings-search-block\s*\{[\s\S]*flex:\s*0 0 auto/);
    assert.match(settingsCss, /\.fv-settings-search-block\s*\{[\s\S]*width:\s*clamp\(180px,\s*15vw,\s*220px\)/);
    assert.match(settingsCss, /\.fv-search-scope\s*\{[\s\S]*justify-self:\s*end/);
    assert.match(settingsCss, /\.fv-search-scope\s*\{[\s\S]*justify-content:\s*flex-end/);
    assert.match(settingsCss, /\.fv-search-scope\s*\{[\s\S]*width:\s*100%/);
    assert.match(settingsCss, /\.fv-search-scope\s*\{[\s\S]*margin-left:\s*auto/);
    assert.match(settingsCss, /\.fv-settings-right\s*\{[\s\S]*gap:\s*0\.4rem/);
    assert.doesNotMatch(settingsJs, /fv-settings-clear-search/);
    assert.match(settingsCss, /\.backup-compare-row\s*\{/);
    assert.match(settingsCss, /\.ui-dialog\.fv-backup-compare-modal #backup-compare-dialog/);
    assert.match(settingsCss, /\.module-empty-note\s*\{/);
    assert.match(settingsCss, /\.folder-table tbody tr\.fv-row-focus\s*\{/);
    assert.doesNotMatch(settingsJs, /await \$\.post\('\/plugins\/folderview\.plus\/server\//);
});
