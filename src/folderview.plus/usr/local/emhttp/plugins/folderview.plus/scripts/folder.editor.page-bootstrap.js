(function folderEditorPageBootstrap(root) {
    'use strict';

    const meta = root.document?.querySelector?.('meta[name="fvplus-folder-editor-context"]');
    let context = {};
    try {
        context = JSON.parse(String(meta?.content || '{}'));
    } catch (_error) {
        context = {};
    }
    root.FolderViewPlusFolderEditorPageType = String(context.pageType || '');
    root.FolderViewPlusFolderEditorPageMode = String(context.pageMode || 'modern');
    root.FolderViewPlusFolderEditorResolvedMode = String(context.pageMode || 'modern');
    root.FolderViewPlusFolderEditorModeSource = String(context.modeSource || 'modern-only');
    root.FolderViewPlusFolderEditorRequestedId = String(context.requestedId || '');
    root.FolderViewPlusFolderEditorResolvedId = String(context.resolvedId || '');
    root.FolderViewPlusFolderEditorBootstrapContext = context.bootstrapContext && typeof context.bootstrapContext === 'object'
        ? context.bootstrapContext
        : {};
    root.FolderViewPlusFolderEditorTypePrefs = context.typePrefs && typeof context.typePrefs === 'object'
        ? context.typePrefs
        : {};
    root.FolderViewPlusFolderEditorPageBuildVersion = String(context.buildVersion || '');
    root.FolderViewPlusFolderEditorRuntimeLoaded = false;
    root.FolderViewPlusFolderEditorRuntimeBootStage = 'page-bootstrap';
    root.FolderViewPlusFolderEditorRuntimeLastError = '';
    root.FolderViewPlusFolderEditorRuntimeScriptState = 'not-registered';
    root.FolderViewPlusFolderEditorRuntimeScriptSource = '';
    root.FolderViewPlusMarkFolderEditorRuntimeScriptEvent = function markFolderEditorRuntimeScriptEvent(state, source) {
        try {
            root.FolderViewPlusFolderEditorRuntimeScriptState = String(state || '').trim() || 'unknown';
            root.FolderViewPlusFolderEditorRuntimeScriptSource = String(source || '').trim();
            if (typeof root.FolderViewPlusReportFolderEditorBootstrap === 'function'
                && root.FolderViewPlusFolderEditorRuntimeLoaded !== true
                && ['load', 'error'].includes(root.FolderViewPlusFolderEditorRuntimeScriptState)) {
                root.FolderViewPlusReportFolderEditorBootstrap({
                    summary: root.FolderViewPlusFolderEditorRuntimeScriptState === 'error'
                        ? 'Folder editor runtime script failed to load.'
                        : 'Folder editor runtime script loaded but did not start.',
                    details: root.FolderViewPlusFolderEditorRuntimeScriptState === 'error'
                        ? 'The editor page could not load its runtime script file.'
                        : 'The editor page loaded the runtime script file, but the runtime marker is still missing.',
                    debug: [
                        `build=${String(root.FolderViewPlusFolderEditorPageBuildVersion || '(empty)')}`,
                        `pageMode=${String(root.FolderViewPlusFolderEditorPageMode || '(empty)')}`,
                        `pageType=${String(root.FolderViewPlusFolderEditorPageType || '(empty)')}`,
                        `pageRequested=${String(root.FolderViewPlusFolderEditorRequestedId || '(empty)')}`,
                        `pageResolved=${String(root.FolderViewPlusFolderEditorResolvedId || '(empty)')}`,
                        `runtimeState=${String(root.FolderViewPlusFolderEditorRuntimeScriptState || '(empty)')}`,
                        `runtimeSrc=${String(root.FolderViewPlusFolderEditorRuntimeScriptSource || '(empty)')}`,
                        `runtimeLoaded=${root.FolderViewPlusFolderEditorRuntimeLoaded === true ? 'yes' : 'no'}`,
                        `stage=${String(root.FolderViewPlusFolderEditorRuntimeBootStage || '(empty)')}`
                    ].join('\n'),
                    tone: root.FolderViewPlusFolderEditorRuntimeScriptState === 'error' ? 'invalid' : 'warning',
                    stage: root.FolderViewPlusFolderEditorRuntimeScriptState === 'error' ? 'runtime-script-error' : 'runtime-script-loaded'
                });
            }
        } catch (_error) {
            // Best effort only.
        }
    };
}(typeof window !== 'undefined' ? window : globalThis));
