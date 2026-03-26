import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');
const dashboardCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const diagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const sharedRuntimeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const themeResolverJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js');

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
    assert.match(dashboardCss, /--fvplus-dashboard-accent/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action\s*\{[\s\S]*background:\s*transparent !important/);
    assert.match(dashboardCss, /\.fv-dashboard-quick-action:hover[\s\S]*var\(--fvplus-dashboard-accent\)/);
    assert.match(settingsCss, /--fvplus-settings-surface-muted/);
    assert.match(settingsCss, /--fvplus-settings-accent/);
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
    assert.match(dockerJs, /const queueDockerRuntimeThemeReflow/);
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
