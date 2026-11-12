'use strict';

(function bootstrapFolderEditorDiagnosticsSurface(win, doc) {
        const EDITOR_DEBUG_SURFACE_STORAGE_KEY = 'fv.folder.editor.debug.surface.v1';
        const bannerState = {
            summary: 'Folder editor bootstrap diagnostics are idle.',
            details: 'No startup issues have been reported yet.',
            debug: 'Bootstrap: waiting for folder editor runtime.',
            tone: 'info'
        };
        const buttonTemplates = new WeakMap();
        const buttonStatusTimers = new WeakMap();
        const flashButtonStatus = (button, message, delayMs) => {
            if (!button) {
                return;
            }
            if (!buttonTemplates.has(button)) {
                buttonTemplates.set(
                    button,
                    Array.from(button.childNodes, (child) => child.cloneNode(true))
                );
            }
            const activeTimer = buttonStatusTimers.get(button);
            if (activeTimer) {
                win.clearTimeout(activeTimer);
            }
            button.replaceChildren(doc.createTextNode(String(message || '')));
            const timer = win.setTimeout(() => {
                const template = buttonTemplates.get(button) || [];
                button.replaceChildren(...template.map((child) => child.cloneNode(true)));
                buttonStatusTimers.delete(button);
            }, delayMs);
            buttonStatusTimers.set(button, timer);
        };
        const buildDiagnosticsSnapshot = () => ({
            checkedAt: new Date().toISOString(),
            summary: String(bannerState.summary || '(empty)'),
            details: String(bannerState.details || '(empty)'),
            tone: String(bannerState.tone || 'info'),
            debug: String(bannerState.debug || 'none'),
            environment: {
                pageMode: String(win.FolderViewPlusFolderEditorPageMode || '(empty)'),
                pageType: String(win.FolderViewPlusFolderEditorPageType || '(empty)'),
                requestedId: String(win.FolderViewPlusFolderEditorRequestedId || '(empty)'),
                resolvedId: String(win.FolderViewPlusFolderEditorResolvedId || '(empty)'),
                pluginVersion: String(win.FolderViewPlusFolderEditorPageBuildVersion || '(empty)'),
                runtimeLoaded: win.FolderViewPlusFolderEditorRuntimeLoaded === true ? 'yes' : 'no',
                runtimeStage: String(win.FolderViewPlusFolderEditorRuntimeBootStage || '(empty)'),
                runtimeState: String(win.FolderViewPlusFolderEditorRuntimeScriptState || '(empty)'),
                runtimeSrc: String(win.FolderViewPlusFolderEditorRuntimeScriptSource || '(empty)'),
                url: String(win.location?.href || '(empty)')
            }
        });
        const buildDiagnosticsText = () => {
            const snapshot = buildDiagnosticsSnapshot();
            return [
                'FolderView Plus Folder Editor Bootstrap Diagnostics',
                'privacyMode: sanitized',
                'summary: [redacted]',
                'details: [redacted]',
                `severity: ${snapshot.tone}`,
                '',
                '[environment]',
                `pageMode: ${snapshot.environment.pageMode === 'modern' ? 'modern' : 'unknown'}`,
                `pageType: ${['docker', 'vm'].includes(snapshot.environment.pageType) ? snapshot.environment.pageType : 'unknown'}`,
                'requestedId: [redacted]',
                'resolvedId: [redacted]',
                'pluginVersion: [redacted]',
                `runtimeLoaded: ${snapshot.environment.runtimeLoaded}`,
                'runtimeStage: [redacted]',
                'runtimeState: [redacted]',
                'runtimeSrc: [redacted]',
                'url: [redacted]',
                '',
                '[debug]',
                '[redacted]'
            ].join('\n');
        };
        const persistDiagnosticsSnapshot = () => {
            try {
                if (win.localStorage && typeof win.localStorage.setItem === 'function') {
                    win.localStorage.setItem(EDITOR_DEBUG_SURFACE_STORAGE_KEY, JSON.stringify(buildDiagnosticsSnapshot()));
                }
            } catch (_error) {
                // Bootstrap diagnostics are best-effort only.
            }
        };
        win.FolderViewPlusCollectFolderEditorBootstrapDiagnostics = function collectFolderEditorBootstrapDiagnostics() {
            return buildDiagnosticsSnapshot();
        };
        const applySurfaceState = () => {
            const host = doc.getElementById('fvFolderEditorBootstrapBanner');
            const summaryNode = doc.getElementById('fvFolderEditorBootstrapSummary');
            const detailsNode = doc.getElementById('fvFolderEditorBootstrapDetailsText');
            const debugNode = doc.getElementById('fvFolderEditorBootstrapDebug');
            const disclosure = doc.getElementById('fvFolderEditorBootstrapDisclosure');
            if (!host || !summaryNode || !detailsNode || !debugNode || !disclosure) {
                return;
            }
            const className = bannerState.tone === 'invalid'
                ? 'invalid'
                : bannerState.tone === 'warning'
                    ? 'warning'
                    : bannerState.tone === 'ready'
                        ? 'ready'
                        : 'info';
            [summaryNode, detailsNode].forEach((node) => {
                node.classList.remove('invalid', 'warning', 'info', 'ready');
                node.classList.add(className);
            });
            summaryNode.textContent = String(bannerState.summary || '');
            detailsNode.textContent = String(bannerState.details || '');
            debugNode.textContent = String(bannerState.debug || '');
            const shouldShow = bannerState.tone === 'invalid' || bannerState.tone === 'warning';
            host.hidden = !shouldShow;
            if (shouldShow) {
                disclosure.open = true;
            }
        };
        const syncSurfaceState = () => {
            persistDiagnosticsSnapshot();
            if (doc.readyState === 'loading') {
                doc.addEventListener('DOMContentLoaded', applySurfaceState, { once: true });
            } else {
                applySurfaceState();
            }
        };
        win.FolderViewPlusCopyFolderEditorBootstrapDiagnostics = async function copyFolderEditorBootstrapDiagnostics() {
            try {
                if (win.FolderViewPlusFatalBanner?.getStartupIncidentSnapshot?.()?.available === true) {
                    const copied = await win.FolderViewPlusFatalBanner.copyDiagnostics?.();
                    if (copied) {
                        flashButtonStatus(doc.getElementById('fvFolderEditorBootstrapCopy'), 'Copied', 1400);
                        return;
                    }
                }
            } catch (_error) {
                // The minimal sanitized report remains available during bootstrap failures.
            }
            const text = buildDiagnosticsText();
            let textarea = null;
            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(text);
                } else {
                    textarea = doc.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    doc.body.appendChild(textarea);
                    textarea.select();
                    if (!doc.execCommand('copy')) throw new Error('Copy failed');
                }
                flashButtonStatus(doc.getElementById('fvFolderEditorBootstrapCopy'), 'Copied', 1400);
            } catch (_error) {
                flashButtonStatus(doc.getElementById('fvFolderEditorBootstrapCopy'), 'Copy failed', 1800);
            } finally {
                textarea?.remove();
            }
        };
        win.FolderViewPlusReportFolderEditorBootstrap = function reportFolderEditorBootstrap({
            summary = '',
            details = '',
            debug = '',
            tone = 'warning',
            stage = ''
        } = {}) {
            if (summary) {
                bannerState.summary = String(summary);
            }
            if (details) {
                bannerState.details = String(details);
            }
            if (debug) {
                bannerState.debug = String(debug);
            }
            bannerState.tone = tone === 'invalid'
                ? 'invalid'
                : tone === 'warning'
                    ? 'warning'
                    : tone === 'ready'
                        ? 'ready'
                        : 'info';
            if (stage) {
                win.FolderViewPlusFolderEditorRuntimeBootStage = String(stage);
            }
            if (bannerState.tone === 'invalid' || bannerState.tone === 'warning') {
                const category = String(stage || '').includes('asset') || String(stage || '').includes('script')
                    ? 'missing-asset'
                    : 'runtime-failed';
                win.FolderViewPlusFatalBanner?.captureIncident?.({
                    context: 'Folder Editor',
                    code: bannerState.tone === 'invalid' ? 'FVPLUS-EDT-BOOT-001' : 'FVPLUS-EDT-BOOT-002',
                    phase: String(stage || 'folder-editor-bootstrap'),
                    category,
                    severity: bannerState.tone === 'invalid' ? 'fatal' : 'degraded',
                    userTitle: String(bannerState.summary || 'Folder Editor startup problem'),
                    userMessage: String(bannerState.details || 'The Folder Editor did not finish loading.'),
                    details: stage ? [`Stage: ${String(stage)}`] : []
                });
            }
            syncSurfaceState();
        };
        doc.addEventListener('click', (event) => {
            const target = event.target instanceof Element
                ? event.target.closest('#fvFolderEditorBootstrapCopy, #fvFolderEditorBootstrapRetry, #fvFolderEditorBootstrapReload, #fvFolderEditorBootstrapDownload')
                : null;
            if (!target) {
                return;
            }
            event.preventDefault();
            if (target.id === 'fvFolderEditorBootstrapRetry') {
                void win.FolderViewPlusFatalBanner?.runRecovery?.('retry');
            } else if (target.id === 'fvFolderEditorBootstrapReload') {
                win.location.reload();
            } else if (target.id === 'fvFolderEditorBootstrapDownload') {
                win.FolderViewPlusFatalBanner?.downloadDiagnostics?.();
            } else {
                void win.FolderViewPlusCopyFolderEditorBootstrapDiagnostics();
            }
        });
        syncSurfaceState();
    })(window, document);
