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
    assert.match(dashboardCss, /\.fv-dashboard-quick-action:hover[\s\S]*var\(--fvplus-dashboard-accent\)/);
    assert.match(settingsCss, /--fvplus-settings-surface-muted/);
    assert.match(settingsCss, /--fvplus-settings-accent/);
});

test('runtime scripts avoid inline status color painting and use row-level css variable overrides', () => {
    assert.match(dockerJs, /const FOLDER_STATUS_COLOR_STYLE_PROPS = Object\.freeze/);
    assert.match(dockerJs, /applyFolderStatusColorOverrides\(\$folderRow,\s*folder\.settings\)/);
    assert.match(vmJs, /const FOLDER_STATUS_COLOR_STYLE_PROPS = Object\.freeze/);
    assert.match(vmJs, /applyFolderStatusColorOverrides\(\$folderRow,\s*folder\.settings\)/);
    assert.doesNotMatch(dockerJs, /\.css\('color',\s*statusColors\./);
    assert.doesNotMatch(vmJs, /\.css\('color',\s*statusColors\./);
});

test('theme-change observers trigger deterministic reflow across runtime and settings surfaces', () => {
    assert.match(dockerJs, /const queueDockerRuntimeThemeReflow/);
    assert.match(dockerJs, /const bindDockerRuntimeThemeReflow/);
    assert.match(vmJs, /const queueVmRuntimeThemeReflow/);
    assert.match(vmJs, /const bindVmRuntimeThemeReflow/);
    assert.match(dashboardJs, /const queueDashboardThemeReflow/);
    assert.match(dashboardJs, /const bindDashboardThemeReflowHandlers/);
    assert.match(settingsJs, /const queueSettingsThemeAwareReflow/);
    assert.match(settingsJs, /const initThemeAwareSettingsReflow/);
    assert.match(settingsJs, /const buildResolvedThemeSnapshot = \(modeInput = null\) =>/);
    assert.match(settingsJs, /const applyResolvedThemeTokens = \(reason = 'runtime'\) =>/);
    assert.match(settingsJs, /const runThemeSelfHeal = async \(\) =>/);
});
