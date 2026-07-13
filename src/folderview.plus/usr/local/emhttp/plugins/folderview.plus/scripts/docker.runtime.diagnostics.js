// @ts-check
(function dockerRuntimeDiagnosticsModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDockerRuntimeDiagnostics = factory(fallbackWindow);
    root.FolderViewPlusDockerRuntimeDiagnosticsModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeDiagnosticsFactory(fallbackWindow) {
    'use strict';

    const DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY = 'fv.support.bundle.docker.page.v1';
    const DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY = 'fv.support.bundle.docker.bulkUpdateTrace.v1';
    const DOCKER_REQUEST_BUNDLE_TRACE_STORAGE_KEY = 'fv.support.bundle.docker.requestBundleTrace.v1';
    const DOCKER_TRACE_HEALTH_STORAGE_KEY = 'fv.support.bundle.docker.traceHealth.v1';
    const DOCKER_BULK_UPDATE_TRACE_LIMIT = 30;
    const DOCKER_REQUEST_BUNDLE_TRACE_LIMIT = 40;
    const DOCKER_PAGE_SNAPSHOT_STORAGE_MAX_BYTES = 98304;
    const DOCKER_TRACE_STORAGE_MAX_BYTES = 32768;
    const DOCKER_TRACE_HEALTH_STORAGE_MAX_BYTES = 12288;
    const DOCKER_SUPPORT_BUNDLE_FOLDER_ROW_LIMIT = 32;
    const DOCKER_SUPPORT_BUNDLE_MEMBER_ROW_LIMIT = 120;
    const DOCKER_SUPPORT_BUNDLE_TOP_LEVEL_ROW_LIMIT = 160;
    const DOCKER_SUPPORT_BUNDLE_MISMATCH_LIMIT = 16;

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const $ = deps.$ || fallbackWindow.jQuery || fallbackWindow.$;
        const localStorageRef = deps.localStorage || win.localStorage || null;
        const readDockerListViewMode = typeof deps.readDockerListViewMode === 'function'
            ? deps.readDockerListViewMode
            : (() => 'basic');
        const resolveExpectedFolderActionToken = typeof deps.resolveExpectedFolderActionToken === 'function'
            ? deps.resolveExpectedFolderActionToken
            : (() => 'unknown');
        const resolveExpectedMemberActionToken = typeof deps.resolveExpectedMemberActionToken === 'function'
            ? deps.resolveExpectedMemberActionToken
            : (() => 'unknown');
        const getRuntimeInfoEntry = typeof deps.getRuntimeInfoEntry === 'function'
            ? deps.getRuntimeInfoEntry
            : (() => ({}));
        const getCorrelationContext = typeof deps.getCorrelationContext === 'function'
            ? deps.getCorrelationContext
            : (() => ({}));

        const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const measureBytes = (value) => {
            try {
                const serialized = typeof value === 'string' ? value : JSON.stringify(value);
                if (typeof TextEncoder === 'function') {
                    return new TextEncoder().encode(serialized).length;
                }
                return serialized.length * 2;
            } catch (_error) {
                return Number.POSITIVE_INFINITY;
            }
        };
        const cloneValue = (value) => {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (_error) {
                return null;
            }
        };
        const normalizeCorrelationContext = (value = {}) => {
            const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
            return {
                currentPage: String(safeValue.currentPage || '').trim(),
                listViewMode: String(safeValue.listViewMode || '').trim(),
                renderGeneration: Number.isFinite(Number(safeValue.renderGeneration)) ? Number(safeValue.renderGeneration) : 0,
                requestGeneration: Number.isFinite(Number(safeValue.requestGeneration)) ? Number(safeValue.requestGeneration) : 0,
                traceSessionId: String(safeValue.traceSessionId || '').trim(),
                stateSignature: String(safeValue.stateSignature || '').trim(),
                stateEntityCount: Number.isFinite(Number(safeValue.stateEntityCount)) ? Number(safeValue.stateEntityCount) : 0,
                orderReconciliation: safeValue.orderReconciliation && typeof safeValue.orderReconciliation === 'object' && !Array.isArray(safeValue.orderReconciliation)
                    ? cloneValue(safeValue.orderReconciliation)
                    : { available: false },
                liveUpdateStatus: safeValue.liveUpdateStatus === true,
                hostSyncSuspended: safeValue.hostSyncSuspended === true,
                hookStates: safeValue.hookStates && typeof safeValue.hookStates === 'object' && !Array.isArray(safeValue.hookStates)
                    ? cloneValue(safeValue.hookStates)
                    : {}
            };
        };

        const compactTracePayload = (value, maxBytes) => {
            const payload = cloneValue(value);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return value;
            }
            const entries = Array.isArray(payload.entries) ? payload.entries.slice() : [];
            let trimmed = false;
            while (entries.length > 1) {
                const candidate = { ...payload, count: entries.length, entries };
                if (measureBytes(candidate) <= maxBytes) {
                    return trimmed ? { ...candidate, storageTrimmed: true } : candidate;
                }
                entries.shift();
                trimmed = true;
            }
            const minimalPayload = { ...payload, count: entries.length, entries, storageTrimmed: trimmed };
            return measureBytes(minimalPayload) <= maxBytes
                ? minimalPayload
                : { updatedAt: payload.updatedAt || new Date().toISOString(), count: 0, entries: [], storageTrimmed: true };
        };

        const compactTraceHealthPayload = (value, maxBytes) => {
            const payload = cloneValue(value);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return value;
            }
            if (measureBytes(payload) <= maxBytes) {
                return payload;
            }
            const compacted = { updatedAt: payload.updatedAt || new Date().toISOString() };
            Object.entries(payload).forEach(([key, record]) => {
                if (key === 'updatedAt' || !record || typeof record !== 'object' || Array.isArray(record)) {
                    return;
                }
                compacted[key] = {
                    lastWriteAt: record.lastWriteAt || null,
                    lastWriteSucceeded: record.lastWriteSucceeded === true,
                    failureCount: Number.isFinite(Number(record.failureCount)) ? Number(record.failureCount) : 0,
                    details: {}
                };
            });
            return measureBytes(compacted) <= maxBytes
                ? compacted
                : { updatedAt: compacted.updatedAt, storageTrimmed: true };
        };

        const compactPageSnapshotPayload = (value, maxBytes) => {
            const payload = cloneValue(value);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return value;
            }
            if (measureBytes(payload) <= maxBytes) {
                return payload;
            }
            const folderEntries = Array.isArray(payload?.folderRows?.entries) ? payload.folderRows.entries.slice() : [];
            const memberEntries = Array.isArray(payload?.memberRows?.entries) ? payload.memberRows.entries.slice() : [];
            const topLevelEntries = Array.isArray(payload?.topLevelRows?.entries) ? payload.topLevelRows.entries.slice() : [];
            const mismatchFolderEntries = Array.isArray(payload?.mismatches?.folderEntries) ? payload.mismatches.folderEntries.slice() : [];
            const mismatchMemberEntries = Array.isArray(payload?.mismatches?.memberEntries) ? payload.mismatches.memberEntries.slice() : [];
            const buildCandidate = () => ({
                ...payload,
                folderRows: {
                    ...(payload.folderRows && typeof payload.folderRows === 'object' && !Array.isArray(payload.folderRows) ? payload.folderRows : {}),
                    count: payload?.folderRows?.count ?? folderEntries.length,
                    truncated: (payload?.folderRows?.count ?? folderEntries.length) > folderEntries.length,
                    entries: folderEntries
                },
                memberRows: {
                    ...(payload.memberRows && typeof payload.memberRows === 'object' && !Array.isArray(payload.memberRows) ? payload.memberRows : {}),
                    count: payload?.memberRows?.count ?? memberEntries.length,
                    truncated: (payload?.memberRows?.count ?? memberEntries.length) > memberEntries.length,
                    entries: memberEntries
                },
                topLevelRows: {
                    ...(payload.topLevelRows && typeof payload.topLevelRows === 'object' && !Array.isArray(payload.topLevelRows) ? payload.topLevelRows : {}),
                    count: payload?.topLevelRows?.count ?? topLevelEntries.length,
                    truncated: (payload?.topLevelRows?.count ?? topLevelEntries.length) > topLevelEntries.length,
                    entries: topLevelEntries
                },
                mismatches: {
                    ...(payload.mismatches && typeof payload.mismatches === 'object' && !Array.isArray(payload.mismatches) ? payload.mismatches : {}),
                    folderActionCount: payload?.mismatches?.folderActionCount ?? mismatchFolderEntries.length,
                    memberActionCount: payload?.mismatches?.memberActionCount ?? mismatchMemberEntries.length,
                    folderEntries: mismatchFolderEntries,
                    memberEntries: mismatchMemberEntries
                },
                storageTrimmed: true
            });
            let candidate = buildCandidate();
            while (measureBytes(candidate) > maxBytes && memberEntries.length > 24) {
                memberEntries.splice(24);
                mismatchMemberEntries.splice(8);
                candidate = buildCandidate();
            }
            while (measureBytes(candidate) > maxBytes && folderEntries.length > 12) {
                folderEntries.splice(12);
                mismatchFolderEntries.splice(8);
                candidate = buildCandidate();
            }
            while (measureBytes(candidate) > maxBytes && topLevelEntries.length > 24) {
                topLevelEntries.splice(24);
                candidate = buildCandidate();
            }
            return candidate;
        };

        const collectDockerAssetIdentity = () => {
            const entries = [];
            const pluginVersion = String(win?.FolderViewPlusFatalRuntimeContext?.pluginVersion || '').trim();
            if (!doc || typeof doc.querySelectorAll !== 'function') {
                return { pluginVersion, count: 0, entries };
            }
            doc.querySelectorAll('script[src*="/plugins/folderview.plus/scripts/docker"]').forEach((node) => {
                const rawUrl = String(node?.src || '').trim();
                if (!rawUrl) {
                    return;
                }
                let path = rawUrl.replace(/^https?:\/\/[^/?#]+/i, '').replace(/[?#].*$/, '');
                let versionQuery = '';
                let bootQuery = '';
                try {
                    const parsed = new URL(rawUrl, win?.location?.origin || 'http://fvplus.local');
                    path = parsed.pathname || path;
                    versionQuery = String(parsed.searchParams.get('v') || '');
                    bootQuery = String(parsed.searchParams.get('boot') || '');
                } catch (_error) {
                    // The normalized path still identifies relative script URLs.
                }
                entries.push({ path, versionQuery, bootQuery, defer: node?.defer === true });
            });
            return { pluginVersion, count: entries.length, entries };
        };

        const compactStoragePayload = (storageKey, value) => {
            if (storageKey === DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY || storageKey === DOCKER_REQUEST_BUNDLE_TRACE_STORAGE_KEY) {
                return compactTracePayload(value, DOCKER_TRACE_STORAGE_MAX_BYTES);
            }
            if (storageKey === DOCKER_TRACE_HEALTH_STORAGE_KEY) {
                return compactTraceHealthPayload(value, DOCKER_TRACE_HEALTH_STORAGE_MAX_BYTES);
            }
            if (storageKey === DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY) {
                return compactPageSnapshotPayload(value, DOCKER_PAGE_SNAPSHOT_STORAGE_MAX_BYTES);
            }
            return value;
        };

        const writeStorageRecord = (storageKey, value) => {
            try {
                if (!localStorageRef) {
                    return false;
                }
                const compactedValue = compactStoragePayload(storageKey, value);
                localStorageRef.setItem(storageKey, JSON.stringify(compactedValue));
                return true;
            } catch (_error) {
                return false;
            }
        };

        const updateTraceHealth = (traceName, success, details = {}) => {
            try {
                if (!localStorageRef) {
                    return false;
                }
                const existingRaw = String(localStorageRef.getItem(DOCKER_TRACE_HEALTH_STORAGE_KEY) || '').trim();
                let existing = {};
                if (existingRaw) {
                    try {
                        existing = JSON.parse(existingRaw);
                    } catch (_parseError) {
                        existing = {};
                    }
                }
                const safeTraceName = String(traceName || '').trim() || 'unknown';
                const previous = existing?.[safeTraceName] && typeof existing[safeTraceName] === 'object' && !Array.isArray(existing[safeTraceName])
                    ? existing[safeTraceName]
                    : {};
                const failureCount = Number.isFinite(Number(previous.failureCount)) ? Number(previous.failureCount) : 0;
                const nextPayload = {
                    updatedAt: new Date().toISOString(),
                    ...existing,
                    [safeTraceName]: {
                        lastWriteAt: new Date().toISOString(),
                        lastWriteSucceeded: success === true,
                        failureCount: success === true ? failureCount : (failureCount + 1),
                        details: details && typeof details === 'object' && !Array.isArray(details) ? details : {}
                    }
                };
                return writeStorageRecord(DOCKER_TRACE_HEALTH_STORAGE_KEY, nextPayload);
            } catch (_error) {
                return false;
            }
        };

        const buildTraceEntry = (eventType, details = {}) => ({
            at: new Date().toISOString(),
            eventType: String(eventType || '').trim() || 'unknown',
            details: {
                ...normalizeCorrelationContext(getCorrelationContext()),
                ...(details && typeof details === 'object' && !Array.isArray(details) ? cloneValue(details) : {})
            }
        });

        const appendTrace = (storageKey, traceName, limit, eventType, details = {}) => {
            try {
                if (!localStorageRef) {
                    updateTraceHealth(traceName, false, {
                        reason: 'localStorageUnavailable',
                        eventType: String(eventType || '').trim() || 'unknown'
                    });
                    return false;
                }
                const existingRaw = String(localStorageRef.getItem(storageKey) || '').trim();
                let existing = {};
                if (existingRaw) {
                    try {
                        existing = JSON.parse(existingRaw);
                    } catch (_parseError) {
                        existing = {};
                    }
                }
                const entries = Array.isArray(existing?.entries) ? existing.entries.slice(-limit) : [];
                entries.push(buildTraceEntry(eventType, details));
                while (entries.length > limit) {
                    entries.shift();
                }
                const writeOk = writeStorageRecord(storageKey, {
                    updatedAt: new Date().toISOString(),
                    count: entries.length,
                    entries
                });
                updateTraceHealth(traceName, writeOk, {
                    eventType: String(eventType || '').trim() || 'unknown',
                    count: entries.length
                });
                return writeOk;
            } catch (_error) {
                updateTraceHealth(traceName, false, {
                    reason: 'exception',
                    eventType: String(eventType || '').trim() || 'unknown'
                });
                return false;
            }
        };

        const isNodeVisible = (node, boundary = null) => {
            if (!node || node.nodeType !== 1) {
                return true;
            }
            const boundaryElement = boundary && boundary.nodeType === 1 ? boundary : null;
            let current = node;
            while (current && current.nodeType === 1) {
                if (current.hidden === true) {
                    return false;
                }
                const ariaHidden = String(current.getAttribute?.('aria-hidden') || '').trim().toLowerCase();
                if (ariaHidden === 'true') {
                    return false;
                }
                const inlineStyle = String(current.getAttribute?.('style') || '').trim().toLowerCase();
                if (/\bdisplay\s*:\s*none\b/.test(inlineStyle) || /\bvisibility\s*:\s*hidden\b/.test(inlineStyle)) {
                    return false;
                }
                if (typeof win?.getComputedStyle === 'function') {
                    const computedStyle = win.getComputedStyle(current);
                    if (computedStyle && (computedStyle.display === 'none' || computedStyle.visibility === 'hidden')) {
                        return false;
                    }
                }
                if (boundaryElement && current === boundaryElement) {
                    break;
                }
                current = current.parentElement;
            }
            return true;
        };

        const collectVisibleText = (node, boundary, segments = []) => {
            if (!node) {
                return segments;
            }
            if (node.nodeType === 3) {
                const text = normalizeText(node.textContent || '');
                if (text) {
                    segments.push(text);
                }
                return segments;
            }
            if (node.nodeType !== 1 || !isNodeVisible(node, boundary)) {
                return segments;
            }
            const tagName = String(node.tagName || '').toUpperCase();
            if (tagName === 'SCRIPT' || tagName === 'STYLE') {
                return segments;
            }
            Array.from(node.childNodes || []).forEach((childNode) => {
                collectVisibleText(childNode, boundary, segments);
            });
            return segments;
        };

        const readVisibleUpdateCellText = ($updateCell) => {
            const updateCell = $updateCell?.get ? $updateCell.get(0) : null;
            if (!updateCell) {
                return '';
            }
            const segments = [];
            Array.from(updateCell.childNodes || []).forEach((childNode) => {
                collectVisibleText(childNode, updateCell, segments);
            });
            return normalizeText(segments.join(' '));
        };

        const resolveActionToken = (text) => {
            const normalized = normalizeText(text).toLowerCase();
            if (!normalized) {
                return 'none';
            }
            if (normalized.includes('apply update')) {
                return 'applyUpdate';
            }
            if (normalized.includes('force update')) {
                return 'forceUpdate';
            }
            if (normalized.includes('up-to-date')) {
                return 'upToDate';
            }
            if (normalized.includes('update ready')) {
                return 'updateReady';
            }
            return 'other';
        };

        const parseFolderId = (row) => {
            const className = String(row?.className || '').trim();
            const match = className.match(/(?:^|\s)folder-id-([A-Za-z0-9_-]+)(?:\s|$)/);
            return match ? String(match[1] || '').trim() : '';
        };

        const parseMemberFolderId = (row) => {
            const className = String(row?.className || '').trim();
            const match = className.match(/(?:^|\s)folder-([A-Za-z0-9_-]+)-element(?:\s|$)/);
            return match ? String(match[1] || '').trim() : '';
        };

        const collectPageSnapshot = (reason = 'runtime-sync') => {
            if (typeof $ !== 'function') {
                return null;
            }
            const $tableRows = $('#docker_list > tr');
            if (!$tableRows.length) {
                return null;
            }
            const currentListViewMode = readDockerListViewMode();
            const folderEntries = [];
            const memberEntries = [];
            const topLevelEntries = [];
            const mismatches = { folderActionCount: 0, memberActionCount: 0, folderEntries: [], memberEntries: [] };
            const summary = {
                visibleFolderRows: 0,
                visibleMemberRows: 0,
                expandedFolderRows: 0,
                folderApplyUpdateCount: 0,
                folderForceUpdateCount: 0,
                memberApplyUpdateCount: 0,
                memberForceUpdateCount: 0,
                memberMissingFolderClassCount: 0,
                folderActionMismatchCount: 0,
                memberActionMismatchCount: 0
            };
            let topLevelRowCount = 0;
            let topLevelFolderCount = 0;
            let standaloneContainerCount = 0;
            let firstStandaloneDomIndex = null;
            let firstOrderingViolationDomIndex = null;

            $tableRows.each((rowIndex, row) => {
                const $row = $(row);
                if (!$row.is(':visible')) {
                    return;
                }
                const folderId = parseFolderId(row);
                if (folderId) {
                    topLevelRowCount += 1;
                    topLevelFolderCount += 1;
                    if (firstStandaloneDomIndex !== null && firstOrderingViolationDomIndex === null) {
                        firstOrderingViolationDomIndex = rowIndex;
                    }
                    if (topLevelEntries.length < DOCKER_SUPPORT_BUNDLE_TOP_LEVEL_ROW_LIMIT) {
                        topLevelEntries.push({
                            domIndex: rowIndex,
                            rowType: 'folder',
                            folderId,
                            folderName: normalizeText($row.find('td.ct-name .appname').first().text())
                        });
                    }
                    const updateCellText = readVisibleUpdateCellText($row.find('td.updatecolumn').first());
                    const actionToken = resolveActionToken(updateCellText);
                    const expectedActionToken = resolveExpectedFolderActionToken(folderId);
                    const expanded = $(`.dropDown-${folderId}`).attr('active') === 'true';
                    const mismatch = expectedActionToken !== 'unknown' && expectedActionToken !== actionToken;
                    summary.visibleFolderRows += 1;
                    if (expanded) {
                        summary.expandedFolderRows += 1;
                    }
                    if (actionToken === 'applyUpdate') {
                        summary.folderApplyUpdateCount += 1;
                    } else if (actionToken === 'forceUpdate') {
                        summary.folderForceUpdateCount += 1;
                    }
                    if (mismatch) {
                        summary.folderActionMismatchCount += 1;
                        mismatches.folderActionCount += 1;
                        if (mismatches.folderEntries.length < DOCKER_SUPPORT_BUNDLE_MISMATCH_LIMIT) {
                            mismatches.folderEntries.push({
                                folderId,
                                folderName: normalizeText($row.find('td.ct-name .appname').first().text()),
                                expectedActionToken,
                                renderedActionToken: actionToken,
                                updateCellText
                            });
                        }
                    }
                    if (folderEntries.length < DOCKER_SUPPORT_BUNDLE_FOLDER_ROW_LIMIT) {
                        folderEntries.push({
                            folderId,
                            folderName: normalizeText($row.find('td.ct-name .appname').first().text()),
                            expanded,
                            updateCellText,
                            actionToken,
                            expectedActionToken,
                            actionMismatch: mismatch,
                            statusText: normalizeText($row.find('td.ct-name .state').first().text())
                        });
                    }
                    return;
                }

                const rawId = String(row?.id || '').trim();
                if (!rawId.startsWith('ct-')) {
                    return;
                }
                const containerName = normalizeText($row.find('td.ct-name .appname').first().text()) || rawId.slice(3);
                const updateCellText = readVisibleUpdateCellText($row.find('td.updatecolumn').first());
                const actionToken = resolveActionToken(updateCellText);
                const memberFolderId = parseMemberFolderId(row);
                if (!memberFolderId) {
                    topLevelRowCount += 1;
                    standaloneContainerCount += 1;
                    if (firstStandaloneDomIndex === null) {
                        firstStandaloneDomIndex = rowIndex;
                    }
                    if (topLevelEntries.length < DOCKER_SUPPORT_BUNDLE_TOP_LEVEL_ROW_LIMIT) {
                        topLevelEntries.push({
                            domIndex: rowIndex,
                            rowType: 'standaloneContainer',
                            containerName,
                            folderOwnership: 'none'
                        });
                    }
                }
                const runtimeEntry = getRuntimeInfoEntry(containerName);
                const expectedActionToken = resolveExpectedMemberActionToken(runtimeEntry || {});
                const mismatch = expectedActionToken !== 'unknown' && expectedActionToken !== actionToken;
                summary.visibleMemberRows += 1;
                if (!memberFolderId) {
                    summary.memberMissingFolderClassCount += 1;
                }
                if (actionToken === 'applyUpdate') {
                    summary.memberApplyUpdateCount += 1;
                } else if (actionToken === 'forceUpdate') {
                    summary.memberForceUpdateCount += 1;
                }
                if (mismatch) {
                    summary.memberActionMismatchCount += 1;
                    mismatches.memberActionCount += 1;
                    if (mismatches.memberEntries.length < DOCKER_SUPPORT_BUNDLE_MISMATCH_LIMIT) {
                        mismatches.memberEntries.push({
                            containerName,
                            folderId: memberFolderId || '',
                            expectedActionToken,
                            renderedActionToken: actionToken,
                            updateCellText
                        });
                    }
                }
                if (memberEntries.length < DOCKER_SUPPORT_BUNDLE_MEMBER_ROW_LIMIT) {
                    memberEntries.push({
                        containerName,
                        folderId: memberFolderId || '',
                        classTagged: memberFolderId !== '',
                        updateCellText,
                        actionToken,
                        expectedActionToken,
                        actionMismatch: mismatch,
                        statusText: normalizeText($row.find('td.ct-name .state').first().text())
                    });
                }
            });

            return {
                capturedAt: new Date().toISOString(),
                reason: String(reason || 'runtime-sync').trim() || 'runtime-sync',
                currentPage: String(win?.location?.pathname || ''),
                listViewMode: currentListViewMode,
                correlation: normalizeCorrelationContext(getCorrelationContext()),
                dockerAssets: collectDockerAssetIdentity(),
                topLevelRows: {
                    count: topLevelRowCount,
                    truncated: topLevelRowCount > topLevelEntries.length,
                    folderCount: topLevelFolderCount,
                    standaloneContainerCount,
                    foldersBeforeStandalone: firstOrderingViolationDomIndex === null,
                    firstStandaloneDomIndex,
                    firstOrderingViolationDomIndex,
                    entries: topLevelEntries
                },
                folderRows: {
                    count: summary.visibleFolderRows,
                    truncated: summary.visibleFolderRows > folderEntries.length,
                    entries: folderEntries
                },
                memberRows: {
                    count: summary.visibleMemberRows,
                    truncated: summary.visibleMemberRows > memberEntries.length,
                    entries: memberEntries
                },
                mismatches: {
                    folderActionCount: mismatches.folderActionCount,
                    memberActionCount: mismatches.memberActionCount,
                    folderEntries: mismatches.folderEntries,
                    memberEntries: mismatches.memberEntries
                },
                summary
            };
        };

        const writeSupportBundleStorageRecord = (storageKey, value) => {
            const writeOk = writeStorageRecord(storageKey, value);
            if (storageKey === DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY) {
                updateTraceHealth('pageSnapshot', writeOk, {
                    reason: String(value?.reason || '').trim() || 'runtime-sync'
                });
            }
            return writeOk;
        };

        let snapshotTimer = null;
        const queuePageSnapshot = (reason = 'runtime-sync', delayMs = 180) => {
            if (snapshotTimer) {
                clearTimeout(snapshotTimer);
            }
            snapshotTimer = win.setTimeout(() => {
                snapshotTimer = null;
                const snapshot = collectPageSnapshot(reason);
                if (snapshot) {
                    writeSupportBundleStorageRecord(DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY, snapshot);
                }
            }, Math.max(0, Number(delayMs) || 0));
        };

        return {
            writeSupportBundleStorageRecord,
            updateTraceHealth,
            appendBulkUpdateTrace: (eventType, details = {}) =>
                appendTrace(DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY, 'bulkUpdateTrace', DOCKER_BULK_UPDATE_TRACE_LIMIT, eventType, details),
            appendRequestBundleTrace: (eventType, details = {}) =>
                appendTrace(DOCKER_REQUEST_BUNDLE_TRACE_STORAGE_KEY, 'requestBundleTrace', DOCKER_REQUEST_BUNDLE_TRACE_LIMIT, eventType, details),
            collectPageSnapshot,
            queuePageSnapshot,
            getStorageKeys: () => ({
                dockerPage: DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY,
                dockerBulkUpdateTrace: DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY,
                dockerRequestBundleTrace: DOCKER_REQUEST_BUNDLE_TRACE_STORAGE_KEY,
                dockerTraceHealth: DOCKER_TRACE_HEALTH_STORAGE_KEY
            })
        };
    };

    return {
        DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY,
        DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY,
        DOCKER_REQUEST_BUNDLE_TRACE_STORAGE_KEY,
        DOCKER_TRACE_HEALTH_STORAGE_KEY,
        createApi
    };
}));
