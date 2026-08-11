// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeSharedControls = factory(root);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(window) {
    'use strict';
    const runtimeJquery = window.jQuery || window.$ || null;

    const createStableToggleController = (options = {}) => {
        const doc = options.document || window.document || null;
        const jquery = options.jquery || runtimeJquery;
        const shellId = String(options.shellId || '').trim();
        const inputId = String(options.inputId || '').trim();
        const menuButtonId = String(options.menuButtonId || '').trim();
        const menuId = String(options.menuId || '').trim();
        const optionAttribute = String(options.optionAttribute || 'data-fvplus-toggle-option').trim();
        const getState = typeof options.getState === 'function' ? options.getState : (() => ({}));
        const resolveMount = typeof options.resolveMount === 'function' ? options.resolveMount : (() => null);
        const buildMarkup = typeof options.buildMarkup === 'function' ? options.buildMarkup : (() => '');
        const getShellClass = typeof options.getShellClass === 'function'
            ? options.getShellClass
            : (() => '');
        const prepareMount = typeof options.prepareMount === 'function' ? options.prepareMount : (() => {});
        const initializePrimary = typeof options.initializePrimary === 'function'
            ? options.initializePrimary
            : (() => {});
        const onToggle = typeof options.onToggle === 'function' ? options.onToggle : (() => {});
        const onMenuToggle = typeof options.onMenuToggle === 'function' ? options.onMenuToggle : (() => {});
        const onOptionToggle = typeof options.onOptionToggle === 'function' ? options.onOptionToggle : (() => {});
        const onMount = typeof options.onMount === 'function' ? options.onMount : (() => {});
        const onError = typeof options.onError === 'function' ? options.onError : (() => {});
        const boundShells = new WeakSet();
        const boundPrimaryInputs = new WeakSet();
        let synchronizingPrimary = false;
        let mountCount = 0;
        let syncCount = 0;
        let switchInitializeCount = 0;

        if (!doc || !shellId || !inputId) {
            throw new Error('Stable toggle controller requires a document, shell id, and input id.');
        }

        const invoke = (callback, ...args) => {
            try {
                const result = callback(...args);
                if (result && typeof result.catch === 'function') {
                    result.catch(onError);
                }
            } catch (error) {
                onError(error);
            }
        };

        const normalizeState = (state = {}) => ({
            enabled: state?.enabled === true,
            pending: state?.pending === true,
            menuOpen: state?.menuOpen === true,
            options: state?.options && typeof state.options === 'object' ? state.options : {}
        });

        const placeShell = (shell, mount) => {
            if (mount?.anchor && mount.anchor.parentElement) {
                if (mount.anchor.nextElementSibling !== shell) {
                    mount.anchor.insertAdjacentElement('afterend', shell);
                }
                return;
            }
            if (mount?.host && mount.host.firstElementChild !== shell) {
                mount.host.insertBefore(shell, mount.host.firstChild);
            }
        };

        const bindShellEvents = (shell) => {
            if (boundShells.has(shell)) {
                return;
            }
            boundShells.add(shell);
            shell.addEventListener('change', (event) => {
                const target = event.target;
                if (!(target instanceof (doc.defaultView?.HTMLInputElement || window.HTMLInputElement))) {
                    return;
                }
                if (target.id === inputId) {
                    return;
                }
                const optionKey = String(target.getAttribute(optionAttribute) || '').trim();
                if (optionKey) {
                    invoke(onOptionToggle, optionKey, target.checked === true);
                }
            });
            shell.addEventListener('click', (event) => {
                const target = event.target;
                const button = target && typeof target.closest === 'function'
                    ? target.closest('button')
                    : null;
                if (!button || button.id !== menuButtonId || !shell.contains(button)) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                invoke(onMenuToggle);
            });
        };

        const bindPrimaryEvents = (input) => {
            if (!input || boundPrimaryInputs.has(input)) {
                return;
            }
            boundPrimaryInputs.add(input);
            const handleChange = () => {
                if (!synchronizingPrimary) {
                    invoke(onToggle, input.checked === true);
                }
            };
            const $input = typeof jquery === 'function' ? jquery(input) : null;
            if ($input && typeof $input.off === 'function' && typeof $input.on === 'function') {
                $input
                    .off('change.fvplusStableToggle')
                    .on('change.fvplusStableToggle', handleChange);
                return;
            }
            input.addEventListener('change', handleChange);
        };

        const initializeSwitch = (input, state) => {
            if (!input || input.dataset.fvplusStableSwitchInitialized === 'true') {
                return;
            }
            initializePrimary(input, state, jquery);
            input.dataset.fvplusStableSwitchInitialized = 'true';
            switchInitializeCount += 1;
        };

        const dispatchPrimaryStateChange = (input) => {
            const EventConstructor = doc.defaultView?.Event || window.Event;
            if (typeof EventConstructor !== 'function') {
                return;
            }
            synchronizingPrimary = true;
            try {
                input.dispatchEvent(new EventConstructor('change', { bubbles: true }));
            } finally {
                synchronizingPrimary = false;
            }
        };

        const synchronizePrimary = (shell, state) => {
            const input = doc.getElementById(inputId);
            if (!input || !shell.contains(input)) {
                return null;
            }
            initializeSwitch(input, state);
            bindPrimaryEvents(input);
            if (input.checked !== state.enabled) {
                input.checked = state.enabled;
                dispatchPrimaryStateChange(input);
            }
            input.disabled = state.pending;
            input.setAttribute('aria-busy', state.pending ? 'true' : 'false');
            shell.classList.toggle('is-save-pending', state.pending);
            const widget = shell.querySelector('.switch-button');
            const background = shell.querySelector('.switch-button-background');
            widget?.classList.toggle('is-disabled', state.pending);
            background?.setAttribute('aria-disabled', state.pending ? 'true' : 'false');
            background?.setAttribute(
                'aria-label',
                input.getAttribute('aria-label') || input.getAttribute('title') || 'Toggle setting'
            );
            return input;
        };

        const synchronizeMenu = (shell, state) => {
            const button = menuButtonId ? doc.getElementById(menuButtonId) : null;
            const menu = menuId ? doc.getElementById(menuId) : null;
            if (button && shell.contains(button)) {
                button.classList.toggle('is-open', state.menuOpen);
                button.setAttribute('aria-expanded', state.menuOpen ? 'true' : 'false');
            }
            if (menu && shell.contains(menu)) {
                menu.hidden = !state.menuOpen;
            }
        };

        const synchronizeOptions = (shell, state) => {
            shell.querySelectorAll(`input[${optionAttribute}]`).forEach((input) => {
                const key = String(input.getAttribute(optionAttribute) || '').trim();
                if (!key) {
                    return;
                }
                input.checked = state.options[key] !== false;
            });
        };

        const sync = () => {
            syncCount += 1;
            const mount = resolveMount();
            if (!mount?.host) {
                return Object.freeze({
                    mounted: false,
                    mountCount,
                    syncCount,
                    switchInitializeCount
                });
            }
            prepareMount(mount);
            const state = normalizeState(getState());
            let shell = doc.getElementById(shellId);
            if (!shell) {
                shell = doc.createElement('div');
                shell.id = shellId;
            }
            shell.className = String(getShellClass(mount, state) || '').trim();
            placeShell(shell, mount);

            let input = doc.getElementById(inputId);
            if (!input || !shell.contains(input)) {
                shell.innerHTML = String(buildMarkup(state) || '');
                mountCount += 1;
                input = doc.getElementById(inputId);
                if (!input || !shell.contains(input)) {
                    throw new Error(`Stable toggle markup did not create #${inputId}.`);
                }
                initializeSwitch(input, state);
                bindShellEvents(shell);
                onMount(shell, state);
            } else {
                bindShellEvents(shell);
            }

            synchronizePrimary(shell, state);
            synchronizeMenu(shell, state);
            synchronizeOptions(shell, state);
            return Object.freeze({
                mounted: true,
                shell,
                input,
                mountCount,
                syncCount,
                switchInitializeCount
            });
        };

        const getSnapshot = () => {
            const shell = doc.getElementById(shellId);
            const input = doc.getElementById(inputId);
            return Object.freeze({
                mounted: Boolean(shell && input && shell.contains(input)),
                enabled: input?.checked === true,
                pending: input?.disabled === true,
                mountCount,
                syncCount,
                switchInitializeCount
            });
        };

        return Object.freeze({
            sync,
            getSnapshot
        });
    };

    const layoutTokens = Object.freeze({
        folderRightGutterPx: 28,
        folderOuterReservedPx: 106,
        folderDropdownRightMarginPx: 16,
        contextQuickItemWidthPx: 34,
        contextQuickLinkWidthPx: 30,
        contextQuickLinkHeightPx: 26
    });

    const createSecureNavigationApi = (deps = {}) => {
        const win = deps.window || window;
        const doc = deps.document || win?.document || null;
        const hasUnresolvedWebuiTemplateTokens = typeof deps.hasUnresolvedWebuiTemplateTokens === 'function'
            ? deps.hasUnresolvedWebuiTemplateTokens
            : (() => false);
        const openRel = String(deps.openRel || 'noopener');
        const getSafeExternalUrl = (value) => {
            const raw = String(value || '').trim();
            if (!raw || raw.startsWith('//')) {
                return '';
            }
            if (raw.startsWith('/')) {
                return raw;
            }
            try {
                const parsed = new URL(raw);
                if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
                    return '';
                }
                return parsed.href;
            } catch (_error) {
                return '';
            }
        };
        const getSafeWebuiUrl = (value) => {
            const raw = String(value || '').trim();
            return !hasUnresolvedWebuiTemplateTokens(raw) ? getSafeExternalUrl(raw) : '';
        };
        const openWebuiInNewTab = (url) => {
            const safeUrl = getSafeWebuiUrl(url);
            if (!safeUrl || !doc?.body) {
                return false;
            }
            const anchor = doc.createElement('a');
            anchor.href = safeUrl;
            anchor.target = '_blank';
            anchor.rel = openRel;
            anchor.style.display = 'none';
            doc.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            return true;
        };
        const openWebuiPopupWindow = (url, targetName = '_blank') => {
            const safeUrl = getSafeWebuiUrl(url);
            if (!safeUrl || typeof win?.open !== 'function') {
                return false;
            }
            const safeTargetName = /^[_A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(String(targetName || ''))
                ? String(targetName)
                : '_blank';
            const popup = win.open(safeUrl, safeTargetName, openRel);
            if (!popup) {
                return false;
            }
            try {
                popup.opener = null;
            } catch (_error) {
                // Cross-origin popup guards can throw after the tab opens; noopener is still requested.
            }
            return true;
        };
        return Object.freeze({
            getSafeExternalUrl,
            getSafeWebuiUrl,
            openWebuiInNewTab,
            openWebuiPopupWindow
        });
    };


    return Object.freeze({
        createStableToggleController,
        createSecureNavigationApi,
        layoutTokens
    });
}));
