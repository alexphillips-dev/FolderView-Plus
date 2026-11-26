(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.prefsOutbox = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const isPreferenceRevisionConflict = (status, error) => status === 409
        && (!error?.phase || error.phase === 'request')
        && !['nonce-stale', 'nonce-target-mismatch', 'transaction-invalid', 'transaction-replayed'].includes(error?.reasonCode);
    const isRetryableSyncError = (error) => {
        const status = Number(error?.status || error?.httpStatus || 0);
        return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500
            || (status === 409 && ['nonce-stale', 'transaction-replayed'].includes(error?.reasonCode));
    };
    const classifyWriteError = (error, alreadySubmitted) => {
        const status = Number(error?.status || error?.httpStatus || 0);
        const isConflict = isPreferenceRevisionConflict(status, error);
        const recoveredConflict = isConflict && alreadySubmitted;
        const rejected = recoveredConflict || error?.collectionConflict === true
            || ((status === 400 || status === 422) && (!error?.phase || error.phase === 'request'));
        return { isConflict, recoveredConflict, rejected };
    };

    const applyFolderVisibilityChanges = (prefs) => {
        if (!prefs || !Object.hasOwn(prefs, 'hiddenFolderIdChanges')) return prefs;
        const { hiddenFolderIdChanges, ...next } = prefs;
        const hiddenIds = new Set(Array.isArray(next.hiddenFolderIds) ? next.hiddenFolderIds : []);
        for (const [id, hidden] of Object.entries(hiddenFolderIdChanges || {})) {
            if (hidden === true) hiddenIds.add(id);
            if (hidden === false) hiddenIds.delete(id);
        }
        return { ...next, hiddenFolderIds: [...hiddenIds] };
    };

    const mergeStartOrderPatch = (previous, patch, mergeValues) => {
        const merged = mergeValues(previous, patch);
        const previousChanges = !Object.hasOwn(patch, 'batches') && Array.isArray(previous?.batchChanges) ? previous.batchChanges : [];
        const changes = [
            ...previousChanges,
            ...(Array.isArray(patch.batchChanges) ? patch.batchChanges : [])
        ];
        if (changes.length) merged.batchChanges = changes;
        else delete merged.batchChanges;
        return merged;
    };

    const applyStartOrderBatchChanges = (prefs) => {
        const plan = prefs?.dockerStartOrder;
        if (!Array.isArray(plan?.batchChanges)) return prefs;
        const { batchChanges, ...next } = plan;
        const batches = [...(Array.isArray(next.batches) ? next.batches : [])];
        for (const edit of batchChanges) {
            if (typeof edit?.id !== 'string' || !edit.id) continue;
            const index = batches.findIndex(batch => batch?.id === edit.id);
            if (edit.action === 'add' && edit.value?.id === edit.id && index < 0 && batches.length < 100) {
                batches.push(edit.value);
            } else if (index >= 0 && batches.findLastIndex(batch => batch?.id === edit.id) === index) {
                if (edit.action === 'remove') batches.splice(index, 1);
                const otherIndex = index + edit.offset;
                if (edit.action === 'move' && [-1, 1].includes(edit.offset)
                    && typeof edit.neighbor === 'string' && batches[otherIndex]?.id === edit.neighbor
                    && batches.findIndex(batch => batch?.id === edit.neighbor) === batches.findLastIndex(batch => batch?.id === edit.neighbor)) {
                    [batches[index], batches[otherIndex]] = [batches[otherIndex], batches[index]];
                }
                if (edit.action === 'set' && ['name', 'delay', 'useFolderOrder', 'parallel', 'items'].includes(edit.field)
                    && Object.hasOwn(edit, 'value') && JSON.stringify(batches[index][edit.field]) === JSON.stringify(edit.previous)) {
                    batches[index] = { ...batches[index], [edit.field]: edit.value };
                }
            }
        }
        return { ...prefs, dockerStartOrder: { ...next, batches } };
    };

    const createStorage = ({ storage, prefix, sourceId, now, readRevision, mergeValues, cloneValue, patchIsEmpty, mutationIdFor }) => {
        const mergePatch = (previous, patch) => {
            if (!Object.hasOwn(patch, 'hiddenFolderIds') || !Object.hasOwn(previous, 'hiddenFolderIdChanges')) {
                return mergeValues(previous, patch);
            }
            // A complete replacement supersedes earlier individual changes.
            const base = { ...previous };
            delete base.hiddenFolderIdChanges;
            return mergeValues(base, patch);
        };
        const written = new Map();
        const legacyKey = type => `${prefix}${type}`;
        const key = type => `${legacyKey(type)}.${encodeURIComponent(sourceId)}`;
        const isCurrent = (entry) => {
            try { return storage?.getItem(entry.key) === entry.raw; } catch (_error) { return false; }
        };

        const read = (type) => {
            if (!storage) return [];
            try {
                const base = legacyKey(type);
                const keys = [base];
                for (let index = 0, length = Number(storage.length) || 0; index < length; index++) {
                    const candidate = storage.key(index);
                    if (candidate?.startsWith(`${base}.`)) keys.push(candidate);
                }
                const byOwner = new Map();
                for (const candidate of keys) {
                    const raw = storage.getItem(candidate);
                    if (!raw) continue;
                    let record;
                    try { record = JSON.parse(raw); } catch (_error) { continue; }
                    if (![1, 2].includes(Number(record?.schemaVersion)) || !record.patch || typeof record.patch !== 'object'
                        || Array.isArray(record.patch) || !Object.keys(record.patch).length) continue;
                    const owner = record.sourceId || candidate;
                    const versions = byOwner.get(owner) || [];
                    versions.push({ key: candidate, raw, record });
                    byOwner.set(owner, versions);
                }
                const latest = [];
                for (const versions of byOwner.values()) {
                    versions.sort((left, right) => (Number(left.record.sequence) || 0) - (Number(right.record.sequence) || 0));
                    const entry = versions.pop();
                    latest.push({ ...entry, superseded: versions });
                }
                return latest.sort((left, right) => String(left.record.updatedAt || '').localeCompare(String(right.record.updatedAt || '')));
            } catch (_error) {
                return [];
            }
        };

        const write = (type, patch, operation, pending) => {
            if (!storage) return false;
            try {
                const contents = { patch, operation, pending };
                const serialized = Object.keys(patch).length ? JSON.stringify(contents) : '';
                const previous = written.get(type) || { serialized: '', key: '', sequence: 0 };
                if (serialized === previous.serialized) return Boolean(previous.key);
                const sequence = previous.sequence + 1;
                const nextKey = serialized ? `${key(type)}.${sequence}` : '';
                if (nextKey) {
                    // A replayer can acknowledge this record without touching later versions.
                    storage.setItem(nextKey, JSON.stringify({
                        schemaVersion: 2, type, sourceId, sequence, updatedAt: new Date(now()).toISOString(), ...contents
                    }));
                }
                written.set(type, { serialized, key: nextKey, sequence });
                if (previous.key) storage.removeItem(previous.key);
                return Boolean(nextKey);
            } catch (_error) {
                // Server persistence remains available when browser storage is blocked.
                return false;
            }
        };

        const acknowledge = (entry) => {
            try {
                for (const candidate of [...entry.superseded, entry]) {
                    if (isCurrent(candidate)) storage.removeItem(candidate.key);
                }
            } catch (_error) {
                // Storage may become unavailable while a request is pending.
            }
        };

        const advance = (entry, operation) => {
            try {
                if (!isCurrent(entry)) return;
                const record = { ...entry.record, patch: operation.patch, operation, pending: null };
                const raw = JSON.stringify(record);
                storage.setItem(entry.key, raw);
                entry.raw = raw;
                entry.record = record;
            } catch (_error) {
                // Keep the original record recoverable until storage is available again.
            }
        };

        const recoverOperation = (entry) => {
            const operation = entry.next || entry.record.operation;
            if (Number(entry.record.schemaVersion) !== 2
                || !Number.isSafeInteger(operation?.expectedRevision) || operation.expectedRevision <= 0
                || typeof operation.mutationId !== 'string' || !/^[a-zA-Z0-9._:-]{1,96}$/.test(operation.mutationId)
                || patchIsEmpty(operation.patch)) return null;
            return operation;
        };

        const applicablePatches = (state, entries) => entries
            .filter(entry => recoverOperation(entry)?.expectedRevision === readRevision(state.confirmedPrefs))
            .map(entry => entry.next?.patch || entry.record.patch);

        const externalPatch = (state) => applicablePatches(state, read(state.type)
            .filter(entry => entry.record.sourceId !== sourceId)).reduce(mergePatch, {});

        const queuedPatches = (state) => [
            ...applicablePatches(state, state.restoring),
            state.inFlightBatch?.patch || {},
            state.retryBatch?.expectedRevision === readRevision(state.confirmedPrefs) ? state.retryBatch.patch : {},
            state.pendingPatch
        ];

        const restore = (state) => {
            state.restoring = read(state.type);
            if (!state.restoring.length) return false;
            state.status = 'sync-pending';
            return true;
        };

        const finish = (state, entry) => {
            if (!entry) return;
            state.restoring = state.restoring.filter(other => other !== entry);
            acknowledge(entry);
            state.externalPatch = externalPatch(state);
        };

        const guardedCollections = ['autoRules', 'folderGroups'];
        const pendingOperation = state => ({
            patch: state.pendingPatch,
            ...Object.fromEntries(guardedCollections
                .filter(key => Object.hasOwn(state.pendingCollectionBases, key))
                .map(key => [`${key}Base`, state.pendingCollectionBases[key]])),
            generation: state.generation,
            mutationId: mutationIdFor(state.generation),
            expectedRevision: readRevision(state.confirmedPrefs)
        });

        const collectionChangedSinceEdit = (batch, state) => guardedCollections.some(key => {
            const baseline = batch[`${key}Base`];
            return Array.isArray(baseline) && JSON.stringify(baseline) !== JSON.stringify(state.confirmedPrefs?.[key] || []);
        });
        const collectionConflictBeforeWrite = (batch, state, alreadySubmitted) =>
            // A previously submitted operation can have committed despite a missing response.
            // Its original revision and mutation ID must reach the server receipt check.
            (!alreadySubmitted || batch.expectedRevision === readRevision(state.confirmedPrefs))
            && collectionChangedSinceEdit(batch, state);

        const queuePatch = (state, patch, baseline) => {
            for (const key of guardedCollections) {
                if (baseline && Object.hasOwn(patch, key) && !Object.hasOwn(state.pendingPatch, key)) {
                    state.pendingCollectionBases[key] = cloneValue(baseline[key] || []);
                }
            }
            state.pendingPatch = mergePatch(state.pendingPatch, patch);
        };

        const requeue = (state, batch) => {
            state.pendingPatch = mergePatch(batch.patch, state.pendingPatch);
            for (const key of guardedCollections) {
                if (!Object.hasOwn(batch.patch, key)) continue;
                const baseline = batch[`${key}Base`];
                if (Array.isArray(baseline)) state.pendingCollectionBases[key] = baseline;
                else delete state.pendingCollectionBases[key];
            }
        };

        const beginRebase = (state, batch) => {
            state.conflictRetries += 1;
            state.stats.conflicts += 1;
            state.status = 'sync-pending';
            state.inFlightBatch = batch;
        };

        const completeRebase = (state, batch) => {
            requeue(state, batch);
            state.inFlightBatch = null;
            state.flushing = false;
            persist(state);
        };

        const persist = (state) => {
            const submitted = state.inFlightBatch || state.retryBatch;
            const pending = pendingOperation(state);
            const persisted = write(state.type, mergePatch(submitted?.patch || {}, pending.patch),
                submitted || pending, submitted && !patchIsEmpty(pending.patch) ? pending : null);
            return persisted && pending.expectedRevision > 0 && (!submitted || submitted.expectedRevision > 0);
        };

        const prepare = (state, restored, recovered) => {
            // Unknown outcomes keep their original patch, revision and identity.
            const retry = restored ? null : state.retryBatch;
            const batch = recovered || retry || pendingOperation(state);
            if (retry) state.retryBatch = null;
            if (!restored && !retry) {
                state.pendingPatch = {};
                state.pendingCollectionBases = {};
            }
            state.inFlightBatch = restored ? null : batch;
            return { batch, retry };
        };

        const advanceAfterCommit = (entry, savedRevision, expectedRevision) => {
            if (!entry || entry.next || patchIsEmpty(entry.record.pending?.patch)
                || (savedRevision !== expectedRevision && savedRevision !== expectedRevision + 1)) return false;
            entry.next = { ...entry.record.pending, expectedRevision: savedRevision };
            advance(entry, entry.next);
            return true;
        };

        const keepPendingStartupEdit = (entry, revision, expectedRevision) => {
            const patch = entry?.record.pending?.patch;
            return Object.keys(patch || {}).length === 1 && Boolean(patch.dockerStartOrder)
                && advanceAfterCommit(entry, revision, expectedRevision);
        };

        return Object.freeze({
            key, isCurrent, recoverOperation, queuedPatches, externalPatch, restore, finish, persist, prepare, advanceAfterCommit, keepPendingStartupEdit,
            queuePatch, requeue, collectionChangedSinceEdit, collectionConflictBeforeWrite, beginRebase, completeRebase
        });
    };

    return Object.freeze({ createStorage, applyFolderVisibilityChanges, mergeStartOrderPatch, applyStartOrderBatchChanges, isPreferenceRevisionConflict, isRetryableSyncError, classifyWriteError });
}));
