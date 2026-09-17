(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.folderDefaults = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const configure = ({ $, document, form, setValidationBannerState, translate }) => {
        setValidationBannerState(translate('legacy.surface.49d13b9d958f69d0', 'Folder defaults'),
            translate('legacy.surface.f8ab1d646671076f', 'New folders inherit this saved profile when the folder editor opens in create mode.'), 'info');
        document.body.classList.add('fv-editing-defaults');
        $('.fv-section-nav > button[data-target="general"]').trigger('click');
        $(form.name).removeAttr('required');
        $(form.parent_folder_id).prop('disabled', true);
        $('.folder-btn-copy, .folder-btn-apply-settings').hide();
        $('.folder-btn-submit').removeAttr('data-i18n').val(translate('legacy.surface.58759082a3f0eb72', 'Save as defaults'));
    };
    const save = async ({ folder, type, prefs, transfer, post }) => {
        const profile = transfer.normalizeFolderSettingsPayload(folder).payload;
        return post('/plugins/folderview.plus/server/prefs.php', {
            type,
            prefs: JSON.stringify({ folderDefaults: { sourceId: '', sourceName: '', profile } }),
            expectedRevision: prefs?._metadata?.prefsRevision ?? 0
        });
    };
    const readProfile = (prefs) => {
        const defaults = prefs?.folderDefaults || {};
        const profile = defaults.profile || {};
        const icon = String(profile.icon || '').trim();
        const settings = profile.settings && typeof profile.settings === 'object' ? JSON.parse(JSON.stringify(profile.settings)) : {};
        const actions = Array.isArray(profile.actions) ? JSON.parse(JSON.stringify(profile.actions)) : [];
        if (!icon && !Object.keys(settings).length && !actions.length) return null;
        return {
            sourceId: String(defaults.sourceId || '').trim(),
            sourceName: String(defaults.sourceName || '').trim(),
            folder: { name: '', parentId: '', icon, regex: '', containers: [], settings, actions }
        };
    };
    return Object.freeze({ configure, save, readProfile });
}));
