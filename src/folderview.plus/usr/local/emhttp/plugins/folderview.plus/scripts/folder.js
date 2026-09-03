// list of element to select
(function fvplusFolderEditorRuntimeScope(window, $) {
window.FolderViewPlusFolderEditorRuntimeLoaded = true;
window.FolderViewPlusFolderEditorRuntimeBootStage = 'script-evaluated';
let choose = [];
// element selected by the regex string
let selectedRegex = [];
// element selected manually
let selected = [];
let hiddenPreviewMembers = new Set();
const folderEditorT = (key, fallback = '', ...params) => (
    window.FolderViewPlusI18n?.t(key, fallback, ...params) || fallback || key
);
const compareFolderEditorText = (left, right, options = {}) => (
    window.FolderViewPlusI18n?.compare?.(left, right, options)
    ?? String(left ?? '').localeCompare(String(right ?? ''), undefined, options)
);
const EDITOR_PREFILL_STORAGE_KEY = 'fv.folder.editor.prefill.v1';
const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv.folder.editor.prefill.persist.v1';
const EDITOR_WINDOW_NAME_PREFIX = 'fv.folder.editor.v1:';
const EDITOR_BOOTSTRAP_COOKIE_NAME = 'fv_folder_editor_bootstrap';
const EDITOR_DEBUG_BOOTSTRAP_STORAGE_KEY = 'fv.folder.editor.debug.bootstrap.v1';
const readCookieFolderEditorBootstrapSeed = () => {
    try {
        const cookieSource = String(document.cookie || '');
        if (!cookieSource) {
            return null;
        }
        const cookieParts = cookieSource.split(';');
        for (const rawPart of cookieParts) {
            const part = String(rawPart || '').trim();
            if (!part || !part.startsWith(`${EDITOR_BOOTSTRAP_COOKIE_NAME}=`)) {
                continue;
            }
            const rawValue = part.slice(EDITOR_BOOTSTRAP_COOKIE_NAME.length + 1);
            if (!rawValue) {
                continue;
            }
            const payload = JSON.parse(decodeURIComponent(rawValue));
            const safeType = String(payload?.type || '').trim();
            const safeId = String(payload?.id || '').trim();
            const folder = payload?.folder && typeof payload.folder === 'object' ? payload.folder : null;
            if (safeType && safeId) {
                return { type: safeType, id: safeId, folder };
            }
        }
    } catch (_error) {
        return null;
    }
    return null;
};
const readFolderEditorBootstrapSeed = () => {
    const parsePrefill = (rawValue) => {
        const raw = String(rawValue || '').trim();
        if (!raw) {
            return null;
        }
        try {
            const payload = JSON.parse(raw);
            const safeType = String(payload?.type || '').trim();
            const safeId = String(payload?.id || '').trim();
            const folder = payload?.folder && typeof payload.folder === 'object' ? payload.folder : null;
            return safeType && safeId ? { type: safeType, id: safeId, folder } : null;
        } catch (_error) {
            return null;
        }
    };
    try {
        if (typeof sessionStorage !== 'undefined') {
            const sessionPayload = parsePrefill(sessionStorage.getItem(EDITOR_PREFILL_STORAGE_KEY));
            if (sessionPayload) {
                return sessionPayload;
            }
        }
        if (typeof localStorage !== 'undefined') {
            const localPayload = parsePrefill(localStorage.getItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY));
            if (localPayload) {
                return localPayload;
            }
        }
    } catch (_error) {
        return null;
    }
    return null;
};
const readWindowNameFolderEditorBootstrapSeed = () => {
    const parsePrefill = (rawValue) => {
        const raw = String(rawValue || '').trim();
        if (!raw || !raw.startsWith(EDITOR_WINDOW_NAME_PREFIX)) {
            return null;
        }
        try {
            const payload = JSON.parse(raw.slice(EDITOR_WINDOW_NAME_PREFIX.length));
            const safeType = String(payload?.type || '').trim();
            const safeId = String(payload?.id || '').trim();
            const folder = payload?.folder && typeof payload.folder === 'object' ? payload.folder : null;
            return safeType && safeId ? { type: safeType, id: safeId, folder } : null;
        } catch (_error) {
            return null;
        }
    };
    try {
        return parsePrefill(window.name);
    } catch (_error) {
        return null;
    }
};
const folderEditorQueryParams = new URLSearchParams(location.search);
const folderEditorHashParams = new URLSearchParams(String(window.location?.hash || '').replace(/^#/, ''));
const folderEditorStorageBootstrap = readFolderEditorBootstrapSeed();
const folderEditorWindowNameBootstrap = readWindowNameFolderEditorBootstrapSeed();
const folderEditorCookieBootstrap = readCookieFolderEditorBootstrapSeed();
const folderEditorBootstrapSeed = folderEditorWindowNameBootstrap || folderEditorStorageBootstrap || folderEditorCookieBootstrap;
const folderEditorBootstrapContext = window.FolderViewPlusFolderEditorBootstrapContext
    && typeof window.FolderViewPlusFolderEditorBootstrapContext === 'object'
    ? window.FolderViewPlusFolderEditorBootstrapContext
    : {};
let folderEditorExpectedFolderRevision = Math.max(
    0,
    Number.parseInt(String(folderEditorBootstrapContext?.metadata?.folderRevision ?? '0'), 10) || 0
);
const inferFolderEditorTypeFromPath = () => {
    const pathname = String(window.location?.pathname || '').toLowerCase();
    if (pathname.includes('/docker/')) {
        return 'docker';
    }
    if (pathname.includes('/vms/')) {
        return 'vm';
    }
    return '';
};
// docker or vm?
const type = String(
    folderEditorQueryParams.get('type')
    || folderEditorHashParams.get('type')
    || folderEditorQueryParams.get('mode')
    || folderEditorHashParams.get('mode')
    || window.FolderViewPlusFolderEditorPageType
    || folderEditorBootstrapSeed?.type
    || inferFolderEditorTypeFromPath()
    || ''
).trim();
// id of the folder if present
const folderId = String(
    folderEditorQueryParams.get('id')
    || folderEditorHashParams.get('id')
    || folderEditorQueryParams.get('folderId')
    || folderEditorHashParams.get('folderId')
    || folderEditorQueryParams.get('folder')
    || folderEditorHashParams.get('folder')
    || folderEditorQueryParams.get('name')
    || folderEditorHashParams.get('name')
    || folderEditorBootstrapContext.resolvedId
    || window.FolderViewPlusFolderEditorRequestedId
    || folderEditorBootstrapContext.requestedId
    || folderEditorBootstrapSeed?.id
    || ''
).trim();
const requestedCreateParentId = String(
    folderEditorQueryParams.get('parentId')
    || folderEditorHashParams.get('parentId')
    || folderEditorQueryParams.get('parent')
    || folderEditorHashParams.get('parent')
    || ''
).trim();
const folderEditorResolvedId = String(
    folderEditorBootstrapContext.resolvedId
    || folderEditorBootstrapSeed?.id
    || window.FolderViewPlusFolderEditorResolvedId
    || ''
).trim();
const folderEditorBootstrapFolder = folderEditorBootstrapContext.folder
    && typeof folderEditorBootstrapContext.folder === 'object'
    ? folderEditorBootstrapContext.folder
    : (folderEditorBootstrapSeed?.folder && typeof folderEditorBootstrapSeed.folder === 'object'
        ? folderEditorBootstrapSeed.folder
        : null);
const buildFolderEditorRefCandidates = (...values) => Array.from(new Set(
    values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
));
const summarizeFolderEditorSeed = (seed) => {
    if (!seed || typeof seed !== 'object') {
        return null;
    }
    const safeType = String(seed.type || '').trim();
    const safeId = String(seed.id || '').trim();
    if (!safeType && !safeId) {
        return null;
    }
    return {
        type: safeType,
        id: safeId,
        hasFolder: Boolean(seed.folder && typeof seed.folder === 'object')
    };
};
if (typeof window.FolderViewPlusReportFolderEditorBootstrap === 'function') {
    window.FolderViewPlusReportFolderEditorBootstrap({
        summary: 'Folder editor runtime script loaded.',
        details: 'The modern editor runtime file executed and is beginning bootstrap.',
        debug: [
            `pageMode=${String(window.FolderViewPlusFolderEditorPageMode || '(empty)')}`,
            `pageType=${String(window.FolderViewPlusFolderEditorPageType || '(empty)')}`,
            `pageRequested=${String(window.FolderViewPlusFolderEditorRequestedId || '(empty)')}`,
            `pageResolved=${String(window.FolderViewPlusFolderEditorResolvedId || '(empty)')}`,
            `queryType=${String(folderEditorQueryParams.get('type') || '(empty)')}`,
            `queryId=${String(folderEditorQueryParams.get('id') || folderEditorQueryParams.get('folderId') || folderEditorQueryParams.get('folder') || '(empty)')}`,
            `hashType=${String(folderEditorHashParams.get('type') || '(empty)')}`,
            `hashId=${String(folderEditorHashParams.get('id') || folderEditorHashParams.get('folderId') || folderEditorHashParams.get('folder') || '(empty)')}`,
            `seedType=${String(folderEditorBootstrapSeed?.type || '(empty)')}`,
            `seedId=${String(folderEditorBootstrapSeed?.id || '(empty)')}`,
            `seedHasFolder=${folderEditorBootstrapFolder ? 'yes' : 'no'}`
        ].join('\n'),
        tone: 'info',
        stage: 'script-evaluated'
    });
}
const folderContract = window.FolderViewPlusFolderContract || null;
const folderEditorShared = window.FolderViewPlusFolderEditorShared || null;
const folderEditorSchema = window.FolderViewPlusFolderEditorSchema || null;
const folderEditorPreview = window.FolderViewPlusFolderEditorPreview || null;
const folderEditorPreviewRuntimeModule = window.FolderViewPlusFolderEditorPreviewRuntime || null;
const folderPreviewModelModule = window.FolderViewPlusFolderPreviewModel || null;
const themeResolver = window.FolderViewPlusThemeResolver || null;
const requestClient = window.FolderViewPlusRequest || null;
const bindFolderThemeAwareSurface = typeof themeResolver?.bindThemeAwareSurface === 'function'
    ? themeResolver.bindThemeAwareSurface.bind(themeResolver)
    : null;
const folderThemeSurfaceBinding = bindFolderThemeAwareSurface
    ? bindFolderThemeAwareSurface({
        root: '.canvas form.folder-editor-form',
        sampleRoot: 'body',
        extraTargets: ['#fvEditorChrome', '#fvLivePanel', '#fvEditorNavDock', '#fvEditorActionBar'],
        modeInput: 'auto',
        reasonPrefix: 'folder-editor'
    })
    : null;
const utils = window.FolderViewPlusUtils || null;
const normalizeFolderId = typeof utils?.normalizeFolderId === 'function'
    ? utils.normalizeFolderId
    : ((value) => {
        const id = String(value || '').trim();
        return /^[A-Za-z0-9._:-]{1,128}$/.test(id)
            && !['__proto__', 'prototype', 'constructor'].includes(id.toLowerCase())
            ? id
            : '';
    });
const createFolderMap = () => Object.create(null);
const setFolderMapEntry = (folderMap, folderIdValue, folderRecord) => {
    const safeId = normalizeFolderId(folderIdValue);
    if (!safeId || !folderMap || typeof folderMap !== 'object') {
        return '';
    }
    Object.defineProperty(folderMap, safeId, {
        value: folderRecord,
        enumerable: true,
        configurable: true,
        writable: true
    });
    return safeId;
};
const folderEditorTypePrefs = window.FolderViewPlusFolderEditorTypePrefs
    && typeof window.FolderViewPlusFolderEditorTypePrefs === 'object'
    ? window.FolderViewPlusFolderEditorTypePrefs
    : {};
const folderEditorRulesModule = window.FolderViewPlusFolderEditorRules || null;
const folderSettingsTransferModule = window.FolderViewPlusFolderSettingsTransfer || null;
const bulkAssignmentSharedModule = window.FolderViewPlusBulkAssignmentShared || null;
const folderEditorStateModule = window.FolderViewPlusFolderEditorState || null;
const folderEditorMembersModule = window.FolderViewPlusFolderEditorMembers || null;
const memberIdentityModule = window.FolderViewPlusMemberIdentity || null;
const folderEditorIconsModule = window.FolderViewPlusFolderEditorIcons || null;
const folderEditorTypeDockerModule = window.FolderViewPlusFolderEditorTypeDocker || null;
const folderEditorTypeVmModule = window.FolderViewPlusFolderEditorTypeVm || null;
const folderHierarchyModule = window.FolderViewPlusFolderHierarchy || null;
const folderParentPickerModule = window.FolderViewPlusFolderEditorParentPicker || null;
const folderIconApiModule = window.FolderViewPlusFolderIconApi || null;
const folderEditorRegexSelectionModule = window.FolderViewPlusFoundationModules?.folderEditorRegexSelection || null;
const folderEditorMemberListModule = window.FolderViewPlusFoundationModules?.folderEditorMemberList || null;
const folderWebuiProfilesModule = window.FolderViewPlusFoundationModules?.folderWebuiProfiles || null;
const DEFAULT_FOLDER_STATUS_COLORS = folderContract?.DEFAULT_FOLDER_STATUS_COLORS || {
    started: '#55b72d',
    paused: '#b8860b',
    stopped: '#ff4d4d', text: '#ffffff'
};
const DEFAULT_FOLDER_ACCENT_COLOR = folderContract?.DEFAULT_FOLDER_ACCENT_COLOR || '#ffca63';
const DEFAULT_BORDER_COLOR = folderContract?.DEFAULT_PREVIEW_BORDER_COLOR || '#afa89e';
const DEFAULT_PREVIEW_BORDER_WIDTH = folderContract?.DEFAULT_PREVIEW_BORDER_WIDTH || 1;
const DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH = folderContract?.DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH || 1;
const DEFAULT_DROPDOWN_STYLE = folderContract?.DEFAULT_DROPDOWN_STYLE || 'minimal';
const DEFAULT_DROPDOWN_COLOR = folderContract?.DEFAULT_DROPDOWN_COLOR || '#ff9a3c';
const DEFAULT_DROPDOWN_HOVER_COLOR = folderContract?.DEFAULT_DROPDOWN_HOVER_COLOR || '#111111';
const SUPPORTED_DROPDOWN_STYLES = folderContract?.SUPPORTED_DROPDOWN_STYLES || Object.freeze(['minimal', 'boxed', 'ghost', 'pill', 'filled']);
const isFolderAccentEnabled = typeof folderContract?.isFolderAccentEnabled === 'function'
    ? folderContract.isFolderAccentEnabled
    : ((settings) => settings?.folder_accent_enabled === true);
const NO_MEMBERS_SELECTED_INFO = 'No members are currently selected in this folder.';
const EDITOR_PREFILL_MAX_AGE_MS = 10 * 60 * 1000;
const FOLDER_LABEL_KEYS = ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
const PREVIEW_MODE_LABELS = folderEditorSchema?.PREVIEW_MODE_LABELS || Object.freeze({
    0: 'None',
    1: 'Icon and label',
    2: 'Only icon',
    3: 'Only label',
    4: 'List'
});
const CONTEXT_MODE_LABELS = folderEditorSchema?.CONTEXT_MODE_LABELS || Object.freeze({
    0: 'None',
    1: 'Default',
    2: 'Advanced'
});
const FOLDER_HEALTH_PROFILE_VALUES = folderEditorSchema?.FOLDER_HEALTH_PROFILE_VALUES || Object.freeze(['strict', 'balanced', 'lenient']);
const FOLDER_HEALTH_UPDATES_MODE_VALUES = folderEditorSchema?.FOLDER_HEALTH_UPDATES_MODE_VALUES || Object.freeze(['maintenance', 'warn', 'ignore']);
const FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES = folderEditorSchema?.FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES || Object.freeze(['critical', 'warn']);
const INVALID_FOLDER_NAME_CHAR_REGEX = folderEditorSchema?.INVALID_FOLDER_NAME_CHAR_REGEX || /[\u0000-\u001f\u007f]/;
const modernEditorSchema = typeof folderEditorSchema?.createModernSchema === 'function'
    ? folderEditorSchema.createModernSchema({
        defaultBorderColor: DEFAULT_BORDER_COLOR,
        defaultPreviewBorderWidth: DEFAULT_PREVIEW_BORDER_WIDTH,
        defaultPreviewVerticalBarsWidth: DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,
        defaultDropdownStyle: DEFAULT_DROPDOWN_STYLE,
        defaultDropdownColor: DEFAULT_DROPDOWN_COLOR,
        defaultDropdownHoverColor: DEFAULT_DROPDOWN_HOVER_COLOR,
        defaultFolderStatusColors: DEFAULT_FOLDER_STATUS_COLORS,
        defaultFolderAccentColor: DEFAULT_FOLDER_ACCENT_COLOR
    })
    : null;
const SECTION_META = modernEditorSchema?.SECTION_META || Object.freeze({});
const SECTION_FIELD_NAMES = modernEditorSchema?.SECTION_FIELD_NAMES || Object.freeze({});
const SECTION_DEFAULT_VALUES = modernEditorSchema?.SECTION_DEFAULT_VALUES || Object.freeze({});
const INHERITED_FIELD_HINTS = modernEditorSchema?.INHERITED_FIELD_HINTS || Object.freeze({});
const ADVANCED_SECTION_KEYS = modernEditorSchema?.ADVANCED_SECTION_KEYS || Object.freeze([]);
const SECTION_CHANGE_LABELS = modernEditorSchema?.SECTION_CHANGE_LABELS || Object.freeze({});
const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
const BUILT_IN_ICON_MANIFEST_PATH = '/plugins/folderview.plus/images/icons/icons.json';
const THIRD_PARTY_ICON_API_PATH = '/plugins/folderview.plus/server/third_party_icons.php';
const CUSTOM_ICON_UPLOAD_API_PATH = '/plugins/folderview.plus/server/upload_custom_icon.php';
const CUSTOM_ICON_UPLOAD_MAX_BYTES = 4194304;
const CUSTOM_ICON_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const ICON_FALLBACK_PATH = '/plugins/dynamix.docker.manager/images/question.png';
const ICON_UPLOAD_ENDPOINT_CONTEXT = 'icon upload endpoint';
const CUSTOM_ICON_MANAGER_CONTEXT = 'custom icon manager';
const ICON_PICKER_PAGE_SIZE = 120;
const CUSTOM_ICON_PAGE_SIZE = 60;
const ICON_PICKER_SEARCH_DEBOUNCE_MS = 120;
const CUSTOM_ICON_SEARCH_DEBOUNCE_MS = 150;
const THIRD_PARTY_ICON_SEARCH_DEBOUNCE_MS = 140;
const EDITOR_INPUT_RECALC_DEBOUNCE_MS = 90;
const NAME_REGEX_SYNC_DEBOUNCE_MS = 150;
const REGEX_INPUT_SYNC_DEBOUNCE_MS = 120;
const MEMBER_LIST_RENDER_CHUNK_SIZE = 140;
const REGEX_WORKER_MIN_ITEMS = 180;
const THIRD_PARTY_RECENT_LIMIT = 36;
const THIRD_PARTY_LONG_PRESS_PREVIEW_MS = 460;
const THIRD_PARTY_GRID_CHUNK_SIZE = 36;
const THIRD_PARTY_MIN_TAG_COUNT = 2;
const THIRD_PARTY_PLACEHOLDER_ICON = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const THIRD_PARTY_FAVORITES_STORAGE_KEY = 'fv.folder.icon.thirdparty.favorites.v1';
const THIRD_PARTY_RECENT_STORAGE_KEY = 'fv.folder.icon.thirdparty.recent.v1';
const THIRD_PARTY_PINNED_STORAGE_KEY = 'fv.folder.icon.thirdparty.pinnedFolders.v1';
const THIRD_PARTY_HIDDEN_STORAGE_KEY = 'fv.folder.icon.thirdparty.hiddenFolders.v1';
const THIRD_PARTY_USAGE_STORAGE_KEY = 'fv.folder.icon.thirdparty.folderUsage.v1';
const THIRD_PARTY_LAST_USED_STORAGE_KEY = 'fv.folder.icon.thirdparty.lastUsedByIcon.v1';
const EDITOR_ADVANCED_COLLAPSE_STORAGE_KEY = 'fv.folder.editor.advancedCollapse.v1';
const MEMBER_BULK_SCOPE_OPTIONS = Object.freeze([
    { value: 'shown', label: 'Move shown' },
    { value: 'included_shown', label: 'Move included shown' },
    { value: 'excluded_shown', label: 'Move excluded shown' },
    { value: 'all_included', label: 'Move all included' }
]);
const BUILT_IN_ICON_FALLBACK = [{
    id: 'default-folder',
    name: 'Default Folder',
    path: DEFAULT_FOLDER_ICON_PATH,
    tags: ['default', 'folder']
}];
const folderEditorBootstrapMissingModules = [];
if (!utils || typeof utils.normalizeDashboardOverflowMode !== 'function') {
    folderEditorBootstrapMissingModules.push('folderviewplus.utils.js');
}
if (!folderIconApiModule || typeof folderIconApiModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.icon-api.js');
}
if (!folderEditorPreviewRuntimeModule || typeof folderEditorPreviewRuntimeModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.preview-runtime.js');
}
if (!folderPreviewModelModule || typeof folderPreviewModelModule.createChildFolderPreviewModel !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.preview-model.js');
}
if (!folderEditorStateModule || typeof folderEditorStateModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.state.js');
}
if (!folderEditorMembersModule || typeof folderEditorMembersModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.members.js');
}
if (!folderHierarchyModule || typeof folderHierarchyModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.hierarchy.js');
}
if (!folderEditorRegexSelectionModule || typeof folderEditorRegexSelectionModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.regex-selection.js');
}
if (!folderEditorMemberListModule || typeof folderEditorMemberListModule.createApi !== 'function' || typeof folderEditorMemberListModule.normalizeChildFolderOrder !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.member-list.js');
}
if (!folderWebuiProfilesModule || typeof folderWebuiProfilesModule.createEditorApi !== 'function') folderEditorBootstrapMissingModules.push('folder.webui-profiles.js');
if (!bulkAssignmentSharedModule || typeof bulkAssignmentSharedModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folderviewplus.bulk-assignment.shared.js');
}
if (!folderEditorIconsModule || typeof folderEditorIconsModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.icons.js');
}
if (!folderEditorTypeDockerModule || typeof folderEditorTypeDockerModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.type-docker.js');
}
if (!folderEditorTypeVmModule || typeof folderEditorTypeVmModule.createApi !== 'function') {
    folderEditorBootstrapMissingModules.push('folder.editor.type-vm.js');
}
if (folderEditorBootstrapMissingModules.length > 0) {
    const error = new Error(`FolderView Plus folder editor bootstrap failed. Missing modules: ${folderEditorBootstrapMissingModules.join(', ')}`);
    error.fvplusBannerShown = true;
    window.FolderViewPlusFolderEditorRuntimeLastError = error.message;
    if (typeof window.FolderViewPlusReportFolderEditorBootstrap === 'function') {
        window.FolderViewPlusReportFolderEditorBootstrap({
            summary: 'Folder editor bootstrap is missing required modules.',
            details: 'The modern editor runtime stopped before hydration because one or more shared scripts were unavailable.',
            debug: [
                `stage=${String(window.FolderViewPlusFolderEditorRuntimeBootStage || '(empty)')}`,
                `missingModules=${folderEditorBootstrapMissingModules.join(', ')}`
            ].join('\n'),
            tone: 'invalid',
            stage: 'missing-modules'
        });
    }
    throw error;
}

let allFoldersById = createFolderMap();
let activeFolderEditorFolderId = '';
let activeFolderEditorResolvedFolderId = '';
let folderEditorRulesApi = null;
let folderEditorPreviewRuntimeApi = null;
let folderEditorStateApi = null;
let folderEditorMembersApi = null;
let folderEditorRegexSelectionApi = null;
let folderEditorMemberListApi = null, folderWebuiProfilesApi = null;
let folderEditorIconsApi = null;
let folderEditorTypeApi = null;
let folderBulkAssignmentSharedApi = null;
let initialSnapshot = '';
let isFormInitialized = false;
let suppressUnloadPrompt = false;
let editorRecalcTimer = null;
let nameRegexSyncTimer = null;
let lastNameRegexSyncValue = '';
let editorMode = 'basic';
let activeEditorSection = folderEditorHashParams.get('section') || folderEditorQueryParams.get('section') || 'general';
let advancedSectionCollapsedState = {};
let memberBulkMoveInFlight = false;
let memberBulkMoveUndoState = null;
let memberBulkMoveUndoInFlight = false;
const SMART_DEFAULT_FIELD_NAMES = new Set([
    'icon',
    'preview',
    'preview_hover',
    'preview_hover_animation',
    'folder_update_highlight',
    'preview_border',
    'preview_border_color',
    'preview_border_width',
    'preview_border_glow',
    'preview_vertical_bars',
    'preview_vertical_bars_color',
    'preview_vertical_bars_width',
    'preview_overflow',
    'preview_row_separator',
    'preview_row_separator_color',
    'dropdown_style',
    'dropdown_color',
    'dropdown_hover_color',
    'folder_accent_enabled',
    'folder_accent_color',
    'status_color_started',
    'status_color_paused',
    'status_color_stopped', 'status_color_text', 'status_color_text_auto',
    'status_color_lock'
]);
const parseSnapshotState = (raw) => {
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') {
            return { fields: {}, members: [], actions: [] };
        }
        return {
            fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
            members: Array.isArray(parsed.members) ? parsed.members : [],
            actions: Array.isArray(parsed.actions) ? parsed.actions : []
        };
    } catch (_error) {
        return { fields: {}, members: [], actions: [] };
    }
};

const normalizeComparableValue = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeComparableValue(entry));
    }
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return String(value);
};
const isFolderStatusTextColorExplicit = (settings) => { const source = settings && typeof settings === 'object' ? settings : {}; const normalizedColors = utils?.getFolderStatusColors?.(source); if (normalizedColors && typeof normalizedColors.text === 'string') return normalizedColors.text !== ''; const hasMarker = Object.prototype.hasOwnProperty.call(source, 'status_color_text_explicit') || Object.prototype.hasOwnProperty.call(source, 'statusColorTextExplicit'); return hasMarker ? (source.status_color_text_explicit === true || source.statusColorTextExplicit === true) : normalizeHexColor(source.status_color_text, DEFAULT_FOLDER_STATUS_COLORS.text) !== DEFAULT_FOLDER_STATUS_COLORS.text; };
const areComparableValuesEqual = (left, right) => JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));

