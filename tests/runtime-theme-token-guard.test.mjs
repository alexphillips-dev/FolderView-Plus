import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');
const dashboardCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/dashboard.css');
const runtimeSharedCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css');
const cspUtilitiesCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/csp.utilities.css');
const themeTokensCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/theme.tokens.css');
const folderCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css');
const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const dockerColumnControllerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.column-controller.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const dashboardJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js');
const dockerRuntimeActionsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');
const fatalBannerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.fatal-banner.js');
const settingsCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');
const settingsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const diagnosticsJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js');
const sharedRuntimeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const themeResolverJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js');
const themeSurfaceJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-surface.js');
const themeSurfaceModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.theme-surface.js'
));
const dashboardPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page');
const libPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

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
    assert.match(themeTokensCss, /--fvplus-graphite-page:\s*#0f0f10/);
    assert.match(themeTokensCss, /--fvplus-graphite-card:\s*#1d1d1f/);
    assert.match(themeTokensCss, /--fvplus-graphite-field:\s*#1a1a1b/);
    assert.match(themeTokensCss, /--fvplus-graphite-field-bg:/);
    assert.match(themeTokensCss, /--fvplus-ui-page:\s*var\(--fvplus-graphite-page\)/);
    assert.match(themeTokensCss, /--fvplus-ui-card:\s*var\(--fvplus-graphite-card-bg\)/);
    assert.match(themeTokensCss, /--fvplus-ui-field:\s*var\(--fvplus-graphite-field-bg\)/);
    assert.match(themeTokensCss, /--fvplus-theme-accent:\s*var\(--fvplus-ui-accent\)/);
    assert.match(themeTokensCss, /--fvplus-editor-bg:\s*var\(--fvplus-ui-page\)/);
    assert.match(themeTokensCss, /--fvplus-editor-inset-surface:\s*var\(--fvplus-ui-field\)/);
    assert.match(runtimeSharedCss, /--fvplus-runtime-menu-bg:\s*var\(--fvplus-graphite-menu-bg,\s*rgba\(18,\s*18,\s*19,\s*0\.985\)\)/);
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
    assert.match(dashboardJs, /const resolveDashboardFolderStatusColors = \(settings\) => \{/);
    assert.match(dashboardJs, /started:\s*'var\(--fvplus-folder-status-started,\s*var\(--fvplus-status-started,\s*var\(--fvplus-theme-foreground,\s*currentColor\)\)\)'/);
    assert.match(dashboardJs, /const statusColors = resolveDashboardFolderStatusColors\(folder\.settings\);/);
});

test('theme-change observers trigger deterministic reflow across runtime and settings surfaces', () => {
    assert.match(dockerColumnControllerJs, /const dockerRuntimeThemeReflowController = runtimeStateObserverModule && typeof runtimeStateObserverModule\.createThemeReflowController === 'function'/);
    assert.match(dockerColumnControllerJs, /const bindDockerRuntimeThemeReflow/);
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
    assert.match(themeResolverJs, /'--fvplus-status-started':\s*tokens\.statusStarted \|\| ''/);
    assert.match(themeResolverJs, /'--fvplus-folder-status-started':\s*tokens\.statusStarted \|\| ''/);
    assert.match(themeResolverJs, /'--fvplus-editor-title-accent':\s*tokens\.editorTitleAccent \|\| ''/);
    assert.match(themeResolverJs, /window\.FolderViewPlusThemeResolverModuleLoaded = true;/);
    assert.match(diagnosticsJs, /const applyDiagnosticsThemeTokens = \(reason = 'runtime', options = \{\}\) =>/);
    assert.match(diagnosticsJs, /const buildDiagnosticsThemeSnapshot = \(modeInput = null, options = \{\}\) =>/);
    assert.match(diagnosticsJs, /const resolveThemeDiagnosticStatusToken = \(tokens, statusName = 'started'\) =>/);
    assert.match(diagnosticsJs, /const resolverSnapshot = applyDiagnosticsThemeTokens\('diagnostics'\);[\s\S]*?const html = document\.documentElement;/);
    assert.match(diagnosticsJs, /const startedStatusToken = resolveThemeDiagnosticStatusToken\(htmlTokens, 'started'\);/);
    assert.match(diagnosticsJs, /const stoppedStatusToken = resolveThemeDiagnosticStatusToken\(htmlTokens, 'stopped'\);/);
    assert.doesNotMatch(diagnosticsJs, /Missing --fvplus-status-started token value on document root\./);
    assert.match(diagnosticsJs, /const runThemeSelfHeal = async \(\) =>/);
});

test('theme token application skips identical inline values to prevent observer feedback loops', () => {
    assert.match(themeResolverJs, /target\.style\.getPropertyValue\(token\) !== normalizedValue/);
    assert.match(themeResolverJs, /target\.getAttribute\('data-fv-theme-mode'\) !== appliedMode/);
    assert.match(themeResolverJs, /target\.style\.colorScheme !== colorScheme/);
});

test('theme resolver keeps folder editor outlines aligned to accent borders', () => {
    assert.match(themeResolverJs, /const editorOutline = themeRgbaToCss\(palette\.accent,\s*isLight \? 0\.24 : 0\.22\);/);
    assert.match(themeResolverJs, /const editorOutlineStrong = themeRgbaToCss\(palette\.accent,\s*isLight \? 0\.44 : 0\.5\);/);
    assert.match(themeResolverJs, /editorBorder:\s*editorOutline,/);
    assert.match(themeResolverJs, /editorBorderStrong:\s*editorOutlineStrong,/);
    assert.match(themeResolverJs, /editorHeroIconBorder:\s*editorOutline,/);
    assert.match(themeResolverJs, /editorControlBorder:\s*editorOutline,/);
    assert.match(themeResolverJs, /editorTitleAccent:\s*themeRgbaToCss\(palette\.accent\),/);
    assert.match(themeResolverJs, /editorBg:\s*isLight[\s\S]*:\s*'#0f0f10'/);
    assert.match(themeResolverJs, /editorPanel:\s*isLight[\s\S]*:\s*'#1d1d1f'/);
    assert.match(themeResolverJs, /editorHeroIconBg:\s*isLight[\s\S]*:\s*'#242426'/);
});

test('theme resolver heals unusable host accents and fully manages folder editor theme bindings', () => {
    assert.match(themeResolverJs, /accent:\s*3\.0,/);
    assert.match(themeResolverJs, /const accentResolution = resolveThemeStatusColor\(/);
    assert.match(themeResolverJs, /adjustments\.push\('Host accent color was auto-healed to preserve contrast\.'\)/);
    assert.match(themeResolverJs, /tokens: buildThemeTokenMap\(\{ classification \}, selectedPalette\),\s*adjustments,\s*warnings/);
    assert.match(diagnosticsJs, /const status = warnings\.length > 0 \? 'warning' : 'healthy';/);
    assert.match(diagnosticsJs, /technicalDetails: \[\.\.\.warnings, \.\.\.adjustments\]/);
    assert.match(diagnosticsJs, /const needsHeal = contrastFailures\.length > 0 \|\| statusFailures\.length > 0;/);
    assert.doesNotMatch(diagnosticsJs, /const needsHeal =[^;]*autoHealed/);
    assert.match(themeResolverJs, /const classification = detectedClassification === 'mixed'/);
    assert.match(themeResolverJs, /themeSurfaceModule\.createBinding\(\{ \.\.\.options, applyResolvedThemeTokens \}\)/);
    assert.match(themeSurfaceJs, /const sampleRoot = options\.sampleRoot \?\? null;/);
    assert.match(themeSurfaceJs, /sampleRoot,[\s\S]*extraTargets,[\s\S]*modeInput,/);
    assert.match(themeSurfaceJs, /'data-fv-host-theme',[\s\S]*'data-fvplus-host-theme'/);
    assert.match(themeSurfaceJs, /media\.removeEventListener\('change', mediaListener\)/);
    assert.match(themeSurfaceJs, /media\.removeListener\(mediaListener\)/);
    assert.match(folderJs, /folderThemeSurfaceBinding\?\.disconnect\(\);/);
    assert.match(folderCss, /#fvEditorChrome\s*\{[\s\S]*background:\s*var\(--fv-editor-panel\);/);
});

test('theme surface forwards editor targets and removes observers and media listeners on teardown', () => {
    const applied = [];
    const observed = [];
    const mediaEvents = [];
    let observerDisconnected = false;
    let observerCallback = null;
    const media = {
        addEventListener(name, handler) { mediaEvents.push(['add', name, handler]); },
        removeEventListener(name, handler) { mediaEvents.push(['remove', name, handler]); }
    };
    class Observer {
        constructor(callback) { observerCallback = callback; }
        observe(target, options) { observed.push({ target, options }); }
        disconnect() { observerDisconnected = true; }
    }
    const document = { documentElement: { id: 'html' }, body: { id: 'body' } };
    const window = {
        document,
        MutationObserver: Observer,
        matchMedia: () => media,
        setTimeout(handler) { handler(); return 1; },
        clearTimeout() {}
    };
    const binding = themeSurfaceModule.createBinding({
        window,
        document,
        root: '.editor',
        sampleRoot: 'body',
        extraTargets: ['#chrome'],
        applyResolvedThemeTokens: (reason, options) => {
            applied.push({ reason, options });
            return { classification: 'dark' };
        }
    });

    binding.bind();
    observerCallback([{ type: 'attributes', attributeName: 'data-color-scheme' }]);
    binding.disconnect();

    assert.equal(applied[0].options.sampleRoot, 'body');
    assert.deepEqual(applied[0].options.extraTargets, ['#chrome']);
    assert.equal(applied.at(-1).reason, 'surface:observer');
    assert.equal(observed.length, 2);
    assert.equal(observerDisconnected, true);
    assert.equal(mediaEvents[0][0], 'add');
    assert.equal(mediaEvents.at(-1)[0], 'remove');
    assert.equal(mediaEvents[0][2], mediaEvents.at(-1)[2]);
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
    assert.match(themeResolverJs, /const rootBackground = resolveThemeSurfaceColor\(\s*parseThemeColorToRgba\(rootStyle\?\.backgroundColor\),\s*parseThemeColorToRgba\(bodyStyle\?\.backgroundColor\),\s*parseThemeColorToRgba\(htmlStyle\?\.backgroundColor\),\s*parseThemeColorToRgba\('#0f0f10'\)\s*\)/);
    assert.match(themeResolverJs, /if \(normalized\.includes\('black'\)\) \{/);
    assert.doesNotMatch(themeResolverJs, /normalized\.includes\('azure'\)/);
    assert.doesNotMatch(themeResolverJs, /normalized\.includes\('gray'\)/);
    assert.doesNotMatch(themeResolverJs, /normalized\.includes\('grey'\)/);
});

test('runtime and settings overlays resolve through theme tokens instead of hardcoded dark chrome', () => {
    assert.match(dockerCss, /\.fv-preview-status-started\s*\{[^}]*var\(--fvplus-folder-status-started,\s*var\(--fvplus-status-started\)\)/);
    assert.match(dockerCss, /\.fv-preview-status-paused\s*\{[^}]*var\(--fvplus-folder-status-paused,\s*var\(--fvplus-status-paused\)\)/);
    assert.match(dockerCss, /\.fv-preview-status-stopped\s*\{[^}]*var\(--fvplus-folder-status-stopped,\s*var\(--fvplus-status-stopped\)\)/);
    assert.match(cspUtilitiesCss, /\.fv-popup-guide\s*\{[^}]*color:\s*var\(--fvplus-runtime-menu-fg,\s*var\(--fvplus-theme-foreground,\s*currentColor\)\)/);
    assert.match(cspUtilitiesCss, /\.fv-popup-panel\s*\{[^}]*background:\s*var\(--fvplus-runtime-menu-header-bg,\s*transparent\)/);
    assert.doesNotMatch(dockerRuntimeActionsJs, /color:\s*#e8edf7/);
    assert.match(dockerColumnControllerJs, /panel\.style\.background = 'var\(--fvplus-runtime-menu-bg,\s*var\(--fvplus-theme-surface-panel,\s*transparent\)\)'/);
    assert.match(dockerColumnControllerJs, /panel\.style\.color = 'var\(--fvplus-runtime-menu-fg,\s*var\(--fvplus-theme-foreground,\s*currentColor\)\)'/);
    assert.match(fatalBannerJs, /border:\s*1px solid var\(--orange,\s*var\(--fvplus-theme-accent,\s*currentColor\)\);/);
    assert.match(fatalBannerJs, /background:\s*var\(--fvplus-theme-surface-panel,\s*transparent\);/);
    assert.match(fatalBannerJs, /color:\s*var\(--fvplus-theme-text-primary,\s*currentColor\);/);
    assert.match(runtimeSharedCss, /\.fv-runtime-conflict-banner\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--text,\s*currentColor\);/);
    assert.doesNotMatch(libPhp, /background:linear-gradient\(180deg,\s*rgba\(120,60,0,0\.22\)/);
    assert.match(folderCss, /\.fv-folder-action-dialog\.ui-dialog\s*\{[^}]*background:\s*var\(--fvplus-editor-bg,\s*var\(--fvplus-theme-surface-panel,\s*transparent\)\);/);
    assert.match(folderCss, /\.fv-folder-action-dialog \.ui-dialog-content\s*\{[^}]*color:\s*var\(--fvplus-editor-text-primary,\s*var\(--fvplus-theme-text-primary,\s*currentColor\)\);/);
    assert.match(folderCss, /\.fv-action-dialog-field > span:first-child,[\s\S]*?\.fv-action-target-label > span\s*\{[^}]*color:\s*var\(--fv-editor-title-accent\);/);
});

test('settings semantic chips and light-mode overrides use exported settings tokens', () => {
    assert.match(settingsCss, /--fvplus-settings-safe-surface-card:\s*var\(--fvplus-ui-card,\s*var\(--fvplus-theme-surface-card,\s*var\(--fvplus-graphite-card-bg/);
    assert.match(settingsCss, /--fvplus-settings-safe-surface-field:\s*var\(--fvplus-ui-field,\s*var\(--fvplus-graphite-field-bg/);
    assert.match(settingsCss, /\.fv-advanced-nav\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-card\);/);
    assert.match(settingsCss, /\.fv-activity-feed-panel\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-card\);/);
    assert.match(settingsCss, /\.settings-mini-card\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-card\);/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-card\);/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.name-cell-breadcrumb\s*\{[^}]*var\(--fvplus-settings-breadcrumb-text\)/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.name-cell-members-meta\s*\{[^}]*var\(--fvplus-settings-members-meta-text\)/);
    assert.match(settingsCss, /#fv-settings-root\[data-fv-theme-class="light"\] \.name-cell-nested-meta\s*\{[^}]*var\(--fvplus-settings-nested-meta-text\)/);
    assert.match(settingsCss, /\.folder-pin-state\.is-pinned\s*\{[^}]*var\(--fvplus-settings-chip-warning-border\)[^}]*var\(--fvplus-settings-chip-warning\)/);
    assert.match(settingsCss, /#import-preview-dialog \.preview-meta-item,\s*#backup-compare-dialog \.preview-meta-item\s*\{[^}]*background:\s*var\(--fvplus-settings-surface-muted\);/);
    assert.match(settingsCss, /\.fv-update-notes-category\.is-ui\s*\{[^}]*var\(--fvplus-settings-chip-warning-border\)[^}]*var\(--fvplus-settings-chip-warning\)[^}]*var\(--fvplus-settings-chip-warning-bg\)/);
    assert.match(settingsCss, /\.fv-section-badge\.is-ok\s*\{[^}]*var\(--fvplus-settings-chip-success-border\)[^}]*var\(--fvplus-settings-chip-success\)/);
    assert.match(settingsCss, /\.fv-section-mode\.is-instant\s*\{[^}]*var\(--fvplus-settings-chip-info-border\)[^}]*var\(--fvplus-settings-chip-info\)/);
    assert.match(settingsCss, /\.folder-quick-filters > button\.is-active\s*\{[^}]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.match(settingsCss, /\.fv-setup-swal-chip\s*\{[^}]*border:\s*1px solid var\(--fvplus-settings-border-subtle\);[^}]*background:\s*var\(--fvplus-settings-surface-muted\);/);
    assert.match(settingsCss, /\.fv-setup-swal-row-value\s*\{[^}]*color:\s*var\(--fvplus-settings-text-primary\);/);
    assert.doesNotMatch(settingsCss, /\.fv-section-badge\s*\{[^}]*border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.2\);/);
    assert.doesNotMatch(settingsCss, /\.fv-setup-swal-row-value\s*\{[^}]*color:\s*#eaf2ff;/);
});

test('folder editor surfaces use graphite cards and fields instead of warm ornamental panels', () => {
    assert.match(folderCss, /\.fv-editor-nav-dock\s*\{[\s\S]*background:\s*var\(--fv-editor-panel\);/);
    assert.match(folderCss, /\.fv-modern-field-row\s*\{[\s\S]*background:\s*var\(--fv-editor-inset-surface\);/);
    assert.match(folderCss, /\.fv-editor-panel\s*\{[\s\S]*background:\s*var\(--fv-editor-panel\);/);
    assert.match(folderCss, /\.fv-editor-panel-icon-preview\s*\{[\s\S]*border:\s*1px solid var\(--fv-editor-control-border\);[\s\S]*background:\s*var\(--fv-editor-control-surface\);/);
    assert.doesNotMatch(folderCss, /\.fv-modern-field-row\s*\{[\s\S]*radial-gradient\(circle at top right,\s*rgba\(255,\s*154,\s*60,\s*0\.09\)/);
});

test('selected folder editor and advanced settings tabs do not render redundant underline bars', () => {
    assert.doesNotMatch(folderCss, /\.fv-section-nav > button(?:\.is-active|\[data-active="true"\]|\[aria-current="page"\])::after/);
    assert.doesNotMatch(settingsCss, /#fv-settings-root \.fv-advanced-tab\.is-active::after/);
    assert.match(folderCss, /\.fv-section-nav > button\.is-active,[\s\S]*background: color-mix\(in srgb, var\(--fv-editor-accent\)/);
    assert.match(settingsCss, /#fv-settings-root \.fv-advanced-tab\.is-active\s*\{[\s\S]*background: color-mix\(in srgb, var\(--fvplus-settings-accent\)/);
});

test('settings wizard and recovery chrome use flat graphite dark surfaces', () => {
    assert.match(settingsCss, /--fv-wizard-surface-page:\s*var\(--fvplus-ui-page,\s*var\(--fvplus-graphite-page,\s*#0f0f10\)\)/);
    assert.match(settingsCss, /--fv-wizard-shell-sidebar-bg:\s*var\(--fv-wizard-surface-panel\)/);
    assert.match(settingsCss, /--fv-wizard-shell-head-bg:\s*var\(--fv-wizard-surface-panel\)/);
    assert.match(settingsCss, /--fv-wizard-card-base-bg:\s*var\(--fvplus-ui-card,\s*var\(--fvplus-graphite-card,\s*#1d1d1f\)\)/);
    assert.match(themeResolverJs, /surfaceCard:\s*parseThemeColorToRgba\('#1d1d1f'\)/);
    assert.match(themeResolverJs, /'--fvplus-theme-surface-card':\s*tokens\.surfaceCard \|\| ''/);
    assert.match(themeResolverJs, /'--fvplus-settings-surface-card':\s*tokens\.settingsSurfaceCard \|\| ''/);
    assert.match(settingsCss, /\.fv-setup-card\s*\{[\s\S]*background:\s*var\(--fv-wizard-card-base-bg\);/);
    assert.match(settingsCss, /\.fv-setup-welcome-hero,\s*[\s\S]*\.fv-setup-welcome-draft,\s*[\s\S]*\.fv-setup-welcome-safety\s*\{[\s\S]*background:\s*var\(--fv-wizard-surface-card\);/);
    assert.match(settingsCss, /\.fv-recovery-panel\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-panel\);/);
    assert.match(settingsCss, /\.fv-recovery-stage\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-card\);/);
    assert.match(settingsCss, /\.fv-recovery-history-card,\s*[\s\S]*\.fv-recovery-timeline-card,\s*[\s\S]*\.fv-recovery-undo-summary\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-strong\);/);
    assert.match(settingsCss, /\.fv-folder-action-sheet-header\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-strong\);/);
    assert.match(settingsCss, /\.fv-folder-action-sheet\s*\{[\s\S]*background:\s*var\(--fvplus-settings-surface-panel\);/);
});
