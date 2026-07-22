(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusMobileReorder = factory();
    root.FolderViewPlusMobileReorderModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
        const doc = deps.document || (typeof document !== 'undefined' ? document : null);
        const normalizeManagedType = typeof deps.normalizeManagedType === 'function'
            ? deps.normalizeManagedType
            : ((value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
        const readMode = typeof deps.readMode === 'function' ? deps.readMode : (() => false);
        const writeMode = typeof deps.writeMode === 'function' ? deps.writeMode : (() => {});
        const persist = typeof deps.persist === 'function' ? deps.persist : (() => {});
        const render = typeof deps.render === 'function' ? deps.render : (() => {});

        const apply = (type) => {
            const resolvedType = normalizeManagedType(type);
            const enabled = readMode(resolvedType) === true;
            const className = `fv-mobile-tree-reorder-${resolvedType}`;
            const rootElement = doc?.getElementById?.('fv-settings-root') || null;
            rootElement?.classList.toggle(className, enabled);
            doc?.body?.classList.toggle(className, enabled);
            const button = doc?.getElementById?.(`${resolvedType}-tree-reorder-toggle`) || null;
            button?.classList.toggle('is-active', enabled);
            button?.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            return enabled;
        };

        const refresh = () => {
            apply('docker');
            apply('vm');
        };

        const set = (type, enabled) => {
            const resolvedType = normalizeManagedType(type);
            const nextEnabled = enabled === true;
            writeMode(resolvedType, nextEnabled);
            persist();
            apply(resolvedType);
            render(resolvedType);
            return nextEnabled;
        };

        const toggle = (type) => {
            const resolvedType = normalizeManagedType(type);
            return set(resolvedType, !(readMode(resolvedType) === true));
        };

        return Object.freeze({
            apply,
            refresh,
            set,
            toggle
        });
    };

    return Object.freeze({
        createApi
    });
}));
