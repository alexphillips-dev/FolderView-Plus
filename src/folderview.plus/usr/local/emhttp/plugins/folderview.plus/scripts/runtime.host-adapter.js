// @ts-check
(function runtimeHostAdapterModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusRuntimeHostAdapters = factory(fallbackWindow);
    root.FolderViewPlusRuntimeHostAdaptersModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function runtimeHostAdapterFactory(fallbackWindow) {
    'use strict';

    const WRAPPER_MARK = '__fvplusHostAdapterHook';
    const registry = new WeakMap();

    const freezeContract = (contract) => Object.freeze({
        ...contract,
        requiredSelectors: Object.freeze(contract.requiredSelectors.map((entry) => Object.freeze({ ...entry }))),
        bodySelectors: Object.freeze([...contract.bodySelectors]),
        itemNameSelectors: Object.freeze([...contract.itemNameSelectors]),
        allowedHooks: Object.freeze([...contract.allowedHooks])
    });

    const CONTRACTS = Object.freeze({
        docker: freezeContract({
            type: 'docker',
            label: 'Docker',
            tableSelector: 'table#docker_containers',
            headerSelector: '#docker_containers > thead > tr',
            bodySelectors: ['tbody#docker_list', 'tbody#docker_view'],
            requiredSelectors: [
                { label: 'Docker table shell', selector: 'table#docker_containers' },
                { label: 'Docker table body', selector: 'tbody#docker_list' },
                { label: 'Docker header row', selector: '#docker_containers > thead > tr' }
            ],
            folderRowSelector: 'tr.folder',
            itemRowSelector: 'tr.sortable:not(.folder)',
            detailRowSelector: 'tr.sub, tr[data-fv-native-detail-row="1"]',
            itemNameSelectors: ['[data-name]', '.ct-name [data-name]', '.ct-name .appname', '.ct-name'],
            allowedHooks: ['loadlist', 'listview', 'openDocker', 'eventControl', 'addDockerContainerContext']
        }),
        vm: freezeContract({
            type: 'vm',
            label: 'VM',
            tableSelector: 'table#kvm_table',
            headerSelector: '#kvm_table > thead > tr',
            bodySelectors: ['tbody#kvm_list', 'tbody#kvm_view'],
            requiredSelectors: [
                { label: 'VM table shell', selector: 'table#kvm_table' },
                { label: 'VM table body', selector: 'tbody#kvm_list' },
                { label: 'VM header row', selector: '#kvm_table > thead > tr' }
            ],
            folderRowSelector: 'tr.folder',
            itemRowSelector: 'tr.sortable:not(.folder)',
            detailRowSelector: 'tr[data-fv-native-detail-row="1"], tr[id^="vm-details-"]',
            itemNameSelectors: ['[data-name]', '.vm-name [data-name]', '.vm-name .appname', '.vm-name'],
            allowedHooks: [
                'loadlist',
                'addVMContext',
                'ajaxVMDispatch',
                'ajaxVMDispatchconsole',
                'ajaxVMDispatchconsoleRV'
            ]
        })
    });

    const normalizeType = (value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker';
    const isoNow = () => new Date().toISOString();

    const createHostAdapter = (type, deps = {}) => {
        const resolvedType = normalizeType(type);
        const contract = CONTRACTS[resolvedType];
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const MutationObserverCtor = deps.MutationObserver || win.MutationObserver || null;
        const queue = typeof deps.queueMicrotask === 'function'
            ? deps.queueMicrotask
            : (typeof win.queueMicrotask === 'function' ? win.queueMicrotask.bind(win) : (callback) => Promise.resolve().then(callback));
        const adapterId = `fvplus-${resolvedType}-host`;
        const hooks = Object.create(null);
        const rowObservers = new Set();

        const assertHookAllowed = (name) => {
            const safeName = String(name || '').trim();
            if (!contract.allowedHooks.includes(safeName)) {
                throw new Error(`${contract.label} host adapter does not allow the ${safeName || '(empty)'} hook.`);
            }
            return safeName;
        };

        const getBodies = () => {
            if (!doc || typeof doc.querySelector !== 'function') return [];
            const seen = new Set();
            return contract.bodySelectors
                .map((selector) => doc.querySelector(selector))
                .filter((node) => {
                    if (!node || seen.has(node)) return false;
                    seen.add(node);
                    return true;
                });
        };
        const getPrimaryBody = () => getBodies()[0] || null;
        const getTable = () => doc?.querySelector?.(contract.tableSelector) || getPrimaryBody()?.closest?.('table') || null;
        const getHeaderRow = () => doc?.querySelector?.(contract.headerSelector) || getTable()?.querySelector?.('thead > tr') || null;
        const queryRows = (kind = 'all', options = {}) => {
            const selector = kind === 'folder'
                ? contract.folderRowSelector
                : (kind === 'item' ? contract.itemRowSelector : (kind === 'detail' ? contract.detailRowSelector : ':scope > tr'));
            const bodies = options.allBodies === true
                ? getBodies()
                : [getPrimaryBody()].filter(Boolean);
            return bodies.flatMap((body) => Array.from(body.querySelectorAll?.(selector) || []));
        };
        const classifyRow = (row) => {
            if (!row || typeof row.matches !== 'function') return 'other';
            if (row.matches(contract.folderRowSelector)) return 'folder';
            if (row.matches(contract.detailRowSelector)) return 'detail';
            if (row.matches(contract.itemRowSelector)) return 'item';
            return 'other';
        };
        const getRowIdentity = (row) => {
            if (!row) return '';
            const direct = String(row.dataset?.name || row.dataset?.id || row.getAttribute?.('data-name') || '').trim();
            if (direct) return direct;
            for (const selector of contract.itemNameSelectors) {
                const node = row.querySelector?.(selector);
                const value = String(node?.dataset?.name || node?.getAttribute?.('data-name') || node?.textContent || '').trim();
                if (value) return value;
            }
            return String(row.id || '').trim();
        };

        const collectStructureIssues = () => contract.requiredSelectors.flatMap((entry) => (
            doc?.querySelector?.(entry.selector) ? [] : [`${entry.label}: ${entry.selector}`]
        ));
        const ensureStructure = (options = {}) => {
            const missing = collectStructureIssues();
            if (missing.length === 0) {
                options.onValid?.({ type: resolvedType, contract });
                return { ok: true, missing: [] };
            }
            const error = new Error(`Expected ${contract.label} host page selectors were not found: ${missing.join(', ')}`);
            error.fvplusPhase = 'host-dom';
            error.fvplusCategory = 'host-page-structure';
            options.onInvalid?.(error, missing);
            if (options.throwOnError !== false) throw error;
            return { ok: false, missing, error };
        };

        const ensureHookState = (name) => {
            const safeName = assertHookAllowed(name);
            if (!hooks[safeName]) {
                hooks[safeName] = {
                    name: safeName,
                    available: false,
                    wrapped: false,
                    callCount: 0,
                    installedAt: null,
                    lastInvokedAt: null,
                    original: null,
                    wrapper: null,
                    legacyAlias: '',
                    handler: null
                };
            }
            return hooks[safeName];
        };

        const captureHook = (name, options = {}) => {
            const state = ensureHookState(name);
            const current = win?.[state.name];
            const metadata = current?.[WRAPPER_MARK];
            const original = metadata?.adapterId === adapterId ? metadata.original : current;
            state.original = typeof original === 'function' ? original : null;
            state.available = typeof state.original === 'function';
            state.legacyAlias = String(options.legacyAlias || `${state.name}_original`).trim();
            if (state.legacyAlias && win) win[state.legacyAlias] = state.original;
            if (state.available) options.onCapture?.(state.original, state.name);
            else options.onMissing?.(state.name);
            return state.original;
        };

        const wrapHook = (name, handler, options = {}) => {
            if (typeof handler !== 'function') throw new TypeError('Host hook handler must be a function.');
            const state = ensureHookState(name);
            const current = win?.[state.name];
            const existingMetadata = current?.[WRAPPER_MARK];
            if (existingMetadata?.adapterId === adapterId) {
                state.handler = handler;
                state.wrapper = current;
                state.wrapped = true;
                return current;
            }
            const original = captureHook(state.name, options);
            state.handler = handler;
            const wrapper = function folderViewPlusHostHookWrapper(...args) {
                state.callCount += 1;
                state.lastInvokedAt = isoNow();
                options.onInvoke?.(state.name, args);
                const invokeOriginal = (...overrideArgs) => {
                    if (typeof state.original !== 'function') return undefined;
                    return state.original.apply(this, overrideArgs.length > 0 ? overrideArgs : args);
                };
                return state.handler({
                    adapter: api,
                    args,
                    invokeOriginal,
                    original: state.original,
                    thisArg: this
                });
            };
            Object.defineProperty(wrapper, WRAPPER_MARK, {
                configurable: false,
                enumerable: false,
                writable: false,
                value: Object.freeze({ adapterId, type: resolvedType, name: state.name, original })
            });
            state.wrapper = wrapper;
            state.wrapped = true;
            state.installedAt = isoNow();
            if (win) win[state.name] = wrapper;
            options.onWrapped?.(state.name, wrapper);
            return wrapper;
        };

        const restoreHook = (name) => {
            const state = ensureHookState(name);
            if (state.wrapper && win?.[state.name] === state.wrapper) win[state.name] = state.original;
            state.wrapper = null;
            state.handler = null;
            state.wrapped = false;
            return state.original;
        };

        const observeRows = (callback, options = {}) => {
            if (typeof callback !== 'function') throw new TypeError('Row observer callback must be a function.');
            const body = getPrimaryBody();
            if (!body || typeof MutationObserverCtor !== 'function') return () => {};
            let observerQueued = false;
            let observerRecords = [];
            const flush = () => {
                observerQueued = false;
                const records = observerRecords;
                observerRecords = [];
                callback({ adapter: api, body, records, rows: queryRows('all') });
            };
            const observer = new MutationObserverCtor((records) => {
                observerRecords.push(...records);
                if (observerQueued) return;
                observerQueued = true;
                queue(flush);
            });
            observer.observe(body, {
                childList: true,
                subtree: options.subtree !== false,
                attributes: options.attributes === true
            });
            const disconnect = () => {
                observer.disconnect?.();
                observerQueued = false;
                observerRecords = [];
                rowObservers.delete(disconnect);
            };
            rowObservers.add(disconnect);
            return disconnect;
        };

        const disconnectObservers = () => {
            Array.from(rowObservers).forEach((disconnect) => disconnect());
        };

        const dispose = (options = {}) => {
            disconnectObservers();
            if (options.restoreHooks === true) contract.allowedHooks.forEach((name) => restoreHook(name));
        };

        const getSnapshot = () => ({
            schemaVersion: 1,
            type: resolvedType,
            adapterId,
            structure: {
                valid: collectStructureIssues().length === 0,
                missing: collectStructureIssues(),
                bodyCount: getBodies().length,
                rowCounts: {
                    all: queryRows('all').length,
                    folders: queryRows('folder').length,
                    items: queryRows('item').length,
                    details: queryRows('detail').length
                },
                observerCount: rowObservers.size
            },
            hooks: Object.fromEntries(Object.entries(hooks).map(([name, state]) => [name, {
                available: state.available,
                wrapped: state.wrapped,
                callCount: state.callCount,
                installedAt: state.installedAt,
                lastInvokedAt: state.lastInvokedAt,
                legacyAlias: state.legacyAlias
            }]))
        });

        const api = Object.freeze({
            type: resolvedType,
            adapterId,
            contract,
            getBodies,
            getPrimaryBody,
            getTable,
            getHeaderRow,
            queryRows,
            classifyRow,
            getRowIdentity,
            collectStructureIssues,
            ensureStructure,
            captureHook,
            wrapHook,
            restoreHook,
            observeRows,
            disconnectObservers,
            dispose,
            getSnapshot
        });
        return api;
    };

    const getOrCreate = (type, deps = {}) => {
        const resolvedType = normalizeType(type);
        const win = deps.window || fallbackWindow;
        let byType = registry.get(win);
        if (!byType) {
            byType = new Map();
            registry.set(win, byType);
        }
        if (!byType.has(resolvedType)) byType.set(resolvedType, createHostAdapter(resolvedType, deps));
        return byType.get(resolvedType);
    };

    const release = (type, options = {}) => {
        const resolvedType = normalizeType(type);
        const win = options.window || fallbackWindow;
        const byType = registry.get(win);
        const adapter = byType?.get(resolvedType);
        if (!adapter) return false;
        adapter.dispose({ restoreHooks: options.restoreHooks === true });
        byType.delete(resolvedType);
        if (byType.size === 0) registry.delete(win);
        return true;
    };

    return Object.freeze({
        WRAPPER_MARK,
        CONTRACTS,
        normalizeType,
        createHostAdapter,
        getOrCreate,
        release
    });
}));
