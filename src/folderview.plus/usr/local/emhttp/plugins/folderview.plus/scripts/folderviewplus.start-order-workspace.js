// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.startOrderWorkspace = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    const createApi = (deps = {}) => {
        const rowAutostart = (row) => [true, 1, '1', 'true', 'yes', 'on'].includes(row?.autostart ?? row?.autoStart ?? row?.info?.State?.Autostart ?? row?.State?.Autostart);
        const setRowAutostart = (row, enabled) => {
            if (!row) return;
            row.autostart = enabled;
            if (row.info?.State) row.info.State.Autostart = enabled;
            if (row.State) row.State.Autostart = enabled;
        };

        const updateWait = async (containerName, value) => {
            const plan = deps.getPlan();
            if (plan.mode === 'unmanaged') return;
            const name = decodeURIComponent(String(containerName || '')).trim();
            if (!name) return;
            const wait = Math.max(0, Math.min(3600, Math.round(Number(value) || 0)));
            try {
                await deps.savePlan({ containerWaits: { [name]: wait } }, { preservePreview: true, refreshPreview: true });
            } catch (error) {
                deps.showError('Docker container wait save failed', error);
            }
        };

        const toggleAutostart = async (containerName, enabled) => {
            const plan = deps.getPlan();
            if (plan.mode === 'unmanaged') return;
            const name = decodeURIComponent(String(containerName || '')).trim();
            const info = deps.getInfo();
            const row = info?.[name];
            if (!row || !Object.prototype.hasOwnProperty.call(info, name)) {
                deps.showError('Docker autostart update failed', new Error('Container identity data is unavailable. Refresh Settings and try again.'));
                return;
            }
            try {
                await deps.writeAutostart(name, enabled === true);
                setRowAutostart(row, enabled === true);
                await deps.refreshPreview({ flush: false });
                deps.setStatus(`Docker autostart ${enabled === true ? 'enabled' : 'disabled'} for ${name}.`);
            } catch (error) {
                deps.showError('Docker autostart update failed', error);
                await deps.refreshPreview({ flush: false });
            }
        };

        return Object.freeze({ rowAutostart, setRowAutostart, updateWait, toggleAutostart });
    };

    const createPreviewActivation = (refresh) => {
        let active = false;
        let hydrated = false;
        const setActive = (nextActive) => {
            const next = nextActive === true;
            if (next && !active) hydrated = false;
            active = next;
        };
        const hydrate = () => {
            if (!active || hydrated) return false;
            hydrated = true;
            if (typeof refresh === 'function') void refresh();
            return true;
        };
        return Object.freeze({ hydrate, setActive });
    };

    return Object.freeze({ createApi, createPreviewActivation });
}));
