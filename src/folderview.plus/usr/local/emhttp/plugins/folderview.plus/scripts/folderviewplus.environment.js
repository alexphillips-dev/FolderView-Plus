(function(root, factory) {
    if (typeof module === "object" && module.exports) { module.exports = factory(); return; }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.environment = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function() {
    const exportSnapshot = async ({ apiGetJson, setRecoveryEnvironmentSummary, downloadFile, buildEnvironmentSnapshotFileName, toPrettyJson, showToastMessage, showError, translate }) => {
        try {
            const response = await apiGetJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                data: { action: 'export' }
            });
            const snapshot = response?.snapshot;
            if (snapshot?.kind !== 'environment_snapshot' || snapshot.schemaVersion !== 1
                || !snapshot.types?.docker?.folders || !snapshot.types?.docker?.prefs
                || !snapshot.types?.vm?.folders || !snapshot.types?.vm?.prefs || !snapshot.themeWorkspace
                || !response.summary?.exportedAt || !response.summary?.pluginVersion) {
                throw new Error(translate('settings.environment.invalid-export', 'The server returned an incomplete environment snapshot. No download was created.'));
            }
            const summary = setRecoveryEnvironmentSummary(response.summary, 'export');
            downloadFile(buildEnvironmentSnapshotFileName(summary), toPrettyJson(snapshot));
            showToastMessage({
                title: translate("legacy.surface.eae1fdd133376e8b", 'Environment exported'),
                message: translate('settings.environment.download-started', 'Environment download started. Check your browser downloads for the saved file.'),
                level: 'success',
                durationMs: 3600
            });
            return summary;
        } catch (error) {
            showError(translate("common.repair.environment-export-failed-d84f08", "Environment export failed"), error);
            throw error;
        }
    };
    const sortModeLabel = (mode, translate) => ({
        created: translate('legacy.surface.c4e26b4afea2668e', 'Created order'),
        created_newest: translate('legacy.surface.daaf6edca8ef1238', 'Created newest first'),
        created_oldest: translate('legacy.surface.ec1e2dc8cbaccadb', 'Created oldest first'),
        updated_newest: translate('legacy.surface.23f60fbe0d3b927a', 'Last updated newest first'),
        manual: translate('legacy.surface.363493371020cd48', 'Manual order'),
        alpha: translate('legacy.surface.c0079cc49f26de66', 'Name (A-Z)'),
        name_desc: translate('legacy.surface.96338842c4d3a262', 'Name (Z-A)')
    })[mode || 'created'] || String(mode);
    return Object.freeze({ exportSnapshot, sortModeLabel });
}));