const setFormControlValue = (fieldName, value) => {
    const form = getForm();
    const field = form?.elements?.[fieldName];
    if (!field) {
        return;
    }
    if (field.type === 'checkbox') {
        field.checked = value === true;
        return;
    }
    $(field).val(value);
};

const getSectionChangeItems = (sectionKey, baselineSnapshot = parseSnapshotState(initialSnapshot), currentSnapshot = parseSnapshotState(computeFormSnapshot())) => {
    if (sectionKey === 'members') {
        return areComparableValuesEqual(baselineSnapshot.members, currentSnapshot.members) ? [] : ['Member assignment or ordering'];
    }
    if (sectionKey === 'actions') {
        return areComparableValuesEqual(baselineSnapshot.actions, currentSnapshot.actions) ? [] : ['Custom folder actions'];
    }
    const fieldNames = SECTION_FIELD_NAMES[sectionKey] || [];
    return fieldNames
        .filter((fieldName) => !areComparableValuesEqual(baselineSnapshot.fields[fieldName], currentSnapshot.fields[fieldName]))
        .map((fieldName) => SECTION_CHANGE_LABELS[fieldName] || fieldName);
};

const getAllChangedItems = (baselineSnapshot = parseSnapshotState(initialSnapshot), currentSnapshot = parseSnapshotState(computeFormSnapshot())) => Object.keys(SECTION_META)
    .flatMap((sectionKey) => getSectionChangeItems(sectionKey, baselineSnapshot, currentSnapshot));

const resolveMemberRuntimeStateKey = (member) => {
    const stateSources = [
        member?.State,
        member?.RawState,
        member?.info?.State,
        member
    ].filter((source) => source && typeof source === 'object');

    for (const source of stateSources) {
        const hasExplicitPaused = typeof source.Paused === 'boolean' || typeof source.paused === 'boolean' || typeof source.pause === 'boolean';
        const hasExplicitRunning = typeof source.Running === 'boolean' || typeof source.running === 'boolean' || typeof source.state === 'boolean';
        const hasPausedFlag = source.Paused === true || source.paused === true || source.pause === true;
        const hasRunningFlag = source.Running === true || source.running === true || source.state === true;
        if (hasExplicitPaused || hasExplicitRunning) {
            if (hasPausedFlag) {
                return 'paused';
            }
            if (hasRunningFlag) {
                return 'started';
            }
            return 'stopped';
        }
    }

    const rawState = stateSources
        .map((source) => String(source.Status || source.status || source.state || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
    if (rawState.includes('pause')) {
        return 'paused';
    }
    if (rawState.includes('run') || rawState.includes('start')) {
        return 'started';
    }
    if (rawState.includes('stop') || rawState.includes('exit') || rawState.includes('dead')) {
        return 'stopped';
    }
    return '';
};

const buildSampleMemberState = (member, index = 0) => {
    const runtimeStateKey = resolveMemberRuntimeStateKey(member);
    if (runtimeStateKey === 'paused') {
        return {
            label: 'paused',
            color: normalizeHexColor(getForm()?.status_color_paused?.value, DEFAULT_FOLDER_STATUS_COLORS.paused)
        };
    }
    if (runtimeStateKey === 'started') {
        return {
            label: type === 'vm' ? 'running' : 'started',
            color: normalizeHexColor(getForm()?.status_color_started?.value, DEFAULT_FOLDER_STATUS_COLORS.started)
        };
    }
    if (runtimeStateKey === 'stopped') {
        return {
            label: 'stopped',
            color: normalizeHexColor(getForm()?.status_color_stopped?.value, DEFAULT_FOLDER_STATUS_COLORS.stopped)
        };
    }
    return index % 3 === 1
        ? { label: 'paused', color: normalizeHexColor(getForm()?.status_color_paused?.value, DEFAULT_FOLDER_STATUS_COLORS.paused) }
        : (index % 2 === 0
            ? { label: type === 'vm' ? 'running' : 'started', color: normalizeHexColor(getForm()?.status_color_started?.value, DEFAULT_FOLDER_STATUS_COLORS.started) }
            : { label: 'stopped', color: normalizeHexColor(getForm()?.status_color_stopped?.value, DEFAULT_FOLDER_STATUS_COLORS.stopped) });
};

const getFolderLabelValue = (labels) => {
    const source = labels && typeof labels === 'object' ? labels : {};
    for (const key of FOLDER_LABEL_KEYS) {
        if (typeof source[key] === 'string' && source[key].trim() !== '') {
            return source[key].trim();
        }
    }
    return '';
};

const basenameFromPathish = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return '';
    }
    const firstEntry = trimmed.split(',')[0].trim();
    if (!firstEntry) {
        return '';
    }
    const normalized = firstEntry.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalized) {
        return '';
    }
    const parts = normalized.split('/');
    return String(parts[parts.length - 1] || '').trim();
};

const getComposeProjectFromLabels = (labels) => {
    const source = labels && typeof labels === 'object' ? labels : {};
    const explicit = String(source['com.docker.compose.project'] || '').trim();
    if (explicit) {
        return explicit;
    }
    const fromWorkingDir = basenameFromPathish(source['com.docker.compose.project.working_dir']);
    if (fromWorkingDir) {
        return fromWorkingDir;
    }
    const configFiles = String(source['com.docker.compose.project.config_files'] || '').trim();
    if (configFiles) {
        const firstConfig = configFiles.split(',')[0].trim();
        if (firstConfig) {
            const normalized = firstConfig.replace(/\\/g, '/');
            const dir = normalized.split('/').slice(0, -1).join('/');
            const fromConfigDir = basenameFromPathish(dir);
            if (fromConfigDir) {
                return fromConfigDir;
            }
        }
    }
    return '';
};

const rgbToHex = (rgb) => {
    rgb = rgb.slice(4, -1).split(', ');
    return "#" + (1 << 24 | rgb[0] << 16 | rgb[1] << 8 | rgb[2]).toString(16).slice(1);
};

const normalizeHexColor = typeof folderContract?.normalizeHexColor === 'function'
    ? folderContract.normalizeHexColor
    : ((value, fallback) => {
        if (typeof value !== 'string') {
            return fallback;
        }
        const trimmed = value.trim();
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
            return fallback;
        }
        if (trimmed.length === 4) {
            return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
        }
        return trimmed.toLowerCase();
    });

const hexColorToRgba = typeof folderContract?.hexColorToRgba === 'function'
    ? folderContract.hexColorToRgba
    : ((hex, alpha) => {
        const normalized = normalizeHexColor(hex, DEFAULT_DROPDOWN_COLOR);
        const safeAlpha = Number.isFinite(Number(alpha)) ? Math.max(0, Math.min(1, Number(alpha))) : 1;
        const value = normalized.slice(1);
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    });

const normalizePositiveInt = typeof folderContract?.normalizePositiveInt === 'function'
    ? folderContract.normalizePositiveInt
    : ((value, fallback, min = 1, max = 4) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }
        return Math.max(min, Math.min(max, Math.round(parsed)));
    });

const normalizePreviewStatusMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['none', 'hide', 'hidden', 'off', 'false', '0', 'no'].includes(normalized)) {
        return 'none';
    }
    return ['none', 'symbol', 'grayscale'].includes(normalized) ? normalized : 'symbol';
};

const normalizePreviewHoverAnimation = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    const aliases = { grow: 'pop', pulse: 'glow', spin: 'flip' };
    const token = aliases[normalized] || normalized;
    return ['none', 'lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'].includes(token)
        ? token
        : 'none';
};

const extractDropdownStyleValue = typeof folderContract?.extractDropdownStyleValue === 'function'
    ? folderContract.extractDropdownStyleValue
    : ((value, fallbackSource = null) => {
        const sources = [value, fallbackSource];
        for (const source of sources) {
            if (source && typeof source === 'object') {
                const candidate = source.dropdown_style
                    ?? source.dropdownStyle
                    ?? source.chevron_style
                    ?? source.chevronStyle;
                if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
                    return candidate;
                }
            } else if (source !== undefined && source !== null && String(source).trim() !== '') {
                return source;
            }
        }
        return '';
    });

const normalizeDropdownStyle = typeof folderContract?.normalizeDropdownStyle === 'function'
    ? folderContract.normalizeDropdownStyle
    : ((value, fallbackSource = null) => {
        const normalized = String(extractDropdownStyleValue(value, fallbackSource) || '').trim().toLowerCase();
        return SUPPORTED_DROPDOWN_STYLES.includes(normalized)
            ? normalized
            : DEFAULT_DROPDOWN_STYLE;
    });

const getDropdownStyleTokens = typeof folderContract?.getDropdownStyleTokens === 'function'
    ? folderContract.getDropdownStyleTokens
    : ((style, normalColor, hoverColor) => {
        switch (style) {
            case 'boxed':
                return { border: hexColorToRgba(normalColor, 0.52), hoverBorder: hoverColor, background: hexColorToRgba(normalColor, 0.10), hoverBackground: hexColorToRgba(normalColor, 0.82), minWidth: '22px', height: '22px', padding: '0 6px', radius: '4px', shadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)', hoverShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.18)' };
            case 'ghost':
                return { border: 'transparent', hoverBorder: hoverColor, background: 'transparent', hoverBackground: hexColorToRgba(normalColor, 0.08), minWidth: '20px', height: '20px', padding: '0 5px', radius: '4px', shadow: 'none', hoverShadow: 'none' };
            case 'pill':
                return { border: hexColorToRgba(normalColor, 0.42), hoverBorder: hoverColor, background: hexColorToRgba(normalColor, 0.10), hoverBackground: hexColorToRgba(normalColor, 0.18), minWidth: '24px', height: '20px', padding: '0 7px', radius: '999px', shadow: 'none', hoverShadow: 'none' };
            case 'filled':
                return { border: hexColorToRgba(normalColor, 0.65), hoverBorder: hoverColor, background: hexColorToRgba(normalColor, 0.22), hoverBackground: hexColorToRgba(normalColor, 0.34), minWidth: '22px', height: '22px', padding: '0 6px', radius: '4px', shadow: 'none', hoverShadow: 'none' };
            case 'minimal':
            default:
                return { border: 'transparent', hoverBorder: 'transparent', background: 'transparent', hoverBackground: 'transparent', minWidth: '12px', height: '16px', padding: '0 2px', radius: '0px', shadow: 'none', hoverShadow: 'none' };
        }
    });

const isLegacyPreviewBorderEnabled = typeof folderContract?.isPreviewBorderEnabled === 'function'
    ? folderContract.isPreviewBorderEnabled
    : ((settings) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        if (Object.prototype.hasOwnProperty.call(source, 'preview_border')) {
            const raw = String(source.preview_border ?? '').trim().toLowerCase();
            const explicitOff = raw === '0' || raw === 'false' || raw === 'off' || raw === 'no';
            return !explicitOff;
        }
        return true;
    });

