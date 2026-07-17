// @ts-check
(function dockerRuntimeReconcileModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDockerRuntimeReconcile = factory(fallbackWindow);
    root.FolderViewPlusDockerRuntimeReconcileModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeReconcileFactory(fallbackWindow) {
    'use strict';

    const DEFAULT_INITIAL_DELAY_MS = 220;
    const DEFAULT_POLL_DELAY_MS = 4000;
    const DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME = '__fvplusDockerLifecycleRefresh';
    const DOCKER_LIFECYCLE_REFRESH_DELAYS_MS = Object.freeze([0, 750, 2000]);
    const DOCKER_LIFECYCLE_ACTIONS = new Set(['start', 'stop', 'pause', 'resume', 'restart']);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const folderEvents = deps.folderEvents || win.folderEvents || null;
        const readDockerListViewMode = typeof deps.readDockerListViewMode === 'function'
            ? deps.readDockerListViewMode
            : (() => 'basic');
        const isDockerHostUpdateCommand = typeof deps.isDockerHostUpdateCommand === 'function'
            ? deps.isDockerHostUpdateCommand
            : (() => false);
        const suspendDockerHostUpdateSync = typeof deps.suspendDockerHostUpdateSync === 'function'
            ? deps.suspendDockerHostUpdateSync
            : (() => 0);
        const isDockerHostUpdateSyncSuspended = typeof deps.isDockerHostUpdateSyncSuspended === 'function'
            ? deps.isDockerHostUpdateSyncSuspended
            : (() => false);
        const refreshDockerRuntimeStateInPlace = typeof deps.refreshDockerRuntimeStateInPlace === 'function'
            ? deps.refreshDockerRuntimeStateInPlace
            : (() => Promise.resolve(false));
        const waitForDockerRenderFrame = typeof deps.waitForDockerRenderFrame === 'function'
            ? deps.waitForDockerRenderFrame
            : (() => Promise.resolve());
        const appendDockerBulkUpdateTrace = typeof deps.appendDockerBulkUpdateTrace === 'function'
            ? deps.appendDockerBulkUpdateTrace
            : (() => false);
        const queueDockerSupportBundlePageSnapshot = typeof deps.queueDockerSupportBundlePageSnapshot === 'function'
            ? deps.queueDockerSupportBundlePageSnapshot
            : (() => {});
        const markDockerFatalBannerStep = typeof deps.markDockerFatalBannerStep === 'function'
            ? deps.markDockerFatalBannerStep
            : (() => {});
        const getDockerHostGuardsApi = typeof deps.getDockerHostGuardsApi === 'function'
            ? deps.getDockerHostGuardsApi
            : (() => null);
        const getDockerRuntimeContainerInfo = typeof deps.getDockerRuntimeContainerInfo === 'function'
            ? deps.getDockerRuntimeContainerInfo
            : (() => null);
        const initialDelayMsDefault = Math.max(0, Number(deps.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS) || DEFAULT_INITIAL_DELAY_MS);
        const pollDelayMsDefault = Math.max(0, Number(deps.pollDelayMs ?? DEFAULT_POLL_DELAY_MS) || DEFAULT_POLL_DELAY_MS);

        let dockerPostUpdateRenderReconcilePending = false;
        let dockerPostUpdateRenderReconcileQueued = false;
        let dockerPostUpdateRenderReconcileBound = false;
        let dockerHostOpenDockerPatchBound = false;
        let dockerUpdateActionClickCaptureBound = false;
        let dockerPostUpdateRuntimePollTimer = null;
        let dockerPostUpdateRuntimePollPending = false;
        let dockerPostUpdateRuntimePollIntervalMs = pollDelayMsDefault;
        let dockerLifecycleRefreshGeneration = 0;
        let pendingDockerLifecycleRequest = {};

        const bindDockerContainerContextStatePatch = () => {
            if (!win || (typeof win !== 'object' && typeof win !== 'function')) {
                return false;
            }
            const currentContextBuilder = win.addDockerContainerContext;
            if (typeof currentContextBuilder !== 'function') {
                return false;
            }
            if (currentContextBuilder.__fvplusDockerRuntimeStatePatched === true) {
                return true;
            }
            const originalContextBuilder = currentContextBuilder;
            const wrappedContextBuilder = function(...args) {
                const containerName = String(args?.[0] || '').trim();
                const runtimeEntry = containerName ? getDockerRuntimeContainerInfo(containerName) : null;
                const runtimeState = runtimeEntry?.info?.State && typeof runtimeEntry.info.State === 'object'
                    ? runtimeEntry.info.State
                    : null;
                if (runtimeState && typeof runtimeState.Running === 'boolean') {
                    args[3] = runtimeState.Running;
                    args[4] = runtimeState.Running && runtimeState.Paused === true;
                    if (typeof runtimeState.Updated === 'boolean') {
                        args[5] = runtimeState.Updated === false ? 1 : 0;
                    }
                    if (typeof runtimeState.Autostart === 'boolean') {
                        args[6] = runtimeState.Autostart;
                    }
                }
                return originalContextBuilder.apply(this, args);
            };
            try {
                wrappedContextBuilder.__fvplusDockerRuntimeStatePatched = true;
                wrappedContextBuilder.__fvplusOriginal = originalContextBuilder;
            } catch (_error) {}
            win.addDockerContainerContext = wrappedContextBuilder;
            return true;
        };

        const clearPostUpdateRuntimePoll = () => {
            if (dockerPostUpdateRuntimePollTimer) {
                const cancel = typeof win?.clearTimeout === 'function'
                    ? win.clearTimeout.bind(win)
                    : clearTimeout;
                cancel(dockerPostUpdateRuntimePollTimer);
                dockerPostUpdateRuntimePollTimer = null;
            }
        };

        const schedulePostUpdateRuntimePoll = (reason = 'post-update-runtime-poll', delayMs = pollDelayMsDefault) => {
            if (!isDockerHostUpdateSyncSuspended()) {
                clearPostUpdateRuntimePoll();
                return;
            }
            if (dockerPostUpdateRuntimePollTimer || dockerPostUpdateRuntimePollPending) {
                return;
            }
            const safeReason = String(reason || '').trim() || 'post-update-runtime-poll';
            const safeDelayMs = Math.max(0, Number(delayMs) || 0);
            const schedule = typeof win?.setTimeout === 'function'
                ? win.setTimeout.bind(win)
                : setTimeout;
            dockerPostUpdateRuntimePollTimer = schedule(() => {
                dockerPostUpdateRuntimePollTimer = null;
                if (!isDockerHostUpdateSyncSuspended()) {
                    return;
                }
                dockerPostUpdateRuntimePollPending = true;
                appendDockerBulkUpdateTrace('postUpdateRuntimePoll', {
                    reason: safeReason,
                    pollDelayMs: dockerPostUpdateRuntimePollIntervalMs
                });
                Promise.resolve(refreshDockerRuntimeStateInPlace({
                    liveUpdateStatus: true
                }))
                    .then((success) => {
                        appendDockerBulkUpdateTrace('postUpdateRuntimePollResult', {
                            reason: safeReason,
                            success: success === true
                        });
                    })
                    .catch(() => {
                        appendDockerBulkUpdateTrace('postUpdateRuntimePollResult', {
                            reason: safeReason,
                            success: false
                        });
                    })
                    .finally(() => {
                        dockerPostUpdateRuntimePollPending = false;
                        if (isDockerHostUpdateSyncSuspended()) {
                            schedulePostUpdateRuntimePoll('post-update-runtime-poll', dockerPostUpdateRuntimePollIntervalMs);
                        } else {
                            queueDockerSupportBundlePageSnapshot('post-update-runtime-poll-complete', 80);
                        }
                    });
            }, safeDelayMs);
        };

        const queuePostUpdateRenderReconcile = (reason = 'docker-post-folders-creation') => {
            if (!isDockerHostUpdateSyncSuspended()) {
                return;
            }
            const safeReason = String(reason || '').trim() || 'docker-post-folders-creation';
            if (dockerPostUpdateRenderReconcilePending) {
                dockerPostUpdateRenderReconcileQueued = true;
                appendDockerBulkUpdateTrace('postUpdateRenderReconcileQueued', {
                    reason: safeReason
                });
                return;
            }
            dockerPostUpdateRenderReconcilePending = true;
            Promise.resolve()
                .then(() => waitForDockerRenderFrame())
                .then(() => {
                    if (!isDockerHostUpdateSyncSuspended()) {
                        return false;
                    }
                    appendDockerBulkUpdateTrace('postUpdateRenderReconcile', {
                        reason: safeReason
                    });
                    return refreshDockerRuntimeStateInPlace({
                        followupDelayMs: 650,
                        liveUpdateStatus: true
                    });
                })
                .catch(() => {})
                .finally(() => {
                    dockerPostUpdateRenderReconcilePending = false;
                    if (!dockerPostUpdateRenderReconcileQueued) {
                        return;
                    }
                    dockerPostUpdateRenderReconcileQueued = false;
                    if (isDockerHostUpdateSyncSuspended()) {
                        queuePostUpdateRenderReconcile('post-render-requeue');
                    }
                });
        };

        const bindPostUpdateRenderReconcile = () => {
            if (dockerPostUpdateRenderReconcileBound || typeof folderEvents?.addEventListener !== 'function') {
                return;
            }
            folderEvents.addEventListener('docker-post-folders-creation', () => {
                queuePostUpdateRenderReconcile('docker-post-folders-creation');
            });
            dockerPostUpdateRenderReconcileBound = true;
        };

        const armPostUpdateRuntimeReconcileWindow = (durationMs = 0, options = {}) => {
            const resolvedUntil = suspendDockerHostUpdateSync(durationMs);
            const initialDelayMs = Math.max(
                0,
                Number(options?.initialDelayMs ?? initialDelayMsDefault) || 0
            );
            const pollDelayMs = Math.max(
                0,
                Number(options?.pollDelayMs ?? pollDelayMsDefault) || 0
            );
            appendDockerBulkUpdateTrace('reconcileWindowArmed', {
                durationMs: Math.max(0, Number(durationMs) || 0),
                initialDelayMs,
                pollDelayMs,
                strategy: 'event-driven-post-render-and-poll'
            });
            dockerPostUpdateRuntimePollIntervalMs = pollDelayMs;
            schedulePostUpdateRuntimePoll('reconcile-window-armed', initialDelayMs);
            return resolvedUntil;
        };

        const parseHostUpdateContainerNames = (command) => {
            const rawCommand = String(command || '').trim();
            if (!isDockerHostUpdateCommand(rawCommand)) {
                return [];
            }
            return rawCommand
                .replace(/^\s*update_container(?:\s|$)/i, '')
                .split('*')
                .map((entry) => String(entry || '').trim())
                .filter(Boolean);
        };

        const armForHostCommand = (command, origin = 'host-openDocker') => {
            const rawCommand = String(command || '').trim();
            if (!isDockerHostUpdateCommand(rawCommand)) {
                return false;
            }
            const containerNames = parseHostUpdateContainerNames(rawCommand);
            appendDockerBulkUpdateTrace('hostUpdateCommand', {
                origin: String(origin || '').trim() || 'host-openDocker',
                currentPage: String(win?.location?.pathname || ''),
                listViewMode: readDockerListViewMode(),
                containerCount: containerNames.length,
                containerNames: containerNames.slice(0, 10)
            });
            armPostUpdateRuntimeReconcileWindow(120000, {
                initialDelayMs: initialDelayMsDefault,
                pollDelayMs: pollDelayMsDefault
            });
            queueDockerSupportBundlePageSnapshot('host-update-command', 80);
            return true;
        };

        const bindHostOpenDockerPatch = () => {
            if (dockerHostOpenDockerPatchBound || !win || typeof win !== 'object') {
                return;
            }
            if (typeof win.openDocker !== 'function') {
                getDockerHostGuardsApi()?.reportMissingHook?.('window.openDocker', 'Docker host openDocker hook was unavailable during bootstrap.', {
                    phase: 'hook-install',
                    category: 'host-hook-missing',
                    detailLabel: 'Missing host hooks',
                    details: ['window.openDocker was not a function when FolderView Plus initialized.']
                });
                return;
            }
            const currentOpenDocker = win.openDocker;
            getDockerHostGuardsApi()?.captureHostHook?.('window.openDocker', currentOpenDocker, {
                step: 'Docker openDocker hook captured',
                note: 'captured'
            });
            if (currentOpenDocker && currentOpenDocker.__fvplusDockerUpdatePatched === true) {
                dockerHostOpenDockerPatchBound = true;
                return;
            }
            const originalOpenDocker = currentOpenDocker;
            const wrappedOpenDocker = function(...args) {
                const rawCommand = String(args?.[0] || '').trim();
                const isUpdateCommand = isDockerHostUpdateCommand(rawCommand);
                const containerNames = parseHostUpdateContainerNames(rawCommand);
                getDockerHostGuardsApi()?.noteHookInvocation?.('window.openDocker', {
                    note: isUpdateCommand ? 'update_container invoked' : 'invoked',
                    details: {
                        commandType: isUpdateCommand ? 'update_container' : 'other',
                        containerCount: containerNames.length,
                        containerNames: containerNames.slice(0, 10)
                    }
                });
                armForHostCommand(args[0], 'host-openDocker');
                return originalOpenDocker.apply(this, args);
            };
            try {
                wrappedOpenDocker.__fvplusDockerUpdatePatched = true;
                wrappedOpenDocker.__fvplusOriginal = originalOpenDocker;
            } catch (_error) {}
            win.openDocker = wrappedOpenDocker;
            dockerHostOpenDockerPatchBound = true;
            getDockerHostGuardsApi()?.noteHookWrapped?.('window.openDocker', {
                step: 'Docker openDocker hook captured',
                note: 'wrapped'
            });
            markDockerFatalBannerStep('Docker openDocker hook captured');
        };

        const shouldArmFromClick = (target) => {
            const actionNode = target instanceof Element
                ? target.closest('#docker_list td.updatecolumn a.exec, #docker_view td.updatecolumn a.exec')
                : null;
            if (!(actionNode instanceof HTMLAnchorElement)) {
                return false;
            }
            const rawOnClick = String(actionNode.getAttribute('onclick') || '').trim();
            const updateText = String(actionNode.closest('td.updatecolumn')?.textContent || '').replace(/\s+/g, ' ').trim();
            return /(?:^|[^A-Za-z0-9_])(?:updateFolder|forceUpdateFolder)\(/.test(rawOnClick)
                || /\b(?:apply update|force update)\b/i.test(updateText);
        };

        const handleUpdateActionClickCapture = (event) => {
            if (!shouldArmFromClick(event?.target)) {
                return;
            }
            appendDockerBulkUpdateTrace('updateActionClick', {
                currentPage: String(win?.location?.pathname || ''),
                listViewMode: readDockerListViewMode()
            });
            armPostUpdateRuntimeReconcileWindow(120000, {
                initialDelayMs: initialDelayMsDefault,
                pollDelayMs: pollDelayMsDefault
            });
            queueDockerSupportBundlePageSnapshot('update-action-click', 80);
        };

        const bindUpdateActionClickCapture = () => {
            if (dockerUpdateActionClickCaptureBound || typeof doc?.addEventListener !== 'function') {
                return;
            }
            doc.addEventListener('click', handleUpdateActionClickCapture, true);
            dockerUpdateActionClickCaptureBound = true;
        };

        const isDockerLifecycleRequest = (request) => {
            const action = String(request?.action || '').trim().toLowerCase();
            const container = String(request?.container || '').trim();
            return DOCKER_LIFECYCLE_ACTIONS.has(action) && container.length > 0;
        };

        const runDockerLifecycleRefresh = (request = {}) => {
            const action = String(request?.action || '').trim().toLowerCase();
            const generation = ++dockerLifecycleRefreshGeneration;
            appendDockerBulkUpdateTrace('lifecycleRefreshScheduled', {
                action,
                strategy: 'incremental-runtime-rows',
                attempts: DOCKER_LIFECYCLE_REFRESH_DELAYS_MS.length
            });
            DOCKER_LIFECYCLE_REFRESH_DELAYS_MS.forEach((delayMs, attemptIndex) => {
                const schedule = typeof win?.setTimeout === 'function'
                    ? win.setTimeout.bind(win)
                    : setTimeout;
                schedule(() => {
                    if (generation !== dockerLifecycleRefreshGeneration) {
                        return;
                    }
                    Promise.resolve(refreshDockerRuntimeStateInPlace({
                        liveUpdateStatus: true,
                        preserveGroupedDom: true
                    }))
                        .then((success) => {
                            appendDockerBulkUpdateTrace('lifecycleRefreshResult', {
                                action,
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: success === true
                            });
                        })
                        .catch(() => {
                            appendDockerBulkUpdateTrace('lifecycleRefreshResult', {
                                action,
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: false
                            });
                        });
                }, delayMs);
            });
        };

        const bindLifecycleEventControlPatch = () => {
            if (!win || (typeof win !== 'object' && typeof win !== 'function')) {
                return false;
            }
            if (typeof win[DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME] !== 'function') {
                win[DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME] = () => {
                    runDockerLifecycleRefresh(pendingDockerLifecycleRequest);
                };
            }
            if (typeof win.eventControl !== 'function') {
                return false;
            }
            const currentEventControl = win.eventControl;
            if (currentEventControl.__fvplusDockerLifecyclePatched === true) {
                return true;
            }
            getDockerHostGuardsApi()?.captureHostHook?.('window.eventControl', currentEventControl, {
                step: 'Docker lifecycle action hook captured',
                note: 'captured'
            });
            const originalEventControl = currentEventControl;
            const wrappedEventControl = function(...args) {
                const request = args?.[0] && typeof args[0] === 'object' ? args[0] : {};
                const refreshTarget = String(args?.[1] || '').trim();
                if (
                    isDockerLifecycleRequest(request)
                    && (refreshTarget === 'loadlist' || refreshTarget === DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME)
                ) {
                    const interceptedHostLoadlist = refreshTarget === 'loadlist';
                    args[1] = DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME;
                    const callbackRequest = {
                        action: String(request.action || '').trim().toLowerCase(),
                        container: String(request.container || '').trim()
                    };
                    pendingDockerLifecycleRequest = callbackRequest;
                    if (interceptedHostLoadlist) {
                        appendDockerBulkUpdateTrace('lifecycleLoadlistIntercepted', {
                            action: callbackRequest.action,
                            strategy: 'incremental-runtime-rows'
                        });
                    }
                }
                return originalEventControl.apply(this, args);
            };
            try {
                wrappedEventControl.__fvplusDockerLifecyclePatched = true;
                wrappedEventControl.__fvplusOriginal = originalEventControl;
            } catch (_error) {}
            win.eventControl = wrappedEventControl;
            getDockerHostGuardsApi()?.noteHookWrapped?.('window.eventControl', {
                step: 'Docker lifecycle action hook captured',
                note: 'wrapped'
            });
            markDockerFatalBannerStep('Docker lifecycle action hook captured');
            return true;
        };

        return {
            queuePostUpdateRenderReconcile,
            bindPostUpdateRenderReconcile,
            armForHostCommand,
            bindHostOpenDockerPatch,
            armPostUpdateRuntimeReconcileWindow,
            handleUpdateActionClickCapture,
            bindUpdateActionClickCapture,
            bindDockerContainerContextStatePatch,
            isDockerLifecycleRequest,
            runDockerLifecycleRefresh,
            bindLifecycleEventControlPatch,
            getLifecycleRefreshCallbackName: () => DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME
        };
    };

    return {
        DEFAULT_INITIAL_DELAY_MS,
        DEFAULT_POLL_DELAY_MS,
        DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME,
        DOCKER_LIFECYCLE_REFRESH_DELAYS_MS,
        createApi
    };
}));
