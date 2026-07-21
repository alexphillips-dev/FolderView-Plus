// @ts-check
(function dashboardRuntimeSurfaceModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDashboardRuntimeSurface = factory(fallbackWindow);
    root.FolderViewPlusDashboardRuntimeSurfaceModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dashboardRuntimeSurfaceFactory(fallbackWindow) {
    'use strict';

    const RUNTIME_STATE_CLASSES = 'started paused stopped running shutoff pmsuspended unknown green-text orange-text red-text';
    const RUNTIME_ICON_CLASSES = `fa-play fa-pause fa-square fa-refresh fa-spin fa-spinner fa-circle-o-notch ${RUNTIME_STATE_CLASSES}`;
    const TRANSIENT_ICON_SELECTOR = '.fa-refresh, .fa-spin, .fa-spinner, .fa-circle-o-notch';
    const HOST_ICON_CLASSES_ATTRIBUTE = 'data-fv-host-icon-classes';
    const LIFECYCLE_DIAGNOSTICS_STORAGE_KEY = 'fv.support.bundle.dashboard.lifecycle.v1';

    const getRuntimeStateMeta = (type, entry = {}) => {
        if (type === 'vm') {
            const state = String(entry?.state || 'unknown').trim().toLowerCase();
            if (state === 'running') return { state, key: 'started', icon: 'fa-play', className: 'started', colorClass: 'green-text', active: true, paused: false };
            if (state === 'paused' || state === 'pmsuspended' || state === 'unknown') return { state, key: 'paused', icon: 'fa-pause', className: 'paused', colorClass: 'orange-text', active: true, paused: true };
            return { state, key: 'stopped', icon: 'fa-square', className: 'stopped', colorClass: 'red-text', active: false, paused: false };
        }
        const stateNode = entry?.info?.State || {};
        const running = entry?.running === true || stateNode.Running === true;
        const paused = running && (entry?.paused === true || stateNode.Paused === true);
        if (paused) return { state: 'paused', key: 'paused', icon: 'fa-pause', className: 'paused', colorClass: 'orange-text', active: true, paused: true };
        if (running) return { state: 'running', key: 'started', icon: 'fa-play', className: 'started', colorClass: 'green-text', active: true, paused: false };
        return { state: 'stopped', key: 'stopped', icon: 'fa-square', className: 'stopped', colorClass: 'red-text', active: false, paused: false };
    };

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const jquery = deps.$ || win.jQuery || win.$ || null;
        const translate = typeof deps.translate === 'function'
            ? deps.translate
            : (key) => jquery?.i18n?.(key) || key;
        if (!doc || !jquery) throw new Error('FolderViewPlusDashboardRuntimeSurface requires document + jQuery.');

        const clearIconInlineState = ($icons) => {
            $icons.each((_, node) => {
                if (!node?.style) return;
                ['color', 'animation', 'animation-name', 'transform', 'opacity'].forEach((property) => node.style.removeProperty(property));
                if (!String(node.getAttribute?.('style') || '').trim()) node.removeAttribute?.('style');
            });
        };

        const getSurface = (containerId) => {
            const safeContainerId = String(containerId || '').trim();
            const control = safeContainerId ? doc.getElementById(safeContainerId) : null;
            return control ? jquery(control).parent('span.outer').first() : jquery();
        };

        const captureSurface = (request = {}) => {
            const $surface = getSurface(request?.container);
            if (!$surface.length) return false;
            $surface.find('i').each((_, node) => {
                if (!node.hasAttribute(HOST_ICON_CLASSES_ATTRIBUTE)) {
                    node.setAttribute(HOST_ICON_CLASSES_ATTRIBUTE, String(node.getAttribute('class') || ''));
                }
            });
            return true;
        };

        const restoreSurfaceIcons = ($surface) => {
            if (!$surface || !$surface.length) return false;
            const $capturedIcons = $surface.find(`i[${HOST_ICON_CLASSES_ATTRIBUTE}]`);
            $capturedIcons.each((_, node) => {
                node.setAttribute('class', String(node.getAttribute(HOST_ICON_CLASSES_ATTRIBUTE) || ''));
                node.removeAttribute(HOST_ICON_CLASSES_ATTRIBUTE);
                node.removeAttribute('aria-busy');
            });
            clearIconInlineState($capturedIcons);
            $surface.find(TRANSIENT_ICON_SELECTOR).each((_, node) => {
                const $node = jquery(node);
                const wasSpinning = $node.hasClass('fa-spin') || $node.hasClass('fa-spinner') || $node.hasClass('fa-circle-o-notch');
                $node.removeClass('fa-spin fa-spinner fa-circle-o-notch');
                if (wasSpinning) $node.removeClass('fa-refresh');
                node.removeAttribute('aria-busy');
            });
            return true;
        };

        const syncSurface = (type, $surface, entry = {}) => {
            if (!$surface || !$surface.length) return false;
            restoreSurfaceIcons($surface);
            const meta = getRuntimeStateMeta(type, entry);
            const $inner = $surface.find('span.inner').first();
            const $state = $inner.find('span.state').first();
            const $statusIcons = $state.length ? $state.prevAll('i.fa') : $inner.find('i.fa').first();
            const $identifiedIcon = $statusIcons.filter('i[id^="load-"]').first();
            const $icon = $identifiedIcon.length ? $identifiedIcon : $statusIcons.first();
            $surface.add($surface.find('span.hand, span.inner')).removeClass(RUNTIME_STATE_CLASSES).addClass(meta.className);
            $surface.attr('data-fv-runtime-state', meta.state);
            if ($icon.length) {
                $icon
                    .removeClass(RUNTIME_ICON_CLASSES)
                    .addClass(`fa ${meta.icon} ${meta.className} ${meta.colorClass}`)
                    .removeAttr('aria-busy');
                clearIconInlineState($icon);
            }
            if ($state.length) {
                $state
                    .text(` ${translate(meta.key)}`)
                    .removeClass(RUNTIME_STATE_CLASSES)
                    .addClass(meta.className)
                    .removeAttr('aria-busy');
                clearIconInlineState($state);
            }
            const autostart = type === 'vm' ? entry?.autostart === true : entry?.info?.State?.Autostart === true;
            $surface.toggleClass('autostart', autostart);
            return true;
        };

        const collectDiagnostics = (containerId = '') => {
            const safeContainerId = String(containerId || '').trim();
            const control = safeContainerId ? doc.getElementById(safeContainerId) : null;
            const $surface = control ? jquery(control).parent('span.outer').first() : jquery();
            const $icons = $surface.find('i');
            const $statusIcon = $surface.find('span.inner i[id^="load-"]').first();
            return {
                containerId: safeContainerId || null,
                controlFound: !!control,
                surfaceFound: $surface.length > 0,
                runtimeState: String($surface.attr('data-fv-runtime-state') || '').trim() || null,
                iconCount: $icons.length,
                capturedIconCount: $icons.filter(`[${HOST_ICON_CLASSES_ATTRIBUTE}]`).length,
                busyIconCount: $icons.filter(TRANSIENT_ICON_SELECTOR).length,
                statusIconClasses: String($statusIcon.attr('class') || '').trim() || null,
                iconClassSets: $icons.map((_, node) => String(node.getAttribute('class') || '').trim()).get().slice(0, 12)
            };
        };

        const persistDiagnostics = (record = {}) => {
            try {
                win.localStorage?.setItem(LIFECYCLE_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(record));
                return true;
            } catch (_error) {
                return false;
            }
        };

        return Object.freeze({
            getRuntimeStateMeta,
            getSurface,
            captureSurface,
            restoreSurfaceIcons,
            syncSurface,
            collectDiagnostics,
            persistDiagnostics
        });
    };

    return Object.freeze({
        RUNTIME_STATE_CLASSES,
        RUNTIME_ICON_CLASSES,
        TRANSIENT_ICON_SELECTOR,
        HOST_ICON_CLASSES_ATTRIBUTE,
        LIFECYCLE_DIAGNOSTICS_STORAGE_KEY,
        getRuntimeStateMeta,
        createApi
    });
}));