const getForm = () => $('div.canvas > form')[0];
const getFormField = (form, fieldName) => {
    if (!form || !fieldName) {
        return null;
    }
    if (typeof form.elements?.namedItem === 'function') {
        return form.elements.namedItem(fieldName);
    }
    return form.elements?.[fieldName] || null;
};
const setValidationBannerState = (summaryText, detailsText, state = 'ready') => {
    const summary = $('#fvValidationSummary');
    const details = $('#fvValidationDetails');
    if (summary.length) {
        summary
            .removeClass('invalid warning info ready')
            .addClass(state === 'invalid' ? 'invalid' : state === 'warning' ? 'warning' : state === 'info' ? 'info' : 'ready')
            .text(summaryText);
    }
    if (details.length) {
        details
            .removeClass('invalid warning info ready')
            .addClass(state === 'invalid' ? 'invalid' : state === 'warning' ? 'warning' : state === 'info' ? 'info' : 'ready')
            .text(detailsText);
    }
};
const recordFolderEditorBootstrapDebug = (details = {}) => {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        localStorage.setItem(EDITOR_DEBUG_BOOTSTRAP_STORAGE_KEY, JSON.stringify({
            storedAt: new Date().toISOString(),
            runtime: 'modern',
            pageUrl: String(window.location?.href || ''),
            pagePath: String(window.location?.pathname || ''),
            pageMode: String(window.FolderViewPlusFolderEditorPageMode || '').trim(),
            pageType: String(window.FolderViewPlusFolderEditorPageType || '').trim(),
            routeType: String(type || '').trim(),
            routeFolderId: String(folderId || '').trim(),
            resolvedRouteId: String(folderEditorResolvedId || '').trim(),
            pageRequestedId: String(window.FolderViewPlusFolderEditorRequestedId || '').trim(),
            pageResolvedId: String(window.FolderViewPlusFolderEditorResolvedId || '').trim(),
            queryType: String(folderEditorQueryParams.get('type') || folderEditorQueryParams.get('mode') || '').trim(),
            queryId: String(folderEditorQueryParams.get('id') || folderEditorQueryParams.get('folderId') || folderEditorQueryParams.get('folder') || folderEditorQueryParams.get('name') || '').trim(),
            hashType: String(folderEditorHashParams.get('type') || folderEditorHashParams.get('mode') || '').trim(),
            hashId: String(folderEditorHashParams.get('id') || folderEditorHashParams.get('folderId') || folderEditorHashParams.get('folder') || folderEditorHashParams.get('name') || '').trim(),
            storageSeed: summarizeFolderEditorSeed(folderEditorStorageBootstrap),
            windowNameSeed: summarizeFolderEditorSeed(folderEditorWindowNameBootstrap),
            cookieSeed: summarizeFolderEditorSeed(folderEditorCookieBootstrap),
            ...details
        }));
    } catch (_error) {
        // Bootstrap diagnostics are best-effort only.
    }
};
const setBootstrapDiagnostics = (details = {}) => {
    recordFolderEditorBootstrapDebug({
        result: String(details.result || '').trim(),
        mode: String(details.mode || 'boot').trim(),
        requestedRef: String(details.requestedRef || '').trim(),
        requestedRefs: Array.isArray(details.requestedFolderRefs) ? details.requestedFolderRefs : [],
        effectiveFolderId: String(details.effectiveFolderId || '').trim(),
        preferredNavigationRef: String(details.preferredNavigationRef || '').trim(),
        navigationPrefillId: String(details.navigationPrefillId || '').trim(),
        navigationPrefillHasFolder: details.navigationPrefillHasFolder === 'yes' || details.navigationPrefillHasFolder === true,
        foldersLoaded: String(details.foldersLoaded || '0'),
        membersLoaded: String(details.membersLoaded || '0'),
        resolvedBy: String(details.resolvedBy || '').trim(),
        routeTargetRecovered: details.routeTargetRecovered === true,
        routeTargetMismatch: details.routeTargetMismatch === true
    });
    const debug = $('#fvEditorBootstrapDebug');
    if (!debug.length) {
        return;
    }
    const formatSeedSummary = (seed) => {
        if (!seed || typeof seed !== 'object') {
            return '(none)';
        }
        const seedType = String(seed.type || '(empty)').trim() || '(empty)';
        const seedId = String(seed.id || '(empty)').trim() || '(empty)';
        const hasFolder = seed.folder && typeof seed.folder === 'object' ? 'yes' : 'no';
        return `type=${seedType};id=${seedId};folder=${hasFolder}`;
    };
    const lines = [
        `type=${String(details.type || type || '(empty)')}`,
        `folderId=${String(details.folderId || folderId || '(empty)')}`,
        `resolvedId=${String(details.resolvedId || folderEditorResolvedId || '(empty)')}`,
        `requestedRef=${String(details.requestedRef || '(empty)')}`,
        `pageType=${String(window.FolderViewPlusFolderEditorPageType || '(empty)')}`,
        `pageMode=${String(window.FolderViewPlusFolderEditorPageMode || '(empty)')}`,
        `pageRequested=${String(window.FolderViewPlusFolderEditorRequestedId || '(empty)')}`,
        `pageResolved=${String(window.FolderViewPlusFolderEditorResolvedId || '(empty)')}`,
        `bootstrapContextResolvedBy=${String(folderEditorBootstrapContext?.resolvedBy || '(none)')}`,
        `bootstrapContextHasFolder=${folderEditorBootstrapFolder ? 'yes' : 'no'}`,
        `storageSeed=${folderEditorStorageBootstrap ? 'yes' : 'no'}`,
        `storageSeedSummary=${String(details.storageSeedSummary || formatSeedSummary(folderEditorStorageBootstrap))}`,
        `windowNameSeed=${folderEditorWindowNameBootstrap ? 'yes' : 'no'}`,
        `windowNameSeedSummary=${String(details.windowNameSeedSummary || formatSeedSummary(folderEditorWindowNameBootstrap))}`,
        `cookieSeed=${String(document.cookie || '').includes(`${EDITOR_BOOTSTRAP_COOKIE_NAME}=`) ? 'yes' : 'no'}`,
        `navigationPrefillId=${String(details.navigationPrefillId || '(empty)')}`,
        `navigationPrefillHasFolder=${String(details.navigationPrefillHasFolder || 'no')}`,
        `foldersLoaded=${String(details.foldersLoaded || '0')}`,
        `membersLoaded=${String(details.membersLoaded || '0')}`,
        `resolvedBy=${String(details.resolvedBy || '(none)')}`,
        `hostTheme=${String(window.FolderViewPlusHostThemeName || '(empty)')}`,
        `htmlTheme=${String(document.documentElement?.getAttribute('data-fvplus-host-theme') || '(empty)')}`,
        `mode=${String(details.mode || 'boot')}`,
        `result=${String(details.result || '(pending)')}`
    ];
    debug.text(lines.join('\n'));
};
const decodeFolderQueryValue = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    try {
        return decodeURIComponent(raw);
    } catch (_error) {
        return raw;
    }
};
const resolveCurrentEditFolder = (folderMap, requestedId) => {
    const normalizedRequestedId = String(requestedId || '').trim();
    if (!normalizedRequestedId || !folderMap || typeof folderMap !== 'object') {
        return null;
    }

    const candidateIds = Array.from(new Set([
        normalizedRequestedId,
        decodeFolderQueryValue(normalizedRequestedId)
    ].filter(Boolean)));

    for (const candidateId of candidateIds) {
        if (Object.prototype.hasOwnProperty.call(folderMap, candidateId)) {
            return {
                id: candidateId,
                folder: normalizeFolderRecordForEditor(folderMap[candidateId] || {}),
                resolvedBy: 'key'
            };
        }
    }

    const entries = Object.entries(folderMap);
    for (const candidateId of candidateIds) {
        const metaMatch = entries.find(([id, folder]) => {
            const normalizedKey = String(id || '').trim();
            const normalizedMetaId = String(folder?.id || folder?.folderId || '').trim();
            return normalizedKey === candidateId || normalizedMetaId === candidateId;
        });
        if (metaMatch) {
            return {
                id: String(metaMatch[0] || '').trim(),
                folder: normalizeFolderRecordForEditor(metaMatch[1] || {}),
                resolvedBy: 'metadata'
            };
        }
    }

    for (const candidateId of candidateIds) {
        const nameMatches = entries.filter(([, folder]) => String(folder?.name || '').trim() === candidateId);
        if (nameMatches.length === 1) {
            return {
                id: String(nameMatches[0][0] || '').trim(),
                folder: normalizeFolderRecordForEditor(nameMatches[0][1] || {}),
                resolvedBy: 'name'
            };
        }
    }

    return null;
};
const readEditorNavigationPrefill = (expectedType, expectedId = '') => {
    const parsePrefillPayload = (rawValue) => {
        const raw = String(rawValue || '').trim();
        if (!raw) {
            return null;
        }
        try {
            const payload = JSON.parse(raw);
            const normalizedType = String(payload?.type || '').trim();
            const normalizedId = String(payload?.id || '').trim();
            const normalizedExpectedType = String(expectedType || '').trim();
            const normalizedExpectedId = String(expectedId || '').trim();
            const storedAt = Number(payload?.storedAt || 0);
            if (!normalizedType || !normalizedId) {
                return null;
            }
            if (normalizedExpectedType && normalizedType !== normalizedExpectedType) {
                return null;
            }
            if (normalizedExpectedId && normalizedId !== normalizedExpectedId) {
                return null;
            }
            if (Number.isFinite(storedAt) && storedAt > 0 && (Date.now() - storedAt) > EDITOR_PREFILL_MAX_AGE_MS) {
                return null;
            }
            return {
                type: normalizedType,
                id: normalizedId,
                folder: payload?.folder && typeof payload.folder === 'object'
                    ? normalizeFolderRecordForEditor(payload.folder)
                    : null
            };
        } catch (_error) {
            return null;
        }
    };
    try {
        if (typeof sessionStorage !== 'undefined') {
            const sessionPayload = parsePrefillPayload(sessionStorage.getItem(EDITOR_PREFILL_STORAGE_KEY));
            if (sessionPayload) {
                return sessionPayload;
            }
        }
        if (typeof localStorage !== 'undefined') {
            const localPayload = parsePrefillPayload(localStorage.getItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY));
            if (localPayload) {
                return localPayload;
            }
        }
    } catch (_error) {
        return null;
    }
    return null;
};
const clearEditorNavigationPrefill = () => {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(EDITOR_PREFILL_STORAGE_KEY);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY);
        }
        if (String(window.name || '').startsWith(EDITOR_WINDOW_NAME_PREFIX)) {
            window.name = '';
        }
        document.cookie = `${EDITOR_BOOTSTRAP_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    } catch (_error) {
        // Ignore storage cleanup issues.
    }
};

const escapeHtml = (value) => {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const buildParentSmartDefaults = (parentFolder) => {
    const source = parentFolder && typeof parentFolder === 'object' ? parentFolder : {};
    const settings = source?.settings && typeof source.settings === 'object' ? source.settings : {};
    return {
        icon: String(source?.icon || '').trim(),
        preview: Number.isFinite(Number(settings.preview)) ? String(settings.preview) : '',
        preview_status: normalizePreviewStatusMode(settings.preview_status),
        preview_hover: settings.preview_hover === true,
        preview_hover_animation: normalizePreviewHoverAnimation(settings.preview_hover_animation || settings.previewHoverAnimation),
        previewHoverAnimation: normalizePreviewHoverAnimation(settings.preview_hover_animation || settings.previewHoverAnimation),
        preview_border: isLegacyPreviewBorderEnabled(settings),
        preview_border_color: normalizeHexColor(settings.preview_border_color, DEFAULT_BORDER_COLOR),
        preview_border_width: normalizePositiveInt(settings.preview_border_width, DEFAULT_PREVIEW_BORDER_WIDTH, 1, 4),
        preview_border_glow: settings.preview_border_glow === true || settings.previewBorderGlow === true,
        preview_vertical_bars: settings.preview_vertical_bars === true,
        preview_vertical_bars_color: normalizeHexColor(
            settings.preview_vertical_bars_color || settings.preview_border_color,
            DEFAULT_BORDER_COLOR
        ),
        preview_vertical_bars_width: normalizePositiveInt(settings.preview_vertical_bars_width, DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH, 1, 4),
        folder_update_highlight: settings.folder_update_highlight === true || settings.folderUpdateHighlight === true,
        preview_overflow: ['expand_row', 'scroll'].includes(String(settings.preview_overflow || settings.previewOverflow))
            ? String(settings.preview_overflow || settings.previewOverflow)
            : 'default',
        preview_row_separator: settings.preview_row_separator === true || settings.previewRowSeparator === true,
        preview_row_separator_color: normalizeHexColor(settings.preview_row_separator_color, DEFAULT_BORDER_COLOR),
        dropdown_style: normalizeDropdownStyle(settings),
        dropdown_color: normalizeHexColor(settings.dropdown_color, DEFAULT_DROPDOWN_COLOR),
        dropdown_hover_color: normalizeHexColor(settings.dropdown_hover_color, DEFAULT_DROPDOWN_HOVER_COLOR),
        folder_accent_enabled: isFolderAccentEnabled(settings),
        folder_accent_color: normalizeHexColor(settings.folder_accent_color, DEFAULT_FOLDER_ACCENT_COLOR),
        status_color_started: utils?.getFolderStatusColors?.(settings)?.started || normalizeHexColor(settings.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started),
        status_color_paused: normalizeHexColor(settings.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused),
        status_color_stopped: normalizeHexColor(settings.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped), status_color_text: normalizeHexColor(settings.status_color_text, DEFAULT_FOLDER_STATUS_COLORS.text), status_color_text_auto: !isFolderStatusTextColorExplicit(settings),
        status_color_lock: settings.status_color_lock === true || settings.statusColorLock === true
    };
};

const parseJsonPayload = (value, context = 'response') => {
    if (value && typeof value === 'object') {
        return value;
    }
    if (typeof value !== 'string') {
        throw new Error(`Unexpected ${context} type.`);
    }
    const normalized = value.replace(/^\uFEFF/, '').trim();
    if (!normalized) {
        throw new Error(`${context} returned an empty response.`);
    }
    try {
        return JSON.parse(normalized);
    } catch (_error) {
        const start = normalized.indexOf('{');
        const end = normalized.lastIndexOf('}');
        if (start >= 0 && end > start) {
            const candidate = normalized.slice(start, end + 1);
            try {
                return JSON.parse(candidate);
            } catch (_ignored) {
                // Keep flowing to the structured error below.
            }
        }
        throw new Error(`Invalid JSON from ${context}.`);
    }
};

const extractAjaxErrorMessage = (error, context = 'request') => {
    const responseText = String(
        error?.jqXHR?.responseText
        || error?.responseText
        || ''
    ).trim();
    if (responseText) {
        try {
            const payload = parseJsonPayload(responseText, context);
            const serverMessage = String(payload?.error || '').trim();
            if (serverMessage) {
                return serverMessage;
            }
        } catch (_parseError) {
            // Keep falling back to HTTP-level details.
        }
    }

    const status = Number(error?.jqXHR?.status || error?.status || 0);
    if (status > 0) {
        const statusText = String(error?.jqXHR?.statusText || error?.statusText || '').trim();
        return statusText ? `Request failed. HTTP ${status} ${statusText}.` : `Request failed. HTTP ${status}.`;
    }

    const textStatus = String(error?.textStatus || '').trim();
    if (textStatus) {
        return `Request failed (${textStatus}).`;
    }

    const thrown = String(error?.errorThrown || '').trim();
    if (thrown) {
        return `Request failed (${thrown}).`;
    }

    const message = String(error?.message || '').trim();
    if (message) {
        return message;
    }

    return `Request failed for ${context}.`;
};

const getFolderEditorRulesApi = () => {
    if (folderEditorRulesApi || typeof folderEditorRulesModule?.createApi !== 'function') {
        return folderEditorRulesApi;
    }
    folderEditorRulesApi = folderEditorRulesModule.createApi({
        window,
        document,
        $,
        requestClient,
        swal,
        type,
        utils,
        escapeHtml,
        extractAjaxErrorMessage,
        getActiveFolderId: () => activeFolderEditorFolderId,
        getLegacyRuleContext: () => ({
            pattern: String(getForm()?.regex?.value || ''),
            items: getAllMembers().map((item) => ({ ...item, Type: type })),
            folders: allFoldersById
        }),
        hasUnsavedChanges: () => getAllChangedItems().length > 0,
        onLegacyRegexConverted: () => {
            const regexInput = getForm()?.regex;
            if (regexInput) {
                regexInput.value = '';
            }
            suppressUnloadPrompt = true;
            location.reload();
        },
        ruleConfig: getFolderEditorTypeApi()?.getRulesConfig?.() || null
    });
    return folderEditorRulesApi;
};

const refreshFolderAutoRulesPanel = (options = {}) => {
    const api = getFolderEditorRulesApi();
    if (api && typeof api.refresh === 'function') {
        return api.refresh(options);
    }
    return Promise.resolve();
};

const fallbackPaginateItems = (items, page, pageSize) => {
    const source = Array.isArray(items) ? items : [];
    const safePageSize = Math.max(1, Number(pageSize) || 1);
    const totalPages = Math.max(1, Math.ceil(source.length / safePageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const startIndex = (safePage - 1) * safePageSize;
    const endIndex = Math.min(source.length, startIndex + safePageSize);
    return {
        page: safePage,
        totalPages,
        startIndex,
        endIndex,
        items: source.slice(startIndex, endIndex)
    };
};

const fallbackFilterIconsByQuery = (icons, query) => {
    const source = Array.isArray(icons) ? icons : [];
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) {
        return [...source];
    }
    return source.filter((icon) => {
        const name = String(icon?.name || '').toLowerCase();
        if (name.includes(needle)) {
            return true;
        }
        const tags = Array.isArray(icon?.tags) ? icon.tags : [];
        return tags.some((tag) => String(tag || '').toLowerCase().includes(needle));
    });
};

const iconPickerRuntime = window.FolderViewIconPickerRuntime || {
    paginateItems: fallbackPaginateItems,
    filterIconsByQuery: fallbackFilterIconsByQuery
};
const folderIconApi = folderIconApiModule && typeof folderIconApiModule.createApi === 'function'
    ? folderIconApiModule.createApi({
        window,
        document,
        $,
        requestClient,
        asArray,
        iconUploadApiPath: CUSTOM_ICON_UPLOAD_API_PATH,
        uploadMaxBytes: CUSTOM_ICON_UPLOAD_MAX_BYTES,
        allowedExtensions: CUSTOM_ICON_ALLOWED_EXTENSIONS,
        uploadContext: ICON_UPLOAD_ENDPOINT_CONTEXT,
        managerContext: CUSTOM_ICON_MANAGER_CONTEXT,
        builtInIconFallback: BUILT_IN_ICON_FALLBACK
    })
    : null;

const paginateItems = (items, page, pageSize) => iconPickerRuntime.paginateItems(items, page, pageSize);
const filterIconItems = (icons, query) => iconPickerRuntime.filterIconsByQuery(icons, query);

const securePost = async (url, data = {}) => folderIconApi.securePost(url, data);

const queueBackgroundMutationPost = (url, data = {}) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl || !requestClient || typeof requestClient.sendKeepalive !== 'function') {
        return false;
    }
    return requestClient.sendKeepalive(safeUrl, data);
};

const getIconInput = () => $(getForm()?.icon);

const getCurrentIconValue = () => String(getIconInput().val() || '').trim();

const setIconInputValue = (value) => {
    const input = getIconInput();
    if (!input.length) {
        return;
    }
    input.val(value || '');
    input.trigger('input');
    input.trigger('change');
};

const getFolderEditorIconsApi = () => {
    if (folderEditorIconsApi || typeof folderEditorIconsModule?.createApi !== 'function') {
        return folderEditorIconsApi;
    }
    folderEditorIconsApi = folderEditorIconsModule.createApi({
        window,
        document,
        $,
        requestClient,
        swal,
        folderIconApi,
        asArray,
        escapeHtml,
        sanitizeImageUrl: utils.sanitizeImageUrl,
        parseJsonPayload,
        paginateItems,
        filterIconItems,
        getForm,
        getIconInput,
        getCurrentIconValue,
        setIconInputValue,
        defaultFolderIconPath: DEFAULT_FOLDER_ICON_PATH,
        builtInIconManifestPath: BUILT_IN_ICON_MANIFEST_PATH,
        thirdPartyIconApiPath: THIRD_PARTY_ICON_API_PATH,
        iconFallbackPath: ICON_FALLBACK_PATH,
        iconPickerPageSize: ICON_PICKER_PAGE_SIZE,
        customIconPageSize: CUSTOM_ICON_PAGE_SIZE,
        iconPickerSearchDebounceMs: ICON_PICKER_SEARCH_DEBOUNCE_MS,
        customIconSearchDebounceMs: CUSTOM_ICON_SEARCH_DEBOUNCE_MS,
        thirdPartyIconSearchDebounceMs: THIRD_PARTY_ICON_SEARCH_DEBOUNCE_MS,
        thirdPartyRecentLimit: THIRD_PARTY_RECENT_LIMIT,
        thirdPartyLongPressPreviewMs: THIRD_PARTY_LONG_PRESS_PREVIEW_MS,
        thirdPartyGridChunkSize: THIRD_PARTY_GRID_CHUNK_SIZE,
        thirdPartyMinTagCount: THIRD_PARTY_MIN_TAG_COUNT,
        thirdPartyPlaceholderIcon: THIRD_PARTY_PLACEHOLDER_ICON,
        thirdPartyFavoritesStorageKey: THIRD_PARTY_FAVORITES_STORAGE_KEY,
        thirdPartyRecentStorageKey: THIRD_PARTY_RECENT_STORAGE_KEY,
        thirdPartyPinnedStorageKey: THIRD_PARTY_PINNED_STORAGE_KEY,
        thirdPartyHiddenStorageKey: THIRD_PARTY_HIDDEN_STORAGE_KEY,
        thirdPartyUsageStorageKey: THIRD_PARTY_USAGE_STORAGE_KEY,
        thirdPartyLastUsedStorageKey: THIRD_PARTY_LAST_USED_STORAGE_KEY,
        builtInIconFallback: BUILT_IN_ICON_FALLBACK
    });
    return folderEditorIconsApi;
};

const renderBuiltInIconPicker = () => { getFolderEditorIconsApi()?.renderBuiltInIconPicker(); };
const bindIconPickerEvents = async () => { await getFolderEditorIconsApi()?.bindIconPickerEvents(); };
const getAllMembers = () => {
    const map = new Map();
    [...selectedRegex, ...selected, ...choose].forEach((member) => {
        if (!map.has(member.Name)) map.set(member.Name, member);
    });
    return [...map.values()];
};
const getFolderWebuiProfilesApi = () => {
    if (folderWebuiProfilesApi || typeof folderWebuiProfilesModule?.createEditorApi !== 'function') return folderWebuiProfilesApi;
    folderWebuiProfilesApi = folderWebuiProfilesModule.createEditorApi({ window, document, form: getForm(), type, getMembers: getAllMembers, translate: folderEditorT });
    return folderWebuiProfilesApi;
};
const computeFormSnapshot = () => {
    const form = getForm();
    const state = {
        fields: {},
        members: [],
        childFolders: [],
        actions: $('input[name*="custom_action"]').map((_, el) => $(el).val()).get()
    };
    $(form).find(':input[name]').each((_, element) => {
        if (!element.name) {
            return;
        }
        const value = element.type === 'checkbox' ? element.checked : $(element).val();
        if (Object.prototype.hasOwnProperty.call(state.fields, element.name)) {
            if (!Array.isArray(state.fields[element.name])) {
                state.fields[element.name] = [state.fields[element.name]];
            }
            state.fields[element.name].push(value);
        } else {
            state.fields[element.name] = value;
        }
    });
    $('table.sortable > tbody > tr').each((_, row) => {
        const input = $(row).find('input.container-switch');
        state.members.push({
            name: $(row).attr('data-name') || '',
            included: input.prop('checked'),
            locked: input.prop('disabled'),
            previewVisible: $(row).find('input.member-preview-switch').prop('checked') === true
        });
    });
    state.childFolders = $('#fvFolderMembersBody > tr[data-child-folder-id]')
        .map((_, row) => String($(row).attr('data-child-folder-id') || '').trim())
        .get()
        .filter(Boolean);

    return JSON.stringify(state);
};
const getFolderEditorStateApi = () => {
    if (folderEditorStateApi || typeof folderEditorStateModule?.createApi !== 'function') {
        return folderEditorStateApi;
    }
    folderEditorStateApi = folderEditorStateModule.createApi({
        window,
        $,
        getForm,
        getInitialSnapshot: () => initialSnapshot,
        setInitialSnapshot: (value) => {
            initialSnapshot = String(value || '');
        },
        computeFormSnapshot,
        getAllChangedItems,
        getSectionChangeItems,
        parseSnapshotState,
        sectionMeta: SECTION_META,
        sectionFieldNames: SECTION_FIELD_NAMES,
        sectionDefaultValues: SECTION_DEFAULT_VALUES,
        inheritedFieldHints: INHERITED_FIELD_HINTS,
        setFormControlValue,
        updateForm: () => updateForm(),
        scheduleEditorRecalculation: (delayMs = 0) => scheduleEditorRecalculation(delayMs),
        getPreviewVerticalBarsDefaultColor: () => rgbToHex($('body').css('color')),
        escapeHtml
    });
    return folderEditorStateApi;
};

const getFolderSettingsTransferApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi || typeof folderSettingsTransferModule?.createApi !== 'function') {
            return cachedApi;
        }
        cachedApi = folderSettingsTransferModule.createApi({ window });
        return cachedApi;
    };
})();

const getFolderBulkAssignmentSharedApi = (() => {
    return () => {
        if (folderBulkAssignmentSharedApi || typeof bulkAssignmentSharedModule?.createApi !== 'function') {
            return folderBulkAssignmentSharedApi;
        }
        folderBulkAssignmentSharedApi = bulkAssignmentSharedModule.createApi({
            window,
            utils,
            getFolderMap: () => allFoldersById,
            getFolderNameForId: (_managedType, id) => String(allFoldersById?.[id]?.name || id || '').trim(),
            requestBulkAssign: async (managedType, folderId, items) => {
                if (!requestClient || typeof requestClient.postJson !== 'function') {
                    throw new Error('Bulk assignment request API unavailable.');
                }
                const response = await requestClient.postJson('/plugins/folderview.plus/server/bulk_assign.php', {
                    type: managedType,
                    folderId,
                    items: JSON.stringify(items || [])
                });
                if (!response?.ok) {
                    throw new Error(response?.error || 'Bulk assignment failed.');
                }
                return response.result || {};
            },
            createBackup: async (managedType, reason) => {
                if (!requestClient || typeof requestClient.postJson !== 'function') {
                    return null;
                }
                const response = await requestClient.postJson('/plugins/folderview.plus/server/backup.php', {
                    type: managedType,
                    action: 'create',
                    reason
                });
                if (!response?.ok) {
                    throw new Error(response?.error || 'Backup failed.');
                }
                return response.backup || null;
            }
        });
        return folderBulkAssignmentSharedApi;
    };
})();

const updateUnsavedIndicator = () => getFolderEditorStateApi()?.updateUnsavedIndicator() === true;

const markCleanState = () => {
    getFolderEditorStateApi()?.markCleanState();
};

const updateSectionStateIndicators = () => {
    getFolderEditorStateApi()?.updateSectionStateIndicators();
};

const updateChangeSummaryPanel = () => {
    getFolderEditorStateApi()?.updateChangeSummaryPanel();
};

const updateInheritedFieldIndicators = () => {
    getFolderEditorStateApi()?.updateInheritedFieldIndicators();
};

const restoreSectionSavedValues = (sectionKey) => {
    getFolderEditorStateApi()?.restoreSectionSavedValues(sectionKey);
};

const applySectionDefaults = (sectionKey) => {
    getFolderEditorStateApi()?.applySectionDefaults(sectionKey);
};

const applyEditorPluginDefaults = () => {
    getFolderEditorStateApi()?.applyEditorPluginDefaults();
};

const normalizeParentFolderId = (value) => String(value || '').trim();

const getFolderEditorPreviewRuntimeApi = () => {
    if (folderEditorPreviewRuntimeApi || typeof folderEditorPreviewRuntimeModule?.createApi !== 'function') {
        return folderEditorPreviewRuntimeApi;
    }
    const getActiveFolderIdsForNestedPreview = () => {
        const form = getForm();
        const candidateIds = [];
        const addCandidateId = (value) => {
            const safeId = String(value || '').trim();
            if (safeId && !candidateIds.includes(safeId)) {
                candidateIds.push(safeId);
            }
        };
        addCandidateId(activeFolderEditorResolvedFolderId);
        addCandidateId(activeFolderEditorFolderId);
        addCandidateId(folderId);
        const currentName = String(form?.name?.value || '').trim();
        const currentIcon = String(form?.icon?.value || '').trim();
        if (currentName) {
            for (const [candidateId, candidateFolder] of Object.entries(allFoldersById || {})) {
                if (!candidateFolder || typeof candidateFolder !== 'object') {
                    continue;
                }
                const normalizedFolder = normalizeFolderRecordForEditor(candidateFolder);
                if (String(normalizedFolder.name || '').trim() !== currentName) {
                    continue;
                }
                if (currentIcon && String(normalizedFolder.icon || '').trim() !== currentIcon) {
                    continue;
                }
                addCandidateId(candidateId);
            }
        }
        return candidateIds;
    };
    const getNestedPreviewSample = () => {
        const samples = getNestedPreviewSamples();
        return samples.length ? samples[0] : null;
    };
    const getNestedPreviewSamples = () => {
        const form = getForm();
        const sourceIds = getActiveFolderIdsForNestedPreview();
        if (!sourceIds.length) {
            return [];
        }
        const depthLimit = normalizeChildFolderPreviewDepth(form?.preview_child_folder_depth?.value || '0');
        const folders = allFoldersById || {};
        const getChildOrderForParent = (parentId) => {
            if (String(parentId || '').trim() === getActiveFolderIdForChildOrdering()) {
                return getFolderEditorMemberListApi().getChildFolderOrder();
            }
            const folderSettings = folders?.[parentId]?.settings || {};
            return normalizeChildFolderOrder(folderSettings.child_folder_order || folderSettings.childFolderOrder);
        };
        const getChildIds = (parentId) => {
            const rawIds = Object.entries(folders)
            .filter(([, candidateFolder]) => (
                candidateFolder && typeof candidateFolder === 'object'
                && normalizeParentFolderId(candidateFolder.parentId || candidateFolder.parent_id || '') === parentId
            ))
            .map(([candidateId]) => String(candidateId || '').trim())
            .filter(Boolean);
            const sourceIndex = new Map(rawIds.map((id, index) => [id, index]));
            const orderIndex = new Map(getChildOrderForParent(parentId).map((id, index) => [id, index]));
            return rawIds.sort((left, right) => {
                const leftOrder = orderIndex.has(left) ? orderIndex.get(left) : Number.MAX_SAFE_INTEGER;
                const rightOrder = orderIndex.has(right) ? orderIndex.get(right) : Number.MAX_SAFE_INTEGER;
                if (leftOrder !== rightOrder) {
                    return leftOrder - rightOrder;
                }
                return (sourceIndex.get(left) || 0) - (sourceIndex.get(right) || 0);
            });
        };
        const hasChildFolders = (parentId) => getChildIds(parentId).length > 0;
        const buildBreadcrumb = (sourceId, childId) => {
            const parts = [];
            const seen = new Set();
            let cursor = String(childId || '').trim();
            while (cursor && !seen.has(cursor)) {
                seen.add(cursor);
                const folderRecord = folders?.[cursor];
                const normalizedFolder = normalizeFolderRecordForEditor(folderRecord || {});
                parts.unshift(String(normalizedFolder?.name || cursor || '').trim());
                if (cursor === sourceId) {
                    break;
                }
                cursor = normalizeParentFolderId(folderRecord?.parentId || folderRecord?.parent_id || '');
            }
            if (!parts.length || parts[0] !== String(folders?.[sourceId]?.name || sourceId || '').trim()) {
                parts.unshift(String(folders?.[sourceId]?.name || sourceId || '').trim());
            }
            return parts.filter(Boolean);
        };
        for (const sourceId of sourceIds) {
            const result = [];
            const seen = new Set();
            const visit = (parentId, depth = 0) => {
                if (depthLimit > 0 && depth >= depthLimit) {
                    return;
                }
                for (const safeCandidateId of getChildIds(parentId)) {
                    if (!safeCandidateId || safeCandidateId === sourceId || seen.has(safeCandidateId)) {
                        continue;
                    }
                    const candidateFolder = folders?.[safeCandidateId];
                    if (!candidateFolder || typeof candidateFolder !== 'object') {
                        continue;
                    }
                    seen.add(safeCandidateId);
                    const normalizedChild = normalizeFolderRecordForEditor(candidateFolder);
                    result.push(folderPreviewModelModule.createChildFolderPreviewModel({
                        sourceId,
                        parentId,
                        rootId: sourceId,
                        childId: safeCandidateId,
                        childFolder: normalizedChild,
                        memberCount: Array.isArray(normalizedChild.containers) ? normalizedChild.containers.length : 0,
                        depth,
                        breadcrumb: buildBreadcrumb(sourceId, safeCandidateId),
                        hasChildren: hasChildFolders(safeCandidateId)
                    }));
                    visit(safeCandidateId, depth + 1);
                }
            };
            visit(sourceId, 0);
            if (result.length) {
                return result;
            }
        }
        return [];
    };
    folderEditorPreviewRuntimeApi = folderEditorPreviewRuntimeModule.createApi({
        window,
        $,
        previewModule: folderEditorPreview,
        type,
        getForm,
        getIncludedMemberNames,
        getPreviewMemberNames,
        getMemberMapByName,
        getAllMembers,
        normalizePreviewRowLimit,
        normalizeDropdownStyle,
        normalizeHexColor,
        normalizePositiveInt,
        getDropdownStyleTokens,
        buildSampleMemberState,
        normalizeParentFolderId,
        getPreviewSignals: (context = {}) => getFolderEditorTypeApi()?.getPreviewSignals?.(context) || null,
        getNestedPreviewSample,
        getNestedPreviewSamples,
        previewModelModule: folderPreviewModelModule,
        applyTypePreviewConstraints: ({ $, form } = {}) => {
            getFolderEditorTypeApi()?.applyPreviewConstraints?.({ $, form });
        },
        escapeHtml,
        updateMemberStats: () => updateMemberStats(),
        updateInheritedFieldIndicators: () => updateInheritedFieldIndicators(),
        updateChangeSummaryPanel: () => updateChangeSummaryPanel(),
        updateSectionStateIndicators: () => updateSectionStateIndicators(),
        defaultBorderColor: DEFAULT_BORDER_COLOR,
        defaultPreviewBorderWidth: DEFAULT_PREVIEW_BORDER_WIDTH,
        defaultPreviewVerticalBarsWidth: DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,
        defaultDropdownColor: DEFAULT_DROPDOWN_COLOR,
        defaultDropdownHoverColor: DEFAULT_DROPDOWN_HOVER_COLOR,
        defaultFolderAccentColor: DEFAULT_FOLDER_ACCENT_COLOR,
        defaultFolderIconPath: DEFAULT_FOLDER_ICON_PATH,
        defaultFolderStatusColors: DEFAULT_FOLDER_STATUS_COLORS,
        iconFallbackPath: ICON_FALLBACK_PATH,
        previewModeLabels: PREVIEW_MODE_LABELS,
        contextModeLabels: CONTEXT_MODE_LABELS,
        supportedDropdownStyles: SUPPORTED_DROPDOWN_STYLES,
        defaultDividerColor: rgbToHex($('body').css('color')),
        isFolderAccentEnabled
    });
    return folderEditorPreviewRuntimeApi;
};

const markUnsavedIndicatorDirty = () => {
    if (!initialSnapshot) {
        return;
    }
    $('#unsavedIndicator').show();
};

const runEditorRecalculation = () => {
    validateForm();
    updateLiveSummary();
    updateRegexSimulator();
    updateUnsavedIndicator();
    updateSectionStateIndicators();
    updateChangeSummaryPanel();
};

const scheduleEditorPreviewRender = () => {
    getFolderEditorPreviewRuntimeApi()?.schedulePreviewRender();
};

const scheduleEditorRecalculation = (delayMs = 0) => {
    const run = () => {
        editorRecalcTimer = null;
        runEditorRecalculation();
    };
    if (editorRecalcTimer) {
        clearTimeout(editorRecalcTimer);
        editorRecalcTimer = null;
    }
    if (!Number.isFinite(Number(delayMs)) || Number(delayMs) <= 0) {
        run();
        return;
    }
    editorRecalcTimer = setTimeout(run, Number(delayMs));
};

const runNameDrivenRegexSync = () => {
    nameRegexSyncTimer = null;
    const form = getForm();
    if (!form) {
        return;
    }
    const nextName = String(form.name?.value || '').trim();
    if (nextName === lastNameRegexSyncValue) {
        return;
    }
    lastNameRegexSyncValue = nextName;
    updateRegex(form.regex, { immediate: true });
};

const scheduleNameDrivenRegexSync = (mode = 'debounced') => {
    if (nameRegexSyncTimer) {
        clearTimeout(nameRegexSyncTimer);
        nameRegexSyncTimer = null;
    }
    if (mode === 'immediate') {
        runNameDrivenRegexSync();
        return;
    }
    nameRegexSyncTimer = setTimeout(runNameDrivenRegexSync, NAME_REGEX_SYNC_DEBOUNCE_MS);
};

const registerBeforeUnloadGuard = () => {
    window.addEventListener('beforeunload', (event) => {
        if (suppressUnloadPrompt || !updateUnsavedIndicator()) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    });
};
const registerFolderEditorModuleTeardown = () => {
    window.addEventListener('pagehide', () => {
        folderThemeSurfaceBinding?.disconnect();
        folderEditorRegexSelectionApi?.dispose();
        folderEditorMemberListApi?.dispose();
        folderWebuiProfilesApi?.dispose();
    }, { once: true });
};

const resetStatusColorDefaults = () => {
    const form = $('div.canvas > form')[0];
    form.status_color_started.value = DEFAULT_FOLDER_STATUS_COLORS.started;
    form.status_color_paused.value = DEFAULT_FOLDER_STATUS_COLORS.paused;
    form.status_color_stopped.value = DEFAULT_FOLDER_STATUS_COLORS.stopped; form.status_color_text.value = DEFAULT_FOLDER_STATUS_COLORS.text; if (form.status_color_text_auto) form.status_color_text_auto.checked = true;
    if (typeof scheduleEditorRecalculation === 'function') {
        scheduleEditorRecalculation(0);
    }
};
window.resetStatusColorDefaults = resetStatusColorDefaults;

const folderEditorResetHelpers = typeof folderEditorShared?.createResetHelpers === 'function'
    ? folderEditorShared.createResetHelpers({
        getForm: () => $('div.canvas > form')[0] || null,
        defaultBorderColor: DEFAULT_BORDER_COLOR,
        defaultPreviewBorderWidth: DEFAULT_PREVIEW_BORDER_WIDTH,
        defaultDropdownColor: DEFAULT_DROPDOWN_COLOR,
        defaultDropdownHoverColor: DEFAULT_DROPDOWN_HOVER_COLOR,
        defaultFolderAccentColor: DEFAULT_FOLDER_ACCENT_COLOR,
        afterVisualChange: () => {
            if (typeof scheduleEditorRecalculation === 'function') {
                scheduleEditorRecalculation(0);
            }
        },
        updateLiveSummary: () => updateLiveSummary()
    })
    : null;

const resetPreviewBorderDefaults = typeof folderEditorResetHelpers?.resetPreviewBorderDefaults === 'function'
    ? folderEditorResetHelpers.resetPreviewBorderDefaults
    : (() => {
        const form = $('div.canvas > form')[0];
        form.preview_border_color.value = DEFAULT_BORDER_COLOR;
        form.preview_border_width.value = String(DEFAULT_PREVIEW_BORDER_WIDTH);
        if (typeof scheduleEditorRecalculation === 'function') {
            scheduleEditorRecalculation(0);
        }
        updateLiveSummary();
    });
window.resetPreviewBorderDefaults = resetPreviewBorderDefaults;

const resetPreviewBarDefaults = () => {
    const form = $('div.canvas > form')[0];
    form.preview_vertical_bars_color.value = rgbToHex($('body').css('color'));
    form.preview_vertical_bars_width.value = String(DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH);
    if (typeof scheduleEditorRecalculation === 'function') {
        scheduleEditorRecalculation(0);
    }
};
window.resetPreviewBarDefaults = resetPreviewBarDefaults;

const resetDropdownColorDefaults = typeof folderEditorResetHelpers?.resetDropdownColorDefaults === 'function'
    ? folderEditorResetHelpers.resetDropdownColorDefaults
    : (() => {
        const form = $('div.canvas > form')[0];
        form.dropdown_color.value = DEFAULT_DROPDOWN_COLOR;
        form.dropdown_hover_color.value = DEFAULT_DROPDOWN_HOVER_COLOR;
        if (typeof scheduleEditorRecalculation === 'function') {
            scheduleEditorRecalculation(0);
        }
        updateLiveSummary();
    });
window.resetDropdownColorDefaults = resetDropdownColorDefaults;

const resetFolderAccentDefaults = typeof folderEditorResetHelpers?.resetFolderAccentDefaults === 'function'
    ? folderEditorResetHelpers.resetFolderAccentDefaults
    : (() => {
        const form = $('div.canvas > form')[0];
        form.folder_accent_enabled.checked = false;
        form.folder_accent_color.value = DEFAULT_FOLDER_ACCENT_COLOR;
        if (typeof scheduleEditorRecalculation === 'function') {
            scheduleEditorRecalculation(0);
        }
        updateLiveSummary();
    });
window.resetFolderAccentDefaults = resetFolderAccentDefaults;

const setFieldError = (fieldName, message) => {
    const form = getForm();
    const input = $(form?.elements?.[fieldName]);
    if (!input.length) {
        return;
    }
    const dd = input.closest('dd');
    if (!dd.length) {
        return;
    }

    let error = dd.find(`.fv-field-error[data-field="${fieldName}"]`);
    if (!error.length) {
        error = $(`<div class="fv-field-error" data-field="${fieldName}" data-fvplus-style="fv-u-xcjvns"></div>`);
        dd.append(error);
    }

    if (message) {
        error.text(message).show();
        input.addClass('fv-input-error');
    } else {
        error.hide().text('');
        input.removeClass('fv-input-error');
    }
};

const validateNameField = () => {
    const form = getForm();
    const value = (form.name.value || '').trim();

    if (!value) {
        setFieldError('name', 'Folder name is required.');
        return false;
    }

    if (INVALID_FOLDER_NAME_CHAR_REGEX.test(value)) {
        setFieldError('name', 'Folder name cannot contain control characters.');
        return false;
    }

    const parentId = normalizeParentFolderId(form.parent_folder_id?.value || '');
    const collision = getSiblingNameCollision(value, parentId, folderId || '');
    if (collision) {
        const suggestion = suggestSiblingName(value, parentId, folderId || '');
        const parentLabel = parentId ? 'this parent folder' : 'top level';
        setFieldError('name', `A sibling with this name already exists under ${parentLabel}. Try "${suggestion}".`);
        return false;
    }

    setFieldError('name', '');
    return true;
};

const validateRegexField = () => {
    const form = getForm();
    const value = (form.regex.value || '').trim();
    if (!value) {
        setFieldError('regex', '');
        return true;
    }
    try {
        // eslint-disable-next-line no-new
        new RegExp(value);
        setFieldError('regex', '');
        return true;
    } catch (error) {
        setFieldError('regex', `Invalid regex: ${error.message}`);
        return false;
    }
};

const validateFolderWebUiUrl = () => {
    const form = getForm();
    const enabled = form.folder_webui.checked;
    const value = (form.folder_webui_url.value || '').trim();
    if (!enabled || !value) {
        setFieldError('folder_webui_url', '');
        return true;
    }
    try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) {
            throw new Error('URL must start with http:// or https://');
        }
        setFieldError('folder_webui_url', '');
        return true;
    } catch (error) {
        setFieldError('folder_webui_url', `Invalid URL: ${error.message}`);
        return false;
    }
};

const validateContextGraphTime = () => {
    const form = getForm();
    const contextIsAdvanced = form.context.value === '2';
    const graphEnabled = form.context_graph.value !== '0';
    const value = Number(form.context_graph_time.value || 0);
    if (!contextIsAdvanced || !graphEnabled) {
        setFieldError('context_graph_time', '');
        return true;
    }
    if (!Number.isInteger(value) || value <= 0) {
        setFieldError('context_graph_time', 'Time frame must be a positive integer.');
        return false;
    }
    setFieldError('context_graph_time', '');
    return true;
};

const normalizeOptionalHealthSelect = (value, allowedValues) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
        return '';
    }
    return Array.isArray(allowedValues) && allowedValues.includes(normalized)
        ? normalized
        : '';
};

const parseOptionalThresholdInput = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return '';
    }
    return Math.min(100, Math.max(0, Math.round(parsed)));
};

const normalizeDashboardOverflowMode = typeof utils?.normalizeDashboardOverflowMode === 'function'
    ? utils.normalizeDashboardOverflowMode
    : ((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['default', 'expand_row', 'scroll'].includes(normalized)
            ? normalized
            : 'default';
    });

let folderEditorSharedApi = null;
const getFolderEditorSharedApi = () => {
    if (folderEditorSharedApi || typeof folderEditorShared?.createApi !== 'function') {
        return folderEditorSharedApi;
    }
    folderEditorSharedApi = folderEditorShared.createApi({
        defaultFolderName: 'Folder',
        defaultFolderIconPath: DEFAULT_FOLDER_ICON_PATH,
        defaultBorderColor: DEFAULT_BORDER_COLOR,
        defaultPreviewBorderWidth: DEFAULT_PREVIEW_BORDER_WIDTH,
        defaultPreviewVerticalBarsWidth: DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,
        defaultDropdownStyle: DEFAULT_DROPDOWN_STYLE,
        defaultDropdownColor: DEFAULT_DROPDOWN_COLOR,
        defaultDropdownHoverColor: DEFAULT_DROPDOWN_HOVER_COLOR,
        defaultFolderAccentColor: DEFAULT_FOLDER_ACCENT_COLOR,
        defaultFolderStatusColors: DEFAULT_FOLDER_STATUS_COLORS,
        healthProfileValues: FOLDER_HEALTH_PROFILE_VALUES,
        healthUpdatesModeValues: FOLDER_HEALTH_UPDATES_MODE_VALUES,
        healthAllStoppedModeValues: FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES,
        normalizeDashboardOverflowMode,
        extractPreviewRowLimitValue: typeof folderContract?.extractPreviewRowLimitValue === 'function' ? folderContract.extractPreviewRowLimitValue : null,
        normalizePreviewRowLimit: typeof folderContract?.normalizePreviewRowLimit === 'function' ? folderContract.normalizePreviewRowLimit : null,
        normalizeParentFolderId,
        asArray,
        normalizeHexColor,
        normalizePositiveInt,
        normalizeDropdownStyle,
        isPreviewBorderEnabled: isLegacyPreviewBorderEnabled,
        isFolderAccentEnabled
    });
    return folderEditorSharedApi;
};

const extractPreviewRowLimitValue = (value, fallbackSource = null) => {
    const sharedApi = getFolderEditorSharedApi();
    if (typeof sharedApi?.extractPreviewRowLimitValue === 'function') {
        return sharedApi.extractPreviewRowLimitValue(value, fallbackSource);
    }
    const sources = [value, fallbackSource];
    for (const source of sources) {
        if (source && typeof source === 'object') {
            const candidate = source.preview_rows
                ?? source.previewRows;
            if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
                return candidate;
            }
        } else if (source !== undefined && source !== null && String(source).trim() !== '') {
            return source;
        }
    }
    return '';
};

const normalizePreviewRowLimit = (value, fallbackSource = null) => {
    const sharedApi = getFolderEditorSharedApi();
    if (typeof sharedApi?.normalizePreviewRowLimit === 'function') {
        return sharedApi.normalizePreviewRowLimit(value, fallbackSource);
    }
    const normalized = String(extractPreviewRowLimitValue(value, fallbackSource) ?? '').trim().toLowerCase();
    if (normalized === '0' || normalized === 'auto' || normalized === 'unlimited') {
        return 0;
    }
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) {
        return 1;
    }
    return Math.max(1, Math.min(4, parsed));
};
const normalizeChildFolderPreviewDepth = (value, fallbackSource = null) => {
    const sharedApi = getFolderEditorSharedApi();
    if (typeof sharedApi?.normalizeChildFolderPreviewDepth === 'function') {
        return sharedApi.normalizeChildFolderPreviewDepth(value, fallbackSource);
    }
    const normalized = String(value ?? fallbackSource?.preview_child_folder_depth ?? fallbackSource?.previewChildFolderDepth ?? '').trim().toLowerCase();
    if (normalized === '0' || normalized === 'all' || normalized === 'unlimited') {
        return 0;
    }
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(3, parsed)) : 0;
};

const normalizeFolderRecordForEditor = (folder) => {
    const sharedApi = getFolderEditorSharedApi();
    if (typeof sharedApi?.normalizeFolderRecordForEditor !== 'function') {
        return folder;
    }
    const normalized = sharedApi.normalizeFolderRecordForEditor(folder);
    normalized.settings = {
        ...normalized.settings,
        dropdownStyle: normalized.settings.dropdown_style,
        chevron_style: normalized.settings.dropdown_style,
        chevronStyle: normalized.settings.dropdown_style
    };
    return normalized;
};

const createEmptyFolderEditorTypeApi = () => Object.freeze({});

const resolveFolderEditorTypeModule = () => {
    if (type === 'docker') {
        return folderEditorTypeDockerModule;
    }
    if (type === 'vm') {
        return folderEditorTypeVmModule;
    }
    return null;
};

const getFolderEditorTypeApi = () => {
    if (folderEditorTypeApi) {
        return folderEditorTypeApi;
    }
    const typeModule = resolveFolderEditorTypeModule();
    if (!typeModule || typeof typeModule.createApi !== 'function') {
        folderEditorTypeApi = createEmptyFolderEditorTypeApi();
        return folderEditorTypeApi;
    }
    folderEditorTypeApi = typeModule.createApi({
        normalizeFolderRecordForEditor,
        queueBackgroundMutationPost,
        securePost,
        syncType: type,
        getFolderLabelValue,
        getComposeProjectFromLabels,
        isDockerUpdateAvailableInEditor
    });
    if (!folderEditorTypeApi || typeof folderEditorTypeApi !== 'object') {
        folderEditorTypeApi = createEmptyFolderEditorTypeApi();
    }
    return folderEditorTypeApi;
};

const flushPostSaveTypeSync = async (options = {}) => {
    const typeApi = getFolderEditorTypeApi();
    if (!typeApi || typeof typeApi.flushPostSaveSync !== 'function') {
        return;
    }
    await typeApi.flushPostSaveSync(options);
};

const validateHealthWarnThreshold = () => {
    const form = getForm();
    const input = form.health_warn_stopped_percent;
    if (!input) {
        return true;
    }
    const raw = String(input.value || '').trim();
    if (!raw) {
        setFieldError('health_warn_stopped_percent', '');
        return true;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setFieldError('health_warn_stopped_percent', 'Threshold must be an integer between 0 and 100.');
        return false;
    }
    setFieldError('health_warn_stopped_percent', '');
    return true;
};

const validateHealthCriticalThreshold = () => {
    const form = getForm();
    const input = form.health_critical_stopped_percent;
    if (!input) {
        return true;
    }
    const raw = String(input.value || '').trim();
    if (!raw) {
        setFieldError('health_critical_stopped_percent', '');
        return true;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setFieldError('health_critical_stopped_percent', 'Threshold must be an integer between 0 and 100.');
        return false;
    }
    const warnRaw = String(form.health_warn_stopped_percent?.value || '').trim();
    if (warnRaw) {
        const warnParsed = Number(warnRaw);
        if (Number.isFinite(warnParsed) && parsed < Math.min(100, Math.max(0, Math.round(warnParsed))) + 5) {
            setFieldError('health_critical_stopped_percent', 'Critical threshold should be at least 5 points above warn threshold.');
            return false;
        }
    }
    setFieldError('health_critical_stopped_percent', '');
    return true;
};

const validateHealthPolicySelects = () => {
    const form = getForm();
    if (!form) {
        return true;
    }
    const profile = normalizeOptionalHealthSelect(form.health_profile?.value, FOLDER_HEALTH_PROFILE_VALUES);
    const updatesMode = normalizeOptionalHealthSelect(form.health_updates_mode?.value, FOLDER_HEALTH_UPDATES_MODE_VALUES);
    const allStoppedMode = normalizeOptionalHealthSelect(form.health_all_stopped_mode?.value, FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES);
    const profileOk = String(form.health_profile?.value || '').trim() === '' || profile !== '';
    const updatesOk = String(form.health_updates_mode?.value || '').trim() === '' || updatesMode !== '';
    const allStoppedOk = String(form.health_all_stopped_mode?.value || '').trim() === '' || allStoppedMode !== '';

    setFieldError('health_profile', profileOk ? '' : 'Choose strict, balanced, lenient, or leave blank for global.');
    setFieldError('health_updates_mode', updatesOk ? '' : 'Choose maintenance, warn, ignore, or leave blank for global.');
    setFieldError('health_all_stopped_mode', allStoppedOk ? '' : 'Choose critical, warn, or leave blank for global.');
    return profileOk && updatesOk && allStoppedOk;
};

const validateStatusWarnThreshold = () => {
    const form = getForm();
    const input = form.status_warn_stopped_percent;
    if (!input) {
        return true;
    }
    const raw = String(input.value || '').trim();
    if (!raw) {
        setFieldError('status_warn_stopped_percent', '');
        return true;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setFieldError('status_warn_stopped_percent', 'Threshold must be an integer between 0 and 100.');
        return false;
    }
    setFieldError('status_warn_stopped_percent', '');
    return true;
};

const validateParentFolderSelection = () => {
    const form = getForm();
    if (!form || !form.parent_folder_id) {
        return true;
    }
    const parentId = normalizeParentFolderId(form.parent_folder_id.value);
    if (!parentId) {
        setFieldError('parent_folder_id', '');
        return true;
    }
    if (folderId && parentId === folderId) {
        setFieldError('parent_folder_id', 'A folder cannot be its own parent.');
        return false;
    }
    if (folderHierarchyState.currentFolderDescendantIds.has(parentId)) {
        setFieldError('parent_folder_id', 'A folder cannot be nested under one of its own children.');
        return false;
    }
    if (!Object.prototype.hasOwnProperty.call(allFoldersById, parentId)) {
        setFieldError('parent_folder_id', 'Selected parent folder no longer exists.');
        return false;
    }
    setFieldError('parent_folder_id', '');
    return true;
};

const isLikelyIconPath = (value) => {
    const source = String(value || '').trim();
    if (!source) {
        return false;
    }
    if (source.startsWith('/plugins/')) {
        return true;
    }
    if (/^https?:\/\//i.test(source)) {
        return true;
    }
    if (/^data:image\//i.test(source)) {
        return true;
    }
    return false;
};

const collectValidationWarnings = () => {
    const form = getForm();
    if (!form) {
        return [];
    }
    const warnings = [];
    const iconValue = String(form.icon.value || '').trim();
    const checkedCount = Number($('input[name*="containers"]:checked').length || 0);
    const statusThresholdRaw = String(form.status_warn_stopped_percent?.value || '').trim();
    const healthThresholdRaw = String(form.health_warn_stopped_percent?.value || '').trim();
    const healthCriticalThresholdRaw = String(form.health_critical_stopped_percent?.value || '').trim();
    const updatesMode = normalizeOptionalHealthSelect(form.health_updates_mode?.value, FOLDER_HEALTH_UPDATES_MODE_VALUES);

    if (iconValue && !isLikelyIconPath(iconValue)) {
        warnings.push('Icon path looks unusual. Use /plugins/, http(s)://, or data:image/* for best compatibility.');
    }
    if (checkedCount === 0) {
        warnings.push(NO_MEMBERS_SELECTED_INFO);
    }
    if (statusThresholdRaw && Number(statusThresholdRaw) >= 95) {
        warnings.push('Status warn threshold is very high and may hide stopped-state alerts.');
    }
    if (healthThresholdRaw && Number(healthThresholdRaw) >= 95) {
        warnings.push('Health warn threshold is very high and may reduce health visibility.');
    }
    if (healthCriticalThresholdRaw && Number(healthCriticalThresholdRaw) <= 40) {
        warnings.push('Health critical threshold is low and may trigger frequent critical alerts.');
    }
    if (updatesMode === 'ignore') {
        warnings.push('Health updates mode is set to ignore; pending image updates will not affect health.');
    }
    return warnings;
};

const validateForm = () => {
    const checks = [
        validateNameField(),
        validateParentFolderSelection(),
        validateRegexField(),
        validateFolderWebUiUrl(),
        getFolderWebuiProfilesApi()?.validate() !== false,
        validateContextGraphTime(),
        validateHealthWarnThreshold(),
        validateHealthCriticalThreshold(),
        validateHealthPolicySelects(),
        validateStatusWarnThreshold()
    ];
    const valid = checks.every(Boolean);
    const blockedCount = checks.filter((ok) => !ok).length;
    const warnings = collectValidationWarnings();
    const infoWarnings = warnings.filter((line) => line === NO_MEMBERS_SELECTED_INFO);
    const advisoryWarnings = warnings.filter((line) => line !== NO_MEMBERS_SELECTED_INFO);

    const summary = $('#fvValidationSummary');
    const details = $('#fvValidationDetails');
    if (summary.length) {
        summary.removeClass('invalid warning info ready');
        if (!valid) {
            summary.addClass('invalid').text(`Blocked: fix ${blockedCount} field issue${blockedCount === 1 ? '' : 's'} before saving.`);
        } else if (advisoryWarnings.length > 0) {
            summary.addClass('warning').text(`Warning: ${advisoryWarnings.length} recommendation${advisoryWarnings.length === 1 ? '' : 's'} available.`);
        } else if (infoWarnings.length > 0) {
            summary.addClass('info').text(`Info: ${infoWarnings.length} note${infoWarnings.length === 1 ? '' : 's'} available.`);
        } else {
            summary.addClass('ready').text('Ready: all checks passed.');
        }
    }
    if (details.length) {
        if (!valid) {
            details
                .removeClass('warning info ready')
                .addClass('invalid')
                .text('Resolve highlighted field errors, then try saving again.');
        } else if (advisoryWarnings.length > 0) {
            const rendered = advisoryWarnings.slice(0, 3).map((line) => `- ${line}`).join('\n');
            details
                .removeClass('invalid info ready')
                .addClass('warning')
                .text(rendered);
        } else if (infoWarnings.length > 0) {
            const rendered = infoWarnings.slice(0, 3).map((line) => `- ${line}`).join('\n');
            details
                .removeClass('invalid warning ready')
                .addClass('info')
                .text(rendered);
        } else {
            details
                .removeClass('invalid warning info')
                .addClass('ready')
                .text('No warnings.');
        }
    }
    $('.folder-btn-submit, .folder-btn-apply-settings, .folder-btn-copy').prop('disabled', !valid);
    return valid;
};

const getMemberStateKey = (member, index = 0) => {
    const state = buildSampleMemberState(member, index);
    const normalized = String(state?.label || '').trim().toLowerCase();
    if (normalized === 'running' || normalized === 'started') {
        return 'running';
    }
    if (normalized === 'paused') {
        return 'paused';
    }
    return 'stopped';
};

const updateMemberStats = () => {
    const rows = $('table.sortable > tbody > tr');
    const total = rows.length;
    const included = rows.find('input.container-switch:checked').length;
    const visible = rows.filter(':visible').length;
    const manual = rows.filter('[data-membership="manual"]').length;
    const regex = rows.filter('[data-membership="regex"]').length;
    const available = rows.filter('[data-membership="available"]').length;
    const previewShown = rows.find('input.container-switch:checked').filter((_, input) => (
        $(input).closest('tr').find('input.member-preview-switch').prop('checked') === true
    )).length;
    const text = `${included}/${total} included (${previewShown} in preview)` + (visible !== total ? ` · ${visible} filtered` : '');
    $('#fvMemberStats').text(text);
    $('#fvLiveMembers').text(text);
    $('#fvHeroMembers').text(text);
    $('#fvMemberChipIncluded').text(`${included} included`);
    $('#fvMemberChipManual').text(`${manual} manual`);
    $('#fvMemberChipRegex').text(`${regex} regex`);
    $('#fvMemberChipAvailable').text(`${available} available`);
    updateMemberBulkMoveUi();
};

const getFolderEditorMembersApi = () => {
    if (folderEditorMembersApi || typeof folderEditorMembersModule?.createApi !== 'function') {
        return folderEditorMembersApi;
    }
    folderEditorMembersApi = folderEditorMembersModule.createApi({
        window,
        $,
        getAllMembers,
        setMemberCollections: ({ selected: nextSelected = [], choose: nextChoose = [], selectedRegex: nextSelectedRegex = [] } = {}) => {
            selected = nextSelected;
            choose = nextChoose;
            selectedRegex = nextSelectedRegex;
        },
        updateMemberStats: () => updateMemberStats(),
        validateForm: () => validateForm(),
        updateUnsavedIndicator: () => updateUnsavedIndicator(),
        updateLiveSummary: () => updateLiveSummary(),
        isFormInitialized: () => isFormInitialized === true
    });
    return folderEditorMembersApi;
};

const syncMemberSearchUiState = () => {
    getFolderEditorMembersApi()?.syncMemberSearchUiState();
};

const applyMemberFilters = () => {
    getFolderEditorMembersApi()?.applyMemberFilters();
};

const setVisibleMemberSelection = (checked) => {
    getFolderEditorMembersApi()?.setVisibleMemberSelection(checked);
};

const syncMemberArraysFromTable = () => {
    getFolderEditorMembersApi()?.syncMemberArraysFromTable();
};

const moveMemberRow = (button, direction) => {
    getFolderEditorMembersApi()?.moveMemberRow(button, direction);
};

const bindMemberDragReorder = () => {
    getFolderEditorMembersApi()?.bindMemberDragReorder();
};

const getFolderEditorMemberListApi = () => {
    if (folderEditorMemberListApi) {
        return folderEditorMemberListApi;
    }
    folderEditorMemberListApi = folderEditorMemberListModule.createApi({
        window,
        $,
        escapeHtml,
        translate: folderEditorT,
        getMemberStateKey,
        getMemberCollections: () => ({ selected, choose, selectedRegex, hiddenPreviewMembers }),
        getAllFolders: () => allFoldersById,
        getActiveFolderId: () => String(activeFolderEditorResolvedFolderId || activeFolderEditorFolderId || folderId || '').trim(),
        normalizeParentFolderId: (value) => getFolderHierarchyApi().normalizeParentFolderId(value),
        normalizeFolderRecord: normalizeFolderRecordForEditor,
        updateLiveSummary,
        updateUnsavedIndicator,
        moveMemberRow,
        bindMemberDragReorder,
        applyMemberFilters,
        updateMemberStats,
        updateRegexSimulator,
        validateForm,
        isFormInitialized: () => isFormInitialized,
        defaultFolderIconPath: DEFAULT_FOLDER_ICON_PATH,
        iconFallbackPath: ICON_FALLBACK_PATH,
        renderChunkSize: MEMBER_LIST_RENDER_CHUNK_SIZE
    });
    return folderEditorMemberListApi;
};

const getFolderEditorRegexSelectionApi = () => {
    if (folderEditorRegexSelectionApi) {
        return folderEditorRegexSelectionApi;
    }
    folderEditorRegexSelectionApi = folderEditorRegexSelectionModule.createApi({
        window,
        getRegexField: () => getFormField(getForm(), 'regex'),
        getFolderName: () => String(getFormField(getForm(), 'name')?.value || '').trim(),
        getMemberCollections: () => ({ selected, choose, selectedRegex }),
        setMemberCollections: ({ selected: nextSelected = [], choose: nextChoose = [], selectedRegex: nextSelectedRegex = [] } = {}) => {
            selected = nextSelected;
            choose = nextChoose;
            selectedRegex = nextSelectedRegex;
        },
        syncMemberArraysFromTable,
        updateList,
        updateRegexSimulator,
        isFormInitialized: () => isFormInitialized,
        workerMinItems: REGEX_WORKER_MIN_ITEMS,
        debounceMs: REGEX_INPUT_SYNC_DEBOUNCE_MS
    });
    return folderEditorRegexSelectionApi;
};

const normalizeEditorMode = () => 'advanced';

const getVisibleEditorSectionKeys = () => Object.entries(SECTION_META)
    .map(([key]) => key);

const normalizeActiveEditorSection = (sectionKey, mode = editorMode) => {
    const visibleSections = getVisibleEditorSectionKeys();
    const preferredSection = String(sectionKey || '').trim();
    if (visibleSections.includes(preferredSection)) {
        return preferredSection;
    }
    return visibleSections[0] || 'general';
};

const loadEditorModePreference = () => {
    return 'advanced';
};

const loadAdvancedCollapseState = () => {
    try {
        const raw = localStorage.getItem(EDITOR_ADVANCED_COLLAPSE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        const state = {};
        ADVANCED_SECTION_KEYS.forEach((key) => {
            state[key] = parsed[key] === true;
        });
        return state;
    } catch (_error) {
        return {};
    }
};

const saveAdvancedCollapseState = () => {
    try {
        localStorage.setItem(EDITOR_ADVANCED_COLLAPSE_STORAGE_KEY, JSON.stringify(advancedSectionCollapsedState || {}));
    } catch (_error) {
        // Ignore storage failures.
    }
};

const clearFieldToInheritedValue = (fieldName) => {
    const form = getForm();
    const field = getFormField(form, fieldName);
    if (!field) {
        return;
    }
    if (field.type === 'checkbox') {
        field.checked = false;
    } else {
        $(field).val('');
    }
    updateForm();
    scheduleEditorRecalculation(0);
};

const ensureInheritedFieldControls = () => {
    const form = getForm();
    if (!form) {
        return;
    }
    Object.keys(INHERITED_FIELD_HINTS).forEach((fieldName) => {
        const row = $(form).find(`.basic:has([name="${fieldName}"])`).first();
        const dt = row.find('dt').first();
        if (!row.length || !dt.length) {
            return;
        }
        let actions = dt.find('.fv-field-inherit-tools').first();
        if (!actions.length) {
            actions = $(`
                <span class="fv-field-inherit-tools">
                    <button type="button" class="fv-inherit-btn" data-field="${fieldName}">Use global</button>
                </span>
            `);
            dt.append(actions);
        }
    });
    $('.fv-inherit-btn').off('click').on('click', function onInheritClick() {
        const fieldName = String($(this).attr('data-field') || '').trim();
        if (!fieldName) {
            return;
        }
        clearFieldToInheritedValue(fieldName);
    });
};

const setActiveEditorSection = (sectionKey) => {
    activeEditorSection = normalizeActiveEditorSection(sectionKey, editorMode);
    applyAdvancedMode();
};

const toggleAdvancedSectionCollapse = (sectionKey) => {
    if (!ADVANCED_SECTION_KEYS.includes(String(sectionKey || ''))) {
        return;
    }
    advancedSectionCollapsedState[sectionKey] = !(advancedSectionCollapsedState[sectionKey] === true);
    saveAdvancedCollapseState();
    applyAdvancedMode();
};

const applyAdvancedMode = () => {
    editorMode = normalizeEditorMode();
    const showAdvanced = true;
    activeEditorSection = normalizeActiveEditorSection(activeEditorSection, editorMode);
    $('#fvHeroMode').text('All sections');

    Object.entries(SECTION_META).forEach(([key, meta]) => {
        const isAdvancedSection = meta?.advanced === true;
        const heading = $(`#fv-section-${key}`);
        const rows = $(`[data-editor-section="${key}"]`);
        const navButton = $(`.fv-section-nav > button[data-target="${key}"]`);
        const collapseButton = heading.find('.fv-section-collapse');
        const shell = $(`.fv-section-shell[data-section-shell="${key}"]`);

        const isActiveSection = activeEditorSection === key;
        shell.toggle(isActiveSection);
        navButton.show();
        navButton.toggleClass('is-active', isActiveSection);
        navButton.attr('data-active', isActiveSection ? 'true' : null);
        navButton.attr('aria-current', isActiveSection ? 'page' : null);
        const collapsed = showAdvanced && isAdvancedSection && advancedSectionCollapsedState[key] === true;
        heading.toggleClass('is-collapsed', collapsed);
        shell.toggleClass('is-collapsed', collapsed);
        if (collapseButton.length) {
            collapseButton.attr('aria-pressed', collapsed ? 'true' : 'false');
            collapseButton.html(`<i class="fa ${collapsed ? 'fa-plus-square-o' : 'fa-minus-square-o'}" aria-hidden="true"></i> ${collapsed ? 'Expand' : 'Collapse'}`);
        }
        rows.toggle(!collapsed);
    });

    $('.fv-advanced-setting').removeClass('fv-advanced-hidden');
};

