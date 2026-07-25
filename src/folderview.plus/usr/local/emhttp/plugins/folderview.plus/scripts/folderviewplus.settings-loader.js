(function folderViewPlusSettingsLoaderBootstrap(root) {
    'use strict';

    const win = root || (typeof window !== 'undefined' ? window : globalThis);
    const doc = win?.document;
    const manifest = win?.FolderViewPlusSettingsLoaderManifest;
    if (!doc || !manifest || !Array.isArray(manifest.foundation) || !Array.isArray(manifest.workspace)) {
        return;
    }

    const fatal = win.FolderViewPlusFatalBanner;
    const state = {
        phase: 'foundation',
        loaded: [],
        startedAt: Date.now(),
        completedAt: 0
    };

    const report = (action) => {
        fatal?.recordAction?.(action);
        fatal?.markStep?.(action);
    };

    const loadScript = (url) => new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = String(url || '');
        script.async = false;
        script.dataset.fvplusSettingsStage = state.phase;
        script.addEventListener('load', () => {
            state.loaded.push(script.src);
            resolve();
        }, { once: true });
        script.addEventListener('error', () => {
            reject(new Error(`Failed to load Settings module: ${script.src}`));
        }, { once: true });
        doc.head.append(script);
    });

    const loadSequentially = async (urls) => {
        for (const url of urls) {
            await loadScript(url);
        }
    };

    const waitForWorkspaceOpportunity = () => new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            win.removeEventListener('pointerdown', finish, true);
            win.removeEventListener('keydown', finish, true);
            resolve();
        };
        win.addEventListener('pointerdown', finish, { capture: true, once: true });
        win.addEventListener('keydown', finish, { capture: true, once: true });
        if (typeof win.requestIdleCallback === 'function') {
            win.requestIdleCallback(finish, { timeout: 250 });
        } else {
            win.setTimeout(finish, 0);
        }
    });

    const ready = (async () => {
        try {
            fatal?.setPhase?.('bootstrap-foundation');
            report('Load Settings foundation modules');
            await loadSequentially(manifest.foundation);

            state.phase = 'workspace';
            fatal?.setPhase?.('bootstrap-workspace');
            await waitForWorkspaceOpportunity();
            report('Load deferred Settings workspace modules');
            await loadSequentially(manifest.workspace);

            state.phase = 'complete';
            state.completedAt = Date.now();
            report('Loaded staged Settings runtime');
            return Object.freeze({
                loadedCount: state.loaded.length,
                durationMs: Math.max(0, state.completedAt - state.startedAt)
            });
        } catch (error) {
            state.phase = 'failed';
            fatal?.reportFatalError?.(error, {
                code: 'FVPLUS-SET-LOADER-001',
                phase: 'bootstrap-module-load',
                category: 'runtime-failed',
                summary: 'FolderView Plus could not load the Settings runtime.',
                details: ['A required Settings JavaScript module failed to load.']
            });
            throw error;
        }
    })();
    // The loader owns fatal presentation. Keep the public promise rejectable for
    // callers without also emitting an unhandled-rejection duplicate.
    ready.catch(() => {});

    win.FolderViewPlusSettingsLoader = Object.freeze({
        ready,
        snapshot: () => Object.freeze({
            phase: state.phase,
            loadedCount: state.loaded.length,
            durationMs: Math.max(0, (state.completedAt || Date.now()) - state.startedAt)
        })
    });
    win.FolderViewPlusSettingsLoaderModuleLoaded = true;
})(typeof window !== 'undefined' ? window : globalThis);
