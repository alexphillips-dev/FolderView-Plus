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
        const rowIdentity = (row) => String(row?.Id || row?.id || row?.shortId || row?.info?.Id || '').trim();
        const rowAutostart = (row) => [true, 1, '1', 'true', 'yes', 'on'].includes(row?.autostart ?? row?.autoStart ?? row?.info?.State?.Autostart ?? row?.State?.Autostart);
        const buildAutostartMutationEntries = (infoByName, plan, targetName, enabled) => {
            const waits = plan?.containerWaits && typeof plan.containerWaits === 'object' ? plan.containerWaits : {};
            return Object.entries(infoByName || {}).map(([name, row]) => ({
                id: rowIdentity(row),
                autoStart: String(name) === String(targetName) ? enabled === true : rowAutostart(row),
                ...(Object.prototype.hasOwnProperty.call(waits, name) ? { wait: Number(waits[name]) || 0 } : {})
            })).filter((entry) => entry.id);
        };

        const updateWait = async (containerName, value) => {
            const plan = deps.getPlan();
            const containerWaits = { ...(plan.containerWaits || {}) };
            containerWaits[decodeURIComponent(String(containerName || ''))] = Math.max(0, Math.min(3600, Math.round(Number(value) || 0)));
            try {
                await deps.savePlan({ containerWaits }, { preservePreview: true, refreshPreview: true });
            } catch (error) {
                deps.showError('Docker container wait save failed', error);
            }
        };

        const toggleAutostart = async (containerName, enabled) => {
            const name = decodeURIComponent(String(containerName || '')).trim();
            const info = deps.getInfo();
            const row = info?.[name];
            const entries = buildAutostartMutationEntries(info, deps.getPlan(), name, enabled === true);
            if (!row || !entries.length) {
                deps.showError('Docker autostart update failed', new Error('Container identity data is unavailable. Refresh Settings and try again.'));
                return;
            }
            try {
                await deps.runDockerMutation({ operation: 'updateAutostartConfiguration', entries, persistUserPreferences: true });
                row.autostart = enabled === true;
                if (row?.info?.State) row.info.State.Autostart = enabled === true;
                if (row?.State) row.State.Autostart = enabled === true;
                await deps.refreshPreview({ flush: false });
                deps.setStatus(`Docker autostart ${enabled === true ? 'enabled' : 'disabled'} for ${name}.`);
            } catch (error) {
                deps.showError('Docker autostart update failed', error);
            }
        };

        return Object.freeze({ buildAutostartMutationEntries, rowAutostart, updateWait, toggleAutostart });
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