const getIncludedMemberNames = () => $('input[name*="containers"]:checked').map((_, el) => String($(el).val() || '')).get();

const getPreviewMemberNames = () => $('table.sortable > tbody > tr').filter((_, row) => {
    const $row = $(row);
    return $row.find('input.container-switch').prop('checked') === true
        && $row.find('input.member-preview-switch').prop('checked') === true;
}).map((_, row) => String($(row).attr('data-name') || '').trim()).get().filter(Boolean);

const getMemberMapByName = () => new Map(getAllMembers().map((member) => [String(member?.Name || ''), member]));

const escapeRegexLiteral = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const longestCommonPrefix = (values) => {
    if (!Array.isArray(values) || values.length === 0) {
        return '';
    }
    const source = values
        .map((value) => String(value || '').trim())
        .filter((value) => value !== '');
    if (source.length === 0) {
        return '';
    }
    let prefix = source[0];
    for (let i = 1; i < source.length; i += 1) {
        const current = source[i];
        while (prefix && !current.toLowerCase().startsWith(prefix.toLowerCase())) {
            prefix = prefix.slice(0, -1);
        }
        if (!prefix) {
            break;
        }
    }
    return prefix.trim();
};

const buildRegexSuggestionFromNames = (names) => {
    const list = Array.isArray(names) ? names : [];
    const prefix = longestCommonPrefix(list);
    if (prefix.length >= 3) {
        return `^${escapeRegexLiteral(prefix)}`;
    }
    const tokens = list
        .map((name) => String(name || '').trim())
        .filter((name) => name.length >= 3)
        .map((name) => name.split(/[-_.\s]+/)[0] || '')
        .filter((token) => token.length >= 3);
    if (!tokens.length) {
        return '';
    }
    const counts = new Map();
    tokens.forEach((token) => {
        const lower = token.toLowerCase();
        counts.set(lower, (counts.get(lower) || 0) + 1);
    });
    const [topToken, topCount] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] || ['', 0];
    if (!topToken || topCount < Math.max(2, Math.ceil(list.length * 0.5))) {
        return '';
    }
    return `^${escapeRegexLiteral(topToken)}`;
};

