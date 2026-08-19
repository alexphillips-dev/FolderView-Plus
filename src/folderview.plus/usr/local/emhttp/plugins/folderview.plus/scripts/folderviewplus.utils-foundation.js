// @ts-check
(function utilityFoundationModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.utilityFoundation = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function utilityFoundationFactory() {
    'use strict';

    const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
    const cloneJson = (value) => JSON.parse(JSON.stringify(value));

    const bindEventOnce = (target, eventName, selectorOrHandler, maybeHandler) => {
        if (!target || typeof target.off !== 'function' || typeof target.on !== 'function') {
            return target;
        }
        const eventToken = String(eventName || '').trim();
        if (!eventToken) {
            return target;
        }
        const hasSelector = typeof selectorOrHandler === 'string';
        const selector = hasSelector ? selectorOrHandler : null;
        const handler = hasSelector ? maybeHandler : selectorOrHandler;
        if (typeof handler !== 'function') {
            return target;
        }
        if (selector !== null) {
            target.off(eventToken, selector).on(eventToken, selector, handler);
            return target;
        }
        target.off(eventToken).on(eventToken, handler);
        return target;
    };

    const createFrameScheduler = () => {
        const queued = new Map();
        let rafId = null;

        const flush = (timestamp = 0) => {
            rafId = null;
            const tasks = Array.from(queued.values());
            queued.clear();
            for (const task of tasks) {
                try {
                    task(timestamp);
                } catch (error) {
                    console.error('folderview.plus: frame scheduler task failed', error);
                }
            }
        };

        const ensureFlushScheduled = () => {
            if (rafId !== null) {
                return;
            }
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                rafId = window.requestAnimationFrame(flush);
                return;
            }
            rafId = setTimeout(() => flush(Date.now()), 16);
        };

        return {
            schedule: (key, callback) => {
                if (typeof callback !== 'function') {
                    return;
                }
                const safeKey = String(key || 'default');
                queued.set(safeKey, callback);
                ensureFlushScheduled();
            },
            cancel: (key) => {
                const safeKey = String(key || 'default');
                queued.delete(safeKey);
                if (queued.size === 0 && rafId !== null) {
                    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                        window.cancelAnimationFrame(rafId);
                    } else {
                        clearTimeout(rafId);
                    }
                    rafId = null;
                }
            },
            flushNow: () => flush(Date.now())
        };
    };

    const createIdleTaskQueue = (options = {}) => {
        const timeout = Math.max(50, Number(options.timeout) || 700);
        const fallbackDelay = Math.max(8, Number(options.fallbackDelay) || 24);
        const tasks = [];
        let scheduled = false;

        const run = (deadline = null) => {
            scheduled = false;
            while (tasks.length > 0) {
                if (deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() <= 1) {
                    break;
                }
                const task = tasks.shift();
                if (typeof task !== 'function') {
                    continue;
                }
                try {
                    task();
                } catch (error) {
                    console.error('folderview.plus: idle task failed', error);
                }
            }
            if (tasks.length > 0) {
                schedule();
            }
        };

        const schedule = () => {
            if (scheduled) {
                return;
            }
            scheduled = true;
            if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(run, { timeout });
                return;
            }
            setTimeout(() => run(null), fallbackDelay);
        };

        return {
            enqueue: (task) => {
                if (typeof task !== 'function') {
                    return;
                }
                tasks.push(task);
                schedule();
            },
            clear: () => {
                tasks.length = 0;
            },
            size: () => tasks.length
        };
    };

    const createBatchedStorageWriter = (storageRef = null, options = {}) => {
        const getStorage = () => {
            if (storageRef) {
                return storageRef;
            }
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage;
            }
            return null;
        };
        const defaultDelayMs = Math.max(0, Number(options.defaultDelayMs) || 80);
        const idleQueue = createIdleTaskQueue({
            timeout: Math.max(80, Number(options.idleTimeoutMs) || 900),
            fallbackDelay: Math.max(8, Number(options.idleFallbackDelayMs) || 32)
        });
        const pendingByKey = new Map();

        const commit = (key) => {
            const safeKey = String(key || '').trim();
            if (!safeKey || !pendingByKey.has(safeKey)) {
                return;
            }
            const entry = pendingByKey.get(safeKey);
            pendingByKey.delete(safeKey);
            const storage = getStorage();
            if (!storage) {
                return;
            }
            try {
                if (entry.remove === true) {
                    storage.removeItem(safeKey);
                } else {
                    storage.setItem(safeKey, String(entry.value));
                }
            } catch (_error) {
                // Best effort: never break runtime flow on quota/privacy failures.
            }
        };

        const queueCommit = (key, value, remove, settings = {}) => {
            const safeKey = String(key || '').trim();
            if (!safeKey) {
                return;
            }
            const delayMs = Math.max(0, Number(settings.delayMs ?? defaultDelayMs) || 0);
            const useIdle = settings.idle === true;
            const existing = pendingByKey.get(safeKey);
            if (existing && existing.timer) {
                clearTimeout(existing.timer);
            }
            const next = {
                value,
                remove: remove === true,
                timer: null
            };
            pendingByKey.set(safeKey, next);
            if (delayMs <= 0) {
                if (useIdle) {
                    idleQueue.enqueue(() => commit(safeKey));
                } else {
                    commit(safeKey);
                }
                return;
            }
            next.timer = setTimeout(() => {
                const current = pendingByKey.get(safeKey);
                if (current) {
                    current.timer = null;
                }
                if (useIdle) {
                    idleQueue.enqueue(() => commit(safeKey));
                    return;
                }
                commit(safeKey);
            }, delayMs);
        };

        return {
            setItem: (key, value, settings = {}) => queueCommit(key, value, false, settings),
            removeItem: (key, settings = {}) => queueCommit(key, '', true, settings),
            flush: (key = '') => {
                const safeKey = String(key || '').trim();
                if (safeKey) {
                    commit(safeKey);
                    return;
                }
                const keys = Array.from(pendingByKey.keys());
                for (const entryKey of keys) {
                    commit(entryKey);
                }
            }
        };
    };

    const normalizeHexColor = (value, fallback) => {
        if (typeof value !== 'string') {
            return fallback;
        }
        const trimmed = value.trim();
        const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
        if (!hexMatch.test(trimmed)) {
            return fallback;
        }
        if (trimmed.length === 4) {
            return (
                '#' +
                trimmed
                    .slice(1)
                    .split('')
                    .map((ch) => ch + ch)
                    .join('')
                    .toLowerCase()
            );
        }
        return trimmed.toLowerCase();
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    let generatedIdCounter = 0;
    const createSecureRuntimeId = (prefix = 'fvplus') => {
        const safePrefix = String(prefix || 'fvplus').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32) || 'fvplus';
        const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
        if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
            return `${safePrefix}-${cryptoApi.randomUUID()}`;
        }
        if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            cryptoApi.getRandomValues(bytes);
            const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
            return `${safePrefix}-${token}`;
        }
        generatedIdCounter = (generatedIdCounter + 1) % Number.MAX_SAFE_INTEGER;
        return `${safePrefix}-${Date.now().toString(36)}-${generatedIdCounter.toString(36)}`;
    };

    const sanitizeImageUrl = (value, fallback = '/plugins/dynamix.docker.manager/images/question.png') => {
        const raw = String(value || '').trim();
        if (!raw || globalThis.FolderViewPlusFoundationModules?.imageFallbacks?.has?.(raw)) return fallback;
        if (raw.startsWith('/') && !raw.startsWith('//')) {
            return raw;
        }
        if (/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon);base64,[a-z0-9+/=\s]+$/i.test(raw)) {
            return raw;
        }
        try {
            const parsed = new URL(raw);
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
                return fallback;
            }
            return parsed.href;
        } catch (_error) {
            return fallback;
        }
    };

    const sanitizeImageSrc = (value, fallback = '/plugins/dynamix.docker.manager/images/question.png') => (
        escapeHtml(sanitizeImageUrl(value, fallback))
    );

    const FOLDER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
    const RESERVED_FOLDER_IDS = new Set(['__proto__', 'prototype', 'constructor']);
    const normalizeFolderId = (value) => {
        const id = String(value || '').trim();
        if (!FOLDER_ID_PATTERN.test(id) || RESERVED_FOLDER_IDS.has(id.toLowerCase())) {
            return '';
        }
        return id;
    };

    return Object.freeze({
        bindEventOnce,
        cloneJson,
        createBatchedStorageWriter,
        createFrameScheduler,
        createIdleTaskQueue,
        createSecureRuntimeId,
        escapeHtml,
        isPlainObject,
        normalizeFolderId,
        normalizeHexColor,
        sanitizeImageSrc,
        sanitizeImageUrl
    });
}));
