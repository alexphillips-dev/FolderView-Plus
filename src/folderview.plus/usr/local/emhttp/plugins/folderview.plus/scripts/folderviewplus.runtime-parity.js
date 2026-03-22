/* Shared Docker/VM parity helpers extracted from folderviewplus.js. */
const tableIdByType = { docker: 'docker', vm: 'vms' };
const parseJsonResponse = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
const VALID_MANAGED_TYPES = new Set(['docker', 'vm']);
const normalizeManagedType = (type) => {
    const normalized = String(type || '').trim().toLowerCase();
    if (!VALID_MANAGED_TYPES.has(normalized)) {
        throw new Error(`Invalid type: ${type}`);
    }
    return normalized;
};
const typeFolders = (type) => (type === 'docker' ? dockers : vms);

const getManagedTypeLabel = (type) => (normalizeManagedType(type) === 'docker' ? 'Docker' : 'VM');
const getManagedTypePluralLabel = (type) => (normalizeManagedType(type) === 'docker' ? 'Docker' : 'VMs');

Object.assign(window, {
    tableIdByType,
    parseJsonResponse,
    VALID_MANAGED_TYPES,
    normalizeManagedType,
    typeFolders,
    getManagedTypeLabel,
    getManagedTypePluralLabel
});

window.FolderViewPlusRuntimeParity = Object.freeze({
    tableIdByType,
    parseJsonResponse,
    VALID_MANAGED_TYPES,
    normalizeManagedType,
    typeFolders,
    getManagedTypeLabel,
    getManagedTypePluralLabel
});
window.FolderViewPlusRuntimeParityModuleLoaded = true;
