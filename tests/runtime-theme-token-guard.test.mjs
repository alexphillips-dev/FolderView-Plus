import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');
const dashboardCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css');
const runtimeSharedCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const diagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const sharedRuntimeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const themeResolverJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js');
const dashboardPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page');

test('runtime css defines canonical fvplus status tokens and legacy graph aliases', () => {
    assert.match(dockerCss, /--fvplus-theme-foreground:\s*var\(--fvplus-runtime-theme-foreground,\s*var\(--text,\s*currentColor\)\)/);
    assert.match(dockerCss, /--fvplus-status-started:\s*var\(--fvplus-runtime-status-started,\s*var\(--fvplus-theme-foreground\)\)/);
    assert.match(dockerCss, /--fvplus-status-paused:\s*var\(--fvplus-runtime-status-paused,\s*#b8860b\)/);
    assert.match(dockerCss, /--fvplus-status-stopped:\s*var\(--fvplus-runtime-status-stopped,\s*#ff4d4d\)/);
    assert.match(dockerCss, /--fvplus-graph-cpu:\s*var\(--folder-view3-graph-cpu,\s*#2b8da3\)/);
    assert.match(dockerCss, /--fvplus-graph-mem:\s*var\(--folder-view3-graph-mem,\s*#5d6db6\)/);
    assert.match(vmCss, /--fvplus-theme-foreground:\s*var\(--fvplus-runtime-theme-foreground,\s*var\(--text,\s*currentColor\)\)/);
    assert.match(vmCss, /--fvplus-status-started:\s*var\(--fvplus-runtime-status-started,\s*var\(--fvplus-theme-foreground\)\)/);
    assert.match(dashboardCss, /--fvplus-status-started:\s*var\(--fvplus-runtime-status-started,\s*var\(--fvplus-theme-foreground\)\)/);
});

test('status state classes resolve through css variables instead of hardcoded runtime values', () => {
    assert.match(dockerCss, /span\.folder-state\.fv-folder-state-started\s*\{[\s\S]*var\(--fvplus-folder-status-started,\s*var\(--fvplus-status-started\)\)/);
    assert.match(dockerCss, /i\.folder-load-status\.started\s*\{[\s\S]*var\(--fvplus-folder-status-started,\s*var\(--fvplus-status-started\)\)/);
    assert.match(vmCss, /span\.folder-state\.fv-folder-state-started\s*\{[\s\S]*var\(--fvplus-folder-status-started,\s*var\(--fvplus-status-started\)\)/);
    assert.match(vmCss, /i\.folder-load-status\.started\s*\{[\s\S]*var\(--fvplus-folder-status-started,\s*var\(--fvplus-status-started\)\)/);
});

test('dashboard quick action palette is tokenized', () => {
    assert.match(dashboardCss, /--fvplus-dashboard-quick-action-border/);
    assert.match(dashboardCss, /--fvplus-dashboard-quick-action-bg-top/);
    assert.match(dashboardCss, /--fvplus-dashboard-quick-action-shadow/);
    assert.match(dashboardCss, /--fvplus-dashboard-accent/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*var\(--fvplus-dashboard-quick-action-bg-top\),\s*var\(--fvplus-dashboard-quick-action-bg-bottom\)\) !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*box-shadow:\s*var\(--fvplus-dashboard-quick-action-shadow\) !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*border-radius:\s*5px/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action:hover[\s\S]*var\(--fvplus-dashboard-accent\)/);
    assert.match(settingsCss, /--fvplus-settings-surface-muted/);
    assert.match(settingsCss, /--fvplus-settings-accent/);
    assert.match(settingsCss, /--fvplus-settings-button-bg-top/);
    assert.match(settingsCss, /--fvplus-settings-button-accent-top/);
    assert.match(settingsCss, /#fv-settings-root :is\([\s\S]*border-radius:\s*8px !important/);
});

test('runtime context menus follow resolved dark and light theme tokens', () => {
    assert.match(runtimeSharedCss, /--fvplus-runtime-menu-bg:\s*rgba\(22,\s*20,\s*18,\s*0\.985\)/);
    assert.match(runtimeSharedCss, /body\[data-fv-theme-class="light"\]\s*\{[\s\S]*--fvplus-runtime-menu-bg:\s*rgba\(248,\s*249,\s*251,\s*0\.985\)/);
    assert.match(runtimeSharedCss, /body ul\.context-menu-list,[\s\S]*body ul\.dropdown-menu \{/);
    assert.match(runtimeSharedCss, /background:\s*var\(--fvplus-runtime-menu-bg\) !important;/);
    assert.match(runtimeSharedCss, /border:\s*1px solid var\(--fvplus-runtime-menu-border\) !important;/);
    assert.match(runtimeSharedCss, /overflow:\s*visible !important;/);
    assert.match(runtimeSharedCss, /body ul\.context-menu-list > li\.divider,[\s\S]*context-menu-separator/);
    assert.match(runtimeSharedCss, /body ul\.context-menu-list \.dropdown-header,[\s\S]*var\(--fvplus-runtime-menu-header-bg\)/);
    assert.match(dashboardPage, /runtime\.shared\.css/);
});

test('runtime scripts avoid inline status color painting and use row-level css variable overrides', () => {
    assert.match(sharedRuntimeJs, /const FOLDER_STATUS_COLOR_STYLE_PROPS = Object\.freeze/);
    assert.match(sharedRuntimeJs, /const applyFolderStatusColorOverrides = \(\$folderRow, settings\) =>/);
    assert.match(dockerJs, /applyFolderStatusColorOverrides\(\$folderRow,\s*folder\.settings\)/);
    assert.match(vmJs, /const applyFolderStatusColorOverrides = typeof runtimeShared\.applyFolderStatusColorOverrides === 'function'/);
    assert.match(vmJs, /applyFolderStatusColorOverrides\(\$folderRow,\s*folder\.settings\)/);
    assert.doesNotMatch(dockerJs, /\.css\('color',\s*statusColors\./);
    assert.doesNotMatch(vmJs, /\.css\('color',\s*statusColors\./);
});

test('theme-change observers trigger deterministic reflow across runtime and settings surfaces', () => {
    assert.match(dockerJs, /const dockerRuntimeThemeReflowController = runtimeStateObserverModule && typeof runtimeStateObserverModule\.createThemeReflowController === 'function'/);
    assert.match(dockerJs, /const bindDockerRuntimeThemeReflow/);
    assert.match(dockerJs, /const applyDockerThemeResolverTokens = \(reason = 'docker-runtime:initial', options = \{\}\) =>/);
    assert.match(vmJs, /const queueVmRuntimeThemeReflow/);
    assert.match(vmJs, /const bindVmRuntimeThemeReflow/);
    assert.match(vmJs, /const applyVmThemeResolverTokens = \(reason = 'vm-runtime:initial', options = \{\}\) =>/);
    assert.match(dashboardJs, /const queueDashboardThemeReflow/);
    assert.match(dashboardJs, /const bindDashboardThemeReflowHandlers/);
    assert.match(settingsJs, /const queueSettingsThemeAwareReflow/);
    assert.match(settingsJs, /const initThemeAwareSettingsReflow/);
    assert.match(settingsJs, /const resolveThemeCompatibilityMode = \(value\) =>/);
    assert.match(settingsJs, /const buildThemeResolverSnapshot = \(modeInput = null, options = \{\}\) =>/);
    assert.match(settingsJs, /const applyThemeResolverTokens = \(reason = 'runtime', options = \{\}\) =>/);
    assert.match(settingsJs, /const configureThemeResolverRuntimeApi = \(options = \{\}\) =>/);
    assert.match(themeResolverJs, /window\.FolderViewPlusThemeResolver = Object\.freeze\(\{/);
    assert.match(themeResolverJs, /buildResolvedThemeSnapshot,/);
    assert.match(themeResolverJs, /applyResolvedThemeTokens,/);
    assert.match(themeResolverJs, /bindThemeAwareSurface/);
    assert.match(themeResolverJs, /window\.FolderViewPlusThemeResolverModuleLoaded = true;/);
    assert.match(diagnosticsJs, /const applyDiagnosticsThemeTokens = \(reason = 'runtime', options = \{\}\) =>/);
    assert.match(diagnosticsJs, /const buildDiagnosticsThemeSnapshot = \(modeInput = null, options = \{\}\) =>/);
    assert.match(diagnosticsJs, /const runThemeSelfHeal = async \(\) =>/);
});

test('theme resolver keeps folder editor outlines aligned to accent borders', () => {
    assert.match(themeResolverJs, /const editorOutline = themeRgbaToCss\(palette\.accent,\s*isLight \? 0\.24 : 0\.22\);/);
    assert.match(themeResolverJs, /const editorOutlineStrong = themeRgbaToCss\(palette\.accent,\s*isLight \? 0\.44 : 0\.5\);/);
    assert.match(themeResolverJs, /editorBorder:\s*editorOutline,/);
    assert.match(themeResolverJs, /editorBorderStrong:\s*editorOutlineStrong,/);
    assert.match(themeResolverJs, /editorHeroIconBorder:\s*editorOutline,/);
    assert.match(themeResolverJs, /editorControlBorder:\s*editorOutline,/);
});

test('theme resolver exports settings semantic tokens for readable light and dark surfaces', () => {
    assert.match(themeResolverJs, /const buildSettingsSemanticTokenStrings = \(classification\) =>/);
    assert.match(themeResolverJs, /settingsTreeGuide:\s*isLight \? 'rgba\(129, 140, 154, 0\.48\)' : 'rgba\(173, 178, 192, 0\.55\)'/);
    assert.match(themeResolverJs, /settingsBreadcrumbText:\s*isLight \? 'rgba\(89, 103, 120, 0\.86\)' : 'rgba\(180, 197, 221, 0\.88\)'/);
    assert.match(themeResolverJs, /settingsChipEmpty:\s*isLight \? '#667385' : 'rgba\(240, 240, 240, 0\.86\)'/);
    assert.match(themeResolverJs, /buildThemeTokenMap[\s\S]*buildSettingsSemanticTokenStrings\(snapshot\.classification\)/);
    assert.match(themeResolverJs, /'--fvplus-settings-tree-guide':\s*tokens\.settingsTreeGuide \|\| ''/);
    assert.match(themeResolverJs, /'--fvplus-settings-breadcrumb-text':\s*tokens\.settingsBreadcrumbText \|\| ''/);
    assert.match(themeResolverJs, /'--fvplus-settings-chip-empty':\s*tokens\.settingsChipEmpty \|\| ''/);
    assert.match(themeResolverJs, /'--fvplus-settings-chip-empty-bg':\s*tokens\.settingsChipEmptyBg \|\| ''/);
});

test('theme resolver ignores transparent surfaces and only hard-forces explicit black host themes dark', () => {
    assert.match(themeResolverJs, /const isThemeSurfaceColorUsable = \(color, minAlpha = 0\.08\) =>/);
    assert.match(themeResolverJs, /const resolveThemeSurfaceColor = \(\.\.\.candidates\) =>/);
    assert.match(themeResolverJs, /const rootBackground = resolveThemeSurfaceColor\(\s*parseThemeColorToRgba\(rootStyle\?\.backgroundColor\),\s*parseThemeColorToRgba\(bodyStyle\?\.backgroundColor\),\s*parseThemeColorToRgba\(htmlStyle\?\.backgroundColor\),\s*parseThemeColorToRgba\('#0f1825'\)\s*\)/);
    assert.match(themeResolverJs, /if \(normalized\.includes\('black'\)\) \{/);
    assert.doesNotMatch(themeResolverJs, /normalized\.includes\('azure'\)/);
    assert.doesNotMatch(themeResolverJs, /normalized\.includes\('gray'\)/);
    assert.doesNotMatch(themeResolverJs, /normalized\.includes\('grey'\)/);
});
