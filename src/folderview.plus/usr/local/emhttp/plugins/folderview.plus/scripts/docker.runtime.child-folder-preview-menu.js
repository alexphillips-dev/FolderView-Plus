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
        const jq = deps.$ || win?.jQuery || win?.$;
        const expandFolderPathToChild = typeof deps.expandFolderPathToChild === 'function'
            ? deps.expandFolderPathToChild
            : (() => {});
        const scrollFolderRowIntoView = typeof deps.scrollFolderRowIntoView === 'function'
            ? deps.scrollFolderRowIntoView
            : (() => {});
        const editFolder = typeof deps.editFolder === 'function' ? deps.editFolder : (() => {});
        const openFolderActions = typeof deps.openFolderActions === 'function' ? deps.openFolderActions : (() => {});
        const recordMenuOpen = typeof deps.recordMenuOpen === 'function' ? deps.recordMenuOpen : (() => {});

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

        const close = () => {
            if (!jq) return;
            jq('.fv-folder-preview-context-menu').remove();
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
            const $menu = jq('<div class="fv-folder-preview-context-menu" role="menu"></div>');
            const addAction = (label, iconClass, onClick) => {
                const $button = jq('<button type="button" role="menuitem"></button>');
                $button.append(jq(`<i class="fa ${iconClass}" aria-hidden="true"></i>`));
                $button.append(jq('<span></span>').text(label));
                $button.on('click', (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    close();
                    onClick();
                });
                $menu.append($button);
            };
            addAction('Expand to folder', 'fa-level-down', () => {
                expandFolderPathToChild(rootId, childId);
                scrollFolderRowIntoView(childId);
            });
            addAction('Edit folder', 'fa-pencil', () => editFolder(childId));
            addAction('Open folder actions', 'fa-bars', () => {
                expandFolderPathToChild(rootId, childId);
                scrollFolderRowIntoView(childId);
                openFolderActions(childId);
            });
            $menu.attr('aria-label', `${safeChildName} folder actions`);
            jq(doc.body).append($menu);
            const viewportWidth = Number(win?.innerWidth || doc.documentElement?.clientWidth || 0);
            const viewportHeight = Number(win?.innerHeight || doc.documentElement?.clientHeight || 0);
            const menuNode = $menu.get(0);
            const menuWidth = Number(menuNode?.offsetWidth || 180);
            const menuHeight = Number(menuNode?.offsetHeight || 112);
            const activationPoint = resolveActivationPoint(event, options.$item || null);
            const left = Math.max(8, Math.min(activationPoint.clientX, viewportWidth ? viewportWidth - menuWidth - 8 : activationPoint.clientX));
            const top = Math.max(8, Math.min(activationPoint.clientY, viewportHeight ? viewportHeight - menuHeight - 8 : activationPoint.clientY));
            $menu.css({ left: `${left}px`, top: `${top}px` });
            recordMenuOpen({ success: true, inputMethod });
            setTimeout(() => {
                jq(doc)
                    .on('click.fvFolderPreviewContext', close)
                    .on('keydown.fvFolderPreviewContext', (keyEvent) => {
                        if (keyEvent.key === 'Escape') close();
                    });
                if (inputMethod === 'keyboard') $menu.find('button').first().trigger('focus');
            }, 0);
            return true;
        };

        return Object.freeze({ close, show });
    };

    return Object.freeze({ createApi });
}));
