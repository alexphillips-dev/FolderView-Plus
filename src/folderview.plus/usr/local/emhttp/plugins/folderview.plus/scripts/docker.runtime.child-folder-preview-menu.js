// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerChildFolderPreviewMenu = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const surfaceT = (key, fallback, ...params) => win?.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
        const jq = deps.$ || win?.jQuery || win?.$;
        const expandFolderPathToChild = typeof deps.expandFolderPathToChild === 'function'
            ? deps.expandFolderPathToChild
            : (() => {});
        const scrollFolderRowIntoView = typeof deps.scrollFolderRowIntoView === 'function'
            ? deps.scrollFolderRowIntoView
            : (() => {});
        const openFolderActions = typeof deps.openFolderActions === 'function' ? deps.openFolderActions : (() => {});
        const recordMenuOpen = typeof deps.recordMenuOpen === 'function' ? deps.recordMenuOpen : (() => {});
        const triggerId = 'fvplus-child-folder-menu-trigger';
        const menuSelector = 'ul.context-menu-list:visible, ul.contextMenuPlugin:visible, ul.context-menu:visible, ul.dropdown-menu:visible';
        let activeTrigger = null;
        let originalId = null;
        let activeMenu = null;
        let focusTimer = null;

        const resolveInputMethod = (event = null) => {
            const sourceEvent = event?.originalEvent || event || {};
            if (event?.type === 'keydown' || sourceEvent.type === 'keydown') return 'keyboard';
            if (String(sourceEvent.pointerType || '').toLowerCase() === 'touch'
                || Number(sourceEvent.touches?.length || 0) > 0
                || Number(sourceEvent.changedTouches?.length || 0) > 0) {
                return 'touch';
            }
            if (event?.type === 'contextmenu' || sourceEvent.type === 'contextmenu') return 'contextmenu';
            return event ? 'mouse' : 'unknown';
        };

        const resolveActivationPoint = (event = null, $item = null) => {
            const sourceEvent = event?.originalEvent || event || {};
            const touchPoint = sourceEvent.changedTouches?.[0] || sourceEvent.touches?.[0] || null;
            const clientX = Number(touchPoint?.clientX ?? sourceEvent.clientX);
            const clientY = Number(touchPoint?.clientY ?? sourceEvent.clientY);
            const keyboardEvent = event?.type === 'keydown' || sourceEvent.type === 'keydown';
            if (!keyboardEvent && Number.isFinite(clientX) && Number.isFinite(clientY) && (clientX !== 0 || clientY !== 0)) {
                return { clientX, clientY };
            }
            const itemNode = $item?.get?.(0) || null;
            const rect = typeof itemNode?.getBoundingClientRect === 'function'
                ? itemNode.getBoundingClientRect()
                : null;
            return {
                clientX: rect ? rect.left + Math.max(1, rect.width / 2) : 0,
                clientY: rect ? rect.top + Math.max(1, rect.height / 2) : 0
            };
        };

        const close = (restoreFocus = false) => {
            if (!jq) return;
            if (focusTimer !== null) win?.clearTimeout?.(focusTimer);
            focusTimer = null;
            activeMenu?.hide?.();
            activeMenu = null;
            if (activeTrigger?.id === triggerId) {
                if (originalId === null) activeTrigger.removeAttribute('id');
                else activeTrigger.id = originalId;
            }
            if (restoreFocus && activeTrigger?.isConnected) activeTrigger.focus();
            activeTrigger = null;
            const doc = win?.document || (typeof document !== 'undefined' ? document : null);
            if (doc) jq(doc).off('click.fvFolderPreviewContext keydown.fvFolderPreviewContext');
        };

        const show = (options = {}) => {
            const event = options.event || null;
            const inputMethod = resolveInputMethod(event);
            if (!jq) {
                recordMenuOpen({ success: false, inputMethod, reason: 'document-unavailable' });
                return false;
            }
            close();
            const doc = win?.document || (typeof document !== 'undefined' ? document : null);
            if (!doc?.body) {
                recordMenuOpen({ success: false, inputMethod, reason: 'document-unavailable' });
                return false;
            }
            const rootId = String(options.rootId || '').trim();
            const childId = String(options.childId || '').trim();
            const safeChildName = String(options.childName || 'Folder').trim() || 'Folder';
            activeTrigger = options.$item?.get?.(0) || null;
            if (!childId || !activeTrigger?.isConnected || typeof win?.MouseEvent !== 'function') {
                recordMenuOpen({ success: false, inputMethod, reason: 'document-unavailable' });
                return false;
            }
            const activationPoint = resolveActivationPoint(event, options.$item || null);
            originalId = activeTrigger.getAttribute('id');
            activeTrigger.id = triggerId;
            const success = openFolderActions(childId, {
                targetSelector: '#' + triggerId,
                navigationAction: {
                    text: surfaceT('legacy.surface.b9f679f5b3e47cc6', 'Expand to folder'),
                    icon: 'fa-level-down',
                    action: (clickEvent) => {
                        clickEvent.preventDefault();
                        close();
                        expandFolderPathToChild(rootId, childId);
                        scrollFolderRowIntoView(childId);
                    }
                }
            }) === true;
            if (!success) { close(); recordMenuOpen({ success: false, inputMethod, reason: 'document-unavailable' }); return false; }
            activeTrigger.dispatchEvent(Object.assign(new win.MouseEvent('click', {
                bubbles: true, cancelable: true, view: win, ...activationPoint
            }), { fvplusChildContextReplay: true }));
            activeMenu = jq(menuSelector).first();
            const opened = activeMenu.length > 0;
            recordMenuOpen({ success: opened, inputMethod, ...(opened ? {} : { reason: 'document-unavailable' }) });
            if (!opened) { close(); return false; }
            activeMenu.attr('aria-label', surfaceT('common.repair.folder-actions-for-1-133218', 'Folder actions for $1', safeChildName));
            focusTimer = win.setTimeout(() => {
                focusTimer = null;
                if (!activeTrigger?.isConnected) { close(); return; }
                jq(doc)
                    .on('click.fvFolderPreviewContext', () => close())
                    .on('keydown.fvFolderPreviewContext', (keyEvent) => {
                        if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); close(true); }
                    });
                if (inputMethod === 'keyboard') activeMenu.find('a:visible').first().trigger('focus');
            }, 0);
            return true;
        };

        return Object.freeze({ close, show });
    };

    return Object.freeze({ createApi });
}));