const isDockerUpdateAvailableInEditor = (member) => {
    const source = member && typeof member === 'object' ? member : {};
    if (source.UpdateAvailable === true || source.update === true) {
        return true;
    }
    const state = source?.State || source?.RawState || source?.info?.State || {};
    return state?.manager === 'dockerman' && state?.Updated === false;
};

const suggestDefaultsFromMembers = () => {
    const form = getForm();
    if (!form) {
        return;
    }
    const memberNames = getIncludedMemberNames();
    if (!memberNames.length) {
        swal({
            title: 'No members selected',
            text: 'Select at least one member in this folder first, then try Suggest defaults again.',
            type: 'warning'
        });
        return;
    }
    const memberMap = getMemberMapByName();
    const selectedMembers = memberNames.map((name) => memberMap.get(name)).filter(Boolean);

    const suggestions = [];
    const iconCandidate = selectedMembers.find((member) => String(member?.Icon || '').trim())?.Icon || '';
    if (iconCandidate) {
        suggestions.push({
            key: 'icon',
            label: 'Icon',
            value: String(iconCandidate),
            apply: () => { form.icon.value = String(iconCandidate); }
        });
    }

    const regexCandidate = buildRegexSuggestionFromNames(memberNames);
    if (regexCandidate) {
        suggestions.push({
            key: 'regex',
            label: 'Regex',
            value: regexCandidate,
            apply: () => { form.regex.value = regexCandidate; }
        });
    }

    const typeSuggestions = getFolderEditorTypeApi()?.buildSmartDefaultSuggestions?.({
        selectedMembers,
        memberNames,
        form,
        buildRegexSuggestionFromNames
    });
    if (Array.isArray(typeSuggestions) && typeSuggestions.length) {
        suggestions.push(...typeSuggestions.filter((entry) => entry && typeof entry === 'object'));
    }

    if (!suggestions.length) {
        swal({
            title: 'No suggestions found',
            text: 'Current selection does not provide enough signal for safe defaults.',
            type: 'info'
        });
        return;
    }

    const previewText = suggestions.map((entry) => `- ${entry.label}: ${entry.value}`).join('\n');
    swal({
        title: 'Apply smart defaults?',
        text: previewText,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply suggestions',
        cancelButtonText: 'Cancel'
    }, (confirmed) => {
        if (!confirmed) {
            return;
        }
        suggestions.forEach((entry) => {
            if (typeof entry.apply === 'function') {
                entry.apply();
            }
        });
        updateIcon(form.icon);
        updateRegex(form.regex, { immediate: true });
        updateForm();
        validateForm();
        updateLiveSummary();
        updateRegexSimulator();
        if (isFormInitialized) {
            updateUnsavedIndicator();
        }
    });
};

const updateLiveSummary = () => {
    getFolderEditorPreviewRuntimeApi()?.updateLiveSummary();
};

const updateRegexSimulator = () => {
    const form = getForm();
    if (!form) {
        return;
    }

    const regexSource = (form.regex.value || '').trim();
    const probe = ($('#fvRegexSimulatorInput').val() || '').trim();
    const result = $('#fvRegexSimulatorResult');
    const meta = $('#fvRegexSimulatorMeta');

    if (!regexSource) {
        result.removeClass('match no-match error').text('No regex configured.');
        meta.text('');
        return;
    }

    let regex;
    try {
        regex = new RegExp(regexSource);
    } catch (error) {
        result.removeClass('match no-match').addClass('error').text(`Regex error: ${error.message}`);
        meta.text('');
        return;
    }

    const names = getAllMembers().map((member) => member.Name);
    const matches = [];
    names.forEach((name) => {
        regex.lastIndex = 0;
        if (regex.test(name)) {
            matches.push(name);
        }
    });

    if (probe) {
        regex.lastIndex = 0;
        const matched = regex.test(probe);
        result
            .removeClass('error')
            .toggleClass('match', matched)
            .toggleClass('no-match', !matched)
            .text(matched ? `"${probe}" matches.` : `"${probe}" does not match.`);
    } else {
        result.removeClass('error no-match').addClass('match').text('Enter a name above to test one item.');
    }

    const preview = matches.slice(0, 6).join(', ');
    meta.text(`${matches.length}/${names.length} members match.` + (preview ? ` Sample: ${preview}` : ''));
};

const applySectionTags = () => {
    $('[data-editor-section]').removeAttr('data-editor-section');
    $('.fv-advanced-setting').removeClass('fv-advanced-setting');

    const markSection = (selector, section) => $(selector).attr('data-editor-section', section);
    const markAdvanced = (selector) => $(selector).addClass('fv-advanced-setting');

    markSection('div.basic:has([name="name"])', 'general');
    markSection('div.basic:has([name="parent_folder_id"])', 'general');
    markSection('div.basic:has([name="icon"])', 'general');
    markSection('div.basic:has([name="folder_webui"])', 'general');
    markSection('ul[constraint*="folder-webui"]', 'general');

    markSection('#fvFolderMembersSection', 'members');
    markSection('div.basic.order-section', 'members');

    markSection('div.basic:has([name="preview"])', 'preview');
    markSection('div.basic:has([name="preview_hover"])', 'preview');
    markSection('div.basic:has([name="folder_update_highlight"])', 'preview');
    markSection('div.basic:has([name="preview_text_width"])', 'preview');
    markSection('div.basic:has([name="preview_rows"])', 'preview');
    markSection('div.basic:has([name="preview_overflow"])', 'preview');
    markSection('div.basic:has([name="preview_grayscale"])', 'preview');
    markSection('div.basic:has([name="preview_hover_animation"])', 'preview');
    markSection('div.basic:has([name="preview_logs"])', 'preview');
    markSection('div.basic:has([name="preview_vertical_bars"])', 'preview');
    markSection('ul[constraint*="bars-color"]', 'preview');
    markSection('div.basic:has([name="preview_row_separator"])', 'preview');
    markSection('ul[constraint*="preview-row-separator-color"]', 'preview');
    markSection('div.basic:has([name="preview_border"])', 'preview');
    markSection('ul[constraint*="border-color"]', 'preview');

    markSection('div.basic:has([name="dropdown_style"])', 'chevron');
    markSection('div.basic:has([name="dropdown_color"])', 'chevron');

    markSection('div.basic:has([name="folder_accent_enabled"])', 'status');
    markSection('div.basic:has([name="folder_accent_color"])', 'status');
    markSection('div.fv-accent-inline-controls[constraint*="accent-color"]', 'status');
    markSection('div.basic:has([name="status_color_started"])', 'status');
    markSection('div.basic:has([name="status_color_lock"])', 'status');
    markSection('div.basic:has([name="status_warn_stopped_percent"])', 'status');

    markSection('div.basic.custom-action-wrapper-parent', 'actions');
    markSection('div.basic:has(button.custom-action)', 'actions');

    markSection('div.basic:has([name="regex"])', 'rules');

    markSection('div.basic:has([name="override_default_actions"])', 'advanced');
    markSection('div.basic:has([name="default_action"])', 'advanced');
    markSection('div.basic:has([name="expand_tab"])', 'advanced');
    markSection('div.basic:has([name="expand_dashboard"])', 'advanced');
    markSection('div.basic:has([name="dashboard_overflow"])', 'advanced');

    markAdvanced('ul[constraint*="folder-webui"]');
    markAdvanced('div.basic:has([name="preview_hover"])');
    markAdvanced('div.basic:has([name="status_warn_stopped_percent"])');
    markAdvanced('div.basic:has([name="regex"])');
    markAdvanced('div.basic:has([name="override_default_actions"])');
    markAdvanced('div.basic:has([name="default_action"])');
    markAdvanced('div.basic:has([name="expand_tab"])');
    markAdvanced('div.basic:has([name="expand_dashboard"])');
    markAdvanced('div.basic:has([name="dashboard_overflow"])');
    markAdvanced('div.basic.custom-action-wrapper-parent');
    markAdvanced('div.basic:has(button.custom-action)');
    getFolderEditorTypeApi()?.applySectionTags?.({ markSection, markAdvanced });
};

const initEditorChrome = () => {
    const form = $('div.canvas > form');
    if (!form.length) {
        return;
    }

    const shouldRebuildChrome = !$('#fvEditorChrome').length
        || !$('#fvRestoreSavedValues').length
        || !$('#fvApplyPluginDefaults').length
        || !$('#fvSuggestDefaults').length
        || !$('#fvLivePanel').length
        || !$('#fvEditorNavDock').length
        || !$('#fvHeroDefaults').length;

    if (shouldRebuildChrome) {
        $('#fvEditorChrome, #fvLivePanel, #fvEditorNavDock').remove();
        const navButtons = Object.entries(SECTION_META)
            .map(([key, section]) => `
                <button type="button" data-target="${key}">
                    <i class="fa ${section.icon}" aria-hidden="true"></i>
                    <span>${section.title}</span>
                    <em class="fv-nav-count" data-fvplus-style="fv-u-xcjvns"></em>
                </button>
            `)
            .join('');
        form.prepend(`
            <div id="fvEditorChrome" class="fv-editor-chrome">
                <div class="fv-editor-hero">
                    <div class="fv-editor-hero-main">
                        <div class="fv-editor-hero-icon">
                            <img id="fvHeroIcon" src="${DEFAULT_FOLDER_ICON_PATH}" alt="">
                        </div>
                        <div class="fv-editor-hero-copy">
                            <span class="fv-editor-kicker">${type === 'vm' ? 'VM' : 'Docker'} folder editor</span>
                            <h2 id="fvHeroTitle">Configure folder</h2>
                            <p id="fvHeroSubtitle">Group the most-used controls, preview the folder row live, and only dig into advanced behavior when needed.</p>
                            <div class="fv-hero-meta">
                                <span id="fvHeroScope">Top-level folder</span>
                                <span id="fvHeroMembers">0/0 included</span>
                                <span id="fvHeroDefaults">Checking inherited defaults</span>
                                <span id="fvHeroMode">All sections</span>
                            </div>
                        </div>
                    </div>
                    <div class="fv-editor-hero-actions">
                        <button type="button" id="fvRestoreSavedValues"><i class="fa fa-history" aria-hidden="true"></i> Restore saved values</button>
                        <button type="button" id="fvApplyPluginDefaults"><i class="fa fa-repeat" aria-hidden="true"></i> Apply plugin defaults</button>
                        <button type="button" id="fvSuggestDefaults"><i class="fa fa-magic" aria-hidden="true"></i> Suggest defaults</button>
                    </div>
                </div>
                <div class="fv-editor-status-row">
                    <span id="fvValidationSummary" class="fv-validation-summary">All checks passed.</span>
                    <pre id="fvValidationDetails" class="fv-validation-details">No warnings.</pre>
                </div>
            </div>
            <div id="fvLivePanel" class="fv-live-panel">
                <div class="fv-live-panel-grid">
                        <div class="fv-live-preview-card">
                            <div class="fv-live-preview-card-head">
                                <div class="fv-live-preview-copy">
                                    <strong>Live folder preview</strong>
                                    <p>Updates immediately while you change preview, chevron, status, and folder display settings.</p>
                                </div>
                                <span id="fvLivePreviewMeta" class="fv-live-preview-meta-chip">Preview disabled</span>
                            </div>
                            <div id="fvLivePreviewCanvas" class="fv-live-preview-canvas"></div>
                        </div>
                    <div class="fv-live-insights">
                        <div class="fv-live-grid">
                            <span><strong>Name:</strong> <span id="fvLiveName">-</span></span>
                            <span><strong>Preview:</strong> <span id="fvLivePreview">-</span></span>
                            <span><strong>Context:</strong> <span id="fvLiveContext">-</span></span>
                            <span><strong>Members:</strong> <span id="fvLiveMembers">0/0 included</span></span>
                        </div>
                        <div class="fv-live-swatches">
                            <span class="fv-swatch-item"><em>Started</em><i id="fvSwatchStarted"></i></span>
                            <span class="fv-swatch-item"><em>Paused</em><i id="fvSwatchPaused"></i></span>
                            <span class="fv-swatch-item"><em>Stopped</em><i id="fvSwatchStopped"></i></span><span class="fv-swatch-item"><em>Text</em><i id="fvSwatchText"></i></span>
                            <span id="fvAccentSwatchItem" class="fv-swatch-item" data-fvplus-style="fv-u-xcjvns"><em>Accent</em><i id="fvSwatchAccent"></i></span>
                        </div>
                        <div id="fvDockerSignals" class="fv-docker-signals" data-fvplus-style="fv-u-xcjvns">
                            <span id="fvDockerComposeSummary" class="fv-docker-signal-chip">Compose: none detected</span>
                            <span id="fvDockerUpdateSummary" class="fv-docker-signal-chip">Updates: 0/0</span>
                        </div>
                    </div>
                </div>
            </div>
            <div id="fvEditorNavDock" class="fv-editor-nav-dock">
                <div class="fv-editor-nav-row">
                    <div class="fv-section-nav">${navButtons}</div>
                </div>
            </div>
        `);
    }

    if (!$('#fvMemberTools').length) {
        $('.basic.order-section dd').prepend(`
            <div id="fvMemberTools" class="fv-member-tools">
                <div class="fv-member-tools-main">
                    <div class="fv-member-tools-filters">
                        <input type="text" id="fvMemberSearch" placeholder="Search members">
                        <select id="fvMemberFilter">
                            <option value="all">All membership</option>
                            <option value="included">Included</option>
                            <option value="excluded">Excluded</option>
                            <option value="regex">Regex included</option>
                            <option value="contains_regex">Contains regex</option>
                            <option value="manual">Manual only</option>
                        </select>
                        <select id="fvMemberStateFilter">
                            <option value="all">All states</option>
                            <option value="running">${type === 'vm' ? 'Running' : 'Started / Running'}</option>
                            <option value="paused">Paused</option>
                            <option value="stopped">Stopped</option>
                        </select>
                    </div>
                    <div class="fv-member-tools-actions">
                        <button type="button" id="fvMemberIncludeVisible">Include shown</button>
                        <button type="button" id="fvMemberExcludeVisible">Exclude shown</button>
                        <button type="button" id="fvMemberClear">Reset filters</button>
                    </div>
                    <span id="fvMemberStats" class="fv-member-stats">0/0 included</span>
                </div>
                <div class="fv-member-chip-row">
                    <span id="fvMemberChipIncluded" class="fv-member-chip is-accent">0 included</span>
                    <span id="fvMemberChipManual" class="fv-member-chip">0 manual</span>
                    <span id="fvMemberChipRegex" class="fv-member-chip">0 regex</span>
                    <span id="fvMemberChipAvailable" class="fv-member-chip">0 available</span>
                </div>
                <div class="fv-member-bulk-row">
                    <div class="fv-member-bulk-copy">
                        <strong>Bulk move</strong>
                        <span>Use the current filters to move Docker containers or VMs directly into another folder without leaving this editor.</span>
                    </div>
                    <div class="fv-member-bulk-controls">
                        <select id="fvMemberBulkScope" aria-label="Bulk move scope">
                            ${MEMBER_BULK_SCOPE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
                        </select>
                        <select id="fvMemberBulkTarget" aria-label="Bulk move target folder">
                            <option value="">Move to folder...</option>
                        </select>
                        <button type="button" id="fvMemberBulkMove"><i class="fa fa-exchange"></i> Move to folder</button>
                    </div>
                    <span id="fvMemberBulkSummary" class="fv-member-bulk-summary">No movable members in the current scope.</span>
                </div>
            </div>
        `);
    }

    if (typeof window.FolderViewPlusRefreshModernEditorChromeLayout === 'function') {
        window.FolderViewPlusRefreshModernEditorChromeLayout();
    }
    $('.fv-section-nav button')
        .off('click.fvEditorSectionSync')
        .on('click.fvEditorSectionSync', function onModernSectionClick() {
            setActiveEditorSection($(this).data('target'));
        });

    $('#fvMemberSearch').off('input').on('input', applyMemberFilters);
    $('#fvMemberFilter').off('change').on('change', applyMemberFilters);
    $('#fvMemberStateFilter').off('change').on('change', applyMemberFilters);
    $('#fvMemberIncludeVisible').off('click').on('click', () => setVisibleMemberSelection(true));
    $('#fvMemberExcludeVisible').off('click').on('click', () => setVisibleMemberSelection(false));
    $('#fvMemberClear').off('click').on('click', () => {
        $('#fvMemberSearch').val('');
        $('#fvMemberFilter').val('all');
        $('#fvMemberStateFilter').val('all');
        applyMemberFilters();
    });
    $('#fvMemberBulkScope').off('change').on('change', () => updateMemberBulkMoveUi());
    $('#fvMemberBulkTarget').off('change').on('change', () => updateMemberBulkMoveUi());
    $('#fvMemberBulkMove').off('click').on('click', () => {
        void applyEditorMemberBulkMove();
    });

    syncMemberSearchUiState();
    $('#fvMemberFilter').attr('aria-label', 'Filter member list');
    $('#fvMemberStateFilter').attr('aria-label', 'Filter member state');
    renderMemberBulkMoveTargets();
    updateMemberBulkMoveUi();

    editorMode = loadEditorModePreference();
    activeEditorSection = normalizeActiveEditorSection(activeEditorSection, editorMode);
    advancedSectionCollapsedState = loadAdvancedCollapseState();
    $('#fvRegexSimulatorInput').off('input').on('input', updateRegexSimulator);
    $('#fvSuggestDefaults').off('click').on('click', suggestDefaultsFromMembers);
    $('#fvRestoreSavedValues').off('click').on('click', () => {
        resetUnsavedChanges();
    });
    $('#fvApplyPluginDefaults').off('click').on('click', () => {
        const confirmed = confirm('Apply plugin defaults to this folder editor? This will reset preview, chevron, status, rules, and advanced overrides but will keep the folder name, icon, members, and custom actions.');
        if (!confirmed) {
            return;
        }
        applyEditorPluginDefaults();
    });

    $('.fv-section-collapse').off('click').on('click', function onCollapseClick() {
        toggleAdvancedSectionCollapse($(this).attr('data-section'));
    });
    $('.fv-section-tool').off('click').on('click', function onSectionToolClick() {
        const sectionKey = String($(this).attr('data-section') || '');
        const action = String($(this).attr('data-section-action') || '');
        if (!sectionKey || !action) {
            return;
        }
        if (action === 'revert') {
            restoreSectionSavedValues(sectionKey);
            return;
        }
        if (action === 'defaults') {
            applySectionDefaults(sectionKey);
        }
    });

    ensureInheritedFieldControls();
    void refreshFolderAutoRulesPanel();
};

