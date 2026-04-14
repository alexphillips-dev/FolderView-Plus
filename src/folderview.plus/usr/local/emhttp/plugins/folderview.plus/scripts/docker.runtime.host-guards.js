// @ts-check
(function dockerRuntimeHostGuardsModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDockerHostGuards = factory(fallbackWindow);
    root.FolderViewPlusDockerHostGuardsModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeHostGuardsFactory(fallbackWindow) {
    'use strict';

    const DEFAULT_REQUIRED_SELECTORS = Object.freeze([
        { label: 'Docker table shell', selector: 'table#docker_containers' },
        { label: 'Docker table body', selector: 'tbody#docker_list' },
        { label: 'Docker header row', selector: '#docker_containers > thead > tr' }
    ]);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const setModuleStatus = typeof deps.setModuleStatus === 'function' ? deps.setModuleStatus : () => {};
        const markStep = typeof deps.markStep === 'function' ? deps.markStep : () => {};
        const reportFatalRuntimeError = typeof deps.reportFatalRuntimeError === 'function'
            ? deps.reportFatalRuntimeError
            : () => {};
        const reportDegradedRuntimeState = typeof deps.reportDegradedRuntimeState === 'function'
            ? deps.reportDegradedRuntimeState
            : () => {};
        const requiredSelectors = Array.isArray(deps.requiredSelectors) && deps.requiredSelectors.length > 0
            ? deps.requiredSelectors
            : DEFAULT_REQUIRED_SELECTORS;

        /** @type {Record<string, { available: boolean, wrapped: boolean, callCount: number, notes: string[], lastSeenAt: string | null, lastInvokedAt: string | null }>} */
        const hookStates = Object.create(null);

        const ensureHookRecord = (name) => {
            const safeName = String(name || '').trim() || 'unknown';
            if (!hookStates[safeName]) {
                hookStates[safeName] = {
                    available: false,
                    wrapped: false,
                    callCount: 0,
                    notes: [],
                    lastSeenAt: null,
                    lastInvokedAt: null
                };
            }
            return hookStates[safeName];
        };

        const collectHostPageStructureIssues = () => {
            const missing = [];
            requiredSelectors.forEach((entry) => {
                if (!entry || !entry.selector) {
                    return;
                }
                if (!doc || typeof doc.querySelector !== 'function' || !doc.querySelector(entry.selector)) {
                    missing.push(`${entry.label}: ${entry.selector}`);
                }
            });
            return missing;
        };

        const ensureHostPageStructure = () => {
            const missing = collectHostPageStructureIssues();
            if (missing.length <= 0) {
                setModuleStatus('host-page-structure', 'ok', 'expected Docker host selectors detected');
                return;
            }
            setModuleStatus('host-page-structure', 'missing', missing.join(' | '));
            const error = new Error(`Expected Docker host page selectors were not found: ${missing.join(', ')}`);
            error.fvplusPhase = 'host-dom';
            error.fvplusCategory = 'host-page-structure';
            reportFatalRuntimeError(error, {
                title: 'Docker page structure changed',
                message: 'FolderView Plus expected the standard Unraid Docker table markup, but required host page elements were missing.',
                code: 'FVPLUS-DKR-DOM-001',
                phase: 'host-dom',
                category: 'host-page-structure',
                detailLabel: 'Missing selectors',
                details: missing
            });
            throw error;
        };

        const captureHostHook = (name, value, options = {}) => {
            const safeName = String(name || '').trim() || 'unknown';
            const record = ensureHookRecord(safeName);
            const available = typeof value === 'function';
            record.available = available;
            record.lastSeenAt = new Date().toISOString();
            if (available) {
                record.notes.push(String(options.note || 'captured').trim() || 'captured');
                markStep(String(options.step || `${safeName} hook captured`).trim() || `${safeName} hook captured`);
            }
            if (record.notes.length > 12) {
                record.notes = record.notes.slice(-12);
            }
            return available;
        };

        const reportMissingHook = (name, message, options = {}) => {
            const safeName = String(name || '').trim() || 'unknown';
            const record = ensureHookRecord(safeName);
            record.available = false;
            record.notes.push(String(message || 'missing').trim() || 'missing');
            if (record.notes.length > 12) {
                record.notes = record.notes.slice(-12);
            }
            reportDegradedRuntimeState(String(message || `${safeName} hook unavailable`), {
                phase: String(options.phase || 'hook-install').trim() || 'hook-install',
                category: String(options.category || 'host-hook-missing').trim() || 'host-hook-missing',
                detailLabel: String(options.detailLabel || 'Missing host hooks').trim() || 'Missing host hooks',
                details: Array.isArray(options.details) && options.details.length > 0
                    ? options.details
                    : [`${safeName} was not a function when FolderView Plus initialized.`]
            });
        };

        const noteHookWrapped = (name, options = {}) => {
            const safeName = String(name || '').trim() || 'unknown';
            const record = ensureHookRecord(safeName);
            record.wrapped = true;
            record.notes.push(String(options.note || 'wrapped').trim() || 'wrapped');
            if (record.notes.length > 12) {
                record.notes = record.notes.slice(-12);
            }
            markStep(String(options.step || `${safeName} hook wrapped`).trim() || `${safeName} hook wrapped`);
        };

        const noteHookInvocation = (name, options = {}) => {
            const safeName = String(name || '').trim() || 'unknown';
            const record = ensureHookRecord(safeName);
            record.callCount += 1;
            record.lastInvokedAt = new Date().toISOString();
            const note = String(options.note || '').trim();
            if (note) {
                record.notes.push(note);
                if (record.notes.length > 12) {
                    record.notes = record.notes.slice(-12);
                }
            }
        };

        const getHookStates = () => JSON.parse(JSON.stringify(hookStates));

        return {
            ensureHostPageStructure,
            collectHostPageStructureIssues,
            captureHostHook,
            reportMissingHook,
            noteHookWrapped,
            noteHookInvocation,
            getHookStates
        };
    };

    return {
        DEFAULT_REQUIRED_SELECTORS,
        createApi
    };
}));
