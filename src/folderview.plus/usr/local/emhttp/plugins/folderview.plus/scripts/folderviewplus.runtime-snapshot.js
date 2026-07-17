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

    window.FolderViewPlusRuntimeSnapshot = Object.freeze({
        ENDPOINT,
        SCHEMA_VERSION,
        parsePayload,
        buildUrl,
        projectValue,
        createProjectedBundle,
        projectRequest
    });
})(window);