getForm().preview_border.checked = true;
getForm().preview_hover_animation.value = 'none';
getForm().preview_border_color.value = DEFAULT_BORDER_COLOR;
getForm().preview_border_width.value = String(DEFAULT_PREVIEW_BORDER_WIDTH);
getForm().preview_border_glow.checked = false;
getForm().preview_vertical_bars_color.value = rgbToHex($('body').css('color'));
getForm().preview_vertical_bars_width.value = String(DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH);
getForm().preview_overflow.value = 'default';
getForm().preview_row_separator.checked = false;
getForm().preview_row_separator_color.value = DEFAULT_BORDER_COLOR;
getForm().folder_update_highlight.checked = false;
getForm().dropdown_style.value = DEFAULT_DROPDOWN_STYLE;
getForm().dropdown_color.value = DEFAULT_DROPDOWN_COLOR;
getForm().dropdown_hover_color.value = DEFAULT_DROPDOWN_HOVER_COLOR;
getForm().folder_accent_enabled.checked = false;
getForm().folder_accent_color.value = DEFAULT_FOLDER_ACCENT_COLOR;
resetStatusColorDefaults();
getForm().status_color_lock.checked = false;

const hydrateCurrentEditFolder = (folderRecord, folderRecordId, foldersMap = {}, options = {}) => {
    const safeFolderId = normalizeFolderId(folderRecordId);
    const normalizedFolder = normalizeFolderRecordForEditor(folderRecord || {});
    hiddenPreviewMembers = new Set(normalizedFolder.hiddenPreviewMembers || []);
    getFolderEditorMemberListApi().setChildFolderOrder(
        normalizedFolder.settings.child_folder_order || normalizedFolder.settings.childFolderOrder
    );
    const folders = utils.normalizeFolderMap(foldersMap);
    if (safeFolderId && Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        Reflect.deleteProperty(folders, safeFolderId);
    }

    activeFolderEditorFolderId = safeFolderId;
    if (safeFolderId && Object.prototype.hasOwnProperty.call(allFoldersById || {}, safeFolderId)) {
        activeFolderEditorResolvedFolderId = safeFolderId;
    }
    folderHierarchyState.currentFolderDescendantIds = safeFolderId
        ? computeFolderDescendantIds(allFoldersById, safeFolderId)
        : new Set();

    const form = getForm();
    const setFieldValue = (fieldName, value) => {
        const field = getFormField(form, fieldName);
        if (field) {
            $(field).val(value);
        }
    };
    const setFieldChecked = (fieldName, checked) => {
        const field = getFormField(form, fieldName);
        if (field) {
            field.checked = checked === true;
        }
    };

    setFieldValue('name', normalizedFolder.name);
    refreshParentFolderChooser(
        folders,
        normalizeParentFolderId(normalizedFolder.parentId || ''),
        safeFolderId ? new Set([safeFolderId, ...Array.from(folderHierarchyState.currentFolderDescendantIds)]) : new Set()
    );
    setFieldValue('icon', normalizedFolder.icon);
    setFieldChecked('folder_webui', normalizedFolder.settings.folder_webui || false);
    setFieldValue('folder_webui_url', normalizedFolder.settings.folder_webui_url || '');
    getFolderWebuiProfilesApi()?.hydrate(normalizedFolder.settings.webui_profiles || normalizedFolder.settings.webuiProfiles || []);
    setFieldValue('preview', String(normalizedFolder.settings.preview));
    setFieldValue('preview_rows', String(normalizePreviewRowLimit(normalizedFolder.settings, normalizedFolder)));
    setFieldValue('preview_overflow', normalizedFolder.settings.preview_overflow || normalizedFolder.settings.previewOverflow || 'default');
    setFieldValue('preview_status', normalizePreviewStatusMode(normalizedFolder.settings.preview_status));
    setFieldChecked('preview_hover', normalizedFolder.settings.preview_hover);
    setFieldValue('preview_hover_animation', normalizePreviewHoverAnimation(normalizedFolder.settings.preview_hover_animation || normalizedFolder.settings.previewHoverAnimation));
    setFieldChecked('preview_update', normalizedFolder.settings.preview_update);
    setFieldChecked('folder_update_highlight', normalizedFolder.settings.folder_update_highlight === true || normalizedFolder.settings.folderUpdateHighlight === true);
    setFieldValue('preview_text_width', normalizedFolder.settings.preview_text_width || '');
    setFieldChecked('preview_grayscale', normalizedFolder.settings.preview_grayscale);
    setFieldChecked('preview_hide_nested_items', normalizedFolder.settings.preview_hide_nested_items);
    setFieldValue('preview_child_folder_depth', String(normalizeChildFolderPreviewDepth(normalizedFolder.settings, normalizedFolder)));
    setFieldChecked('preview_webui', normalizedFolder.settings.preview_webui);
    setFieldChecked('preview_logs', normalizedFolder.settings.preview_logs);
    setFieldChecked('preview_console', normalizedFolder.settings.preview_console || false);
    setFieldChecked('preview_vertical_bars', normalizedFolder.settings.preview_vertical_bars || false);
    setFieldValue('context', normalizedFolder.settings.context?.toString() || '1');
    setFieldValue('context_trigger', normalizedFolder.settings.context_trigger?.toString() || '0');
    setFieldValue('context_graph', normalizedFolder.settings.context_graph?.toString() || '1');
    setFieldValue('context_graph_time', normalizedFolder.settings.context_graph_time?.toString() || '60');
    setFieldChecked('preview_border', isLegacyPreviewBorderEnabled(normalizedFolder.settings || {}));
    setFieldValue('preview_border_color', normalizeHexColor(normalizedFolder.settings.preview_border_color, DEFAULT_BORDER_COLOR));
    setFieldValue('preview_border_width', String(normalizePositiveInt(normalizedFolder.settings.preview_border_width, DEFAULT_PREVIEW_BORDER_WIDTH, 1, 4)));
    setFieldChecked('preview_border_glow', normalizedFolder.settings.preview_border_glow === true || normalizedFolder.settings.previewBorderGlow === true);
    setFieldValue('preview_vertical_bars_color', normalizeHexColor(
        normalizedFolder.settings.preview_vertical_bars_color || normalizedFolder.settings.preview_border_color,
        DEFAULT_BORDER_COLOR
    ));
    setFieldChecked('preview_row_separator', normalizedFolder.settings.preview_row_separator === true || normalizedFolder.settings.previewRowSeparator === true);
    setFieldValue('preview_row_separator_color', normalizeHexColor(normalizedFolder.settings.preview_row_separator_color, DEFAULT_BORDER_COLOR));
    setFieldValue('preview_vertical_bars_width', String(normalizePositiveInt(normalizedFolder.settings.preview_vertical_bars_width, DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH, 1, 4)));
    setFieldValue('dropdown_style', normalizeDropdownStyle(normalizedFolder.settings, normalizedFolder));
    setFieldValue('dropdown_color', normalizeHexColor(normalizedFolder.settings.dropdown_color, DEFAULT_DROPDOWN_COLOR));
    setFieldValue('dropdown_hover_color', normalizeHexColor(normalizedFolder.settings.dropdown_hover_color, DEFAULT_DROPDOWN_HOVER_COLOR));
    setFieldChecked('folder_accent_enabled', isFolderAccentEnabled(normalizedFolder.settings || {}));
    setFieldValue('folder_accent_color', normalizeHexColor(normalizedFolder.settings.folder_accent_color, DEFAULT_FOLDER_ACCENT_COLOR));
    setFieldValue('status_color_started', normalizeHexColor(normalizedFolder.settings.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started));
    setFieldValue('status_color_paused', normalizeHexColor(normalizedFolder.settings.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused));
    setFieldValue('status_color_stopped', normalizeHexColor(normalizedFolder.settings.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped)); setFieldValue('status_color_text', normalizeHexColor(normalizedFolder.settings.status_color_text, DEFAULT_FOLDER_STATUS_COLORS.text)); setFieldChecked('status_color_text_auto', !isFolderStatusTextColorExplicit(normalizedFolder.settings));
    setFieldChecked('status_color_lock', normalizedFolder.settings.status_color_lock === true || normalizedFolder.settings.statusColorLock === true);
    setFieldValue('health_warn_stopped_percent', normalizedFolder.settings.health_warn_stopped_percent === undefined
        || normalizedFolder.settings.health_warn_stopped_percent === null
        || normalizedFolder.settings.health_warn_stopped_percent === ''
        ? ''
        : String(normalizedFolder.settings.health_warn_stopped_percent));
    setFieldValue('health_critical_stopped_percent', normalizedFolder.settings.health_critical_stopped_percent === undefined
        || normalizedFolder.settings.health_critical_stopped_percent === null
        || normalizedFolder.settings.health_critical_stopped_percent === ''
        ? ''
        : String(normalizedFolder.settings.health_critical_stopped_percent));
    setFieldValue('health_profile', normalizeOptionalHealthSelect(normalizedFolder.settings.health_profile, FOLDER_HEALTH_PROFILE_VALUES));
    setFieldValue('health_updates_mode', normalizeOptionalHealthSelect(normalizedFolder.settings.health_updates_mode, FOLDER_HEALTH_UPDATES_MODE_VALUES));
    setFieldValue('health_all_stopped_mode', normalizeOptionalHealthSelect(normalizedFolder.settings.health_all_stopped_mode, FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES));
    setFieldValue('status_warn_stopped_percent', normalizedFolder.settings.status_warn_stopped_percent === undefined
        || normalizedFolder.settings.status_warn_stopped_percent === null
        || normalizedFolder.settings.status_warn_stopped_percent === ''
        ? ''
        : String(normalizedFolder.settings.status_warn_stopped_percent));
    setFieldChecked('update_column', normalizedFolder.settings.update_column || false);
    setFieldChecked('default_action', normalizedFolder.settings.default_action || false);
    setFieldChecked('expand_tab', normalizedFolder.settings.expand_tab);
    setFieldChecked('override_default_actions', normalizedFolder.settings.override_default_actions);
    setFieldChecked('expand_dashboard', normalizedFolder.settings.expand_dashboard);
    setFieldValue('dashboard_overflow', normalizeDashboardOverflowMode(normalizedFolder.settings.dashboard_overflow));
    setFieldValue('regex', normalizedFolder.regex);

    const customActionWrapper = $('.custom-action-wrapper');
    if (customActionWrapper.length) {
        customActionWrapper.empty();
        normalizedFolder.actions?.forEach((entry, index) => {
            const safeActionName = escapeHtml(entry?.name || '');
            customActionWrapper.append(`<div class="custom-action-n-${index}">${safeActionName} <button data-fv-onclick="return customAction(${index});"><i class="fa fa-pencil" aria-hidden="true"></i></button><button data-fv-onclick="return rCcustomAction(${index});"><i class="fa fa-trash" aria-hidden="true"></i></button><input type="hidden" name="custom_action[]" value="${btoa(JSON.stringify(entry))}"></div>`);
        });
    }

    updateForm();
    updateIcon(getFormField(form, 'icon'));
    if (options.clearPrefill === true) {
        clearEditorNavigationPrefill();
    }
    setParentDefaultsNote('');
    void refreshFolderAutoRulesPanel();
    return {
        folder: normalizedFolder,
        id: safeFolderId
    };
};

const startFolderEditorRuntime = async () => {
    window.FolderViewPlusFolderEditorRuntimeBootStage = 'runtime-start';
    folderThemeSurfaceBinding?.bind();
    registerBeforeUnloadGuard();
    registerFolderEditorModuleTeardown();
    applySectionTags();
    initEditorChrome();
    folderThemeSurfaceBinding?.runApply('chrome-ready');
    setBootstrapDiagnostics({
        mode: 'boot',
        result: 'shell-ready'
    });
    window.FolderViewPlusFolderEditorRuntimeBootStage = 'shell-ready';
    updateForm();
    applyAdvancedMode();
    validateForm();
    updateLiveSummary();
    updateRegexSimulator();
    const bootstrapFolderId = buildFolderEditorRefCandidates(
        folderEditorResolvedId,
        folderEditorBootstrapContext.resolvedId,
        window.FolderViewPlusFolderEditorResolvedId,
        folderEditorBootstrapSeed?.id,
        folderEditorBootstrapContext.requestedId,
        window.FolderViewPlusFolderEditorRequestedId,
        folderId
    )[0] || '';
    const bootstrapFolderRecord = folderEditorBootstrapFolder && typeof folderEditorBootstrapFolder === 'object'
        ? normalizeFolderRecordForEditor(folderEditorBootstrapFolder)
        : null;
    if (bootstrapFolderRecord && bootstrapFolderId) {
        setFolderMapEntry(allFoldersById, bootstrapFolderId, bootstrapFolderRecord);
        hydrateCurrentEditFolder(bootstrapFolderRecord, bootstrapFolderId, {}, { clearPrefill: false });
    }
    const cacheBust = Date.now();
    // get folders
    const foldersResponse = await requestClient.getJson('/plugins/folderview.plus/server/read.php', {
        data: { type, nocache: 1, _: cacheBust },
        cache: false
    });
    window.FolderViewPlusFolderEditorRuntimeBootStage = 'folders-loaded';
    const folders = createFolderMap();
    for (const [id, folder] of Object.entries(utils.normalizeFolderMap(foldersResponse))) {
        setFolderMapEntry(folders, id, normalizeFolderRecordForEditor(folder));
    }
    allFoldersById = utils.normalizeFolderMap(folders);
    let currentEditFolder = null;
    let currentEditFolderId = '';

    const preferredNavigationRef = buildFolderEditorRefCandidates(
        folderEditorResolvedId,
        folderEditorBootstrapContext.resolvedId,
        window.FolderViewPlusFolderEditorResolvedId,
        folderEditorBootstrapSeed?.id,
        folderId
    )[0] || '';
    const navigationPrefill = readEditorNavigationPrefill(type, preferredNavigationRef);
    const requestedFolderRefs = buildFolderEditorRefCandidates(
        folderEditorResolvedId,
        folderEditorBootstrapContext.resolvedId,
        window.FolderViewPlusFolderEditorResolvedId,
        folderEditorBootstrapSeed?.id,
        navigationPrefill?.id,
        window.FolderViewPlusFolderEditorRequestedId,
        folderEditorBootstrapContext.requestedId,
        folderId
    );
    let requestedFolderRef = requestedFolderRefs[0] || '';
    const folderCount = Object.keys(folders).length;

    if (requestedFolderRef) {
        let resolvedEditFolder = null;
        for (const candidateRef of requestedFolderRefs) {
            const resolvedCandidate = resolveCurrentEditFolder(folders, candidateRef);
            if (resolvedCandidate) {
                resolvedEditFolder = resolvedCandidate;
                requestedFolderRef = candidateRef;
                break;
            }
        }
        currentEditFolder = resolvedEditFolder?.folder || bootstrapFolderRecord || navigationPrefill?.folder || null;
        currentEditFolderId = String(
            resolvedEditFolder?.id
            || navigationPrefill?.id
            || bootstrapFolderId
            || requestedFolderRef
            || ''
        ).trim();
        if (!currentEditFolder || !currentEditFolderId) {
            activeFolderEditorFolderId = '';
            activeFolderEditorResolvedFolderId = '';
            setValidationBannerState(
                'Warning: requested folder could not be loaded.',
                `Folder reference "${requestedFolderRef}" was not found in the saved folder map, server bootstrap context, or recent edit context. The editor stayed in new-folder mode instead of silently hydrating the wrong data.`,
                'warning'
            );
            setBootstrapDiagnostics({
                mode: 'hydrate',
                requestedRef: requestedFolderRef,
                requestedFolderRefs,
                navigationPrefillId: String(navigationPrefill?.id || '(empty)'),
                navigationPrefillHasFolder: navigationPrefill?.folder ? 'yes' : 'no',
                foldersLoaded: String(folderCount),
                result: 'missing-target',
                effectiveFolderId: '',
                routeTargetRecovered: false,
                routeTargetMismatch: false
            });
            folderHierarchyState.currentFolderDescendantIds = new Set();
            refreshParentFolderChooser(folders, '', new Set());
            setParentDefaultsNote('Select a parent to inherit preview/icon defaults automatically.', 'info');
        } else {
        if (!resolvedEditFolder && bootstrapFolderRecord) {
            setFolderMapEntry(folders, currentEditFolderId, currentEditFolder);
            setFolderMapEntry(allFoldersById, currentEditFolderId, currentEditFolder);
        }
        if (!resolvedEditFolder && navigationPrefill && !bootstrapFolderRecord) {
            setFolderMapEntry(folders, currentEditFolderId, currentEditFolder);
            setFolderMapEntry(allFoldersById, currentEditFolderId, currentEditFolder);
            setValidationBannerState(
                'Recovered requested folder from navigation context.',
                `Folder reference "${requestedFolderRef}" was restored from the folder you clicked before the editor loaded. Saved member and display data should now be available immediately.`,
                'warning'
            );
        }
        activeFolderEditorResolvedFolderId = String(resolvedEditFolder?.id || '').trim();
        hydrateCurrentEditFolder(currentEditFolder, currentEditFolderId, folders, { clearPrefill: true });
        updateLiveSummary();
        setBootstrapDiagnostics({
            mode: 'hydrate',
            requestedRef: requestedFolderRef,
            requestedFolderRefs,
            resolvedId: currentEditFolderId,
            navigationPrefillId: String(navigationPrefill?.id || '(empty)'),
            navigationPrefillHasFolder: navigationPrefill?.folder ? 'yes' : 'no',
            foldersLoaded: String(folderCount),
            resolvedBy: String(resolvedEditFolder?.resolvedBy || (bootstrapFolderRecord ? 'server-bootstrap-folder' : navigationPrefill?.folder ? 'navigation-folder' : folderEditorResolvedId ? 'server-resolved-id' : '(none)')),
            result: 'hydrated',
            effectiveFolderId: currentEditFolderId,
            routeTargetRecovered: !folderId && Boolean(currentEditFolderId),
            routeTargetMismatch: Boolean(folderId && currentEditFolderId && folderId !== currentEditFolderId)
        });
        }
    } else {
        activeFolderEditorFolderId = '';
        activeFolderEditorResolvedFolderId = '';
        const hasCreateParentRequest = Boolean(normalizeParentFolderId(requestedCreateParentId));
        setValidationBannerState(
            hasCreateParentRequest
                ? 'Creating a child folder.'
                : 'Folder editor opened without a folder target.',
            hasCreateParentRequest
                ? 'The editor opened in new-folder mode with the clicked folder preselected as the parent.'
                : 'No folder reference was found in query, hash, page bootstrap, storage bootstrap, window.name bootstrap, or recent edit context. The editor stayed in new-folder mode.',
            hasCreateParentRequest ? 'info' : 'warning'
        );
        setBootstrapDiagnostics({
            mode: 'hydrate',
            requestedFolderRefs,
            requestedCreateParentId: normalizeParentFolderId(requestedCreateParentId),
            navigationPrefillId: String(navigationPrefill?.id || '(empty)'),
            navigationPrefillHasFolder: navigationPrefill?.folder ? 'yes' : 'no',
            foldersLoaded: String(folderCount),
            result: hasCreateParentRequest ? 'create-child-target' : 'no-target',
            effectiveFolderId: '',
            routeTargetRecovered: false,
            routeTargetMismatch: false
        });
        clearEditorNavigationPrefill();
        folderHierarchyState.currentFolderDescendantIds = new Set();
        const appliedSavedDefaults = applySavedFolderDefaultsToNewFolder(folders);
        const appliedRequestedParent = await applyRequestedCreateParentToNewFolder(folders);
        if (!appliedRequestedParent && !appliedSavedDefaults) {
            refreshParentFolderChooser(folders, '', new Set());
            setParentDefaultsNote('Select a parent to inherit preview/icon defaults automatically.', 'info');
        }
    }
    renderMemberBulkMoveTargets();
    updateMemberBulkMoveUi();

    const typeMemberMapper = typeof getFolderEditorTypeApi()?.mapRuntimeMember === 'function'
        ? getFolderEditorTypeApi().mapRuntimeMember
        : ((entry) => entry);
    choose = Object.values(await requestClient.getJson('/plugins/folderview.plus/server/read_info.php', {
        data: { type, mode: 'state', _: cacheBust },
        cache: false
    }))
        .map((entry) => typeMemberMapper(entry))
        .filter((entry) => entry && String(entry.Name || '').trim() !== '');
    window.FolderViewPlusFolderEditorRuntimeBootStage = 'members-loaded';
    setBootstrapDiagnostics({
        mode: 'post-read-info',
        requestedRef: requestedFolderRef,
        requestedFolderRefs,
        resolvedId: currentEditFolderId,
        navigationPrefillId: String(navigationPrefill?.id || '(empty)'),
        navigationPrefillHasFolder: navigationPrefill?.folder ? 'yes' : 'no',
        foldersLoaded: String(folderCount),
        membersLoaded: String(Array.isArray(choose) ? choose.length : 0),
        resolvedBy: currentEditFolderId
            ? String(
                resolveCurrentEditFolder(folders, requestedFolderRef)?.resolvedBy
                || (bootstrapFolderRecord ? 'server-bootstrap-folder' : navigationPrefill?.folder ? 'navigation-folder' : folderEditorResolvedId ? 'server-resolved-id' : '(none)')
            )
            : '(none)',
        result: currentEditFolderId ? 'post-read-info-ready' : 'post-read-info-no-target',
        effectiveFolderId: currentEditFolderId,
        routeTargetRecovered: !folderId && Boolean(currentEditFolderId),
        routeTargetMismatch: Boolean(folderId && currentEditFolderId && folderId !== currentEditFolderId)
    });
    window.FolderViewPlusFolderEditorRuntimeBootStage = 'runtime-ready';

    // if editing a folder and not creating one
    if (currentEditFolder && currentEditFolderId) {
        const form = getForm();
        for (const ct of currentEditFolder.containers) {
            const index = choose.findIndex((e) => e.Name === ct);
            if (index > -1) {
                selected.push(choose.splice(index, 1)[0]);
            }
        }

        // make the ui respond to the previus changes
        updateForm();
        updateRegex(getFormField(form, 'regex'), { immediate: true });
        updateIcon(getFormField(form, 'icon'));
        setParentDefaultsNote('');
    }

    // create the *cool* unraid button for the autostart
    $('input.basic-switch').switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on')});
    if (typeof window.FolderViewPlusEnsureAccentControlPlacement === 'function') {
        window.FolderViewPlusEnsureAccentControlPlacement(getForm());
    }

    // iterate over the folders
    for (const value of Object.values(folders)) {
        // match the element to the regex
        if (value.regex) {
            const regex = new RegExp(value.regex);
            for (const container of choose) {
                regex.lastIndex = 0;
                if (regex.test(container.Name)) {
                    value.containers.push(container.Name);
                }
            }
        }

        // remove the containers from the order
        for (const container of value.containers) {
            const index = choose.findIndex((e) => e.Name === container);
            if (index > -1) {
                choose.splice(index, 1);
            }
        }
    }

    choose.sort((a, b) => compareFolderEditorText(a.Name, b.Name));
    await bindIconPickerEvents();

    updateList();
    getFolderWebuiProfilesApi()?.refreshMembers();
    applySectionTags();
    initEditorChrome();
    updateForm();
    applyAdvancedMode();
    validateForm();
    updateLiveSummary();
    updateRegexSimulator();
    void refreshFolderAutoRulesPanel({
        forceReload: Boolean(currentEditFolderId)
    });
    markCleanState();
    isFormInitialized = true;
    if (typeof window.FolderViewPlusRevealModernEditorStage === 'function') {
        window.FolderViewPlusRevealModernEditorStage();
    }

    const form = getForm();
    lastNameRegexSyncValue = String(form?.name?.value || '').trim();
    $(form).on('input change', ':input', (event) => {
        if (!isFormInitialized) {
            return;
        }
        const fieldName = String(event?.target?.name || '').trim();
        const isLivePreviewColorField = fieldName === 'dropdown_color'
            || fieldName === 'dropdown_hover_color'
            || fieldName === 'preview_border_color'
            || fieldName === 'preview_vertical_bars_color'
            || fieldName === 'preview_row_separator_color'
            || fieldName === 'folder_accent_color' || fieldName === 'status_color_started' || fieldName === 'status_color_paused' || fieldName === 'status_color_stopped' || fieldName === 'status_color_text';
        if (fieldName === 'status_color_text' && form.status_color_text_auto) form.status_color_text_auto.checked = false;
        markSmartDefaultFieldTouched(fieldName);
        if (!folderId && fieldName === 'parent_folder_id' && event.type === 'change') {
            void applySmartDefaultsFromParent(normalizeParentFolderId(form.parent_folder_id?.value || ''));
        }
        if (fieldName === 'name') {
            if (event.type === 'input') {
                $('#fvLiveName').text((form.name?.value || '').trim() || '(unnamed)');
                markUnsavedIndicatorDirty();
                return;
            }
            scheduleNameDrivenRegexSync('immediate');
        }
        if (fieldName === 'regex') {
            if (event.type === 'input') {
                markUnsavedIndicatorDirty();
                return;
            }
            updateRegex(form.regex, { immediate: true });
            return;
        }
        if (fieldName === 'dropdown_style' || fieldName === 'dropdown_color' || fieldName === 'dropdown_hover_color'
            || fieldName === 'preview_border' || fieldName === 'preview_border_color' || fieldName === 'preview_border_width' || fieldName === 'preview_border_glow'
            || fieldName === 'folder_accent_enabled' || fieldName === 'folder_accent_color' || fieldName === 'status_color_started' || fieldName === 'status_color_paused' || fieldName === 'status_color_stopped' || fieldName === 'status_color_text' || fieldName === 'status_color_text_auto') {
            if (event.type === 'input' && isLivePreviewColorField) {
                scheduleEditorPreviewRender();
                markUnsavedIndicatorDirty();
                return;
            }
            scheduleEditorRecalculation(0);
            return;
        }
        scheduleEditorRecalculation(event.type === 'input' ? EDITOR_INPUT_RECALC_DEBOUNCE_MS : 0);
    });
};

