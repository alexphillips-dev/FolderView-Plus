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
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const settingsWizardJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js'
);
const settingsImportJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js'
);
const folderCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css'
);
const folderJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const dockerJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
);
const vmJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const settingsWizardJs = fs.readFileSync(settingsWizardJsPath, 'utf8');
const settingsImportJs = fs.readFileSync(settingsImportJsPath, 'utf8');
const settingsRuntime = `${settingsJs}\n${settingsWizardJs}\n${settingsImportJs}`;
const folderCss = fs.readFileSync(folderCssPath, 'utf8');
const folderJs = fs.readFileSync(folderJsPath, 'utf8');
const dockerJs = fs.readFileSync(dockerJsPath, 'utf8');
const vmJs = fs.readFileSync(vmJsPath, 'utf8');

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
    assert.match(settingsPage, /id="fv-settings-action-bar"/);
    assert.match(settingsPage, /id="fv-runtime-resolved-panel"/);
    assert.match(settingsPage, /folderviewplus\.request\.js/);
    assert.match(settingsPage, /folderviewplus\.chrome\.js/);
    assert.match(settingsPage, /folderviewplus\.dirty\.js/);
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
    assert.match(settingsPage, /id="docker-col-rules"/);
    assert.match(settingsPage, /id="docker-col-last-changed"/);
    assert.match(settingsPage, /id="docker-col-pinned"/);
    assert.match(settingsPage, /id="docker-col-signals"/);
    assert.match(settingsPage, /id="docker-health-critical-threshold"/);
    assert.match(settingsPage, /id="docker-health-profile"/);
    assert.match(settingsPage, /id="docker-health-updates-mode"/);
    assert.match(settingsPage, /id="docker-health-all-stopped-mode"/);
    assert.match(settingsPage, /id="vm-col-status"/);
    assert.match(settingsPage, /id="vm-col-rules"/);
    assert.match(settingsPage, /id="vm-col-last-changed"/);
    assert.match(settingsPage, /id="vm-col-pinned"/);
    assert.match(settingsPage, /id="vm-col-autostart"/);
    assert.match(settingsPage, /id="vm-col-resources"/);
    assert.match(settingsPage, /id="vm-health-critical-threshold"/);
    assert.match(settingsPage, /id="vm-health-profile"/);
    assert.match(settingsPage, /id="vm-health-updates-mode"/);
    assert.match(settingsPage, /id="vm-health-all-stopped-mode"/);
    assert.match(settingsPage, /id="vm-resource-warn-vcpu"/);
    assert.match(settingsPage, /id="vm-resource-critical-vcpu"/);
    assert.match(settingsPage, /id="vm-resource-warn-gib"/);
    assert.match(settingsPage, /id="vm-resource-critical-gib"/);
    assert.match(settingsPage, /id="fv-first-run-panel"/);
});

