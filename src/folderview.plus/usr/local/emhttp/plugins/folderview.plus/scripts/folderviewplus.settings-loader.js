(function folderViewPlusSettingsLoaderBootstrap(root) {
    'use strict';

    const win = root || (typeof window !== 'undefined' ? window : globalThis);
    const doc = win?.document;
    const manifest = win?.FolderViewPlusSettingsLoaderManifest;
    if (!doc || !manifest || !Array.isArray(manifest.foundation) || !Array.isArray(manifest.workspace)) {
        return;
    }

    const fatal = win.FolderViewPlusFatalBanner;
    const configuredTimeout = Number(manifest.moduleTimeoutMs);
    const moduleTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
        ? Math.round(configuredTimeout)
        : 12000;
    const queue = [
        ...manifest.foundation.map((url) => ({ url: String(url || ''), stage: 'foundation' })),
        ...manifest.workspace.map((url) => ({ url: String(url || ''), stage: 'workspace' }))
    ];
    const state = {
        phase: 'foundation',
        loaded: [],
        index: 0,
        currentModule: '',
        startedAt: Date.now(),
        completedAt: 0,
        retryCount: 0,
        workspaceOpportunityWaited: false
    };

    const report = (action) => {
        fatal?.recordAction?.(action);
        fatal?.markStep?.(action);
    };

    const assetName = (url) => {
        try {
            const parsed = new URL(String(url || ''), win.location?.href || 'http://localhost/');
            return parsed.pathname.split('/').filter(Boolean).pop() || 'unknown';
        } catch (_error) {
            return String(url || '').split('?')[0].split('/').pop() || 'unknown';
        }
    };

    const assetVersion = (url) => {
        try {
            return new URL(String(url || ''), win.location?.href || 'http://localhost/').searchParams.get('v') || '';
        } catch (_error) {
            return '';
        }
    };

    const buildAttemptUrl = (url, retry) => {
        if (!retry) {
            return String(url || '');
        }
        try {
            const parsed = new URL(String(url || ''), win.location?.href || 'http://localhost/');
            parsed.searchParams.set('fv_retry', String(state.retryCount));
            if (parsed.origin === win.location?.origin) {
                return `${parsed.pathname}${parsed.search}${parsed.hash}`;
            }
            return parsed.href;
        } catch (_error) {
            const separator = String(url || '').includes('?') ? '&' : '?';
            return `${String(url || '')}${separator}fv_retry=${state.retryCount}`;
        }
    };

    const readResourceTiming = (url) => {
        try {
            const rows = win.performance?.getEntriesByName?.(url) || [];
            const entry = rows[rows.length - 1] || null;
            if (!entry) return '';
            const transferSize = Math.max(0, Number(entry.transferSize) || 0);
            const encodedBodySize = Math.max(0, Number(entry.encodedBodySize) || 0);
            return `transferSize=${transferSize}; encodedBodySize=${encodedBodySize}`;
        } catch (_error) {
            return '';
        }
    };

    const loadScript = (entry, { retry = false } = {}) => new Promise((resolve, reject) => {
        const startedAt = new Date().toISOString();
        const startedMs = Date.now();
        const requestedUrl = buildAttemptUrl(entry.url, retry);
        const name = assetName(entry.url);
        const script = doc.createElement('script');
        let settled = false;
        let timer = null;
        state.currentModule = name;
        script.src = requestedUrl;
        script.async = false;
        script.dataset.fvplusSettingsStage = entry.stage;
        script.dataset.fvplusSettingsModule = name;
        script.dataset.fvplusSettingsAttempt = retry ? 'retry' : 'initial';
        fatal?.recordModuleEvent?.({
            name,
            stage: entry.stage,
            outcome: 'loading',
            startedAt,
            version: assetVersion(entry.url),
            retry
        });

        const finish = (outcome, error = null) => {
            if (settled) return;
            settled = true;
            if (timer !== null && typeof win.clearTimeout === 'function') {
                win.clearTimeout(timer);
            }
            const completedAt = new Date().toISOString();
            const durationMs = Math.max(0, Date.now() - startedMs);
            const timing = readResourceTiming(script.src || requestedUrl);
            fatal?.recordModuleEvent?.({
                name,
                stage: entry.stage,
                outcome,
                startedAt,
                completedAt,
                durationMs,
                version: assetVersion(entry.url),
                retry,
                detail: timing
            });
            if (outcome === 'loaded') {
                state.loaded.push(script.src || requestedUrl);
                state.currentModule = '';
                resolve();
                return;
            }
            script.remove?.();
            reject(error || new Error(`Failed to load Settings module: ${name}`));
        };

        script.addEventListener('load', () => finish('loaded'), { once: true });
        script.addEventListener('error', () => {
            finish('failed', new Error(`Failed to load Settings module: ${name}`));
        }, { once: true });
        timer = win.setTimeout(() => {
            finish('timed-out', new Error(`Settings module timed out after ${moduleTimeoutMs} ms: ${name}`));
        }, moduleTimeoutMs);
        timer?.unref?.();
        doc.head.append(script);
    });

    const waitForWorkspaceOpportunity = () => new Promise((resolve) => {
        if (state.workspaceOpportunityWaited) {
            resolve();
            return;
        }
        state.workspaceOpportunityWaited = true;
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

    const run = async ({ retry = false } = {}) => {
        try {
            if (state.index < manifest.foundation.length) {
                state.phase = 'foundation';
                fatal?.setPhase?.('bootstrap-foundation');
                if (!retry) report('Load Settings foundation modules');
            }
            while (state.index < queue.length) {
                const entry = queue[state.index];
                if (entry.stage === 'workspace' && state.phase !== 'workspace') {
                    state.phase = 'workspace';
                    fatal?.setPhase?.('bootstrap-workspace');
                    await waitForWorkspaceOpportunity();
                    if (!retry) report('Load deferred Settings workspace modules');
                }
                await loadScript(entry, { retry });
                state.index += 1;
                retry = false;
            }

            state.phase = 'complete';
            state.completedAt = Date.now();
            report('Loaded staged Settings runtime');
            return Object.freeze({
                loadedCount: state.loaded.length,
                durationMs: Math.max(0, state.completedAt - state.startedAt),
                retryCount: state.retryCount
            });
        } catch (error) {
            state.phase = 'failed';
            const failedEntry = queue[state.index] || null;
            const failedVersion = assetVersion(failedEntry?.url || '');
            const expectedVersion = String(win.FolderViewPlusFatalRuntimeContext?.pluginVersion || '').trim();
            const hasVersionMismatch = Boolean(
                failedVersion
                && failedVersion !== '0'
                && expectedVersion
                && expectedVersion !== 'unknown'
                && failedVersion !== expectedVersion
            );
            fatal?.reportFatalError?.(error, {
                code: 'FVPLUS-SET-LOADER-001',
                phase: 'bootstrap-module-load',
                category: hasVersionMismatch
                    ? 'version-mismatch'
                    : (fatal?.classifyError?.(error, 'missing-asset') || 'missing-asset'),
                details: [
                    state.currentModule ? `Affected module: ${state.currentModule}` : '',
                    hasVersionMismatch ? `Requested asset version: ${failedVersion}` : '',
                    hasVersionMismatch ? `Installed plugin version: ${expectedVersion}` : ''
                ].filter(Boolean),
                summary: 'FolderView Plus could not load the Settings runtime.'
            });
            throw error;
        }
    };

    const retry = async () => {
        if (state.phase !== 'failed') {
            return Object.freeze({ skipped: true, reason: 'loader-not-failed' });
        }
        if (state.retryCount >= 1) {
            throw new Error('Settings startup retry limit reached. Reload the page to try again.');
        }
        state.retryCount += 1;
        state.startedAt = Date.now();
        state.completedAt = 0;
        state.phase = queue[state.index]?.stage || 'foundation';
        report('Retry failed Settings module');
        return run({ retry: true });
    };

    fatal?.registerRecoveryHandler?.('retry', retry);
    const ready = run();
    // The loader owns fatal presentation. Keep the public promise rejectable for
    // callers without also emitting an unhandled-rejection duplicate.
    ready.catch(() => {});

    win.FolderViewPlusSettingsLoader = Object.freeze({
        ready,
        retry,
        snapshot: () => Object.freeze({
            phase: state.phase,
            loadedCount: state.loaded.length,
            durationMs: Math.max(0, (state.completedAt || Date.now()) - state.startedAt),
            currentModule: state.currentModule,
            nextModule: assetName(queue[state.index]?.url || ''),
            retryCount: state.retryCount,
            moduleTimeoutMs
        })
    });
    win.FolderViewPlusSettingsLoaderModuleLoaded = true;
})(typeof window !== 'undefined' ? window : globalThis);