/**
 * Update the folder icon when editing the respective field
 * @param {*} e the element
 */
const updateIcon = (e) => {
    if (e.previousElementSibling && e.previousElementSibling.tagName === 'IMG') {
        e.previousElementSibling.src = utils.sanitizeImageUrl(e.value, DEFAULT_FOLDER_ICON_PATH);
    }
    renderBuiltInIconPicker();
};

/**
 * Update the regex selection when editing the respective field
 * @param {*} e the element
 */
const updateRegex = (e, options = {}) => {
    return getFolderEditorRegexSelectionApi().updateRegex(e, options);
};

/**
 * Update the setting visibility according to the preview setting
 * @param {*} e the element
 */
/**
 * Update the setting visibility according to the changin of settings
 */
function updateForm() {
    getFolderEditorPreviewRuntimeApi()?.updatePreviewConstraints();
}

const createFolderHierarchyApi = folderHierarchyModule.createApi;
const getFolderHierarchyApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = createFolderHierarchyApi({
            $,
            getForm,
            getFolderId: () => folderId,
            getAllFolders: () => allFoldersById,
            updateForm,
            validateForm,
            updateLiveSummary,
            updateRegexSimulator,
            escapeHtml,
            smartDefaultFieldNames: SMART_DEFAULT_FIELD_NAMES,
            getParentDefaults: (parentFolder) => buildParentSmartDefaults(parentFolder)
        });
        return cachedApi;
    };
})();
const folderHierarchyState = {
    get currentFolderDescendantIds() {
        return getFolderHierarchyApi().state.currentFolderDescendantIds;
    },
    set currentFolderDescendantIds(value) {
        getFolderHierarchyApi().state.currentFolderDescendantIds = value;
    }
};
const computeFolderDescendantIds = (...args) => getFolderHierarchyApi().computeFolderDescendantIds(...args);
const buildParentFolderEntries = (...args) => getFolderHierarchyApi().buildParentFolderEntries(...args);
const populateParentFolderOptions = (...args) => getFolderHierarchyApi().populateParentFolderOptions(...args);
const getSiblingNameCollision = (...args) => getFolderHierarchyApi().getSiblingNameCollision(...args);
const suggestSiblingName = (...args) => getFolderHierarchyApi().suggestSiblingName(...args);
const setParentDefaultsNote = (...args) => getFolderHierarchyApi().setParentDefaultsNote(...args);
const applySmartDefaultsFromParent = (...args) => getFolderHierarchyApi().applySmartDefaultsFromParent(...args);
const markSmartDefaultFieldTouched = (...args) => getFolderHierarchyApi().markSmartDefaultFieldTouched(...args);
const getSavedFolderDefaultsProfile = () => {
    const normalizedPrefs = typeof utils?.normalizePrefs === 'function'
        ? utils.normalizePrefs(folderEditorTypePrefs || {})
        : (folderEditorTypePrefs && typeof folderEditorTypePrefs === 'object' ? folderEditorTypePrefs : {});
    const folderDefaults = normalizedPrefs?.folderDefaults && typeof normalizedPrefs.folderDefaults === 'object'
        ? normalizedPrefs.folderDefaults
        : {};
    const profile = folderDefaults.profile && typeof folderDefaults.profile === 'object'
        ? folderDefaults.profile
        : {};
    const icon = String(profile.icon || '').trim();
    const settings = profile.settings && typeof profile.settings === 'object'
        ? JSON.parse(JSON.stringify(profile.settings))
        : {};
    const actions = Array.isArray(profile.actions)
        ? JSON.parse(JSON.stringify(profile.actions))
        : [];
    if (!icon && Object.keys(settings).length <= 0 && actions.length <= 0) {
        return null;
    }
    return {
        sourceId: String(folderDefaults.sourceId || '').trim(),
        sourceName: String(folderDefaults.sourceName || '').trim(),
        folder: {
            name: '',
            parentId: '',
            icon,
            regex: '',
            containers: [],
            settings,
            actions
        }
    };
};
const applySavedFolderDefaultsToNewFolder = (foldersMap = {}) => {
    if (String(activeFolderEditorFolderId || folderId || '').trim()) {
        return false;
    }
    const savedDefaults = getSavedFolderDefaultsProfile();
    if (!savedDefaults) {
        return false;
    }
    selected = [];
    selectedRegex = [];
    hydrateCurrentEditFolder(savedDefaults.folder, '', foldersMap, { clearPrefill: false });
    const sourceLabel = savedDefaults.sourceName || savedDefaults.sourceId || 'saved profile';
    setParentDefaultsNote(`Loaded saved defaults from "${sourceLabel}".`, 'info');
    return true;
};
const applyRequestedCreateParentToNewFolder = async (foldersMap = {}) => {
    const parentId = normalizeParentFolderId(requestedCreateParentId);
    if (!parentId || String(activeFolderEditorFolderId || folderId || '').trim()) {
        return false;
    }
    if (!Object.prototype.hasOwnProperty.call(foldersMap || {}, parentId)) {
        return false;
    }
    refreshParentFolderChooser(foldersMap, parentId, new Set());
    const form = getForm();
    if (form?.parent_folder_id) {
        form.parent_folder_id.value = parentId;
    }
    const parentName = String(foldersMap?.[parentId]?.name || parentId).trim();
    setParentDefaultsNote(`Creating this folder under "${parentName}".`, 'info');
    await applySmartDefaultsFromParent(parentId, { force: true });
    return true;
};
const getFolderEditorParentPickerApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        if (typeof folderParentPickerModule?.createApi !== 'function') {
            return null;
        }
        cachedApi = folderParentPickerModule.createApi({
            window,
            document,
            $,
            getForm,
            escapeHtml,
            normalizeParentFolderId
        });
        return cachedApi;
    };
})();
const refreshParentFolderChooser = (foldersMap, selectedParentId = '', blockedIds = new Set()) => {
    populateParentFolderOptions(foldersMap, selectedParentId, blockedIds);
    const parentPickerApi = getFolderEditorParentPickerApi();
    if (!parentPickerApi || typeof parentPickerApi.render !== 'function') {
        return;
    }
    parentPickerApi.render({
        entries: buildParentFolderEntries(foldersMap, blockedIds),
        selectedParentId: normalizeParentFolderId(selectedParentId)
    });
};

const normalizeChildFolderOrder = (value) => folderEditorMemberListModule.normalizeChildFolderOrder(value);
const getActiveFolderIdForChildOrdering = () => String(activeFolderEditorResolvedFolderId || activeFolderEditorFolderId || folderId || '').trim();
const getChildFolderOrderIds = () => getFolderEditorMemberListApi().getChildFolderOrderIds();
const updateList = (afterRender = null) => getFolderEditorMemberListApi().updateList(afterRender);

/**
 * Handle the form submission
 * @param {*} e the form
 * @returns {bool} always false
 */
const generateCopyName = (baseName, parentId = '') => {
    const trimmed = (baseName || '').trim() || 'Folder';
    return suggestSiblingName(`${trimmed} Copy`, parentId, '');
};

const buildFolderPayloadFromForm = (e) => {
    const actions = $('input[name*="custom_action"]').map((i, el) => JSON.parse(atob($(el).val()))).get();
    const healthWarnThresholdRaw = String(e.health_warn_stopped_percent?.value || '').trim();
    const healthWarnThreshold = parseOptionalThresholdInput(healthWarnThresholdRaw);
    const healthCriticalThresholdRaw = String(e.health_critical_stopped_percent?.value || '').trim();
    const healthCriticalThreshold = parseOptionalThresholdInput(healthCriticalThresholdRaw);
    const healthProfile = normalizeOptionalHealthSelect(e.health_profile?.value, FOLDER_HEALTH_PROFILE_VALUES);
    const healthUpdatesMode = normalizeOptionalHealthSelect(e.health_updates_mode?.value, FOLDER_HEALTH_UPDATES_MODE_VALUES);
    const healthAllStoppedMode = normalizeOptionalHealthSelect(e.health_all_stopped_mode?.value, FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES);
    const statusWarnThresholdRaw = String(e.status_warn_stopped_percent?.value || '').trim();
    const statusWarnThreshold = parseOptionalThresholdInput(statusWarnThresholdRaw);
    const normalizedPreviewRows = normalizePreviewRowLimit(e.preview_rows?.value);
    const normalizedChildFolderPreviewDepth = normalizeChildFolderPreviewDepth(e.preview_child_folder_depth?.value);
    const normalizedDropdownStyle = normalizeDropdownStyle(e.dropdown_style.value.toString());
    const includedMemberNames = [...$('input[name*="containers"]:checked').map((i, el) => String($(el).val() || '').trim())].filter(Boolean);
    const includedMemberSet = new Set(includedMemberNames);
    const nextHiddenPreviewMembers = $('table.sortable > tbody > tr').map((_, row) => {
        const $row = $(row);
        const name = String($row.attr('data-name') || '').trim();
        return name && includedMemberSet.has(name) && $row.find('input.member-preview-switch').prop('checked') !== true ? name : null;
    }).get().filter(Boolean);
    const memberIdentities = {};
    const memberMap = getMemberMapByName();
    includedMemberNames.forEach((name) => {
        const identity = memberMap.get(name)?.Identity;
        if (identity && typeof identity === 'object') {
            memberIdentities[name] = memberIdentityModule?.normalizeMemberIdentity
                ? memberIdentityModule.normalizeMemberIdentity(identity, type)
                : identity;
        }
    });
    return {
        name: e.name.value.toString().trim(),
        parentId: normalizeParentFolderId(e.parent_folder_id?.value || ''),
        icon: e.icon.value.toString(),
        preview_rows: normalizedPreviewRows,
        previewRows: normalizedPreviewRows,
        dropdown_style: normalizedDropdownStyle,
        dropdownStyle: normalizedDropdownStyle,
        chevron_style: normalizedDropdownStyle,
        chevronStyle: normalizedDropdownStyle,
        settings: {
            folder_webui: e.folder_webui.checked,
            folder_webui_url: e.folder_webui_url.value.toString(),
            webui_profiles: getFolderWebuiProfilesApi()?.serialize() || [],
            preview: parseInt(e.preview.value.toString()),
            preview_rows: normalizedPreviewRows,
            preview_overflow: ['expand_row', 'scroll'].includes(String(e.preview_overflow?.value)) ? String(e.preview_overflow.value) : 'default',
            preview_status: normalizePreviewStatusMode(e.preview_status?.value),
            previewRows: normalizedPreviewRows,
            preview_hover: e.preview_hover.checked,
            preview_hover_animation: normalizePreviewHoverAnimation(e.preview_hover_animation?.value),
            previewHoverAnimation: normalizePreviewHoverAnimation(e.preview_hover_animation?.value),
            preview_update: e.preview_update.checked,
            folder_update_highlight: e.folder_update_highlight?.checked === true,
            preview_text_width: e.preview_text_width.value,
            preview_grayscale: e.preview_grayscale.checked,
            preview_hide_nested_items: e.preview_hide_nested_items.checked,
            child_folder_order: getChildFolderOrderIds(),
            childFolderOrder: getChildFolderOrderIds(),
            preview_child_folder_depth: normalizedChildFolderPreviewDepth,
            previewChildFolderDepth: normalizedChildFolderPreviewDepth,
            preview_webui: e.preview_webui.checked,
            preview_logs: e.preview_logs.checked,
            preview_console: e.preview_console.checked,
            preview_vertical_bars: e.preview_vertical_bars.checked,
            preview_row_separator: e.preview_row_separator?.checked === true,
            preview_row_separator_color: normalizeHexColor(e.preview_row_separator_color?.value, DEFAULT_BORDER_COLOR),
            context: parseInt(e.context.value.toString()),
            context_trigger: parseInt(e.context_trigger.value.toString()),
            context_graph: parseInt(e.context_graph.value.toString()),
            context_graph_time: parseInt(e.context_graph_time.value.toString()),
            preview_border: e.preview_border.checked,
            preview_border_color: e.preview_border_color.value.toString(),
            preview_border_width: normalizePositiveInt(e.preview_border_width.value.toString(), DEFAULT_PREVIEW_BORDER_WIDTH, 1, 4),
            preview_border_glow: e.preview_border_glow.checked,
            previewBorderGlow: e.preview_border_glow.checked,
            preview_vertical_bars_color: e.preview_vertical_bars_color.value.toString(),
            preview_vertical_bars_width: normalizePositiveInt(e.preview_vertical_bars_width.value.toString(), DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH, 1, 4),
            dropdown_style: normalizedDropdownStyle,
            dropdownStyle: normalizedDropdownStyle,
            chevron_style: normalizedDropdownStyle,
            chevronStyle: normalizedDropdownStyle,
            dropdown_color: normalizeHexColor(e.dropdown_color.value.toString(), DEFAULT_DROPDOWN_COLOR),
            dropdown_hover_color: normalizeHexColor(e.dropdown_hover_color.value.toString(), DEFAULT_DROPDOWN_HOVER_COLOR),
            folder_accent_enabled: e.folder_accent_enabled.checked,
            folder_accent_color: normalizeHexColor(e.folder_accent_color.value.toString(), DEFAULT_FOLDER_ACCENT_COLOR),
            status_color_started: normalizeHexColor(e.status_color_started.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.started), status_color_started_explicit: true,
            status_color_paused: normalizeHexColor(e.status_color_paused.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.paused),
            status_color_stopped: normalizeHexColor(e.status_color_stopped.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.stopped), status_color_text: normalizeHexColor(e.status_color_text.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.text), status_color_text_explicit: e.status_color_text_auto?.checked !== true,
            status_color_lock: e.status_color_lock?.checked === true,
            health_warn_stopped_percent: healthWarnThreshold,
            health_critical_stopped_percent: healthCriticalThreshold,
            health_profile: healthProfile,
            health_updates_mode: healthUpdatesMode,
            health_all_stopped_mode: healthAllStoppedMode,
            status_warn_stopped_percent: statusWarnThreshold,
            update_column: e.update_column.checked,
            default_action: e.default_action.checked,
            expand_tab: e.expand_tab.checked,
            override_default_actions: e.override_default_actions.checked,
            expand_dashboard: e.expand_dashboard.checked,
            dashboard_overflow: normalizeDashboardOverflowMode(e.dashboard_overflow?.value),
        },
        regex: e.regex.value.toString(),
        containers: includedMemberNames,
        hiddenPreviewMembers: nextHiddenPreviewMembers,
        memberIdentities,
        actions
    };
};

const buildFolderSettingsSummaryHtml = (entry) => {
    const transferApi = getFolderSettingsTransferApi();
    const summary = transferApi?.summarizeClipboardEntry(entry) || {
        sourceName: 'Current folder settings',
        copiedActionCount: 0,
        droppedMemberBoundActionCount: 0,
        labels: ['Folder settings']
    };
    const pillHtml = summary.labels.map((label) => (
        `<span data-fvplus-style="fv-u-1i4smo6">${escapeHtml(label)}</span>`
    )).join('');
    const skippedHint = summary.droppedMemberBoundActionCount > 0
        ? `<div data-fvplus-style="fv-u-1wnpfz0">Skipped ${summary.droppedMemberBoundActionCount} member-bound custom action${summary.droppedMemberBoundActionCount === 1 ? '' : 's'} to avoid copying source-specific targets.</div>`
        : '';
    return [
        `<div><strong>Source:</strong> ${escapeHtml(summary.sourceName)}</div>`,
        `<div data-fvplus-style="fv-u-1wnpfz0"><strong>Will apply:</strong> ${pillHtml || '<span>Folder settings</span>'}</div>`,
        skippedHint
    ].join('');
};

const getFolderSettingsApplyTargets = () => Object.entries(allFoldersById || {})
    .filter(([id]) => String(id || '').trim() !== '' && String(id || '').trim() !== String(activeFolderEditorFolderId || '').trim())
    .map(([id, folder]) => {
        const parentId = normalizeParentFolderId(folder?.parentId || folder?.parent_id || '');
        const parentName = parentId && allFoldersById[parentId]
            ? String(allFoldersById[parentId]?.name || parentId).trim()
            : 'Top level';
        return {
            id: String(id || '').trim(),
            name: String(folder?.name || id).trim() || String(id || '').trim(),
            parentName
        };
    })
    .sort((left, right) => compareFolderEditorText(left.name, right.name, { sensitivity: 'base' }));

function getMemberBulkMoveTargets() {
    return getFolderSettingsApplyTargets();
}

function describeMemberBulkMoveScope(scope) {
    const normalized = String(scope || '').trim().toLowerCase();
    const match = MEMBER_BULK_SCOPE_OPTIONS.find((entry) => entry.value === normalized);
    return match ? match.label : 'Move shown';
}

function getCurrentMemberBulkMoveScope() {
    return String($('#fvMemberBulkScope').val() || 'shown').trim().toLowerCase() || 'shown';
}

function collectCurrentMemberBulkMoveScope() {
    const scope = getCurrentMemberBulkMoveScope();
    const details = getFolderEditorMembersApi()?.collectBulkMoveScope(scope);
    return details && typeof details === 'object'
        ? details
        : { scope, names: [], skippedRegexNames: [], candidateCount: 0, movableCount: 0 };
}

function renderMemberBulkMoveTargets() {
    const select = $('#fvMemberBulkTarget');
    if (!select.length) {
        return;
    }
    const previousValue = String(select.val() || '').trim();
    const targets = getMemberBulkMoveTargets();
    const options = ['<option value="">Move to folder...</option>'];
    targets.forEach((target) => {
        const detail = target.parentName && target.parentName !== 'Top level'
            ? `${target.name} (${target.parentName})`
            : target.name;
        options.push(`<option value="${escapeHtml(target.id)}">${escapeHtml(detail)}</option>`);
    });
    select.html(options.join(''));
    if (previousValue && targets.some((target) => target.id === previousValue)) {
        select.val(previousValue);
    } else {
        select.val('');
    }
}

function syncMemberSnapshotBaseline() {
    const baseline = parseSnapshotState(initialSnapshot || computeFormSnapshot());
    const current = parseSnapshotState(computeFormSnapshot());
    baseline.members = Array.isArray(current.members) ? current.members : [];
    if (Object.prototype.hasOwnProperty.call(current.fields || {}, 'containers[]')) {
        baseline.fields = baseline.fields && typeof baseline.fields === 'object' ? baseline.fields : {};
        baseline.fields['containers[]'] = current.fields['containers[]'];
    } else if (baseline.fields && typeof baseline.fields === 'object' && Object.prototype.hasOwnProperty.call(baseline.fields, 'containers[]')) {
        delete baseline.fields['containers[]'];
    }
    initialSnapshot = JSON.stringify(baseline);
    updateUnsavedIndicator();
    updateSectionStateIndicators();
    updateChangeSummaryPanel();
}

function clearMemberBulkMoveUndoState() {
    memberBulkMoveUndoState = null;
    memberBulkMoveUndoInFlight = false;
}

const applyMemberBulkMoveResultLocally = (targetFolderId, movedNames = []) => {
    const safeTargetFolderId = normalizeFolderId(targetFolderId);
    const uniqueNames = Array.from(new Set((Array.isArray(movedNames) ? movedNames : []).map((name) => String(name || '').trim()).filter(Boolean)));
    if (!safeTargetFolderId || uniqueNames.length <= 0) {
        return;
    }
    const movedSet = new Set(uniqueNames);
    for (const [folderKey, folderRecord] of Object.entries(allFoldersById || {})) {
        const normalizedFolder = normalizeFolderRecordForEditor(folderRecord || {});
        const nextMembers = (utils?.normalizeFolderMembers ? utils.normalizeFolderMembers(normalizedFolder.containers || []) : [])
            .filter((memberName) => !movedSet.has(String(memberName || '').trim()));
        setFolderMapEntry(allFoldersById, folderKey, {
            ...normalizedFolder,
            containers: nextMembers
        });
    }
    if (allFoldersById[safeTargetFolderId]) {
        const targetFolder = normalizeFolderRecordForEditor(allFoldersById[safeTargetFolderId]);
        const targetMembers = utils?.normalizeFolderMembers
            ? utils.normalizeFolderMembers(targetFolder.containers || [])
            : [];
        uniqueNames.forEach((name) => {
            if (!targetMembers.includes(name)) {
                targetMembers.push(name);
            }
        });
        setFolderMapEntry(allFoldersById, safeTargetFolderId, {
            ...targetFolder,
            containers: targetMembers
        });
    }

    selected = selected.filter((member) => {
        const safeName = String(member?.Name || '').trim();
        return !(safeName && movedSet.has(safeName));
    });
    choose = choose.filter((member) => {
        const safeName = String(member?.Name || '').trim();
        return !(safeName && movedSet.has(safeName));
    });
    updateList(() => {
        syncMemberSnapshotBaseline();
        renderMemberBulkMoveTargets();
        updateMemberBulkMoveUi();
    });
};

const restoreEditorBulkMoveBackup = async (backupName) => {
    const safeBackupName = String(backupName || '').trim();
    if (!safeBackupName) {
        throw new Error('Backup name is required.');
    }
    if (!requestClient || typeof requestClient.postJson !== 'function') {
        throw new Error('Backup restore API unavailable.');
    }
    const response = await requestClient.postJson('/plugins/folderview.plus/server/backup.php', {
        type,
        action: 'restore',
        name: safeBackupName
    });
    if (!response?.ok) {
        throw new Error(response?.error || 'Undo failed.');
    }
    return response.restore || {};
};

function setMemberBulkMoveUndoState(backup, successMessage) {
    memberBulkMoveUndoState = {
        backupName: String(backup?.name || '').trim(),
        message: String(successMessage || '').trim() || 'Bulk move complete.'
    };
    memberBulkMoveUndoInFlight = false;
}

async function undoEditorMemberBulkMove() {
    const backupName = String(memberBulkMoveUndoState?.backupName || '').trim();
    if (!backupName || memberBulkMoveUndoInFlight) {
        return false;
    }
    memberBulkMoveUndoInFlight = true;
    updateMemberBulkMoveUi();
    try {
        await restoreEditorBulkMoveBackup(backupName);
        suppressUnloadPrompt = true;
        location.reload();
        return true;
    } catch (error) {
        memberBulkMoveUndoInFlight = false;
        updateMemberBulkMoveUi();
        swal({
            title: 'Undo failed',
            text: extractAjaxErrorMessage(error, 'bulk move undo'),
            type: 'error'
        });
        return false;
    }
}

