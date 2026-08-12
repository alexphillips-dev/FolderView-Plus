// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeLiveRefresh = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const normalizeKey = (value) => String(value || 'default').trim() || 'default';
    const createController = (options = {}) => {
        const win = options.window || (typeof globalThis !== 'undefined' ? globalThis : {});
        const doc = options.document || win.document || null;
        const keys = Array.from(new Set(
            (Array.isArray(options.keys) && options.keys.length ? options.keys : ['default'])
                .map(normalizeKey)
        ));
        const releaseDelayMs = Math.max(0, Number(options.releaseDelayMs) || 500);
        const isEnabled = typeof options.isEnabled === 'function' ? options.isEnabled : (() => true);
        const tick = typeof options.tick === 'function' ? options.tick : (() => undefined);
        const onError = typeof options.onError === 'function' ? options.onError : (() => {});
        const timers = Object.fromEntries(keys.map((key) => [key, null]));
        const releaseTimers = Object.fromEntries(keys.map((key) => [key, null]));
        const intervalMsByKey = Object.fromEntries(keys.map((key) => [key, 0]));
        const inFlightByKey = Object.fromEntries(keys.map((key) => [key, false]));
        let disposed = false;

        const resolveKeys = (key = null) => {
            if (key === null || key === undefined || key === '') return [...keys];
            const normalized = normalizeKey(key);
            return Object.prototype.hasOwnProperty.call(timers, normalized) ? [normalized] : [];
        };
        const clear = (key = null) => {
            resolveKeys(key).forEach((resolvedKey) => {
                if (timers[resolvedKey] !== null) {
                    win.clearInterval(timers[resolvedKey]);
                    timers[resolvedKey] = null;
                }
                if (releaseTimers[resolvedKey] !== null) {
                    win.clearTimeout(releaseTimers[resolvedKey]);
                    releaseTimers[resolvedKey] = null;
                }
                intervalMsByKey[resolvedKey] = 0;
                inFlightByKey[resolvedKey] = false;
            });
        };
        const release = (key) => {
            if (releaseTimers[key] !== null) win.clearTimeout(releaseTimers[key]);
            if (disposed) {
                releaseTimers[key] = null;
                inFlightByKey[key] = false;
                return;
            }
            releaseTimers[key] = win.setTimeout(() => {
                releaseTimers[key] = null;
                inFlightByKey[key] = false;
            }, releaseDelayMs);
        };
        const run = (key = keys[0]) => {
            const resolvedKey = normalizeKey(key);
            if (
                disposed
                || !Object.prototype.hasOwnProperty.call(inFlightByKey, resolvedKey)
                || inFlightByKey[resolvedKey]
                || doc?.hidden === true
                || isEnabled(resolvedKey) !== true
            ) {
                return Promise.resolve(false);
            }
            inFlightByKey[resolvedKey] = true;
            return Promise.resolve()
                .then(() => tick(resolvedKey))
                .then((result) => result !== false)
                .catch((error) => {
                    onError(error, resolvedKey);
                    return false;
                })
                .finally(() => release(resolvedKey));
        };
        const schedule = (key = keys[0], scheduleOptions = {}) => {
            const resolvedKey = normalizeKey(key);
            if (!Object.prototype.hasOwnProperty.call(timers, resolvedKey)) return false;
            const enabled = scheduleOptions.enabled === true;
            const intervalMs = Math.max(0, Number(scheduleOptions.intervalMs) || 0);
            if (!enabled || intervalMs <= 0 || disposed) {
                clear(resolvedKey);
                return false;
            }
            if (timers[resolvedKey] !== null && intervalMsByKey[resolvedKey] === intervalMs) return true;
            clear(resolvedKey);
            intervalMsByKey[resolvedKey] = intervalMs;
            timers[resolvedKey] = win.setInterval(() => { void run(resolvedKey); }, intervalMs);
            return true;
        };
        const snapshot = () => Object.freeze({
            disposed,
            intervalMsByKey: Object.freeze({ ...intervalMsByKey }),
            inFlightByKey: Object.freeze({ ...inFlightByKey }),
            activeKeys: Object.freeze(keys.filter((key) => timers[key] !== null))
        });
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            clear();
        };

        return Object.freeze({ clear, run, schedule, snapshot, dispose });
    };

    return Object.freeze({ createController });
}));
