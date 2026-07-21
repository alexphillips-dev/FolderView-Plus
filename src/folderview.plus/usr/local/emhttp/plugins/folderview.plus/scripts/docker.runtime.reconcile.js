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
    const DEFAULT_POLL_COUNT = 2;
    const POST_UPDATE_CALLBACK_WINDOW_MS = 15000;
    const DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME = '__fvplusDockerPostUpdateRefresh';
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
        const getDockerHostGuardsApi = typeof deps.getDockerHostGuardsApi === 'function'
            ? deps.getDockerHostGuardsApi
            : (() => null);
        const getDockerRuntimeContainerInfo = typeof deps.getDockerRuntimeContainerInfo === 'function'
            ? deps.getDockerRuntimeContainerInfo
            : (() => null);
        const isDockerLifecycleStateSettled = typeof deps.isDockerLifecycleStateSettled === 'function'
            ? deps.isDockerLifecycleStateSettled
            : null;
        const prepareDockerLifecycleSurface = typeof deps.prepareDockerLifecycleSurface === 'function'
            ? deps.prepareDockerLifecycleSurface
            : (() => false);
        const getDockerLifecycleStateSnapshot = typeof deps.getDockerLifecycleStateSnapshot === 'function'
            ? deps.getDockerLifecycleStateSnapshot
            : (() => null);
        const finalizeDockerLifecycleSurface = typeof deps.finalizeDockerLifecycleSurface === 'function'
            ? deps.finalizeDockerLifecycleSurface
            : (() => false);
        const dockerLifecycleRefreshDelaysMs = Array.isArray(deps.lifecycleRefreshDelaysMs)
            && deps.lifecycleRefreshDelaysMs.length > 0
            ? Object.freeze(deps.lifecycleRefreshDelaysMs.map((delayMs) => Math.max(0, Number(delayMs) || 0)))
            : DOCKER_LIFECYCLE_REFRESH_DELAYS_MS;
        const requestedLifecycleCallbackName = String(deps.lifecycleRefreshCallbackName || '').trim();
        const dockerLifecycleRefreshCallbackName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(requestedLifecycleCallbackName)
            ? requestedLifecycleCallbackName
            : DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME;
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
        let dockerPostUpdateRuntimePollRemaining = 0;
        let dockerLifecycleRefreshGeneration = 0;
        let dockerLifecycleSettledGeneration = 0;
        let dockerLifecycleFinalizedGeneration = 0;
        let pendingDockerLifecycleRequest = {};

        const bindDockerContainerContextStatePatch = () => {
            if (!win || (typeof win !== 'object' && typeof win !== 'function')) {
                return false;
            }
            const hostGuards = getDockerHostGuardsApi();
            if (!hostGuards || typeof hostGuards.wrapHostHook !== 'function') {
                return false;
            }
            hostGuards.wrapHostHook('addDockerContainerContext', ({ args, invokeOriginal }) => {
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
                    appendDockerBulkUpdateTrace('lifecycleContextStateResolved', {
                        containerName,
                        running: runtimeState.Running,
                        paused: runtimeState.Running && runtimeState.Paused === true,
                        autostart: runtimeState.Autostart === true
                    });
                }
                return invokeOriginal(...args);
            }, {
                legacyAlias: 'addDockerContainerContext_original',
                captureStep: 'Docker container context hook captured',
                missingMessage: 'Docker host container context hook was unavailable during bootstrap.',
                missingDetails: ['window.addDockerContainerContext was not a function when FolderView Plus initialized.'],
                describeInvocation: (args) => ({
                    container: String(args?.[0] || '').trim(),
                    runtimeStateAvailable: !!getDockerRuntimeContainerInfo(String(args?.[0] || '').trim())?.info?.State
                })
            });
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
            if (!isDockerHostUpdateSyncSuspended() || dockerPostUpdateRuntimePollRemaining <= 0) {
                clearPostUpdateRuntimePoll();
                dockerPostUpdateRuntimePollRemaining = 0;
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
                    dockerPostUpdateRuntimePollRemaining = 0;
                    return;
                }
                dockerPostUpdateRuntimePollRemaining = Math.max(0, dockerPostUpdateRuntimePollRemaining - 1);
                dockerPostUpdateRuntimePollPending = true;
                appendDockerBulkUpdateTrace('postUpdateRuntimePoll', {
                    reason: safeReason,
                    pollDelayMs: dockerPostUpdateRuntimePollIntervalMs,
                    remainingPolls: dockerPostUpdateRuntimePollRemaining
                });
                Promise.resolve(refreshDockerRuntimeStateInPlace({
                    liveUpdateStatus: true,
                    preserveGroupedDom: true
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
                        if (isDockerHostUpdateSyncSuspended() && dockerPostUpdateRuntimePollRemaining > 0) {
                            schedulePostUpdateRuntimePoll('post-update-runtime-poll', dockerPostUpdateRuntimePollIntervalMs);
                        } else {
                            queueDockerSupportBundlePageSnapshot('post-update-runtime-poll-complete', 80);
                        }
                    });
            }, safeDelayMs);
        };

        const queuePostUpdateRuntimeRefresh = (reason = 'host-update-callback', options = {}) => {
            const tailPolls = Math.max(0, Number(options?.tailPolls ?? 1) || 0);
            suspendDockerHostUpdateSync(POST_UPDATE_CALLBACK_WINDOW_MS);
            dockerPostUpdateRuntimePollRemaining = Math.max(
                dockerPostUpdateRuntimePollRemaining,
                1 + tailPolls
            );
            clearPostUpdateRuntimePoll();
            appendDockerBulkUpdateTrace('postUpdateRuntimeRefreshQueued', {
                reason: String(reason || '').trim() || 'host-update-callback',
                tailPolls
            });
            schedulePostUpdateRuntimePoll(reason, 0);
        };

        const getPostUpdateRefreshCallbackName = () => {
            if (!win || (typeof win !== 'object' && typeof win !== 'function')) {
                return DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME;
            }
            if (typeof win[DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME] !== 'function') {
                win[DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME] = () => {
                    queuePostUpdateRuntimeRefresh('host-update-dialog-callback', { tailPolls: 1 });
                };
            }
            return DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME;
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
                        liveUpdateStatus: true,
                        preserveGroupedDom: true
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
            const pollCount = Math.max(
                1,
                Number(options?.pollCount ?? DEFAULT_POLL_COUNT) || DEFAULT_POLL_COUNT
            );
            appendDockerBulkUpdateTrace('reconcileWindowArmed', {
                durationMs: Math.max(0, Number(durationMs) || 0),
                initialDelayMs,
                pollDelayMs,
                pollCount,
                strategy: 'event-driven-incremental-with-finite-backstops'
            });
            dockerPostUpdateRuntimePollIntervalMs = pollDelayMs;
            dockerPostUpdateRuntimePollRemaining = Math.max(dockerPostUpdateRuntimePollRemaining, pollCount);
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
            const hostGuards = getDockerHostGuardsApi();
            if (!hostGuards || typeof hostGuards.wrapHostHook !== 'function') {
                return;
            }
            hostGuards.wrapHostHook('openDocker', ({ args, invokeOriginal }) => {
                const rawCommand = String(args?.[0] || '').trim();
                const isUpdateCommand = isDockerHostUpdateCommand(rawCommand);
                const containerNames = parseHostUpdateContainerNames(rawCommand);
                armForHostCommand(args[0], 'host-openDocker');
                if (isUpdateCommand) {
                    const previousCallback = String(args?.[3] || '').trim();
                    args[3] = getPostUpdateRefreshCallbackName();
                    appendDockerBulkUpdateTrace('hostUpdateRefreshCallbackIntercepted', {
                        previousCallback: previousCallback || 'none',
                        replacementCallback: args[3],
                        containerCount: containerNames.length
                    });
                }
                return invokeOriginal(...args);
            }, {
                legacyAlias: 'openDocker_original',
                captureStep: 'Docker openDocker hook captured',
                missingMessage: 'Docker host openDocker hook was unavailable during bootstrap.',
                missingDetails: ['window.openDocker was not a function when FolderView Plus initialized.'],
                describeInvocation: (args) => {
                    const command = String(args?.[0] || '').trim();
                    const isUpdate = isDockerHostUpdateCommand(command);
                    const names = parseHostUpdateContainerNames(command);
                    return {
                        commandType: isUpdate ? 'update_container' : 'other',
                        containerCount: names.length,
                        containerNames: names.slice(0, 10)
                    };
                }
            });
            dockerHostOpenDockerPatchBound = true;
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
            dockerLifecycleSettledGeneration = 0;
            dockerLifecycleFinalizedGeneration = 0;
            const finalizeGeneration = (outcome = {}) => {
                if (generation !== dockerLifecycleRefreshGeneration || generation === dockerLifecycleFinalizedGeneration) {
                    return;
                }
                dockerLifecycleFinalizedGeneration = generation;
                try {
                    finalizeDockerLifecycleSurface(request, {
                        generation,
                        ...outcome
                    });
                } catch (_error) {
                    // Diagnostics and visual cleanup must never break host lifecycle actions.
                }
            };
            appendDockerBulkUpdateTrace('lifecycleRefreshScheduled', {
                action,
                containerId: String(request?.container || '').trim(),
                strategy: 'incremental-runtime-rows',
                attempts: dockerLifecycleRefreshDelaysMs.length
            });
            dockerLifecycleRefreshDelaysMs.forEach((delayMs, attemptIndex) => {
                const schedule = typeof win?.setTimeout === 'function'
                    ? win.setTimeout.bind(win)
                    : setTimeout;
                schedule(() => {
                    if (
                        generation !== dockerLifecycleRefreshGeneration
                        || generation === dockerLifecycleSettledGeneration
                    ) {
                        return;
                    }
                    Promise.resolve(refreshDockerRuntimeStateInPlace({
                        liveUpdateStatus: true,
                        preserveGroupedDom: true
                    }))
                        .then((success) => {
                            const observedState = getDockerLifecycleStateSnapshot(request);
                            const settled = success === true
                                && isDockerLifecycleStateSettled
                                && isDockerLifecycleStateSettled(request) === true;
                            if (settled) {
                                dockerLifecycleSettledGeneration = generation;
                            }
                            appendDockerBulkUpdateTrace('lifecycleRefreshResult', {
                                action,
                                containerId: String(request?.container || '').trim(),
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: success === true,
                                settled: settled === true,
                                observedState
                            });
                            if (settled) {
                                finalizeGeneration({
                                    reason: 'settled',
                                    settled: true,
                                    success: success === true,
                                    attempt: attemptIndex + 1,
                                    observedState
                                });
                            } else if (attemptIndex === dockerLifecycleRefreshDelaysMs.length - 1) {
                                finalizeGeneration({
                                    reason: 'attempts-exhausted',
                                    settled: false,
                                    success: success === true,
                                    attempt: attemptIndex + 1,
                                    observedState
                                });
                            }
                        })
                        .catch(() => {
                            appendDockerBulkUpdateTrace('lifecycleRefreshResult', {
                                action,
                                containerId: String(request?.container || '').trim(),
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: false
                            });
                            if (attemptIndex === dockerLifecycleRefreshDelaysMs.length - 1) {
                                finalizeGeneration({
                                    reason: 'attempts-exhausted',
                                    settled: false,
                                    success: false,
                                    attempt: attemptIndex + 1,
                                    observedState: getDockerLifecycleStateSnapshot(request)
                                });
                            }
                        });
                }, delayMs);
            });
        };

        const bindLifecycleEventControlPatch = () => {
            if (!win || (typeof win !== 'object' && typeof win !== 'function')) {
                return false;
            }
            if (typeof win[dockerLifecycleRefreshCallbackName] !== 'function') {
                win[dockerLifecycleRefreshCallbackName] = () => {
                    runDockerLifecycleRefresh(pendingDockerLifecycleRequest);
                };
            }
            if (typeof win.eventControl !== 'function') {
                return false;
            }
            const hostGuards = getDockerHostGuardsApi();
            if (!hostGuards || typeof hostGuards.wrapHostHook !== 'function') {
                return false;
            }
            hostGuards.wrapHostHook('eventControl', ({ args, invokeOriginal }) => {
                const request = args?.[0] && typeof args[0] === 'object' ? args[0] : {};
                const refreshTarget = String(args?.[1] || '').trim();
                if (
                    isDockerLifecycleRequest(request)
                    && (refreshTarget === 'loadlist' || refreshTarget === dockerLifecycleRefreshCallbackName)
                ) {
                    const interceptedHostLoadlist = refreshTarget === 'loadlist';
                    args[1] = dockerLifecycleRefreshCallbackName;
                    const callbackRequest = {
                        action: String(request.action || '').trim().toLowerCase(),
                        container: String(request.container || '').trim()
                    };
                    pendingDockerLifecycleRequest = callbackRequest;
                    prepareDockerLifecycleSurface(callbackRequest);
                    if (interceptedHostLoadlist) {
                        appendDockerBulkUpdateTrace('lifecycleLoadlistIntercepted', {
                            action: callbackRequest.action,
                            containerId: callbackRequest.container,
                            strategy: 'incremental-runtime-rows'
                        });
                    }
                }
                return invokeOriginal(...args);
            }, {
                legacyAlias: 'eventControl_original',
                captureStep: 'Docker lifecycle action hook captured',
                missingMessage: 'Docker host eventControl hook was unavailable during bootstrap.',
                missingDetails: ['window.eventControl was not a function when FolderView Plus initialized.'],
                describeInvocation: (args) => ({
                    action: String(args?.[0]?.action || '').trim(),
                    hasContainer: String(args?.[0]?.container || '').trim().length > 0,
                    refreshTarget: String(args?.[1] || '').trim()
                })
            });
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
            getLifecycleRefreshCallbackName: () => dockerLifecycleRefreshCallbackName
        };
    };

    return {
        DEFAULT_INITIAL_DELAY_MS,
        DEFAULT_POLL_DELAY_MS,
        DEFAULT_POLL_COUNT,
        POST_UPDATE_CALLBACK_WINDOW_MS,
        DOCKER_POST_UPDATE_REFRESH_CALLBACK_NAME,
        DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME,
        DOCKER_LIFECYCLE_REFRESH_DELAYS_MS,
        createApi
    };
}));