async function applyEditorMemberBulkMove() {
    if (memberBulkMoveInFlight) {
        return false;
    }
    if (getSectionChangeItems('members').length > 0) {
        swal({
            title: 'Save member edits first',
            text: 'Bulk move is disabled while the Members section has unsaved local changes. Submit or reset those member edits first, then run the move.',
            type: 'warning'
        });
        return false;
    }
    const targetFolderId = String($('#fvMemberBulkTarget').val() || '').trim();
    if (!targetFolderId) {
        swal({
            title: 'Select a folder',
            text: 'Choose a target folder for the bulk move first.',
            type: 'error'
        });
        return false;
    }
    const sharedApi = getFolderBulkAssignmentSharedApi();
    if (!sharedApi) {
        swal({
            title: 'Bulk move unavailable',
            text: 'The shared bulk assignment engine did not load on this page.',
            type: 'error'
        });
        return false;
    }
    const scopeDetails = collectCurrentMemberBulkMoveScope();
    const plan = sharedApi.buildBulkAssignmentPlan(type, targetFolderId, scopeDetails.names || []);
    const scopeLabel = describeMemberBulkMoveScope(scopeDetails.scope);
    if (!plan.targetFolderId) {
        swal({
            title: 'Missing target folder',
            text: 'Select a target folder before applying the bulk move.',
            type: 'error'
        });
        return false;
    }
    if (!plan.selectedNames.length && scopeDetails.skippedRegexNames.length > 0) {
        swal({
            title: 'Nothing movable in this scope',
            text: 'The current scope only contains regex-controlled members. Edit the folder rules instead of using bulk move for those entries.',
            type: 'info'
        });
        return false;
    }
    if (!plan.selectedNames.length) {
        swal({
            title: 'Nothing selected',
            text: 'There are no movable members in the current scope.',
            type: 'info'
        });
        return false;
    }

    const regexSkipText = scopeDetails.skippedRegexNames.length > 0
        ? `\nRegex-controlled skipped: ${scopeDetails.skippedRegexNames.length}`
        : '';
    const summary = [
        `Scope: ${scopeLabel}`,
        `Target: ${plan.targetFolderName || plan.targetFolderId}`,
        `Create: ${plan.creates.length}`,
        `Move: ${plan.moves.length}`,
        `Unchanged: ${plan.unchanged.length}`,
        `Invalid: ${plan.invalidNames.length}`,
        `Duplicates dropped: ${plan.duplicateNames.length}${regexSkipText}`
    ].join('\n');

    swal({
        title: `${scopeLabel}?`,
        text: `${summary}\n\nA backup snapshot will be created first.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Move',
        cancelButtonText: 'Cancel',
        closeOnConfirm: false,
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        memberBulkMoveInFlight = true;
        clearMemberBulkMoveUndoState();
        updateMemberBulkMoveUi();
        try {
            const preludeLines = sharedApi.buildBulkAssignmentPreludeLines(plan, {
                extraSkipped: (scopeDetails.skippedRegexNames || []).map((name) => ({
                    name,
                    detail: 'Skipped because this member is currently controlled by folder rules or labels.'
                }))
            });
            const executionResult = await sharedApi.executeBulkAssignmentPlan(type, plan, {
                typeLabel: type === 'docker' ? 'Docker' : 'VM',
                operationScope: 'editor-bulk-move',
                operationLabel: `${type === 'docker' ? 'Docker' : 'VM'} editor bulk move`,
                backupReason: 'before-folder-editor-bulk-move',
                preludeLines,
                offerUndo: false,
                trackDiagnostics: false,
                onProgress: ({ chunkNumber, chunkCount, chunkSize }) => {
                    $('#fvMemberBulkSummary').text(`Applying chunk ${chunkNumber}/${chunkCount} (${chunkSize} item${chunkSize === 1 ? '' : 's'})...`);
                    updateMemberBulkMoveUi();
                }
            });
            if (executionResult?.cancelled) {
                $('#fvMemberBulkSummary').text(executionResult.summary || 'Bulk move is already running.');
                swal.close();
                return;
            }
            swal.close();
            applyMemberBulkMoveResultLocally(plan.targetFolderId, executionResult?.lines?.filter((entry) => entry.status === 'success').map((entry) => entry.name) || []);
            const successMessage = executionResult?.summary || `Moved ${plan.actionableNames.length} item${plan.actionableNames.length === 1 ? '' : 's'}.`;
            setMemberBulkMoveUndoState(executionResult?.backup || null, successMessage);
            updateMemberBulkMoveUi();
        } catch (error) {
            $('#fvMemberBulkSummary').text('Bulk move failed.');
            swal({
                title: 'Bulk move failed',
                text: extractAjaxErrorMessage(error, 'member bulk move'),
                type: 'error'
            });
        } finally {
            memberBulkMoveInFlight = false;
            updateMemberBulkMoveUi();
        }
    });
    return false;
}

function updateMemberBulkMoveUi() {
    const summaryNode = $('#fvMemberBulkSummary');
    const moveButton = $('#fvMemberBulkMove');
    const targetSelect = $('#fvMemberBulkTarget');
    const scopeDetails = collectCurrentMemberBulkMoveScope();
    const targetFolderId = String(targetSelect.val() || '').trim();
    if (moveButton.length) {
        moveButton.prop('disabled', memberBulkMoveInFlight || !targetFolderId || (scopeDetails.movableCount || 0) <= 0);
        moveButton.html(memberBulkMoveInFlight
            ? '<i class="fa fa-refresh fa-spin"></i> Moving...'
            : '<i class="fa fa-exchange"></i> Move to folder');
    }
    if (!summaryNode.length) {
        return;
    }
    if (memberBulkMoveInFlight) {
        return;
    }
    if (memberBulkMoveUndoState) {
        const successText = escapeHtml(String(memberBulkMoveUndoState.message || 'Bulk move complete.'));
        const backupName = escapeHtml(String(memberBulkMoveUndoState.backupName || '').trim());
        if (memberBulkMoveUndoInFlight && backupName) {
            summaryNode.html(`<span class="fv-member-bulk-summary-text">${successText} Restoring backup ${backupName}...</span>`);
            return;
        }
        if (backupName) {
            summaryNode.html(`
                <span class="fv-member-bulk-summary-text">${successText} Backup created: ${backupName}.</span>
                <button type="button" id="fvMemberBulkUndo" class="fv-member-bulk-inline-action">Undo</button>
            `);
            $('#fvMemberBulkUndo').off('click').on('click', () => {
                void undoEditorMemberBulkMove();
            });
            return;
        }
        summaryNode.html(`<span class="fv-member-bulk-summary-text">${successText}</span>`);
        return;
    }
    if ((scopeDetails.movableCount || 0) <= 0) {
        summaryNode.text(scopeDetails.skippedRegexNames.length > 0
            ? 'Current scope only contains regex-controlled members. Those stay controlled by rules.'
            : 'No movable members in the current scope.');
        return;
    }
    const regexNote = scopeDetails.skippedRegexNames.length > 0
        ? ` • ${scopeDetails.skippedRegexNames.length} regex-controlled skipped`
        : '';
    summaryNode.text(`${scopeDetails.movableCount} ready to move${regexNote}`);
}

const buildFolderSettingsApplyDialogHtml = (entry, targets) => {
    const summaryHtml = buildFolderSettingsSummaryHtml(entry);
    const targetHtml = targets.map((target) => `
        <label data-fvplus-style="fv-u-vo5fty">
            <input class="fv-folder-settings-target" type="checkbox" value="${escapeHtml(target.id)}" data-fvplus-style="fv-u-dc2vxe">
            <span>
                <strong>${escapeHtml(target.name)}</strong>
                <span data-fvplus-style="fv-u-3q0p6m">${escapeHtml(target.parentName)}</span>
            </span>
        </label>
    `).join('');
    return [
        '<div class="fv-folder-settings-apply-dialog" data-fvplus-style="fv-u-18w5s3q">',
        `<div data-fvplus-style="fv-u-tczc3j">${summaryHtml}</div>`,
        '<div data-fvplus-style="fv-u-k1hi7u">',
        `<strong>Apply to ${targets.length} folder${targets.length === 1 ? '' : 's'}</strong>`,
        '<span>',
        '<button type="button" class="btn btn-small" id="fv-folder-settings-select-all" data-fvplus-style="fv-u-1of1hjl">Select all</button>',
        '<button type="button" class="btn btn-small" id="fv-folder-settings-clear-all">Clear</button>',
        '</span>',
        '</div>',
        '<div data-fvplus-style="fv-u-1g3cbq1">',
        targetHtml,
        '</div>',
        '</div>'
    ].join('');
};

const bindFolderSettingsApplyDialogHelpers = () => {
    $(document)
        .off('click.fvFolderSettingsSelectAll', '#fv-folder-settings-select-all')
        .on('click.fvFolderSettingsSelectAll', '#fv-folder-settings-select-all', (event) => {
            event.preventDefault();
            $('.fv-folder-settings-target').prop('checked', true);
        });
    $(document)
        .off('click.fvFolderSettingsClearAll', '#fv-folder-settings-clear-all')
        .on('click.fvFolderSettingsClearAll', '#fv-folder-settings-clear-all', (event) => {
            event.preventDefault();
            $('.fv-folder-settings-target').prop('checked', false);
        });
};

const unbindFolderSettingsApplyDialogHelpers = () => {
    $(document).off('click.fvFolderSettingsSelectAll', '#fv-folder-settings-select-all');
    $(document).off('click.fvFolderSettingsClearAll', '#fv-folder-settings-clear-all');
};

const applyFolderSettingsToFolders = async () => {
    if (!validateForm()) {
        return false;
    }
    const form = getForm();
    if (!form) {
        return false;
    }
    const transferApi = getFolderSettingsTransferApi();
    if (!transferApi) {
        if (typeof swal === 'function') {
            swal({
                title: 'Apply unavailable',
                text: 'Folder settings transfer is unavailable on this page load.',
                type: 'error'
            });
        }
        return false;
    }
    const sourceFolder = buildFolderPayloadFromForm(form);
    const clipboardEntry = transferApi.buildClipboardEntry(type, sourceFolder, {
        sourceId: activeFolderEditorFolderId,
        sourceName: String(sourceFolder?.name || 'Current folder').trim(),
        sourceContext: 'folder-editor'
    });
    const targets = getFolderSettingsApplyTargets();
    if (!targets.length) {
        swal({
            title: 'No target folders',
            text: `There are no other ${type === 'docker' ? 'Docker' : 'VM'} folders to update yet.`,
            type: 'info'
        });
        return false;
    }
    transferApi.writeClipboardEntry(clipboardEntry);
    bindFolderSettingsApplyDialogHelpers();
    swal({
        title: 'Apply folder settings',
        text: buildFolderSettingsApplyDialogHtml(clipboardEntry, targets),
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        closeOnConfirm: false,
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            unbindFolderSettingsApplyDialogHelpers();
            return;
        }
        const selectedIds = $('.fv-folder-settings-target:checked').map((_, node) => String($(node).val() || '').trim()).get().filter(Boolean);
        if (!selectedIds.length) {
            if (typeof swal.showInputError === 'function') {
                swal.showInputError('Select at least one target folder.');
            }
            return false;
        }
        try {
            await securePost('/plugins/folderview.plus/server/apply_folder_settings.php', {
                type,
                targetIds: JSON.stringify(selectedIds),
                settings: JSON.stringify(clipboardEntry.payload)
            });
            unbindFolderSettingsApplyDialogHelpers();
            swal.close();
            swal({
                title: 'Folder settings applied',
                text: `Applied to ${selectedIds.length} folder${selectedIds.length === 1 ? '' : 's'}. A backup snapshot was created before the update.`,
                type: 'success'
            });
        } catch (error) {
            unbindFolderSettingsApplyDialogHelpers();
            const message = extractAjaxErrorMessage(error, 'apply folder settings');
            swal({
                title: 'Apply failed',
                text: message,
                type: 'error'
            });
        }
        return true;
    });
    return false;
};

const submitForm = async (e, saveAsCopy = false) => {
    if (!validateForm()) {
        return false;
    }
    const folder = buildFolderPayloadFromForm(e);
    const currentFolderId = String(activeFolderEditorFolderId || folderId || '').trim();
    const previousFolder = !saveAsCopy && currentFolderId && allFoldersById[currentFolderId]
        ? normalizeFolderRecordForEditor(allFoldersById[currentFolderId])
        : null;
    if (saveAsCopy) {
        folder.name = generateCopyName(folder.name, folder.parentId);
    }
    if (!folder.name) {
        setFieldError('name', 'Folder name is required.');
        return false;
    }
    try {
        // send the data to the right endpoint
        if (folderId && !saveAsCopy) {
            const saveResponse = await securePost('/plugins/folderview.plus/server/update.php', {
                type: type,
                content: JSON.stringify(folder),
                id: folderId,
                expectedRevision: folderEditorExpectedFolderRevision
            });
            const savedRevision = Number.parseInt(String(saveResponse?.metadata?.folderRevision ?? ''), 10);
            if (Number.isFinite(savedRevision) && savedRevision >= 0) {
                folderEditorExpectedFolderRevision = savedRevision;
            }
        } else {
            await securePost('/plugins/folderview.plus/server/create.php', {
                type: type,
                content: JSON.stringify(folder)
            });
        }

        await flushPostSaveTypeSync({
            force: saveAsCopy || !currentFolderId,
            folder,
            folderId: currentFolderId,
            previousFolder
        });
    } catch (error) {
        const message = extractAjaxErrorMessage(error, 'folder save');
        if (typeof swal === 'function') {
            swal({
                title: 'Save failed',
                text: message,
                type: 'error'
            });
        } else {
            alert(message);
        }
        return false;
    }

    // return to the right tab
    suppressUnloadPrompt = true;
    let loc = location.pathname.split('/');
    loc.pop();
    location.href = loc.join('/');
    
    return false;
};

/**
 * Handles the button to return to the tab
 */
const cancelBtn = () => {
    if (updateUnsavedIndicator()) {
        const confirmLeave = confirm('You have unsaved changes. Leave without saving?');
        if (!confirmLeave) {
            return;
        }
    }
    suppressUnloadPrompt = true;
    let loc = location.pathname.split('/');
    loc.pop();
    location.href = loc.join('/');
};

const resetUnsavedChanges = () => {
    if (!updateUnsavedIndicator()) {
        return;
    }
    const confirmed = confirm('Discard all unsaved changes and reload this editor?');
    if (!confirmed) {
        return;
    }
    suppressUnloadPrompt = true;
    location.reload();
};

/**
 * Set the Folder icon to the clicked element icon
 * @param {*} e the element
 */
const setIconAsContainer = (e) => {
    const form = getForm();
    form.icon.value = e.firstChild.src;
    $(form.icon).trigger('input');
};

/**
 * Add a custom action to the folder
 * @param {number | undefined} action 
 */
const customAction = (action = undefined) => {
    let config = {
        name: '',
        type: 0,
        action: 0,
        modes: 0,
        conatiners: [],
        script_icon: ''
    };
    if(action !== undefined) {
        config = JSON.parse(atob($('input[name*="custom_action"]').map((i, e) => $(e).val()).get()[action]));
    }
    const dialog = $('.dialogCustomAction');
    const customNumber = $('input[name*="custom_action"]').length;
    dialog.html($('.templateDialogCustomAction').html());
    const targetSelect = dialog.find('[name="action_elements"]');
    const eligibleTargets = Array.from(new Set([
        ...$('input[name*="containers"]:checked').map((i, e) => String($(e).val() || '').trim()).get(),
        ...selectedRegex.map((entry) => String(entry?.Name || '').trim())
    ].filter(Boolean)));
    const configuredTargetsSource = Array.isArray(config.conatiners)
        ? config.conatiners
        : (Array.isArray(config.containers) ? config.containers : []);
    const configuredTargets = configuredTargetsSource.map(String);
    eligibleTargets.forEach((targetName) => {
        const option = document.createElement('option');
        option.value = targetName;
        option.textContent = targetName;
        option.selected = configuredTargets.includes(targetName);
        targetSelect.get(0)?.appendChild(option);
    });

    const modeSelect = dialog.find('[name="action_type"]');
    const actionSelect = dialog.find('[name="action_standard"]');
    const nameInput = dialog.find('[name="action_name"]');
    const scriptInput = dialog.find('[name="action_script"]');
    const iconInput = dialog.find('[name="action_script_icon"]');
    const primaryLabel = (action !== undefined) ? $.i18n('action-edit-btn') : $.i18n('action-add-btn');
    const targetSubject = type === 'vm' ? 'VMs' : 'Containers';
    let primaryButton = $();
    let validationTouched = false;

    dialog.find('[data-fv-action-target-label]').text(`${targetSubject}:`);
    dialog.find('[data-action-help="targets"]').text(`Only ${targetSubject.toLowerCase()} currently available to this folder are listed.`);
    targetSelect.multiselect({
        header: false,
        noneSelectedText: "Select options",
        zIndex: 99998,
        appendTo: document.body,
        selectedText: (numChecked) => `${numChecked} selected`,
        click: () => window.setTimeout(() => {
            syncTargetSummary();
            validateActionDialog(false);
        }, 0),
        classes: 'multiselect-container'
    });
    nameInput.val(config.name);
    modeSelect.val(String(config.type));
    dialog.find('input.basic-switch-sync').prop("checked", config.script_sync || false);
    dialog.find('input.basic-switch-sync').switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on')});
    if(Number(config.type) === 0) {
        actionSelect.val(String(config.action));
        if(Number(config.action) === 0) {
            dialog.find('[name="action_cycle"]').val(config.modes);
        } else if(Number(config.action) === 1) {
            dialog.find('[name="action_set"]').val(config.modes);
        }
    } else if(Number(config.type) === 1){
        scriptInput.val(config.script || '');
        dialog.find('[name="action_script_args"]').val(config.script_args || '');
    }
    iconInput.val(config.script_icon || '');

    const normalizePreviewIconClass = (value, mode = Number(modeSelect.val() || 0)) => {
        const fallback = mode === 1 ? 'fa-file-text-o' : 'fa-cogs';
        const iconClass = String(value || '').trim().split(/\s+/).find((entry) => /^fa-[a-z0-9-]+$/i.test(entry));
        return iconClass || fallback;
    };

    const syncIconPreview = () => {
        const iconClass = normalizePreviewIconClass(iconInput.val());
        dialog.find('.fv-action-icon-preview > i').attr('class', `fa ${iconClass}`);
    };

    const syncTargetSummary = () => {
        const selectedTargets = (targetSelect.val() || []).map(String);
        dialog.find('[data-fv-action-target-count]').text(`${selectedTargets.length} selected`);
        const chips = dialog.find('[data-fv-action-target-chips]').empty();
        if (eligibleTargets.length === 0) {
            chips.append($('<span class="is-empty"></span>').text(`No eligible ${targetSubject.toLowerCase()} are currently available.`));
        } else if (selectedTargets.length === 0) {
            chips.append($('<span class="is-empty"></span>').text(`No ${targetSubject.toLowerCase()} selected yet.`));
        } else {
            selectedTargets.forEach((targetName) => {
                chips.append($('<span></span>').text(targetName));
            });
        }
        dialog.find('[data-action-target-command="all"]').prop('disabled', eligibleTargets.length === 0 || selectedTargets.length === eligibleTargets.length);
        dialog.find('[data-action-target-command="clear"]').prop('disabled', selectedTargets.length === 0);
    };

    const syncStandardAction = () => {
        const actionMode = String(actionSelect.val() || '0');
        dialog.find('[constraint*="action-standard-"]').hide();
        dialog.find(`[constraint*="action-standard-${actionMode}"]`).css('display', 'grid');
    };

    const syncActionType = (nextType = modeSelect.val()) => {
        const mode = String(nextType) === '1' ? '1' : '0';
        modeSelect.val(mode);
        dialog.find('[constraint*="action-type-"]').hide();
        dialog.find(`[constraint*="action-type-${mode}"]`).css('display', 'grid');
        dialog.find('[data-action-type]').each((index, element) => {
            const button = $(element);
            const selected = String(button.attr('data-action-type')) === mode;
            button.toggleClass('is-selected', selected)
                .attr('aria-checked', selected ? 'true' : 'false')
                .attr('tabindex', selected ? '0' : '-1');
        });
        syncStandardAction();
        syncIconPreview();
    };

    const setFieldValidity = (input, valid, errorSelector, showErrors) => {
        const field = input.closest('.fv-action-dialog-field, .action-subject');
        field.toggleClass('is-invalid', showErrors && !valid);
        dialog.find(errorSelector).prop('hidden', !(showErrors && !valid));
    };

    const validateActionDialog = (showErrors = validationTouched) => {
        const mode = Number(modeSelect.val() || 0);
        const nameValid = String(nameInput.val() || '').trim() !== '';
        const targetsValid = mode !== 0 || (targetSelect.val() || []).length > 0;
        const scriptValid = mode !== 1 || String(scriptInput.val() || '').trim() !== '';
        setFieldValidity(nameInput, nameValid, '[data-action-error="name"]', showErrors);
        setFieldValidity(targetSelect, targetsValid, '[data-action-error="targets"]', showErrors);
        setFieldValidity(scriptInput, scriptValid, '[data-action-error="script"]', showErrors);
        const valid = nameValid && targetsValid && scriptValid;
        dialog.find('.fv-action-validation-summary').prop('hidden', !(showErrors && !valid));
        primaryButton.prop('disabled', !valid).attr('aria-disabled', valid ? 'false' : 'true');
        return valid;
    };

    const persistAction = () => {
        validationTouched = true;
        if (!validateActionDialog(true)) {
            dialog.find('.is-invalid').first()
                .find('.ui-multiselect:visible, input:visible, select:visible, button:visible')
                .first()
                .trigger('focus');
            return;
        }
        let cfg = {
            name: String(nameInput.val() || '').trim(),
            type: parseInt(modeSelect.val()),
        };
        cfg.script_icon = normalizePreviewIconClass(iconInput.val(), cfg.type);
        if(cfg.type === 0) {
            cfg.conatiners = (targetSelect.val() || []).map(String);
            cfg.action = parseInt(actionSelect.val());
            if(cfg.action === 0) {
                cfg.modes = parseInt(dialog.find('[name="action_cycle"]').val());
            } else if(cfg.action === 1) {
                cfg.modes = parseInt(dialog.find('[name="action_set"]').val());
            }
        } else if(cfg.type === 1) {
            cfg.script = String(scriptInput.val() || '').trim();
            cfg.script_args = dialog.find('[name="action_script_args"]').val();
            cfg.script_sync = dialog.find('[name="action_script_sync"]').prop("checked");
        }
        if(action !== undefined) {
            $(`.custom-action-n-${action} > input[type="hidden"]`).val(btoa(JSON.stringify(cfg)));
            $(`.custom-action-n-${action} > span`).text(cfg.name + ' ');
        } else {
            const safeCfgName = escapeHtml(cfg.name || '');
            $('.custom-action-wrapper').append(`<div class="custom-action-n-${(action !== undefined) ? action : customNumber}"><span>${safeCfgName} </span><button data-fv-onclick="return customAction(${(action !== undefined) ? action : customNumber});"><i class="fa fa-pencil" aria-hidden="true"></i></button><button data-fv-onclick="return rCcustomAction(${(action !== undefined) ? action : customNumber});"><i class="fa fa-trash" aria-hidden="true"></i></button><input type="hidden" name="custom_action[]" value="${btoa(JSON.stringify(cfg))}"></div>`);
        }
        if (isFormInitialized) {
            validateForm();
            updateUnsavedIndicator();
        }
        dialog.dialog("close");
    };

    dialog.find('[data-action-type]').on('click', function() {
        syncActionType($(this).attr('data-action-type'));
        validateActionDialog(false);
    }).on('keydown', function(event) {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const nextMode = String($(this).attr('data-action-type')) === '0' ? '1' : '0';
        const nextButton = dialog.find(`[data-action-type="${nextMode}"]`);
        syncActionType(nextMode);
        nextButton.trigger('focus');
        validateActionDialog(false);
    });
    actionSelect.on('change', () => {
        syncStandardAction();
        validateActionDialog(false);
    });
    nameInput.add(scriptInput).on('input', () => validateActionDialog(false));
    iconInput.on('input', syncIconPreview);
    targetSelect.on('change', () => {
        syncTargetSummary();
        validateActionDialog(false);
    });
    dialog.find('[data-action-target-command]').on('click', function() {
        const selectAll = $(this).attr('data-action-target-command') === 'all';
        targetSelect.find('option').prop('selected', selectAll);
        targetSelect.multiselect('refresh').trigger('change');
    });

    dialog.dialog({
        title: (action !== undefined) ? $.i18n('action-edit') : $.i18n('action-add'),
        resizable: false,
        width: Math.max(320, Math.min(640, window.innerWidth - 24)),
        modal: true,
        position: { my: 'center', at: 'center', of: window },
        show: { effect: 'fade', duration: 250 },
        hide: { effect: 'fade', duration: 250 },
        buttons: [
            { text: primaryLabel, class: 'fv-action-dialog-primary', click: persistAction },
            { text: $.i18n('cancel'), class: 'fv-action-dialog-secondary', click() { $(this).dialog('close'); } }
        ],
        open: () => window.setTimeout(() => nameInput.trigger('focus'), 0),
        close: () => {
            try {
                targetSelect.multiselect("destroy");
            } catch (_error) {
                // The selector may already be destroyed by the host dialog lifecycle.
            }
        }
    });
    const dialogWidget = dialog.closest('.ui-dialog');
    dialogWidget.addClass('fv-folder-action-dialog');
    dialogWidget.css({ maxWidth: 'calc(100vw - 24px)' });
    dialogWidget.find('.ui-dialog-titlebar').addClass('menu');
    dialogWidget.find('.ui-dialog-title').css({ 'text-align': 'left', width: '100%' });
    const dialogButtons = dialogWidget.find('.ui-dialog-buttonpane button');
    primaryButton = dialogButtons.first().addClass('fv-action-dialog-primary');
    dialogButtons.eq(1).addClass('fv-action-dialog-secondary');
    dialogWidget.find('.ui-dialog-titlebar-close').attr('aria-label', $.i18n('cancel'));
    syncActionType(config.type);
    syncTargetSummary();
    validateActionDialog(false);
    return false;
};

/**
 * Remove a custom action from the folder
 * @param {number} action 
 */
const rCcustomAction =  (action) => {
    $(`.custom-action-n-${action}`).remove();
    if (isFormInitialized) {
        validateForm();
        updateUnsavedIndicator();
    }
    return false;
};

window.updateIcon = updateIcon;
window.updateRegex = updateRegex;
window.updateForm = updateForm;
window.submitForm = submitForm;
window.applyFolderSettingsToFolders = applyFolderSettingsToFolders;
window.cancelBtn = cancelBtn;
window.resetUnsavedChanges = resetUnsavedChanges;
window.applyEditorPluginDefaults = applyEditorPluginDefaults;
window.suggestDefaultsFromMembers = suggestDefaultsFromMembers;
window.setIconAsContainer = setIconAsContainer;
window.customAction = customAction;
window.rCcustomAction = rCcustomAction;
void startFolderEditorRuntime().catch((error) => {
    const safeError = error instanceof Error ? error : new Error(String(error || 'Unknown folder editor bootstrap failure.'));
    setValidationBannerState(
        'Folder editor failed to finish loading.',
        safeError.message || 'Unknown folder editor bootstrap failure.',
        'invalid'
    );
    throw safeError;
});
})(window, window.jQuery || window.$);
