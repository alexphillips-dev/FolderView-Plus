(function folderViewPlusRuntimeSnapshotScope(window) {
    'use strict';

    const ENDPOINT = '/plugins/folderview.plus/server/runtime_snapshot.php';
    const SCHEMA_VERSION = 1;
    const requestClient = window.FolderViewPlusRequest || null;

    const parsePayload = (payload) => {
        let parsed = payload;
        if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Runtime snapshot response was empty.');
        }
        if (parsed.ok === false) {
            throw new Error(String(parsed.error || 'Runtime snapshot request failed.'));
        }
        if (String(parsed.kind || '') !== 'runtime_snapshot') {
            throw new Error('Runtime snapshot response kind was invalid.');
        }
        if (Number(parsed.schemaVersion || 0) !== SCHEMA_VERSION) {
            throw new Error('Runtime snapshot schema is not supported.');
        }
        return parsed;
    };

    const buildUrl = (type, mode = 'state', options = {}) => {
        const safeType = type === 'vm' ? 'vm' : 'docker';
        const safeMode = ['state', 'full', 'check'].includes(String(mode || '').toLowerCase())
            ? String(mode).toLowerCase()
            : 'state';
        const query = { type: safeType, mode: safeMode };
        const since = String(options?.since || '').trim().toLowerCase();
        if (/^[a-f0-9]{64}$/.test(since)) {
            query.since = since;
        }
        if (options?.liveUpdateStatus === true && safeType === 'docker' && safeMode !== 'full') {
            query.liveupdate = 1;
        }
        if (options?.forceRefresh === true || safeMode === 'check') {
            query.nocache = 1;
        }
        if (Number.isFinite(Number(options?.ttl))) {
            query.ttl = Math.max(0, Math.min(30, Math.round(Number(options.ttl))));
        }
        query._ = String(options?.cacheBust || Date.now());
        if (!requestClient || typeof requestClient.buildUrl !== 'function') {
            throw new Error('FolderView Plus request URL builder is unavailable.');
        }
        return requestClient.buildUrl(ENDPOINT, query);
    };

    const projectValue = (snapshot, field) => {
        if (field === 'prefsResponse') {
            return {
                ok: true,
                prefs: snapshot?.prefs && typeof snapshot.prefs === 'object' ? snapshot.prefs : {},
                metadata: snapshot?.metadata && typeof snapshot.metadata === 'object' ? snapshot.metadata : {}
            };
        }
        const value = snapshot?.[field];
        if (Array.isArray(value)) {
            return value;
        }
        return value && typeof value === 'object' ? value : {};
    };

    const createProjectedBundle = (requestPromise, fields, options = {}) => {
        const normalizedPromise = Promise.resolve(requestPromise).then(parsePayload);
        if (typeof options?.onSnapshot === 'function') {
            normalizedPromise.then((snapshot) => options.onSnapshot(snapshot)).catch(() => {});
        }
        const fallbackFactories = Array.isArray(options?.fallbackFactories) ? options.fallbackFactories : [];
        return (Array.isArray(fields) ? fields : []).map((field, index) => normalizedPromise
            .then((snapshot) => JSON.stringify(projectValue(snapshot, field)))
            .catch((error) => {
                const fallbackFactory = fallbackFactories[index];
                if (typeof fallbackFactory === 'function') {
                    return fallbackFactory(error);
                }
                throw error;
            }));
    };

    const projectRequest = (requestPromise, field, fallbackFactory = null, onSnapshot = null) => {
        const normalizedPromise = Promise.resolve(requestPromise).then(parsePayload);
        if (typeof onSnapshot === 'function') {
            normalizedPromise.then((snapshot) => onSnapshot(snapshot)).catch(() => {});
        }
        return normalizedPromise
            .then((snapshot) => JSON.stringify(projectValue(snapshot, field)))
            .catch((error) => {
                if (typeof fallbackFactory === 'function') {
                    return fallbackFactory(error);
                }
                throw error;
            });
    };

    const normalizeRuntimeBoolean = (value) => {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value === 1;
        }
        return ['1', 'true', 'yes', 'on', 'running', 'started'].includes(String(value || '').trim().toLowerCase());
    };

    const buildRuntimeRowToken = (type, entry) => {
        const safeType = type === 'vm' ? 'vm' : 'docker';
        const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
        if (safeType === 'vm') {
            return JSON.stringify([
                String(source.uuid || source.id || '').trim(),
                String(source.state || 'unknown').trim().toLowerCase(),
                normalizeRuntimeBoolean(source.autostart)
            ]);
        }
        const info = source.info && typeof source.info === 'object' ? source.info : {};
        const stateNode = info.State && typeof info.State === 'object' ? info.State : {};
        const labels = source.Labels && typeof source.Labels === 'object' ? source.Labels : {};
        const running = Object.prototype.hasOwnProperty.call(source, 'running')
            ? normalizeRuntimeBoolean(source.running)
            : normalizeRuntimeBoolean(stateNode.Running);
        const paused = Object.prototype.hasOwnProperty.call(source, 'paused')
            ? normalizeRuntimeBoolean(source.paused)
            : normalizeRuntimeBoolean(stateNode.Paused);
        const state = String(source.state || '').trim().toLowerCase() || (running ? (paused ? 'paused' : 'running') : 'stopped');
        const identity = String(source.id || source.shortId || source.Id || '').replace(/^sha256:/i, '').slice(0, 12);
        const updated = Object.prototype.hasOwnProperty.call(source, 'Updated') ? source.Updated : stateNode.Updated;
        const folderLabel = String(
            source.folderLabel
            || labels['folderview.plus']
            || labels['folder.view3']
            || labels['folder.view2']
            || labels['folder.view']
            || ''
        ).trim();
        return JSON.stringify([
            identity,
            state,
            running,
            paused,
            normalizeRuntimeBoolean(Object.prototype.hasOwnProperty.call(source, 'autostart') ? source.autostart : stateNode.Autostart),
            typeof updated === 'boolean' ? updated : null,
            String(source.manager || stateNode.manager || '').trim(),
            folderLabel
        ]);
    };

    const diffRuntimeRows = (type, previousRows, nextRows) => {
        const previous = previousRows && typeof previousRows === 'object' && !Array.isArray(previousRows) ? previousRows : {};
        const next = nextRows && typeof nextRows === 'object' && !Array.isArray(nextRows) ? nextRows : {};
        const previousKeys = Object.keys(previous);
        const nextKeys = Object.keys(next);
        const previousSet = new Set(previousKeys);
        const nextSet = new Set(nextKeys);
        const added = nextKeys.filter((key) => !previousSet.has(key)).sort((a, b) => a.localeCompare(b));
        const removed = previousKeys.filter((key) => !nextSet.has(key)).sort((a, b) => a.localeCompare(b));
        const changed = [];
        const unchanged = [];
        nextKeys.forEach((key) => {
            if (!previousSet.has(key)) {
                return;
            }
            if (buildRuntimeRowToken(type, previous[key]) === buildRuntimeRowToken(type, next[key])) {
                unchanged.push(key);
            } else {
                changed.push(key);
            }
        });
        changed.sort((a, b) => a.localeCompare(b));
        unchanged.sort((a, b) => a.localeCompare(b));
        return Object.freeze({
            type: type === 'vm' ? 'vm' : 'docker',
            added: Object.freeze(added),
            removed: Object.freeze(removed),
            changed: Object.freeze(changed),
            unchanged: Object.freeze(unchanged),
            structuralChanged: added.length > 0 || removed.length > 0,
            hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0
        });
    };

    window.FolderViewPlusRuntimeSnapshot = Object.freeze({
        ENDPOINT,
        SCHEMA_VERSION,
        parsePayload,
        buildUrl,
        projectValue,
        createProjectedBundle,
        projectRequest,
        buildRuntimeRowToken,
        diffRuntimeRows
    });
})(window);
