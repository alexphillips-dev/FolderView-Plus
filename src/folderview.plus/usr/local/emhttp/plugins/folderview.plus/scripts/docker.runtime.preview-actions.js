// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerPreviewActions = factory();
    root.FolderViewPlusDockerPreviewActionsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const PREVIEW_CONTEXT_DIAGNOSTICS_STORAGE_KEY = 'fv.support.bundle.docker.previewContextBridge.v1';
    const PREVIEW_CONTEXT_DIAGNOSTICS_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    const PREVIEW_CONTEXT_ROW_MODES = Object.freeze(['1', '2', '3', '4', 'unlimited', 'unknown']);
    const PREVIEW_CONTEXT_ROW_BUCKETS = Object.freeze(['1', '2', '3', '4', '5+', 'unknown']);
    const PREVIEW_CONTEXT_COUNTER_KEYS = Object.freeze([
        'bindAttempts', 'boundTargets', 'bindFailures', 'keyboardTargetsMissing', 'finalizationPasses',
        'eligibleTargetsAudited', 'boundTargetsAudited', 'missingBridgeTargets', 'handlerIntegrityFailures',
        'dispatchAttempts', 'dispatchSuccesses', 'dispatchFailures', 'quickActionBypasses', 'storageWriteFailures'
    ]);
    const CHILD_FOLDER_PREVIEW_COUNTER_KEYS = Object.freeze([
        'chipsRendered', 'bindings', 'menuOpenAttempts', 'menuOpens', 'menuOpenFailures'
    ]);
    const CHILD_FOLDER_PREVIEW_INPUT_METHODS = Object.freeze(['mouse', 'keyboard', 'contextmenu', 'touch', 'unknown']);
    const PREVIEW_CONTEXT_FAILURE_REASONS = Object.freeze([
        'item-missing', 'native-trigger-missing', 'keyboard-target-missing', 'bridge-missing',
        'handler-missing', 'native-event-unavailable', 'dispatch-failed'
    ]);
    const PREVIEW_CONTEXT_METRIC_KEYS = Object.freeze([
        'bindings', 'audits', 'eligible', 'bound', 'missing', 'handlerFailures',
        'dispatchAttempts', 'dispatchSuccesses', 'dispatchFailures'
    ]);
    const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key);
    const capPreviewContextCount = (value) => Math.max(0, Math.min(1000000, Math.round(Number(value) || 0)));
    const normalizePreviewContextRowMode = (value) => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === '0' || raw === 'unlimited') return 'unlimited';
        return PREVIEW_CONTEXT_ROW_MODES.includes(raw) ? raw : 'unknown';
    };
    const normalizePreviewContextRowIndex = (value) => {
        const parsed = Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
        return parsed > 0 ? parsed : 0;
    };
    const getPreviewContextRowBucket = (value) => {
        const index = normalizePreviewContextRowIndex(value);
        return index > 4 ? '5+' : (index > 0 ? String(index) : 'unknown');
    };
    const createPreviewContextMetricMap = (keys) => Object.fromEntries(keys.map((key) => [key, Object.fromEntries(
        PREVIEW_CONTEXT_METRIC_KEYS.map((metric) => [metric, 0])
    )]));
    const createPreviewContextDiagnosticsState = (nowIso) => ({
        schemaVersion: 1,
        sessionStartedAt: nowIso,
        updatedAt: nowIso,
        counters: Object.fromEntries(PREVIEW_CONTEXT_COUNTER_KEYS.map((key) => [key, 0])),
        rowModes: createPreviewContextMetricMap(PREVIEW_CONTEXT_ROW_MODES),
        rowIndexes: createPreviewContextMetricMap(PREVIEW_CONTEXT_ROW_BUCKETS),
        triggerSources: { icon: 0, name: 0, status: 0, card: 0, unknown: 0 },
        inputMethods: { mouse: 0, keyboard: 0, unknown: 0 },
        failureReasons: Object.fromEntries(PREVIEW_CONTEXT_FAILURE_REASONS.map((key) => [key, 0])),
        childFolderPreview: {
            counters: Object.fromEntries(CHILD_FOLDER_PREVIEW_COUNTER_KEYS.map((key) => [key, 0])),
            inputMethods: Object.fromEntries(CHILD_FOLDER_PREVIEW_INPUT_METHODS.map((key) => [key, 0])),
            lastEvent: null
        },
        lastEvent: null
    });
    const createPreviewContextDiagnostics = (win) => {
        const nowIso = () => new Date().toISOString();
        const state = createPreviewContextDiagnosticsState(nowIso());
        let storage = null;
        try { storage = win?.localStorage || null; } catch (_error) { storage = null; }
        try {
            const stored = JSON.parse(String(storage?.getItem(PREVIEW_CONTEXT_DIAGNOSTICS_STORAGE_KEY) || 'null'));
            const storedAt = Date.parse(String(stored?.updatedAt || ''));
            if (stored?.schemaVersion === 1 && Number.isFinite(storedAt) && Date.now() - storedAt <= PREVIEW_CONTEXT_DIAGNOSTICS_MAX_AGE_MS) {
                state.sessionStartedAt = String(stored.sessionStartedAt || state.sessionStartedAt);
                PREVIEW_CONTEXT_COUNTER_KEYS.forEach((key) => { state.counters[key] = capPreviewContextCount(stored.counters?.[key]); });
                [
                    [state.rowModes, stored.rowModes, PREVIEW_CONTEXT_ROW_MODES],
                    [state.rowIndexes, stored.rowIndexes, PREVIEW_CONTEXT_ROW_BUCKETS]
                ].forEach(([target, source, keys]) => keys.forEach((key) => PREVIEW_CONTEXT_METRIC_KEYS.forEach((metric) => {
                    target[key][metric] = capPreviewContextCount(source?.[key]?.[metric]);
                })));
                Object.keys(state.triggerSources).forEach((key) => { state.triggerSources[key] = capPreviewContextCount(stored.triggerSources?.[key]); });
                Object.keys(state.inputMethods).forEach((key) => { state.inputMethods[key] = capPreviewContextCount(stored.inputMethods?.[key]); });
                PREVIEW_CONTEXT_FAILURE_REASONS.forEach((key) => { state.failureReasons[key] = capPreviewContextCount(stored.failureReasons?.[key]); });
                CHILD_FOLDER_PREVIEW_COUNTER_KEYS.forEach((key) => {
                    state.childFolderPreview.counters[key] = capPreviewContextCount(stored.childFolderPreview?.counters?.[key]);
                });
                CHILD_FOLDER_PREVIEW_INPUT_METHODS.forEach((key) => {
                    state.childFolderPreview.inputMethods[key] = capPreviewContextCount(stored.childFolderPreview?.inputMethods?.[key]);
                });
                const childFolderLast = stored.childFolderPreview?.lastEvent;
                if (childFolderLast && typeof childFolderLast === 'object' && !Array.isArray(childFolderLast)) {
                    state.childFolderPreview.lastEvent = {
                        at: String(childFolderLast.at || ''),
                        type: ['render', 'binding', 'menu-open'].includes(childFolderLast.type) ? childFolderLast.type : 'menu-open',
                        outcome: ['success', 'failure'].includes(childFolderLast.outcome) ? childFolderLast.outcome : 'failure',
                        inputMethod: CHILD_FOLDER_PREVIEW_INPUT_METHODS.includes(childFolderLast.inputMethod)
                            ? childFolderLast.inputMethod
                            : 'unknown',
                        reason: childFolderLast.reason === 'document-unavailable' ? 'document-unavailable' : ''
                    };
                }
                const last = stored.lastEvent;
                if (last && typeof last === 'object' && !Array.isArray(last)) {
                    state.lastEvent = {
                        at: String(last.at || ''),
                        type: ['bind', 'finalization', 'dispatch'].includes(last.type) ? last.type : 'dispatch',
                        outcome: ['success', 'failure', 'warning'].includes(last.outcome) ? last.outcome : 'failure',
                        rowMode: normalizePreviewContextRowMode(last.rowMode),
                        rowIndex: normalizePreviewContextRowIndex(last.rowIndex),
                        triggerSource: hasOwn(state.triggerSources, last.triggerSource) ? last.triggerSource : 'unknown',
                        inputMethod: hasOwn(state.inputMethods, last.inputMethod) ? last.inputMethod : 'unknown',
                        reason: PREVIEW_CONTEXT_FAILURE_REASONS.includes(last.reason) ? last.reason : ''
                    };
                }
            }
        } catch (_error) {}
        let writePending = false;
        const flush = () => {
            writePending = false;
            state.updatedAt = nowIso();
            try {
                storage?.setItem(PREVIEW_CONTEXT_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(state));
                return true;
            } catch (_error) {
                state.counters.storageWriteFailures = capPreviewContextCount(state.counters.storageWriteFailures + 1);
                return false;
            }
        };
        const persist = (immediate = false) => {
            if (immediate || typeof win?.setTimeout !== 'function') return flush();
            if (!writePending) {
                writePending = true;
                win.setTimeout(flush, 0);
            }
            return true;
        };
        const bump = (target, key, amount = 1) => {
            if (target && hasOwn(target, key)) target[key] = capPreviewContextCount(target[key] + (Number(amount) || 0));
        };
        const modeMetric = (details, name, amount = 1) => {
            const mode = normalizePreviewContextRowMode(details.rowMode);
            bump(state.rowModes[mode], name, amount);
        };
        const rowMetric = (details, name, amount = 1) => {
            const bucket = getPreviewContextRowBucket(details.rowIndex);
            bump(state.rowIndexes[bucket], name, amount);
        };
        const metric = (details, name, amount = 1) => {
            modeMetric(details, name, amount);
            rowMetric(details, name, amount);
        };
        const setLastEvent = (type, details = {}) => {
            state.lastEvent = {
                at: nowIso(), type, outcome: details.outcome || 'success',
                rowMode: normalizePreviewContextRowMode(details.rowMode),
                rowIndex: normalizePreviewContextRowIndex(details.rowIndex),
                triggerSource: hasOwn(state.triggerSources, details.triggerSource) ? details.triggerSource : 'unknown',
                inputMethod: hasOwn(state.inputMethods, details.inputMethod) ? details.inputMethod : 'unknown',
                reason: PREVIEW_CONTEXT_FAILURE_REASONS.includes(details.reason) ? details.reason : ''
            };
        };
        const setChildFolderPreviewLastEvent = (type, details = {}) => {
            state.childFolderPreview.lastEvent = {
                at: nowIso(),
                type,
                outcome: details.success === false ? 'failure' : 'success',
                inputMethod: CHILD_FOLDER_PREVIEW_INPUT_METHODS.includes(details.inputMethod)
                    ? details.inputMethod
                    : 'unknown',
                reason: details.reason === 'document-unavailable' ? 'document-unavailable' : ''
            };
        };
        return Object.freeze({
            recordBinding(details = {}) {
                bump(state.counters, 'bindAttempts'); metric(details, 'bindings');
                if (details.success === true) bump(state.counters, 'boundTargets');
                else { bump(state.counters, 'bindFailures'); bump(state.failureReasons, details.reason); }
                if (details.keyboardTargetMissing === true) {
                    bump(state.counters, 'keyboardTargetsMissing');
                    bump(state.failureReasons, 'keyboard-target-missing');
                }
                setLastEvent('bind', { ...details, outcome: details.success === true ? (details.keyboardTargetMissing ? 'warning' : 'success') : 'failure' });
                persist();
            },
            recordFinalization(details = {}) {
                bump(state.counters, 'finalizationPasses'); modeMetric(details, 'audits');
                [['eligibleTargetsAudited', 'eligible'], ['boundTargetsAudited', 'bound'], ['missingBridgeTargets', 'missing'], ['handlerIntegrityFailures', 'handlerFailures']]
                    .forEach(([counter, name]) => { bump(state.counters, counter, details[counter]); modeMetric(details, name, details[counter]); });
                (details.rows || []).forEach((row) => {
                    const bucket = getPreviewContextRowBucket(row.rowIndex);
                    [['eligible', row.eligible], ['bound', row.bound], ['missing', row.missing], ['handlerFailures', row.handlerFailures]]
                        .forEach(([name, value]) => bump(state.rowIndexes[bucket], name, value));
                });
                const reason = details.handlerIntegrityFailures > 0 ? 'handler-missing' : (details.missingBridgeTargets > 0 ? 'bridge-missing' : '');
                if (reason) bump(state.failureReasons, reason, reason === 'handler-missing' ? details.handlerIntegrityFailures : details.missingBridgeTargets);
                setLastEvent('finalization', { ...details, reason, outcome: reason ? 'failure' : 'success' });
                persist();
            },
            recordDispatch(details = {}) {
                bump(state.counters, 'dispatchAttempts'); metric(details, 'dispatchAttempts');
                const success = details.success === true;
                bump(state.counters, success ? 'dispatchSuccesses' : 'dispatchFailures');
                metric(details, success ? 'dispatchSuccesses' : 'dispatchFailures');
                bump(state.triggerSources, details.triggerSource);
                bump(state.inputMethods, details.inputMethod);
                if (!success) bump(state.failureReasons, details.reason);
                setLastEvent('dispatch', { ...details, outcome: success ? 'success' : 'failure' });
                persist(true);
            },
            recordQuickActionBypass() { bump(state.counters, 'quickActionBypasses'); persist(); },
            recordChildFolderPreviewRender() {
                bump(state.childFolderPreview.counters, 'chipsRendered');
                setChildFolderPreviewLastEvent('render');
                persist();
            },
            recordChildFolderPreviewBinding() {
                bump(state.childFolderPreview.counters, 'bindings');
                setChildFolderPreviewLastEvent('binding');
                persist();
            },
            recordChildFolderPreviewMenuOpen(details = {}) {
                bump(state.childFolderPreview.counters, 'menuOpenAttempts');
                const success = details.success === true;
                bump(state.childFolderPreview.counters, success ? 'menuOpens' : 'menuOpenFailures');
                bump(
                    state.childFolderPreview.inputMethods,
                    CHILD_FOLDER_PREVIEW_INPUT_METHODS.includes(details.inputMethod) ? details.inputMethod : 'unknown'
                );
                setChildFolderPreviewLastEvent('menu-open', { ...details, success });
                persist(true);
            },
            snapshot: () => JSON.parse(JSON.stringify(state))
        });
    };

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        const jq = deps.$ || win?.jQuery || win?.$;
        const utils = deps.utils && typeof deps.utils === 'object' ? deps.utils : {};
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;'));
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function' ? deps.getSafeWebuiUrl : ((value) => String(value || '').trim());
        const openWebuiInNewTab = typeof deps.openWebuiInNewTab === 'function' ? deps.openWebuiInNewTab : (() => {});
        const openTerminal = typeof deps.openTerminal === 'function' ? deps.openTerminal : (() => {});
        const getDirectMemberRowsForFolder = typeof deps.getDirectMemberRowsForFolder === 'function'
            ? deps.getDirectMemberRowsForFolder
            : (() => jq());
        const isCompactMultiRowPreview = typeof deps.isCompactMultiRowPreview === 'function'
            ? deps.isCompactMultiRowPreview
            : (() => false);
        const applyFolderPreviewLayout = typeof deps.applyFolderPreviewLayout === 'function'
            ? deps.applyFolderPreviewLayout
            : (() => {});
        const layoutFolderPreviewRows = typeof deps.layoutFolderPreviewRows === 'function'
            ? deps.layoutFolderPreviewRows
            : (() => {});
        const appendRequestBundleTrace = typeof deps.appendRequestBundleTrace === 'function'
            ? deps.appendRequestBundleTrace
            : (() => false);
        const previewContextDiagnostics = createPreviewContextDiagnostics(win);
        const debug = deps.debug === true;
        const webuiLinkRel = String(deps.webuiLinkRel || 'noopener noreferrer').trim() || 'noopener noreferrer';
        const dockerRuntimeStateClassList = 'started paused stopped fv-preview-status-started fv-preview-status-paused fv-preview-status-stopped green-text orange-text red-text';
        const dockerRuntimeIconClassList = 'fa-play fa-pause fa-square fa-refresh fa-spin';
        const dockerPreviewActionIconClassList = 'fa-globe fa-terminal fa-bars fa-refresh fa-spin fa-spinner fa-circle-o-notch';
        const dockerPreviewQuickActionSelector = [
            '.folder-element-custom-btn',
            '.folder-element-custom-btn *',
            '.fv-preview-actions-compact',
            '.fv-preview-actions-compact *'
        ].join(', ');

        const resolveDockerNativePreviewContextTrigger = ($sourceRow) => {
            if (!jq || !$sourceRow || !$sourceRow.length || typeof $sourceRow.find !== 'function') {
                return jq ? jq() : null;
            }
            const $iconTrigger = $sourceRow.find('td.ct-name > span.outer > span.hand').first();
            if ($iconTrigger.length) {
                return $iconTrigger;
            }
            return $sourceRow.find('td.ct-name > span.outer > span.inner > span.appname > a.exec').first();
        };

        const sanitizeDockerPreviewContextClone = ($item) => {
            if (!$item || !$item.length) {
                return $item;
            }
            $item
                .removeAttr('id onclick oncontextmenu')
                .find('[onclick], [oncontextmenu]')
                .removeAttr('onclick oncontextmenu');
            $item.find('[id]').not('i[id^="load-"]').removeAttr('id');
            return $item;
        };

        const resolveDockerPreviewActivationPoint = ($item, event = null) => {
            const sourceEvent = event?.originalEvent || event || {};
            const eventX = Number(sourceEvent.clientX);
            const eventY = Number(sourceEvent.clientY);
            if (Number.isFinite(eventX) && Number.isFinite(eventY) && sourceEvent.type !== 'keydown') {
                return { clientX: eventX, clientY: eventY };
            }
            const itemNode = $item?.get?.(0) || null;
            const rect = typeof itemNode?.getBoundingClientRect === 'function'
                ? itemNode.getBoundingClientRect()
                : null;
            return {
                clientX: rect ? rect.left + Math.max(1, rect.width / 2) : 0,
                clientY: rect ? rect.top + Math.max(1, rect.height / 2) : 0
            };
        };

        const resolveDockerPreviewContextRowMode = ($item, settings = {}) => normalizePreviewContextRowMode(
            $item?.attr?.('data-fv-preview-row-mode')
            || $item?.closest?.('.folder-preview')?.attr?.('data-preview-rows')
            || settings?.preview_rows
            || settings?.previewRows
        );

        const resolveDockerPreviewContextRowIndex = ($item) => {
            const $row = $item?.closest?.('.folder-preview-row');
            if (!$row?.length) return 1;
            const $rows = $row.parent().children('.folder-preview-row');
            return Math.max(1, $rows.index($row) + 1);
        };

        const resolveDockerPreviewContextTriggerSource = (event = null) => {
            if (!jq || !event?.target) return 'unknown';
            const $target = jq(event.target);
            if ($target.closest('span.hand').length) return 'icon';
            if ($target.closest('span.appname').length) return 'name';
            if ($target.closest('span.state, .fv-preview-status-compact').length) return 'status';
            return 'card';
        };

        const hasNamespacedPreviewContextHandler = (node, eventType) => {
            if (!node || typeof jq?._data !== 'function') return null;
            const handlers = jq._data(node, 'events')?.[eventType];
            return Array.isArray(handlers)
                ? handlers.some((handler) => String(handler?.namespace || '').split('.').includes('fvDockerNativePreviewContext'))
                : false;
        };

        const dispatchDockerNativePreviewContext = ($nativeTrigger, $item, event = null) => {
            const trigger = $nativeTrigger?.get?.(0) || null;
            if (!trigger || typeof trigger.dispatchEvent !== 'function') {
                return { ok: false, reason: 'native-trigger-missing' };
            }
            const { clientX, clientY } = resolveDockerPreviewActivationPoint($item, event);
            const MouseEventConstructor = win?.MouseEvent || fallbackWindow?.MouseEvent;
            if (typeof MouseEventConstructor !== 'function') {
                return { ok: false, reason: 'native-event-unavailable' };
            }
            try {
                trigger.dispatchEvent(new MouseEventConstructor('click', {
                    bubbles: true,
                    cancelable: true,
                    view: win || undefined,
                    button: 0,
                    buttons: 0,
                    clientX,
                    clientY
                }));
                return { ok: true, reason: '' };
            } catch (_error) {
                return { ok: false, reason: 'dispatch-failed' };
            }
        };

        const recordDockerPreviewContextDispatch = ($nativeTrigger, $item, event = null) => {
            const result = dispatchDockerNativePreviewContext($nativeTrigger, $item, event);
            previewContextDiagnostics.recordDispatch({
                success: result.ok,
                reason: result.reason,
                rowMode: resolveDockerPreviewContextRowMode($item),
                rowIndex: resolveDockerPreviewContextRowIndex($item),
                triggerSource: resolveDockerPreviewContextTriggerSource(event),
                inputMethod: event?.type === 'keydown' ? 'keyboard' : 'mouse'
            });
            return result.ok;
        };

        const bindDockerPreviewDefaultContextBridge = ($item, $sourceRow, settings = {}) => {
            const rowMode = resolveDockerPreviewContextRowMode($item, settings);
            if (!jq || !$item || !$item.length) {
                previewContextDiagnostics.recordBinding({ success: false, reason: 'item-missing', rowMode });
                return false;
            }
            $item.attr('data-fv-preview-context-eligible', 'true').attr('data-fv-preview-row-mode', rowMode);
            const $nativeTrigger = resolveDockerNativePreviewContextTrigger($sourceRow);
            if (!$nativeTrigger || !$nativeTrigger.length) {
                $item.attr('data-fv-preview-context-bound', 'false');
                previewContextDiagnostics.recordBinding({ success: false, reason: 'native-trigger-missing', rowMode });
                return false;
            }
            const nativeTitle = String($nativeTrigger.attr('title') || '').trim();
            sanitizeDockerPreviewContextClone($item);
            const $keyboardTarget = $item.find('span.hand, span.appname').first();
            $item
                .removeClass('fv-preview-trigger fv-preview-tooltip-proxy')
                .removeAttr('role tabindex data-fv-preview-context')
                .find('.fv-preview-trigger, .fv-preview-tooltip-proxy')
                .removeClass('fv-preview-trigger fv-preview-tooltip-proxy');
            if ($keyboardTarget.length) {
                $keyboardTarget
                    .attr('role', 'button')
                    .attr('tabindex', '0')
                    .attr('data-fv-preview-context', 'native');
                if (nativeTitle) {
                    $keyboardTarget.attr('title', nativeTitle);
                }
            }
            $item
                .attr('data-fv-preview-context-bound', 'true')
                .off('.fvDockerNativePreviewContext')
                .on('click.fvDockerNativePreviewContext', function(event) {
                    if (jq(event.target).closest(dockerPreviewQuickActionSelector).length) {
                        previewContextDiagnostics.recordQuickActionBypass();
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    recordDockerPreviewContextDispatch($nativeTrigger, $item, event);
                });
            $keyboardTarget
                .off('.fvDockerNativePreviewContext')
                .on('keydown.fvDockerNativePreviewContext', function(event) {
                    if (!['Enter', ' '].includes(event.key)) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    recordDockerPreviewContextDispatch($nativeTrigger, $item, event);
                });
            previewContextDiagnostics.recordBinding({
                success: true,
                rowMode,
                keyboardTargetMissing: !$keyboardTarget.length
            });
            return true;
        };

        const auditDockerPreviewContextBridges = ($preview, settings = {}) => {
            if (!jq || !$preview || !$preview.length) return null;
            const rowMode = resolveDockerPreviewContextRowMode($preview, settings);
            const $eligibleTargets = $preview.find('[data-fv-preview-context-eligible="true"]');
            if (!$eligibleTargets.length) return null;
            const rows = new Map();
            let eligibleTargetsAudited = 0;
            let boundTargetsAudited = 0;
            let missingBridgeTargets = 0;
            let handlerIntegrityFailures = 0;
            $eligibleTargets.each((_, node) => {
                const $item = jq(node);
                const rowIndex = resolveDockerPreviewContextRowIndex($item);
                const row = rows.get(rowIndex) || { rowIndex, eligible: 0, bound: 0, missing: 0, handlerFailures: 0 };
                const bound = $item.attr('data-fv-preview-context-bound') === 'true';
                const $keyboardTarget = $item.find('[data-fv-preview-context="native"]').first();
                const clickHandlerPresent = hasNamespacedPreviewContextHandler(node, 'click');
                const keyboardHandlerPresent = $keyboardTarget.length
                    ? hasNamespacedPreviewContextHandler($keyboardTarget.get(0), 'keydown')
                    : null;
                const handlerMissing = clickHandlerPresent === false || keyboardHandlerPresent === false;
                $item.attr('data-fv-preview-row-index', String(rowIndex));
                eligibleTargetsAudited += 1;
                row.eligible += 1;
                if (bound) { boundTargetsAudited += 1; row.bound += 1; }
                else { missingBridgeTargets += 1; row.missing += 1; }
                if (handlerMissing) { handlerIntegrityFailures += 1; row.handlerFailures += 1; }
                rows.set(rowIndex, row);
            });
            const details = {
                rowMode,
                rowIndex: 0,
                eligibleTargetsAudited,
                boundTargetsAudited,
                missingBridgeTargets,
                handlerIntegrityFailures,
                rows: [...rows.values()].slice(0, 10)
            };
            previewContextDiagnostics.recordFinalization(details);
            return details;
        };

        const normalizeDockerPreviewStatusMarkup = ($target) => {
            if (!$target || !$target.length) {
                return '';
            }
            const $statusIcon = $target.find('i.started, i.paused, i.stopped').first();
            if (!$statusIcon.length) {
                return '';
            }
            const stateClass = $statusIcon.hasClass('paused')
                ? 'fv-preview-status-paused'
                : ($statusIcon.hasClass('stopped') ? 'fv-preview-status-stopped' : 'fv-preview-status-started');
            const $status = $target.find('.fv-preview-status-compact').first();
            if (!$status.length) {
                return '';
            }
            $status
                .removeClass('fv-preview-status-started fv-preview-status-paused fv-preview-status-stopped')
                .addClass(stateClass)
                .find('i.fa, span.state')
                .removeClass('fv-preview-status-started fv-preview-status-paused fv-preview-status-stopped')
                .addClass(stateClass);
            return stateClass;
        };

        const cloneDockerSingleRowPreviewSource = ($sourceRow, selector, options = {}) => {
            if (!jq) {
                return { ok: false, reason: 'jquery-unavailable', $clone: null };
            }
            const emptyClone = () => jq();
            if (!$sourceRow || !$sourceRow.length || typeof $sourceRow.find !== 'function') {
                return { ok: false, reason: 'source-row-missing', $clone: emptyClone() };
            }
            const safeSelector = String(selector || '').trim();
            if (!safeSelector) {
                return { ok: false, reason: 'selector-missing', $clone: emptyClone() };
            }
            try {
                const $clone = $sourceRow.find(safeSelector).last().clone();
                if (!$clone.length) {
                    return { ok: false, reason: 'preview-markup-missing', $clone: emptyClone() };
                }
                const $state = $clone.find('span.state').first();
                if (options.requireState === true && !$state.length) {
                    return { ok: false, reason: 'state-markup-missing', $clone: emptyClone() };
                }
                if ($state.length && options.trimStateDetails !== false) {
                    $state.html(String($state.html() || '').split(/<br\s*\/?\s*>/i)[0]);
                }
                return { ok: true, reason: '', $clone };
            } catch (_error) {
                return { ok: false, reason: 'preview-clone-failed', $clone: emptyClone() };
            }
        };

        const appendSafeModelPreview = ({ appendModelPreview, previewMode = 0, reason = 'native-preview-error' } = {}) => {
            const safeReasons = new Set([
                'jquery-unavailable', 'source-row-missing', 'selector-missing', 'preview-markup-missing',
                'state-markup-missing', 'preview-clone-failed', 'native-preview-error'
            ]);
            appendRequestBundleTrace('single-row-preview-fallback', {
                previewMode: Number(previewMode || 0),
                reason: safeReasons.has(reason) ? reason : 'native-preview-error'
            });
            try {
                return typeof appendModelPreview === 'function' ? appendModelPreview() : null;
            } catch (_error) {
                appendRequestBundleTrace('single-row-preview-skipped', {
                    previewMode: Number(previewMode || 0),
                    reason: 'model-preview-failed'
                });
                if (debug) console.warn('[FV3_DEBUG] Docker preview fallback failed; the affected member preview was skipped.');
                return null;
            }
        };

        const renderDockerSingleRowPreview = (options = {}) => {
            const previewMode = Number(options.previewMode || 0);
            const nativePreview = cloneDockerSingleRowPreviewSource(
                options.$sourceRow,
                options.selector,
                { requireState: true, trimStateDetails: true }
            );
            if (!nativePreview.ok) {
                return appendSafeModelPreview({ ...options, previewMode, reason: nativePreview.reason });
            }
            try {
                const $clone = nativePreview.$clone.addClass(options.autostart ? 'autostart' : '');
                options.$preview.append($clone);
                const $loadIcon = $clone.find('i[id^="load-"]').first();
                const loadId = String($loadIcon.attr('id') || '').trim();
                if (loadId) $loadIcon.attr('id', `folder-${loadId}`);
                if (options.context === 2 || options.context === 0) {
                    const $trigger = previewMode === 1
                        ? $clone.children('span.hand').first()
                        : $clone.find('span.appname > a.exec').first();
                    $trigger.attr('id', `folder-preview-${String(options.ctid || '')}`).removeAttr('onclick');
                    if (options.context === 2) return $trigger;
                }
                return null;
            } catch (_error) {
                nativePreview.$clone?.remove?.();
                return appendSafeModelPreview({ ...options, previewMode, reason: 'native-preview-error' });
            }
        };

        const runDockerPreviewRenderer = ({ render, ...fallbackOptions } = {}) => {
            try {
                return typeof render === 'function' ? render() : null;
            } catch (_error) {
                return appendSafeModelPreview({ ...fallbackOptions, reason: 'native-preview-error' });
            }
        };

        const buildDockerPreviewWebuiButton = (webuiUrl) => jq('<span class="folder-element-custom-btn folder-element-webui fv-preview-action-slot is-ready"></span>').append(
            jq('<a></a>')
                .attr('href', webuiUrl)
                .attr('target', '_blank')
                .attr('rel', webuiLinkRel)
                .attr('data-fv-preview-action', 'webui')
                .attr('data-webui-url', webuiUrl)
                .attr('aria-label', i18nLabel('docker.preview.open-webui', 'Open WebUI'))
                .attr('title', i18nLabel('docker.preview.open-webui', 'Open WebUI'))
                .append('<i class="fa fa-globe" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openWebuiInNewTab(webuiUrl);
                })
        );

        const buildDockerPreviewConsoleButton = (containerName, shellValue) => jq('<span class="folder-element-custom-btn folder-element-console fv-preview-action-slot is-ready"></span>').append(
            jq('<a href="#"></a>')
                .attr('data-fv-preview-action', 'console')
                .attr('data-container-name', containerName)
                .attr('data-shell-value', shellValue)
                .attr('aria-label', i18nLabel('docker.preview.open-console', 'Open console'))
                .attr('title', i18nLabel('docker.preview.open-console', 'Open console'))
                .append('<i class="fa fa-terminal" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openTerminal('docker', containerName, shellValue);
                })
        );

        const buildDockerPreviewLogsButton = (containerName) => jq('<span class="folder-element-custom-btn folder-element-logs fv-preview-action-slot is-ready"></span>').append(
            jq('<a href="#"></a>')
                .attr('data-fv-preview-action', 'logs')
                .attr('data-container-name', containerName)
                .attr('data-shell-value', '.log')
                .attr('aria-label', i18nLabel('docker.preview.view-logs', 'View logs'))
                .attr('title', i18nLabel('docker.preview.view-logs', 'View logs'))
                .append('<i class="fa fa-bars" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openTerminal('docker', containerName, '.log');
                })
        );

        const collectDockerPreviewActionTargets = ($preview, settings = {}) => {
            if (!$preview || !$preview.length) {
                return [];
            }
            if (isCompactMultiRowPreview(settings)) {
                return $preview.find('.fv-preview-actions-compact').get().map((node) => jq(node));
            }
            const previewMode = Number(settings?.preview || 0);
            switch (previewMode) {
                case 2:
                    return $preview.find('span.hand').get().map((node) => jq(node));
                case 3:
                    return $preview.find('span.inner').get().map((node) => jq(node));
                case 4:
                    return $preview.find('span.outer > span.inner').get().map((node) => jq(node));
                case 1:
                default:
                    return $preview.find('span.outer').get().map((node) => {
                        const $outer = jq(node);
                        const $inner = $outer.children('span.inner').last();
                        return $inner.length ? $inner : $outer;
                    });
            }
        };

        const insertDockerPreviewActionSlot = ($target, $slot, actionName) => {
            const actionOrder = ['webui', 'console', 'logs'];
            const currentIndex = actionOrder.indexOf(actionName);
            const laterAction = actionOrder
                .slice(currentIndex + 1)
                .map((name) => $target.children(`span.folder-element-${name}`).first())
                .find(($candidate) => $candidate && $candidate.length);
            if (laterAction && laterAction.length) {
                $slot.insertBefore(laterAction);
                return;
            }
            $target.append($slot);
        };

        const ensureDockerPreviewActionSlot = ($target, actionName, factory) => {
            let $slot = $target.children(`span.folder-element-${actionName}`).first();
            if ($slot.length) {
                $slot.addClass('fv-preview-action-slot');
                return $slot;
            }
            $slot = factory();
            insertDockerPreviewActionSlot($target, $slot, actionName);
            return $slot;
        };

        const normalizeDockerPreviewActionIcon = ($slot, expectedIconClass) => {
            const $icon = $slot?.find?.('i').first?.();
            if (!$icon || !$icon.length) {
                return false;
            }
            $icon
                .removeClass(dockerPreviewActionIconClassList)
                .addClass(`fa ${expectedIconClass}`)
                .attr('aria-hidden', 'true');
            return true;
        };

        const syncDockerPreviewWebuiSlot = ($slot, webuiUrl = '', options = {}) => {
            const safeUrl = getSafeWebuiUrl(webuiUrl);
            const capability = typeof options?.webuiCapability === 'boolean'
                ? options.webuiCapability
                : (safeUrl ? true : null);
            const hydrating = options?.webuiHydrating === true && !safeUrl;
            $slot
                .removeClass('is-ready is-pending is-unavailable fv-preview-webui-placeholder')
                .addClass(safeUrl ? 'is-ready' : (hydrating || capability === null ? 'is-pending' : 'is-unavailable'))
                .attr('data-fv-preview-action-slot', 'webui')
                .attr('data-fv-webui-capability', capability === null ? 'unknown' : String(capability))
                .attr('aria-hidden', safeUrl ? 'false' : 'true');

            const $existingLink = $slot.children('a[data-fv-preview-action="webui"]').first();
            normalizeDockerPreviewActionIcon($slot, 'fa-globe');
            if (safeUrl && $existingLink.length && String($existingLink.attr('data-webui-url') || '') === safeUrl) {
                return;
            }
            $slot.empty();
            if (safeUrl) {
                const $readySlot = buildDockerPreviewWebuiButton(safeUrl);
                $slot.append($readySlot.children());
                return;
            }
            $slot.append('<span class="fv-preview-webui-placeholder-icon" aria-hidden="true"><i class="fa fa-globe" aria-hidden="true"></i></span>');
        };

        const syncDockerPreviewConsoleSlot = ($slot, containerName, shellValue) => {
            const safeName = String(containerName || '').trim();
            const safeShell = String(shellValue || '/bin/sh').trim() || '/bin/sh';
            const $existingLink = $slot.children('a[data-fv-preview-action="console"]').first();
            normalizeDockerPreviewActionIcon($slot, 'fa-terminal');
            if (
                $existingLink.length
                && String($existingLink.attr('data-container-name') || '') === safeName
                && String($existingLink.attr('data-shell-value') || '') === safeShell
            ) {
                return;
            }
            $slot.empty().append(buildDockerPreviewConsoleButton(safeName, safeShell).children());
        };

        const syncDockerPreviewLogsSlot = ($slot, containerName) => {
            const safeName = String(containerName || '').trim();
            const $existingLink = $slot.children('a[data-fv-preview-action="logs"]').first();
            normalizeDockerPreviewActionIcon($slot, 'fa-bars');
            if ($existingLink.length && String($existingLink.attr('data-container-name') || '') === safeName) {
                return;
            }
            $slot.empty().append(buildDockerPreviewLogsButton(safeName).children());
        };

        const reconcileDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '', options = {}) => {
            if (!$target || !$target.length) {
                return;
            }
            const actionPrefs = typeof utils.resolvePreviewActionPrefs === 'function'
                ? utils.resolvePreviewActionPrefs(settings)
                : {
                    preview_webui: settings?.preview_webui === true,
                    preview_console: settings?.preview_console === true,
                    preview_logs: settings?.preview_logs === true
                };
            if (actionPrefs.preview_webui) {
                const $webuiSlot = ensureDockerPreviewActionSlot(
                    $target,
                    'webui',
                    () => jq('<span class="folder-element-custom-btn folder-element-webui fv-preview-action-slot"></span>')
                );
                syncDockerPreviewWebuiSlot($webuiSlot, webuiUrl, options);
            } else {
                $target.children('span.folder-element-webui').remove();
            }
            if (actionPrefs.preview_console && containerName) {
                const $consoleSlot = ensureDockerPreviewActionSlot(
                    $target,
                    'console',
                    () => buildDockerPreviewConsoleButton(containerName, shellValue)
                );
                syncDockerPreviewConsoleSlot($consoleSlot, containerName, shellValue);
            } else {
                $target.children('span.folder-element-console').remove();
            }
            if (actionPrefs.preview_logs && containerName) {
                const $logsSlot = ensureDockerPreviewActionSlot(
                    $target,
                    'logs',
                    () => buildDockerPreviewLogsButton(containerName)
                );
                syncDockerPreviewLogsSlot($logsSlot, containerName);
            } else {
                $target.children('span.folder-element-logs').remove();
            }
        };

        const appendDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '', options = {}) => {
            reconcileDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, options);
        };

        const i18nLabel = (key, fallback = '') => {
            const safeFallback = String(fallback || key || '').trim();
            try {
                if (typeof jq?.i18n !== 'function') {
                    return safeFallback;
                }
                const localized = String(jq.i18n(key) || '').trim();
                return localized && localized !== key ? localized : safeFallback;
            } catch (_error) {
                return safeFallback;
            }
        };

        const isDockerAdvancedModeEnabled = () => {
            try {
                return typeof jq?.cookie === 'function' && jq.cookie('docker_listview_mode') == 'advanced';
            } catch (_error) {
                return false;
            }
        };

        const escapeInlineJsSingleQuotedValue = (value) => String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");

        const resolveDockerMemberUpdateState = (entry = {}, options = {}) => {
            const manager = String(entry?.manager || '').trim().toLowerCase();
            const updateReady = entry?.update === true;
            const advanced = options?.advanced === true
                || (options?.advanced !== false && isDockerAdvancedModeEnabled());

            if (manager === 'composeman') {
                return {
                    manager,
                    statusToken: 'compose',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false
                };
            }
            if (manager && manager !== 'dockerman') {
                return {
                    manager,
                    statusToken: 'thirdParty',
                    actionToken: 'other',
                    actionRequiresAdvancedView: false
                };
            }
            if (updateReady) {
                return {
                    manager: manager || 'dockerman',
                    statusToken: 'updateReady',
                    actionToken: 'applyUpdate',
                    actionRequiresAdvancedView: false
                };
            }
            return {
                manager: manager || 'dockerman',
                statusToken: 'upToDate',
                actionToken: advanced ? 'forceUpdate' : 'upToDate',
                actionRequiresAdvancedView: true
            };
        };

        const buildDockerMemberUpdateColumnHtml = (entry = {}, options = {}) => {
            const state = resolveDockerMemberUpdateState(entry, options);
            if (state.statusToken === 'compose') {
                return `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${escapeHtml(i18nLabel('compose', 'compose'))}</span>`;
            }
            if (state.statusToken === 'thirdParty') {
                return `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${escapeHtml(i18nLabel('third-party', 'third-party'))}</span>`;
            }
            const safeContainerName = escapeInlineJsSingleQuotedValue(String(entry?.name || '').trim());
            if (state.statusToken === 'updateReady') {
                return `<span class="orange-text folder-update-text" data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-flash fa-fw"></i>${escapeHtml(i18nLabel('update-ready', 'update-ready'))}</span><br><a class="exec" data-fv-onclick="hideAllTips(); updateContainer('${safeContainerName}');"><span data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-cloud-download fa-fw"></i>${escapeHtml(i18nLabel('apply-update', 'apply-update'))}</span></a>`;
            }
            const forceUpdateHtml = state.actionToken === 'forceUpdate'
                ? `<br><a class="exec" data-fv-onclick="hideAllTips(); updateContainer('${safeContainerName}');"><span data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-cloud-download fa-fw"></i>${escapeHtml(i18nLabel('force-update', 'force-update'))}</span></a>`
                : '';
            return `<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i>${escapeHtml(i18nLabel('up-to-date', 'up-to-date'))}</span>${forceUpdateHtml}`;
        };

        const getDockerPreviewStatusMeta = (entry = {}) => {
            const running = entry?.state === true;
            const paused = running && entry?.pause === true;
            if (running && paused) {
                return {
                    key: 'paused',
                    icon: 'fa-pause',
                    compactClassName: 'fv-preview-status-paused',
                    legacyStateClass: 'paused',
                    legacyToneClass: 'orange-text'
                };
            }
            if (running) {
                return {
                    key: 'started',
                    icon: 'fa-play',
                    compactClassName: 'fv-preview-status-started',
                    legacyStateClass: 'started',
                    legacyToneClass: 'green-text'
                };
            }
            return {
                key: 'stopped',
                icon: 'fa-square',
                compactClassName: 'fv-preview-status-stopped',
                legacyStateClass: 'stopped',
                legacyToneClass: 'red-text'
            };
        };
        const normalizePreviewStatusMode = (value) => {
            const normalized = String(value || '').trim().toLowerCase();
            if (['none', 'hide', 'hidden', 'off', 'false', '0', 'no'].includes(normalized)) {
                return 'none';
            }
            return ['none', 'symbol', 'grayscale'].includes(normalized) ? normalized : 'symbol';
        };

        const clearDockerRuntimeStateClasses = ($elements) => {
            if (!$elements || !$elements.length) {
                return;
            }
            $elements.removeClass(dockerRuntimeStateClassList);
        };

        const syncDockerPreviewStateSurface = ($target, statusMeta, localizedLabel) => {
            if (!$target || !$target.length) {
                return;
            }
            const $outer = $target.hasClass('outer')
                ? $target
                : $target.closest('span.outer').first();
            if (!$outer.length) {
                return;
            }
            const $hand = $outer.children('span.hand').first();
            const $inner = $outer.children('span.inner').first();
            const $appName = $inner.children('span.appname').first();
            const $appLink = $appName.children('a.exec').first();
            const $inlineStatus = $appLink.children('.fv-preview-status-inline').first();
            clearDockerRuntimeStateClasses($outer.add($hand).add($inner).add($appName));
            $outer.add($hand).add($inner).add($appName).addClass(statusMeta.legacyStateClass);
            $outer.attr('data-fv-runtime-state', statusMeta.key);
            if ($appLink.length) {
                clearDockerRuntimeStateClasses($appLink);
                $appLink
                    .addClass(statusMeta.legacyStateClass)
                    .attr('data-fv-runtime-state', statusMeta.key);
                if ($appLink.hasClass('fv-preview-status-name')) {
                    $appLink.addClass(statusMeta.compactClassName);
                }
            }
            if ($inlineStatus.length) {
                clearDockerRuntimeStateClasses($inlineStatus);
                $inlineStatus
                    .addClass(statusMeta.compactClassName)
                    .attr('title', localizedLabel)
                    .attr('data-fv-runtime-state', statusMeta.key);
                $inlineStatus.find('i.fa').first()
                    .removeClass(dockerRuntimeIconClassList)
                    .addClass(`fa ${statusMeta.icon}`);
            }
            const $iconStatus = $outer.find('.fv-preview-icon-status').first();
            if ($iconStatus.length) {
                clearDockerRuntimeStateClasses($iconStatus);
                $iconStatus
                    .addClass(statusMeta.compactClassName)
                    .attr('title', localizedLabel)
                    .attr('data-fv-runtime-state', statusMeta.key);
                $iconStatus.find('i.fa').first()
                    .removeClass(dockerRuntimeIconClassList)
                    .addClass(`fa ${statusMeta.icon}`);
                $iconStatus.find('span.state').first().text(` ${localizedLabel}`);
            }
        };

        const syncDockerPreviewUpdateHighlight = ($target, settings = {}, entry = {}) => {
            if (!$target || !$target.length) {
                return;
            }
            const $outer = $target.hasClass('outer')
                ? $target
                : $target.closest('span.outer').first();
            if (!$outer.length) {
                return;
            }
            const $appName = $outer.children('span.inner').first().children('span.appname').first();
            const $appLink = $appName.children('a.exec').first();
            const highlightUpdate = settings?.preview_update === true && entry?.update === true;
            $appName.toggleClass('orange-text fv-preview-update-ready', highlightUpdate);
            if ($appLink.length) {
                $appLink.toggleClass('orange-text fv-preview-update-ready', highlightUpdate);
            }
        };

        const findDockerFolderMemberRow = (id, containerName) => {
            const folderId = String(id || '').trim();
            const safeContainerName = String(containerName || '').trim();
            if (!folderId || !safeContainerName) {
                return jq();
            }
            const matchRows = ($rows) => $rows.filter((_, row) => {
                const rowId = String(row?.id || '').trim();
                if (rowId === `ct-${safeContainerName}`) {
                    return true;
                }
                const $row = jq(row);
                return String($row.find('td.ct-name .appname').first().text() || '').trim() === safeContainerName;
            }).first();
            const $rows = jq(`tr.folder-id-${folderId} div.folder-storage > tr, tr.folder-${folderId}-element`);
            const $matchedRow = matchRows($rows);
            if ($matchedRow.length) {
                return $matchedRow;
            }
            return matchRows(getDirectMemberRowsForFolder(folderId));
        };

        const syncDockerStorageRowStatus = ($row, entry = {}) => {
            if (!$row || !$row.length) {
                return;
            }
            const statusMeta = getDockerPreviewStatusMeta(entry);
            const localizedLabel = typeof jq?.i18n === 'function'
                ? String(jq.i18n(statusMeta.key) || statusMeta.key).trim()
                : statusMeta.key;
            const $outer = $row.find('td.ct-name > span.outer').first();
            const $hand = $outer.children('span.hand').first();
            const $inner = $outer.children('span.inner').first();
            const $appName = $inner.children('span.appname').first();
            const $stateLabel = $inner.children('span.state').first();
            const $icon = $inner.children('i[id^="load-"]').first();
            clearDockerRuntimeStateClasses($outer.add($hand).add($inner).add($appName).add($stateLabel));
            $outer.add($hand).add($inner).add($appName).add($stateLabel).addClass(statusMeta.legacyStateClass);
            $row.attr('data-fv-runtime-state', statusMeta.key);
            if ($icon.length) {
                $icon
                    .removeClass(dockerRuntimeStateClassList)
                    .removeClass(dockerRuntimeIconClassList)
                    .addClass(`fa ${statusMeta.icon} ${statusMeta.legacyStateClass} ${statusMeta.legacyToneClass}`);
            }
            if ($stateLabel.length) {
                $stateLabel.text(` ${localizedLabel}`);
            }
        };

        const syncDockerStorageRowUpdateColumn = ($row, entry = {}) => {
            if (!$row || !$row.length) {
                return;
            }
            const $updateColumn = $row.find('td.updatecolumn').first();
            if (!$updateColumn.length) {
                return;
            }
            $updateColumn.html(buildDockerMemberUpdateColumnHtml(entry));
        };

        const syncDockerFolderMemberRows = (id, runtimeContainers, changedNames = null) => {
            const changedSet = changedNames instanceof Set
                ? changedNames
                : (Array.isArray(changedNames) ? new Set(changedNames) : null);
            const entries = Object.values(runtimeContainers || {}).filter((entry) => (
                !changedSet || changedSet.has(String(entry?.name || '').trim())
            ));
            entries.forEach((entry) => {
                const containerName = String(entry?.name || '').trim();
                if (!containerName) {
                    return;
                }
                const $row = findDockerFolderMemberRow(id, containerName);
                syncDockerStorageRowStatus($row, entry);
                syncDockerStorageRowUpdateColumn($row, entry);
            });
        };

        const syncDockerRuntimeRows = (runtimeContainers, changedNames = null) => {
            const changedSet = changedNames instanceof Set
                ? changedNames
                : (Array.isArray(changedNames) ? new Set(changedNames) : null);
            Object.values(runtimeContainers || {}).forEach((entry) => {
                const containerName = String(entry?.name || entry?.info?.Name || '').trim();
                if (!containerName || (changedSet && !changedSet.has(containerName))) {
                    return;
                }
                const row = doc?.getElementById?.(`ct-${containerName}`) || null;
                if (!row) {
                    return;
                }
                const $row = jq(row);
                syncDockerStorageRowStatus($row, entry);
            });
        };

        const resolveDockerPreviewStateTargets = ($target) => {
            if (!$target || !$target.length) {
                return {
                    $compactStatus: jq(),
                    $stateLabel: jq(),
                    $icon: jq()
                };
            }
            const $compactStatus = $target.hasClass('fv-preview-status-compact')
                ? $target
                : $target.siblings('.fv-preview-status-compact').first();
            if ($compactStatus.length) {
                return {
                    $compactStatus,
                    $stateLabel: $compactStatus.find('span.state').first(),
                    $icon: $compactStatus.find('i.fa').first()
                };
            }
            const $stateLabel = $target.find('span.state').first().length
                ? $target.find('span.state').first()
                : $target.closest('span.inner, span.outer').find('span.state').first();
            const $icon = $stateLabel.length
                ? $stateLabel.prevAll('i.fa').first()
                : jq();
            return {
                $compactStatus: jq(),
                $stateLabel,
                $icon
            };
        };

        const syncDockerPreviewStatus = ($target, entry = {}) => {
            const { $compactStatus, $stateLabel, $icon } = resolveDockerPreviewStateTargets($target);
            if (!$stateLabel.length && !$icon.length && !$compactStatus.length) {
                return;
            }
            const statusMeta = getDockerPreviewStatusMeta(entry);
            const localizedLabel = typeof jq?.i18n === 'function'
                ? String(jq.i18n(statusMeta.key) || statusMeta.key).trim()
                : statusMeta.key;
            syncDockerPreviewStateSurface($target, statusMeta, localizedLabel);
            if ($compactStatus.length) {
                $compactStatus.attr('title', localizedLabel);
            }
            if ($icon.length) {
                $icon
                    .removeClass(`${dockerRuntimeIconClassList} ${dockerRuntimeStateClassList}`)
                    .addClass(`fa ${statusMeta.icon} ${$compactStatus.length ? statusMeta.compactClassName : `${statusMeta.legacyStateClass} ${statusMeta.legacyToneClass}`}`);
            }
            if ($stateLabel.length) {
                $stateLabel.text(` ${localizedLabel}`);
            }
        };

        const hideDockerPreviewStatus = ($target) => {
            if (!$target || !$target.length) {
                return;
            }
            const $outer = $target.hasClass('outer')
                ? $target
                : $target.closest('span.outer').first();
            if (!$outer.length) {
                return;
            }
            clearDockerRuntimeStateClasses($outer.add($outer.find('span.hand, span.inner, span.appname, span.appname > a.exec')));
            $outer.find('.fv-preview-status-compact, .fv-preview-status-inline').remove();
            $outer.find('span.state').each((_, node) => {
                const $state = jq(node);
                const $icon = $state.prevAll('i.fa').first();
                $state.remove();
                if ($icon.length) {
                    $icon.remove();
                }
            });
        };

        const syncDockerLeafFolderPreviewActions = (id, folder, runtimeContainers, changedNames = null) => {
            const $preview = jq(`tr.folder-id-${id} div.folder-preview`);
            if (!$preview.length) {
                return;
            }
            const settings = folder?.settings || {};
            const previewMode = Number(settings?.preview || 0);
            if (previewMode <= 0) {
                $preview.empty();
                return;
            }
            const actionTargets = collectDockerPreviewActionTargets($preview, settings);
            const entries = Object.values(runtimeContainers || {});
            const changedSet = changedNames instanceof Set
                ? changedNames
                : (Array.isArray(changedNames) ? new Set(changedNames) : null);
            syncDockerFolderMemberRows(id, runtimeContainers, changedSet);
            actionTargets.forEach(($target, index) => {
                const entry = entries[index];
                if (!$target || !$target.length || !entry) {
                    return;
                }
                const containerName = String(entry?.name || '').trim();
                if (changedSet && !changedSet.has(containerName)) {
                    return;
                }
                const shellValue = String(entry?.shell || '/bin/sh').trim() || '/bin/sh';
                const webuiUrl = getSafeWebuiUrl(entry?.webui);
                const previewStatusMode = normalizePreviewStatusMode(settings?.preview_status);
                if (previewStatusMode === 'none') {
                    hideDockerPreviewStatus($target);
                } else {
                    syncDockerPreviewStatus($target, entry);
                }
                syncDockerPreviewUpdateHighlight($target, settings, entry);
                if (Number(settings?.preview || 0) === 2) {
                    const $outer = $target.hasClass('outer') ? $target : $target.closest('span.outer').first();
                    const $img = $outer.find('img.img').first();
                    if (previewStatusMode === 'symbol') {
                        $outer.find('.fv-preview-icon-status').removeClass('fv-preview-status-hidden');
                    } else {
                        $outer.find('.fv-preview-icon-status').remove();
                    }
                    if (previewStatusMode === 'grayscale' && entry?.state !== true) {
                        $img.css('filter', 'grayscale(100%)');
                    } else if (settings?.preview_grayscale !== true) {
                        $img.css('filter', '');
                    }
                }
                reconcileDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, {
                    webuiCapability: entry?.webuiCapability,
                    webuiHydrating: entry?.webuiHydrating === true
                });
            });
            $preview.find('[id^="folder-preview-"]').each((_, node) => {
                jq(node).data('fvTooltipLazyBuilt', false);
            });
            applyFolderPreviewLayout($preview, settings);
            layoutFolderPreviewRows($preview, settings);
            auditDockerPreviewContextBridges($preview, settings);
            $preview.find('span.inner > span.appname').css('width', settings?.preview_text_width || '');
        };

        return Object.freeze({
            sanitizeDockerPreviewContextClone,
            bindDockerPreviewDefaultContextBridge,
            auditDockerPreviewContextBridges,
            getPreviewContextDiagnosticsSnapshot: previewContextDiagnostics.snapshot,
            recordChildFolderPreviewRender: previewContextDiagnostics.recordChildFolderPreviewRender,
            recordChildFolderPreviewBinding: previewContextDiagnostics.recordChildFolderPreviewBinding,
            recordChildFolderPreviewMenuOpen: previewContextDiagnostics.recordChildFolderPreviewMenuOpen,
            normalizeDockerPreviewStatusMarkup,
            cloneDockerSingleRowPreviewSource,
            renderDockerSingleRowPreview,
            runDockerPreviewRenderer,
            appendDockerPreviewActionButtons,
            reconcileDockerPreviewActionButtons,
            resolveDockerMemberUpdateState,
            buildDockerMemberUpdateColumnHtml,
            syncDockerRuntimeRows,
            syncDockerFolderMemberRows,
            syncDockerLeafFolderPreviewActions
        });
    };

    return Object.freeze({
        createApi,
        PREVIEW_CONTEXT_DIAGNOSTICS_STORAGE_KEY
    });
}));