test('mobile action bar and import progress keep compact viewport guards', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /#fv-settings-action-bar\s*\{[\s\S]*max-width:\s*calc\(100%\s*-\s*1rem\)/);
    assert.doesNotMatch(settingsCss, /#fv-settings-action-bar\s*\{[^}]*max-width:\s*calc\(100vw/);
    assert.match(settingsCss, /\.fv-save-dock\s*\{/);
    assert.match(settingsCss, /\.fv-save-dock-chip\s*\{/);
    assert.doesNotMatch(settingsCss, /\.fv-save-dock-handle\s*\{/);
    assert.match(settingsCss, /#fv-settings-action-bar\.is-hidden/);
    assert.match(settingsCss, /\.fv-action-buttons\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(settingsCss, /#import-apply-progress-dialog\s*\{[\s\S]*max-width:\s*min\([0-9]+px,\s*calc\(100vw\s*-\s*1\.5rem\)\)/);
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

test('folder tables avoid unnecessary horizontal scrollbar in basic view', () => {
    assert.match(settingsCss, /\.folder-table\s*\{[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.folder-table > \*\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*box-sizing:\s*border-box/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden/);
    assert.match(settingsCss, /\.folder-table \.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.folder-table \.table-wrap::-webkit-scrollbar\s*\{[\s\S]*display:\s*none/);
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
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*\.folder-overflow-btn[\s\S]*width:\s*20px/);
    assert.match(settingsCss, /@media \(max-width: 1100px\)[\s\S]*\.row-order-actions\s*\{[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(1\)[\s\S]*display:\s*none !important/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(2\)[\s\S]*width:\s*78%/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*th:nth-child\(10\)[\s\S]*width:\s*22%/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*\.folder-overflow-btn[\s\S]*width:\s*20px/);
    assert.match(settingsCss, /#fv-settings-root\.fv-mobile-compact[\s\S]*\.row-order-actions[\s\S]*display:\s*none !important/);
    assert.match(settingsJs, /class="folder-action-btn folder-overflow-btn"/);
    assert.match(settingsJs, /data-fv-overflow-type="\$\{escapeHtml\(type\)\}"/);
    assert.match(settingsJs, /data-fv-overflow-id="\$\{escapeHtml\(id\)\}"/);
    assert.match(settingsJs, /const overflowSelector = `\$\{tbodySelector\} \.folder-overflow-btn`;/);
    assert.match(settingsJs, /on\(`click\$\{namespace\}`, overflowSelector/);
    assert.match(settingsJs, /on\(`touchend\$\{namespace\}`, overflowSelector/);
    assert.match(settingsJs, /\$\('\.sweet-alert:visible'\)\.addClass\('fv-row-quick-actions-modal'\);/);
    assert.match(settingsJs, /const orderCellHtml = compactMobileLayout[\s\S]*\?\s*''/);
    assert.match(settingsJs, /const openFolderRowQuickActions = \(type, folderId, event = null\) =>/);
    assert.match(settingsJs, /window\.openFolderRowQuickActions = openFolderRowQuickActions;/);
    assert.match(settingsJs, /const renderFolderQuickActionSummaryHtml = \(summary\) =>/);
    assert.match(settingsJs, /const toggleVmRowDetailsDrawer = \(folderId\) =>/);
    assert.match(settingsJs, /data-fv-vm-drawer-action/);
    assert.match(settingsJs, /const runVmRowDrawerAction = async \(action, folderId\) =>/);
    assert.match(settingsCss, /\.fv-row-details-panel\s*\{/);
    assert.match(settingsCss, /\.fv-row-details-grid\s*\{/);
});

test('nested folder expansion avoids duplicate parent previews and keeps child-only reveal path', () => {
    assert.match(dockerJs, /const hasChildren = folderHasChildren\(id\);/);
    assert.match(dockerJs, /hideNestedDescendants\(id\);/);
    assert.match(dockerJs, /showDirectNestedChildren\(id,\s*\$childAnchor\);/);
    assert.match(dockerJs, /syncParentFolderVisualState\(id,\s*true\);/);
    assert.match(dockerJs, /syncParentFolderVisualState\(id,\s*false\);/);
    assert.match(dockerJs, /buildRuntimeContainerMapForFolder\(id,\s*false\)/);
    assert.match(dockerJs, /When expanded, keep parent-level containers visible but avoid duplicating descendants\./);
    assert.match(dockerJs, /\$folderRow\.after\(\$directMemberRows\);/);
    assert.match(dockerJs, /Expanded parent folder\. Showing direct members, then nested children\./);
    assert.match(dockerJs, /\.addClass\('fv-nested-hidden'\)\.hide\(\);/);
    assert.match(dockerJs, /webui:\s*ct\.info\.State\.WebUi \|\| ''/);
    assert.match(dockerJs, /shell:\s*ct\.info\.Shell \|\| '\/bin\/sh'/);
    assert.match(dockerJs, /openTerminal\('docker', containerName, shellValue\);/);
    assert.match(dockerJs, /openTerminal\('docker', containerName, '\.log'\);/);
    assert.match(dockerJs, /const nestedParentPreview = folderHasChildren\(id\);/);
    assert.match(dockerJs, /const allowWebuiQuickAction = nestedParentPreview \|\| quickActionPrefs\.preview_webui === true;/);
    assert.match(dockerJs, /const allowConsoleQuickAction = nestedParentPreview \|\| quickActionPrefs\.preview_console === true;/);
    assert.match(dockerJs, /const allowLogsQuickAction = nestedParentPreview \|\| quickActionPrefs\.preview_logs === true;/);
    assert.match(dockerJs, /if \(allowWebuiQuickAction && webuiUrl\)/);
    assert.match(dockerJs, /if \(allowConsoleQuickAction\)/);
    assert.match(dockerJs, /if \(allowLogsQuickAction\)/);
    assert.match(vmJs, /const parentId = normalizeFolderParentId\(source\[id\]\?\.parentId \|\| source\[id\]\?\.parent_id \|\| ''\);/);
});

test('folder editor keeps left-alignment runtime and stylesheet guards', () => {
    assert.match(folderJs, /const enforceLeftAlignedSettingsLayout = \(\) =>/);
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
    assert.match(folderJs, /const suggestDefaultsFromMembers = \(\) =>/);
    assert.match(folderJs, /const buildRegexSuggestionFromNames = \(names\) =>/);
    assert.match(folderJs, /const applyAdvancedMode = \(\) =>/);
    assert.match(folderJs, /const toggleAdvancedSectionCollapse = \(sectionKey\) =>/);
    assert.match(folderJs, /ComposeProject/);
    assert.match(folderJs, /UpdateAvailable/);
    assert.match(folderJs, /id="fvSuggestDefaults"/);
    assert.match(folderJs, /id="fvDockerSignals"/);
    assert.match(folderCss, /\.canvas form\.folder-editor-form\.fv-force-left-v3/);
    assert.match(folderCss, /Runtime-enforced left alignment guard/);
    assert.match(folderCss, /\.fv-editor-mode/);
    assert.match(folderCss, /\.fv-section-collapse/);
    assert.match(folderCss, /\.fv-docker-signals/);
    assert.match(folderCss, /\.fv-validation-details/);
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
    assert.doesNotMatch(settingsJs, /const ACTION_DOCK_SIDE_STORAGE_KEY = 'fv\.settings\.actionDockSide\.v1';/);
    assert.match(settingsJs, /const ACTION_DOCK_AUTOCOLLAPSE_MS = 5000;/);
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
    assert.match(settingsJs, /const setActionDockExpanded = \(expanded, \{ auto = false \} = \{\}\) =>/);
    assert.doesNotMatch(settingsJs, /const bindActionDockDrag = \(\) =>/);
    assert.doesNotMatch(settingsJs, /fv-save-dock-handle/);
    assert.match(settingsJs, /<div class="fv-save-dock-panel">[\s\S]*<div class="fv-save-dock-head">/);
    assert.match(settingsJs, /const getTrackedInputs = \(\) => \{/);
    assert.match(settingsJs, /dirtyTracker && typeof dirtyTracker\.getTrackedInputs === 'function'/);
    assert.match(settingsJs, /resolveAffectedFolderIdsFromOperations\(resolvedType, operations\)/);
    assert.match(settingsRuntime, /const SETUP_ASSISTANT_EXPERIENCE_MODES = new Set\(\['guided', 'expert'\]\);/);
    assert.match(settingsRuntime, /const SETUP_ASSISTANT_APPLY_SAFETY_MODES = new Set\(\['auto', 'strict', 'fast'\]\);/);
    assert.match(settingsRuntime, /const SETUP_ASSISTANT_ENV_PRESETS = \{/);
    assert.match(settingsRuntime, /const normalizeSetupAssistantExperienceMode = \(value\) =>/);
    assert.match(settingsRuntime, /const normalizeSetupAssistantSafetyMode = \(value\) =>/);
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
    assert.match(settingsJs, /runQuickSetupWizard = \(force = false\) => \{/);
    assert.match(settingsRuntime, /openSetupAssistant\(force === true\);/);
    assert.match(settingsRuntime, /const bindSetupAssistantEvents = \(\) =>/);
    assert.match(settingsRuntime, /markSetupAssistantCompletedLocal\(\);/);
    assert.match(settingsRuntime, /id="fv-setup-dry-run"/);
    assert.match(settingsRuntime, /id="fv-setup-copy-summary"/);
    assert.match(settingsRuntime, /id="fv-setup-discard-draft"/);
    assert.match(settingsRuntime, /id="fv-setup-skip-review"/);
    assert.match(settingsRuntime, /id="fv-setup-apply-detected"/);
    assert.match(settingsRuntime, /id="fv-setup-preset-save"/);
    assert.match(settingsRuntime, /id="fv-setup-preset-load"/);
    assert.match(settingsRuntime, /id="fv-setup-preset-delete"/);
    assert.match(settingsRuntime, /name="fv-setup-safety-mode"/);
    assert.match(settingsRuntime, /data-fv-setup-experience=/);
    assert.match(settingsRuntime, /data-fv-setup-quick-preset=/);
    assert.match(settingsRuntime, /Dry run only \(preview changes, do not modify folders or settings\)/);
    assert.match(settingsJs, /const shouldRunWizard = !isWizardCompletedServerSide\(\) && !isSetupAssistantCompletedLocal\(\);/);
    assert.match(settingsJs, /const apiPostJson = async \(url, data = \{\}, options = \{\}\) =>/);
    assert.match(settingsJs, /const topbarHtml = settingsChrome && typeof settingsChrome\.getTopbarHtml === 'function'/);
    assert.match(settingsJs, /const enforceNoHorizontalOverflow = \(\) =>/);
    assert.match(settingsJs, /const initOverflowGuard = \(\) =>/);
    assert.match(settingsJs, /window\.addEventListener\('resize', enforceNoHorizontalOverflow\)/);
    assert.match(settingsJs, /initOverflowGuard\(\);/);
    assert.match(settingsJs, /syncRuntimeConflictResolutionBanner\(\);/);
    assert.match(settingsJs, /window\.compareBackupSnapshots = compareBackupSnapshots;/);
    assert.match(settingsJs, /window\.copyFolderId = copyFolderId;/);
    assert.match(settingsJs, /window\.toggleDockerUpdatesFilter = toggleDockerUpdatesFilter;/);
    assert.match(settingsJs, /const evaluateDockerFolderHealth = \(folder, members, countsByState, updateCount, fallbackWarnThreshold\) =>/);
    assert.match(settingsJs, /const toggleHealthSeverityFilter = \(type = 'docker', severity = 'all'\) =>/);
    assert.match(settingsJs, /window\.toggleHealthSeverityFilter = toggleHealthSeverityFilter;/);
    assert.match(settingsJs, /toggleHealthSeverityFilter\('\$\{type\}','\$\{escapeHtml\(healthStatus\.filterSeverity\)\}'\)/);
    assert.match(settingsJs, /const showFolderHealthBreakdown = \(type, folderId\) =>/);
    assert.match(settingsJs, /window\.showFolderHealthBreakdown = showFolderHealthBreakdown;/);
    assert.match(settingsJs, /class="health-breakdown-btn"/);
    assert.match(settingsJs, /const compactHoverLabel = 'Compact tab';/);
    assert.match(settingsJs, /id="fv-advanced-compact" class="fv-advanced-compact" title="\$\{escapeHtml\(compactHoverLabel\)\}" aria-label="\$\{escapeHtml\(compactLabel\)\}"/);
    assert.match(settingsJs, /const folderMatchesStatusFilter = \(statusFilterMode, countsByState, totalMembers\) =>/);
    assert.match(settingsJs, /const applyColumnVisibility = \(type\) =>/);
    assert.match(settingsJs, /const TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE = Object\.freeze\(/);
    assert.match(settingsJs, /columnWidths:\s*\{\s*docker:\s*\{\s*\.\.\.\(columnWidthsByType\.docker/);
    assert.match(settingsJs, /columnWidthsByType\[resolvedType\] = normalizeColumnWidthsForType\(resolvedType, sourceColumnWidths\[resolvedType\]\);/);
    assert.match(settingsJs, /const applyColumnWidths = \(type\) =>/);
    assert.match(settingsJs, /const bindTableColumnResizers = \(type\) =>/);
    assert.match(settingsJs, /const renderColumnVisibilityControls = \(type\) =>/);
    assert.match(settingsJs, /const changeColumnVisibility = \(type, key, checked\) =>/);
    assert.match(settingsJs, /window\.changeColumnVisibility = changeColumnVisibility;/);
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
    assert.match(settingsJs, /const ensureAdvancedDataLoaded = async \(\{ force = false \} = \{\}\) =>/);
    assert.match(settingsJs, /const refreshCoreData = async \(\) =>/);
    assert.match(settingsJs, /if \(settingsUiState\.mode === 'advanced'\) \{\s*await refreshAll\(\);\s*\} else \{\s*await refreshCoreData\(\);\s*\}/);
    assert.match(settingsCss, /\.folder-action-btn\s*\{/);
    assert.match(settingsCss, /\.fv-col-resizer/);
    assert.match(settingsCss, /body\.fv-column-resize-active/);
    assert.match(settingsCss, /\.fv-runtime-resolved-panel\s*\{/);
    assert.match(settingsCss, /\.fv-runtime-resolved-actions\s*\{/);
    assert.match(settingsCss, /\.updates-chip\s*\{/);
    assert.match(settingsCss, /\.health-chip\s*\{/);
    assert.match(settingsCss, /\.folder-metric-chip\.is-maintenance\s*\{/);
    assert.match(settingsCss, /\.health-breakdown-btn\s*\{/);
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
    assert.match(settingsCss, /\.fv-advanced-compact i\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-overlay\s*\{/);
    assert.match(settingsCss, /#fv-setup-assistant-dialog\s*\{/);
    assert.match(settingsCss, /\.fv-setup-assistant-shell\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-list\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-jump\s*\{[\s\S]*grid-template-columns:\s*21px minmax\(0,\s*1fr\) auto/);
    assert.match(settingsCss, /\.fv-setup-step-state\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-state\.is-pending\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-delta\s*\{/);
    assert.match(settingsCss, /\.fv-setup-nav-note\s*\{/);
    assert.match(settingsCss, /\.fv-setup-safety-grid\s*\{/);
    assert.match(settingsCss, /\.fv-setup-detected-row\s*\{/);
    assert.match(settingsCss, /\.fv-setup-progress-track > span\s*\{/);
    assert.match(settingsCss, /\.fv-setup-draft-banner\s*\{/);
    assert.match(settingsCss, /\.fv-setup-validation-box\s*\{/);
    assert.match(settingsCss, /\.fv-setup-impact-grid\s*\{/);
    assert.match(settingsCss, /\.fv-setup-env-grid\s*\{/);
    assert.match(settingsCss, /\.fv-setup-step-jump\s*\{/);
    assert.match(settingsCss, /\.fv-setup-quick-preset-grid\s*\{/);
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
    assert.match(settingsCss, /\.fv-advanced-compact\s*\{[\s\S]*width:\s*28px/);
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
    assert.match(settingsJs, /class="status-cell"><span class="status-cell-content \$\{statusDisplayClass\}"><button type="button" class="status-breakdown-btn"[\s\S]*\$\{statusSummaryChipHtml\}\$\{statusBreakdownHtml\}\$\{statusTrendHtml\}/);
    assert.match(settingsCss, /\.folder-metric-chip\.is-danger\s*\{/);
    assert.match(settingsCss, /\.folder-metric-chip\s*\{/);
    assert.match(settingsCss, /\.folder-pin-state,\s*[\s\S]*\.folder-metric-chip\s*\{/);
    assert.match(settingsCss, /\.backup-compare-row\s*\{/);
    assert.match(settingsCss, /\.ui-dialog\.fv-backup-compare-modal #backup-compare-dialog/);
    assert.match(settingsCss, /\.module-empty-note\s*\{/);
    assert.match(settingsCss, /\.folder-table tbody tr\.fv-row-focus\s*\{/);
    assert.doesNotMatch(settingsJs, /await \$\.post\('\/plugins\/folderview\.plus\/server\//);
});
