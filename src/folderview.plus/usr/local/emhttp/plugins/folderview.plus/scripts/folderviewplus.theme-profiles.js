// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.themeProfiles = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';
    const SCOPES = Object.freeze(['global', 'docker', 'vm', 'dashboard']);
    const emptyLayer = () => ({ variables: {}, customCss: '' });
    const defaultProfile = (id = 'default', name = 'Default profile') => ({
        id,
        name,
        layers: Object.fromEntries(SCOPES.map((scope) => [scope, emptyLayer()]))
    });
    const normalizeLayer = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        return {
            variables: source.variables && typeof source.variables === 'object' && !Array.isArray(source.variables) ? { ...source.variables } : {},
            customCss: String(source.customCss || '')
        };
    };
    const normalizeProfile = (value, index = 0) => {
        const source = value && typeof value === 'object' ? value : {};
        const id = String(source.id || '').trim().slice(0, 64) || `profile-${index + 1}`;
        const name = String(source.name || '').trim().slice(0, 96) || `Appearance profile ${index + 1}`;
        const profile = defaultProfile(id, name);
        SCOPES.forEach((scope) => {
            profile.layers[scope] = normalizeLayer(source.layers?.[scope]);
        });
        return profile;
    };
    const normalizeState = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        let rawProfiles = Array.isArray(source.profiles) ? source.profiles : [];
        if (!rawProfiles.length) {
            const migrated = defaultProfile();
            migrated.layers.global = normalizeLayer({ variables: source.variables, customCss: source.customCss });
            rawProfiles = [migrated];
        }
        const seen = new Set();
        const profiles = rawProfiles.slice(0, 32).map(normalizeProfile).filter((profile) => {
            if (seen.has(profile.id)) return false;
            seen.add(profile.id);
            return true;
        });
        if (!profiles.length) profiles.push(defaultProfile());
        const requested = String(source.activeProfileId || '').trim();
        const activeProfileId = profiles.some((profile) => profile.id === requested) ? requested : profiles[0].id;
        return { activeProfileId, profiles };
    };
    const getActiveProfile = (value) => {
        const state = normalizeState(value);
        return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
    };
    const resolveLayer = (value, scope = 'global') => {
        const profile = getActiveProfile(value);
        const globalLayer = normalizeLayer(profile.layers.global);
        const scopedLayer = normalizeLayer(profile.layers[SCOPES.includes(scope) ? scope : 'global']);
        return {
            variables: { ...globalLayer.variables, ...scopedLayer.variables },
            customCss: [globalLayer.customCss, scope === 'global' ? '' : scopedLayer.customCss].filter((entry) => entry.trim()).join('\n\n')
        };
    };
    return Object.freeze({ SCOPES, defaultProfile, normalizeLayer, normalizeProfile, normalizeState, getActiveProfile, resolveLayer });
}));
