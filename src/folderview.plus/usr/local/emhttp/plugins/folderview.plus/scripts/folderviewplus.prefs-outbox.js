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

    const createStorage = ({ storage, prefix, sourceId, now, readRevision, mergePatch, patchIsEmpty, mutationIdFor }) => {
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
            if (!storage) return;
            try {
                const contents = { patch, operation, pending };
                const serialized = Object.keys(patch).length ? JSON.stringify(contents) : '';
                const previous = written.get(type) || { serialized: '', key: '', sequence: 0 };
                if (serialized === previous.serialized) return;
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
            } catch (_error) {
                // Server persistence remains available when browser storage is blocked.
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

        const pendingOperation = state => ({
            patch: state.pendingPatch,
            generation: state.generation,
            mutationId: mutationIdFor(state.generation),
            expectedRevision: readRevision(state.confirmedPrefs)
        });

        const persist = (state) => {
            const submitted = state.inFlightBatch || state.retryBatch;
            const pending = pendingOperation(state);
            write(state.type, mergePatch(submitted?.patch || {}, pending.patch),
                submitted || pending, submitted && !patchIsEmpty(pending.patch) ? pending : null);
        };

        const prepare = (state, restored, recovered) => {
            // Unknown outcomes keep their original patch, revision and identity.
            const retry = restored ? null : state.retryBatch;
            const batch = recovered || retry || pendingOperation(state);
            if (retry) state.retryBatch = null;
            if (!restored && !retry) state.pendingPatch = {};
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

        return Object.freeze({
            key, isCurrent, recoverOperation, queuedPatches, externalPatch, restore, finish, persist, prepare, advanceAfterCommit
        });
    };

    return Object.freeze({ createStorage, isPreferenceRevisionConflict });
}));
