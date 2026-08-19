// @ts-check
(function dockerRuntimeFolderGroupingModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerFolderGrouping = factory();
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeFolderGroupingFactory() {
    'use strict';

    const ENTRY_LIMIT = 64;
    const normalizeToken = (value) => String(value || '').trim().replace(/^\/+/, '');
    const asObject = (value) => (
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    );
    const asArray = (value) => (Array.isArray(value) ? value : []);
    const addUnique = (target, value) => {
        const normalized = normalizeToken(value);
        if (normalized && !target.includes(normalized)) target.push(normalized);
    };
    const identityVariants = (value) => {
        const normalized = normalizeToken(value);
        if (!normalized) return [];
        const variants = [normalized];
        const unprefixed = normalized.split(':').pop() || '';
        addUnique(variants, unprefixed);
        if (/^[a-f0-9]{16,}$/i.test(unprefixed)) {
            addUnique(variants, unprefixed.slice(0, 12));
        }
        return variants;
    };
    const buildIdentityIndex = (containersInfo = {}) => {
        const index = new Map();
        const canonicalNames = new Set();
        const register = (token, canonicalName) => {
            identityVariants(token).forEach((variant) => {
                const existing = index.get(variant);
                index.set(variant, existing && existing !== canonicalName ? null : canonicalName);
            });
        };
        Object.entries(asObject(containersInfo)).forEach(([rawName, rawEntry]) => {
            const canonicalName = normalizeToken(rawName);
            if (!canonicalName) return;
            canonicalNames.add(canonicalName);
            const entry = asObject(rawEntry);
            const info = asObject(entry.info);
            [rawName, entry.name, entry.id, entry.shortId, info.Name, info.Id]
                .forEach((token) => register(token, canonicalName));
            asArray(entry.names).forEach((token) => register(token, canonicalName));
            asArray(info.Names).forEach((token) => register(token, canonicalName));
        });
        const resolve = (value) => {
            const normalized = normalizeToken(value);
            if (!normalized) return '';
            if (canonicalNames.has(normalized)) return normalized;
            for (const variant of identityVariants(normalized)) {
                const resolved = index.get(variant);
                if (resolved) return resolved;
            }
            if (/^[a-f0-9]{8,}$/i.test(normalized)) {
                const matches = [...canonicalNames].filter((name) => {
                    const entry = asObject(containersInfo[name]);
                    const info = asObject(entry.info);
                    const id = normalizeToken(entry.id || info.Id).split(':').pop() || '';
                    return id.startsWith(normalized);
                });
                if (matches.length === 1) return matches[0];
            }
            return '';
        };
        return Object.freeze({ resolve });
    };
    const readRowCandidates = (row) => {
        const candidates = [];
        const dataset = asObject(row?.dataset);
        ['containerName', 'name', 'container', 'containerId', 'id'].forEach((key) => {
            addUnique(candidates, dataset[key]);
        });
        ['[data-container-name]', '[data-container-id]', 'td.ct-name .appname a', 'td.ct-name .appname']
            .forEach((selector) => {
                const node = row?.querySelector?.(selector);
                addUnique(candidates, node?.dataset?.containerName);
                addUnique(candidates, node?.dataset?.containerId);
                addUnique(candidates, node?.textContent);
            });
        const rawId = String(row?.id || '').trim();
        addUnique(candidates, rawId.startsWith('ct-') ? rawId.slice(3) : rawId);
        return candidates;
    };
    const candidateCount = (matchCacheEntry, key) => asArray(matchCacheEntry?.[key]).length;
    const clone = (value) => JSON.parse(JSON.stringify(value));

    const createSession = (options = {}) => {
        const doc = options.document || null;
        const listRoot = options.listRoot || doc?.getElementById?.('docker_list') || null;
        const selector = String(options.rowSelector || '#docker_list > tr.sortable:not(.folder), #docker_list tr.folder-element');
        const identityIndex = buildIdentityIndex(options.containersInfo);
        const rowRecords = [];
        const rowByCanonicalName = new Map();
        const claimedNames = new Set();
        const folderEntries = new Map();
        let resolvedRowCount = 0;
        let unresolvedRowCount = 0;
        let conflictingCandidateRowCount = 0;
        let duplicateCanonicalRowCount = 0;

        Array.from(doc?.querySelectorAll?.(selector) || []).forEach((row) => {
            if (row?.classList?.contains?.('folder')) return;
            const candidates = readRowCandidates(row);
            const resolvedCandidates = candidates.map(identityIndex.resolve).filter(Boolean);
            const distinctResolved = [...new Set(resolvedCandidates)];
            const canonicalName = distinctResolved[0] || '';
            if (distinctResolved.length > 1) conflictingCandidateRowCount++;
            if (canonicalName) {
                resolvedRowCount++;
                if (rowByCanonicalName.has(canonicalName)) duplicateCanonicalRowCount++;
                else rowByCanonicalName.set(canonicalName, row);
            } else {
                unresolvedRowCount++;
            }
            rowRecords.push({ row, canonicalName, fallbackName: candidates[0] || '' });
        });

        const beginFolder = (folderId, matchCacheEntry = {}, combinedCandidateCount = 0) => {
            const key = String(folderId || '');
            if (!key || folderEntries.has(key)) return;
            folderEntries.set(key, {
                folderOrdinal: folderEntries.size,
                explicitCandidateCount: candidateCount(matchCacheEntry, 'explicit'),
                regexCandidateCount: candidateCount(matchCacheEntry, 'regex'),
                labelCandidateCount: candidateCount(matchCacheEntry, 'label'),
                ruleCandidateCount: candidateCount(matchCacheEntry, 'rules'),
                combinedCandidateCount: Math.max(0, Number(combinedCandidateCount) || 0),
                claimedRowCount: 0,
                missingRowCount: 0,
                renderedMemberCount: 0,
                shellInserted: false,
                shellInsertionStrategy: 'none',
                removedByHideEmpty: false
            });
        };
        const isDirectListRow = (row) => !!listRoot && !!row && (
            row.parentElement === listRoot || row.parentNode === listRoot
        );
        const resolveOrderRow = (identity) => {
            const token = normalizeToken(identity);
            if (!token || !listRoot) return null;
            if (token.startsWith('folder-')) {
                const folderId = token.slice(7);
                return Array.from(listRoot.children || []).find((row) => (
                    normalizeToken(row?.dataset?.fvFolderId) === folderId
                )) || null;
            }
            const canonicalName = identityIndex.resolve(token) || token;
            return rowByCanonicalName.get(canonicalName) || null;
        };
        const insertFolderRow = (folderId, folderRow, position, liveOrder = []) => {
            const entry = folderEntries.get(String(folderId || ''));
            const order = asArray(liveOrder);
            const resolvedPosition = Math.max(0, Math.min(order.length, Math.floor(Number(position) || 0)));
            let strategy = 'failed';
            if (listRoot && folderRow && typeof listRoot.insertBefore === 'function') {
                for (let index = resolvedPosition + 1; index < order.length; index++) {
                    const anchor = resolveOrderRow(order[index]);
                    if (!isDirectListRow(anchor) || anchor === folderRow) continue;
                    listRoot.insertBefore(folderRow, anchor);
                    strategy = 'before-next';
                    break;
                }
                for (let index = resolvedPosition - 1; strategy === 'failed' && index >= 0; index--) {
                    const anchor = resolveOrderRow(order[index]);
                    if (!isDirectListRow(anchor) || anchor === folderRow) continue;
                    listRoot.insertBefore(folderRow, anchor.nextSibling || null);
                    strategy = 'after-previous';
                }
                if (strategy === 'failed' && typeof listRoot.appendChild === 'function') {
                    listRoot.appendChild(folderRow);
                    strategy = 'append';
                }
            }
            const inserted = isDirectListRow(folderRow);
            if (entry) {
                entry.shellInserted = inserted;
                entry.shellInsertionStrategy = inserted ? strategy : 'failed';
            }
            return Object.freeze({ inserted, strategy: inserted ? strategy : 'failed' });
        };
        const claim = (folderId, requestedIdentity) => {
            const canonicalName = identityIndex.resolve(requestedIdentity) || normalizeToken(requestedIdentity);
            const entry = folderEntries.get(String(folderId || ''));
            const row = rowByCanonicalName.get(canonicalName) || null;
            const available = row && !claimedNames.has(canonicalName) && row.isConnected !== false;
            if (available) {
                claimedNames.add(canonicalName);
                if (entry) entry.claimedRowCount++;
                return row;
            }
            if (entry) entry.missingRowCount++;
            return null;
        };
        const finishFolder = (folderId, details = {}) => {
            const entry = folderEntries.get(String(folderId || ''));
            if (!entry) return;
            entry.renderedMemberCount = Math.max(0, Number(details.renderedMemberCount) || 0);
            entry.removedByHideEmpty = details.removedByHideEmpty === true;
        };
        const snapshot = () => {
            const entries = [...folderEntries.values()];
            const totals = entries.reduce((result, entry) => ({
                combinedCandidateCount: result.combinedCandidateCount + entry.combinedCandidateCount,
                claimedRowCount: result.claimedRowCount + entry.claimedRowCount,
                missingRowCount: result.missingRowCount + entry.missingRowCount,
                renderedMemberCount: result.renderedMemberCount + entry.renderedMemberCount,
                insertedShellCount: result.insertedShellCount + (entry.shellInserted ? 1 : 0),
                failedShellCount: result.failedShellCount + (entry.shellInserted ? 0 : 1),
                fallbackShellCount: result.fallbackShellCount + (
                    entry.shellInserted && entry.shellInsertionStrategy !== 'before-next' ? 1 : 0
                ),
                removedByHideEmptyCount: result.removedByHideEmptyCount + (entry.removedByHideEmpty ? 1 : 0)
            }), {
                combinedCandidateCount: 0,
                claimedRowCount: 0,
                missingRowCount: 0,
                renderedMemberCount: 0,
                insertedShellCount: 0,
                failedShellCount: 0,
                fallbackShellCount: 0,
                removedByHideEmptyCount: 0
            });
            return clone({
                schemaVersion: 1,
                hostRows: {
                    total: rowRecords.length,
                    resolved: resolvedRowCount,
                    unresolved: unresolvedRowCount,
                    conflictingCandidates: conflictingCandidateRowCount,
                    duplicateCanonical: duplicateCanonicalRowCount
                },
                folders: {
                    total: entries.length,
                    truncated: entries.length > ENTRY_LIMIT,
                    ...totals,
                    entries: entries.slice(0, ENTRY_LIMIT)
                }
            });
        };
        return Object.freeze({
            readOrder: () => rowRecords.map((entry) => entry.canonicalName || entry.fallbackName).filter(Boolean),
            beginFolder,
            insertFolderRow,
            claim,
            finishFolder,
            snapshot
        });
    };

    return Object.freeze({ normalizeToken, buildIdentityIndex, readRowCandidates, createSession });
}));
