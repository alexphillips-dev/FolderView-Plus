'use strict';

(function bootFolderEditorRuntimePage(win, doc) {
        const buildVersion = String(win.FolderViewPlusFolderEditorPageBuildVersion || '').trim() || String(Date.now());
        const assetVersion = encodeURIComponent(buildVersion);
        const runtimeMode = 'modern';
        const bootNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let bootAttempt = 0;
        const managedSelector = 'script[data-fv-folder-editor-boot-managed="1"]';
        const scriptQueue = [
            '/plugins/folderview.plus/scripts/icon-picker.runtime.js',
            '/plugins/folderview.plus/scripts/folder.editor.hierarchy.js',
            '/plugins/folderview.plus/scripts/folder.editor.chrome.js',
            '/plugins/folderview.plus/scripts/folder.editor.parent-picker.js',
            '/plugins/folderview.plus/scripts/folder.editor.rules.js',
            '/plugins/folderview.plus/scripts/folder.settings-transfer.js',
            '/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js',
            '/plugins/folderview.plus/scripts/folder.editor.state.js',
            '/plugins/folderview.plus/scripts/folder.editor.members.js',
            '/plugins/folderview.plus/scripts/folder.editor.icons.js',
            '/plugins/folderview.plus/scripts/folder.editor.type-docker.js',
            '/plugins/folderview.plus/scripts/folder.editor.type-vm.js',
            '/plugins/folderview.plus/scripts/folder.js'
        ];
        const formatDebug = () => [
            'build=' + buildVersion,
            'bootNonce=' + bootNonce,
            'pageMode=' + String(win.FolderViewPlusFolderEditorPageMode || '(empty)'),
            'pageType=' + String(win.FolderViewPlusFolderEditorPageType || '(empty)'),
            'pageRequested=' + String(win.FolderViewPlusFolderEditorRequestedId || '(empty)'),
            'pageResolved=' + String(win.FolderViewPlusFolderEditorResolvedId || '(empty)'),
            'runtimeState=' + String(win.FolderViewPlusFolderEditorRuntimeScriptState || '(empty)'),
            'runtimeSrc=' + String(win.FolderViewPlusFolderEditorRuntimeScriptSource || '(empty)'),
            'runtimeLoaded=' + (win.FolderViewPlusFolderEditorRuntimeLoaded === true ? 'yes' : 'no'),
            'stage=' + String(win.FolderViewPlusFolderEditorRuntimeBootStage || '(empty)')
        ].join('\n');
        const report = (summary, details, tone, stage) => {
            if (typeof win.FolderViewPlusReportFolderEditorBootstrap === 'function') {
                win.FolderViewPlusReportFolderEditorBootstrap({
                    summary,
                    details,
                    debug: formatDebug(),
                    tone,
                    stage
                });
                return;
            }
            const apply = () => {
                const summaryNode = doc.getElementById('fvValidationSummary');
                const detailsNode = doc.getElementById('fvValidationDetails');
                const debugNode = doc.getElementById('fvEditorBootstrapDebug');
                [summaryNode, detailsNode].forEach((node) => {
                    if (!node) {
                        return;
                    }
                    node.classList.remove('invalid', 'warning', 'info', 'ready');
                    node.classList.add(tone === 'invalid' ? 'invalid' : (tone === 'warning' ? 'warning' : 'info'));
                });
                if (summaryNode) {
                    summaryNode.textContent = summary;
                }
                if (detailsNode) {
                    detailsNode.textContent = details;
                }
                if (debugNode) {
                    debugNode.textContent = formatDebug();
                }
            };
            if (doc.readyState === 'loading') {
                doc.addEventListener('DOMContentLoaded', apply, { once: true });
            } else {
                apply();
            }
        };
        const loadScript = (relativePath, isRuntimeScript) => new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            const separator = relativePath.includes('?') ? '&' : '?';
            const src = `${relativePath}${separator}v=${assetVersion}&boot=${encodeURIComponent(bootNonce)}&attempt=${bootAttempt}`;
            const moduleName = relativePath.split('/').pop() || relativePath;
            const startedAt = new Date().toISOString();
            const startedMs = Date.now();
            let settled = false;
            let timeoutId = null;
            script.src = src;
            script.async = false;
            script.defer = false;
            script.dataset.fvFolderEditorBootManaged = '1';
            if (isRuntimeScript) {
                script.id = 'fv-folder-editor-runtime-script';
                script.dataset.runtime = runtimeMode;
            }
            win.FolderViewPlusFatalBanner?.recordModuleEvent?.({
                name: moduleName,
                stage: 'folder-editor-runtime',
                outcome: 'loading',
                startedAt,
                version: buildVersion
            });
            const finish = (outcome, error = null) => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) win.clearTimeout(timeoutId);
                win.FolderViewPlusFatalBanner?.recordModuleEvent?.({
                    name: moduleName,
                    stage: 'folder-editor-runtime',
                    outcome,
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startedMs,
                    version: buildVersion
                });
                if (outcome === 'loaded') {
                    resolve();
                    return;
                }
                script.remove();
                reject(error || new Error(`Failed to load ${relativePath}`));
            };
            script.onload = () => {
                if (isRuntimeScript && typeof win.FolderViewPlusMarkFolderEditorRuntimeScriptEvent === 'function') {
                    win.FolderViewPlusMarkFolderEditorRuntimeScriptEvent('load', src);
                }
                finish('loaded');
            };
            script.onerror = () => {
                if (isRuntimeScript && typeof win.FolderViewPlusMarkFolderEditorRuntimeScriptEvent === 'function') {
                    win.FolderViewPlusMarkFolderEditorRuntimeScriptEvent('error', src);
                }
                finish('failed', new Error(`Failed to load ${relativePath}`));
            };
            timeoutId = win.setTimeout(() => {
                finish('timed-out', new Error(`Timed out loading ${relativePath}`));
            }, 8000);
            doc.body.appendChild(script);
        });
        const run = ({ propagateFailure = false } = {}) => {
            bootAttempt += 1;
            win.FolderViewPlusFolderEditorRuntimeLoaded = false;
            win.FolderViewPlusFolderEditorRuntimeBootStage = 'page-boot-loader';
            win.FolderViewPlusFolderEditorRuntimeLastError = '';
            win.FolderViewPlusFolderEditorRuntimeScriptState = 'injecting';
            win.FolderViewPlusFolderEditorRuntimeScriptSource = '';
            doc.querySelectorAll(managedSelector).forEach((node) => node.remove());
            let chain = Promise.resolve();
            scriptQueue.forEach((relativePath, index) => {
                chain = chain.then(() => loadScript(relativePath, index === scriptQueue.length - 1));
            });
            return chain.catch((error) => {
                report(
                    'Folder editor runtime assets failed to load.',
                    String(error?.message || error || 'Unknown runtime asset failure.'),
                    'invalid',
                    'runtime-asset-load-failed'
                );
                if (propagateFailure) {
                    throw error;
                }
                return null;
            });
        };
        win.FolderViewPlusFatalBanner?.registerRecoveryHandler?.('retry', () => run({ propagateFailure: true }));
        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
        win.setTimeout(() => {
            if (win.FolderViewPlusFolderEditorRuntimeLoaded === true) {
                return;
            }
            report(
                'Folder editor runtime has not started yet.',
                'The page boot loader injected the editor runtime scripts, but the runtime marker is still missing.',
                'warning',
                'runtime-script-pending'
            );
        }, 900);
        win.setTimeout(() => {
            if (win.FolderViewPlusFolderEditorRuntimeLoaded === true) {
                return;
            }
            report(
                'Folder editor runtime still has not started.',
                'The editor page has now attempted a direct runtime script injection and still did not receive a startup marker.',
                'invalid',
                'runtime-script-still-pending'
            );
        }, 2500);
    })(window, document);
