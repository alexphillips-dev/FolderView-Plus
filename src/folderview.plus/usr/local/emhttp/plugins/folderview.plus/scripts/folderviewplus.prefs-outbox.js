(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.prefsOutbox = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const createStorage = ({ storage, prefix, sourceId, now }) => {
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
                    if (Number(record?.schemaVersion) !== 1 || !record.patch || typeof record.patch !== 'object'
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

        const write = (type, patch) => {
            if (!storage) return;
            try {
                const serialized = Object.keys(patch).length ? JSON.stringify(patch) : '';
                const previous = written.get(type) || { serialized: '', key: '', sequence: 0 };
                if (serialized === previous.serialized) return;
                const sequence = previous.sequence + 1;
                const nextKey = serialized ? `${key(type)}.${sequence}` : '';
                if (nextKey) {
                    // A replayer can acknowledge this record without touching later versions.
                    storage.setItem(nextKey, JSON.stringify({
                        schemaVersion: 1, type, sourceId, sequence, updatedAt: new Date(now()).toISOString(), patch
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

        return Object.freeze({ key, read, write, isCurrent, acknowledge });
    };

    return Object.freeze({ createStorage });
}));
