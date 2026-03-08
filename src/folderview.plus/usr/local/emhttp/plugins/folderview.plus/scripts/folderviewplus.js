const utils = window.FolderViewPlusUtils;
const EXPORT_BASENAME = 'FolderView Plus Export';
const REQUEST_TOKEN_STORAGE_KEY = 'fv.request.token';
const requestClient = window.FolderViewPlusRequest || null;
const settingsChrome = window.FolderViewPlusSettingsChrome || null;

let dockers = {};
let vms = {};
let pluginVersion = '0.0.0';
let prefsByType = {
    docker: utils.normalizePrefs({}),
    vm: utils.normalizePrefs({})
};
let infoByType = {
    docker: {},
    vm: {}
};
let backupsByType = {
    docker: [],
    vm: []
};
let templatesByType = {
    docker: [],
    vm: []
};
let selectedRuleIdsByType = {
    docker: new Set(),
    vm: new Set()
};
let selectedTemplateIdsByType = {
    docker: new Set(),
    vm: new Set()
};
let filtersByType = {
    docker: {
        folders: '',
        rules: '',
        backups: '',
        templates: ''
    },
    vm: {
        folders: '',
        rules: '',
        backups: '',
        templates: ''
    }
};
let healthMetricsByType = {
    docker: null,
    vm: null
};
let healthFilterByType = {
    docker: 'all',
    vm: 'all'
};
let healthSeverityFilterByType = {
    docker: 'all',
    vm: 'all'
};
let statusFilterByType = {
    docker: 'all',
    vm: 'all'
};
let statusSnapshotByType = {
    docker: {},
    vm: {}
};
let dockerUpdatesOnlyFilter = false;
let importSelectionState = null;
let importDiffPagingState = {
    rows: [],
    page: 1,
    pageSize: 80
};
let backupCompareDiffPagingState = {
    rows: [],
    page: 1,
    pageSize: 120
};
const IMPORT_APPLY_CHUNK_SIZE = 20;
const IMPORT_APPLY_CHUNK_PAUSE_MS = 16;
let lastDiagnostics = null;
let latestPrefsBackupByType = {
    docker: null,
    vm: null
};
let backupCompareSelectionByType = {
    docker: {
        left: '',
        right: '__current__',
        includePrefs: true
    },
    vm: {
        left: '',
        right: '__current__',
        includePrefs: true
    }
};

const UI_MODE_STORAGE_KEY = 'fv.settings.mode.v1';
const WIZARD_DONE_STORAGE_KEY = 'fv.settings.wizard.v1.done';
const SETUP_ASSISTANT_DONE_STORAGE_KEY = 'fv.settings.setupAssistant.v2.done';
const SETUP_ASSISTANT_DRAFT_STORAGE_KEY = 'fv.settings.setupAssistant.v2.draft';
const SETUP_ASSISTANT_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const SETUP_ASSISTANT_VERSION = 2;
const ADVANCED_TAB_STORAGE_KEY = 'fv.settings.advancedTab.v1';
const ADVANCED_SECTION_STORAGE_KEY = 'fv.settings.advancedSection.v1';
const ADVANCED_EXPANDED_STORAGE_KEY = 'fv.settings.advancedExpanded.v2';
const ADVANCED_KNOWN_STORAGE_KEY = 'fv.settings.advancedKnown.v1';
const SEARCH_ALL_ADVANCED_STORAGE_KEY = 'fv.settings.searchAllAdvanced.v1';
const UPDATE_NOTES_SEEN_VERSION_STORAGE_KEY = 'fv.settings.updateNotesSeenVersion.v1';
const IMPORT_PRESET_DEFAULT_ID = 'builtin:merge';
const IMPORT_PRESET_BUILTINS = [
    {
        id: 'builtin:merge',
        name: 'Merge safely',
        mode: 'merge',
        dryRunOnly: false
    },
    {
        id: 'builtin:replace',
        name: 'Replace fully',
        mode: 'replace',
        dryRunOnly: false
    },
    {
        id: 'builtin:skip',
        name: 'Add new only',
        mode: 'skip',
        dryRunOnly: false
    },
    {
        id: 'builtin:dryrun',
        name: 'Dry-run merge',
        mode: 'merge',
        dryRunOnly: true
    }
];
const UPDATE_NOTES_CHANGELOG_URL = 'https://github.com/alexphillips-dev/FolderView-Plus/blob/main/folderview.plus.plg';
const PERF_DIAGNOSTICS_SAMPLE_LIMIT = 30;
const performanceDiagnosticsState = {
    refresh: { docker: [], vm: [] },
    import: { docker: [], vm: [] },
    updatedAt: 0
};
const LEGACY_ADVANCED_SECTION_KEYS = [
    'auto-assignment',
    'bulk-assignment',
    'runtime-actions',
    'backups',
    'folder-templates',
    'change-history',
    'diagnostics',
    'conflict-inspector'
];
const ADVANCED_SECTION_KEYS = new Set([
    'auto-assignment',
    'bulk-assignment',
    'runtime-actions',
    'backups',
    'folder-templates',
    'change-history',
    'folder-health',
    'diagnostics',
    'conflict-inspector'
]);
const ADVANCED_GROUPS = ['automation', 'recovery', 'operations', 'diagnostics'];
const ADVANCED_GROUP_LABELS = {
    automation: 'Automation',
    recovery: 'Recovery',
    operations: 'Operations',
    diagnostics: 'Diagnostics'
};
const ADVANCED_GROUP_BY_SECTION = {
    'auto-assignment': 'automation',
    'bulk-assignment': 'automation',
    'conflict-inspector': 'automation',
    'backups': 'recovery',
    'change-history': 'recovery',
    'runtime-actions': 'operations',
    'folder-templates': 'operations',
    'folder-health': 'diagnostics',
    'diagnostics': 'diagnostics'
};
const BASIC_WORKSPACE_SECTION_KEYS = new Set(['docker', 'vms']);
const SETUP_ASSISTANT_STEPS = ['welcome', 'profile', 'import', 'rules', 'behavior', 'review'];
const SETUP_ASSISTANT_ENV_PRESETS = {
    home_lab: {
        label: 'Home Lab',
        description: 'Balanced defaults for personal or mixed-use servers.',
        behavior: {
            docker: {
                sortMode: 'created',
                hideEmptyFolders: false,
                statusMode: 'summary',
                statusWarnStoppedPercent: 60,
                healthCardsEnabled: true,
                runtimeBadgeEnabled: false
            },
            vm: {
                sortMode: 'created',
                hideEmptyFolders: false,
                statusMode: 'summary',
                statusWarnStoppedPercent: 60,
                healthCardsEnabled: true,
                runtimeBadgeEnabled: false
            }
        }
    },
    production: {
        label: 'Production',
        description: 'Stricter visibility with stronger attention thresholds.',
        behavior: {
            docker: {
                sortMode: 'manual',
                hideEmptyFolders: true,
                statusMode: 'summary',
                statusWarnStoppedPercent: 40,
                healthCardsEnabled: true,
                runtimeBadgeEnabled: true
            },
            vm: {
                sortMode: 'manual',
                hideEmptyFolders: true,
                statusMode: 'summary',
                statusWarnStoppedPercent: 40,
                healthCardsEnabled: true,
                runtimeBadgeEnabled: true
            }
        }
    },
    media_stack: {
        label: 'Media Stack',
        description: 'Relaxed defaults tuned for larger media container sets.',
        behavior: {
            docker: {
                sortMode: 'alpha',
                hideEmptyFolders: false,
                statusMode: 'summary',
                statusWarnStoppedPercent: 70,
                healthCardsEnabled: true,
                runtimeBadgeEnabled: false
            },
            vm: {
                sortMode: 'alpha',
                hideEmptyFolders: false,
                statusMode: 'summary',
                statusWarnStoppedPercent: 70,
                healthCardsEnabled: true,
                runtimeBadgeEnabled: false
            }
        }
    }
};
const SETUP_ASSISTANT_PROFILE_PRESETS = {
    safe: {
        label: 'Safe',
        description: 'Best stability defaults with low background activity.',
        runtime: {
            liveRefreshEnabled: false,
            liveRefreshSeconds: 20,
            performanceMode: false,
            lazyPreviewEnabled: false,
            lazyPreviewThreshold: 30
        },
        health: {
            cardsEnabled: true,
            runtimeBadgeEnabled: false
        },
        status: {
            mode: 'summary',
            trendEnabled: true,
            attentionAccent: true
        }
    },
    balanced: {
        label: 'Balanced',
        description: 'Recommended defaults for daily use.',
        runtime: {
            liveRefreshEnabled: false,
            liveRefreshSeconds: 20,
            performanceMode: true,
            lazyPreviewEnabled: false,
            lazyPreviewThreshold: 30
        },
        health: {
            cardsEnabled: true,
            runtimeBadgeEnabled: false
        },
        status: {
            mode: 'summary',
            trendEnabled: true,
            attentionAccent: true
        }
    },
    power: {
        label: 'Power',
        description: 'Higher refresh and richer telemetry for large installs.',
        runtime: {
            liveRefreshEnabled: true,
            liveRefreshSeconds: 15,
            performanceMode: true,
            lazyPreviewEnabled: true,
            lazyPreviewThreshold: 45
        },
        health: {
            cardsEnabled: true,
            runtimeBadgeEnabled: true
        },
        status: {
            mode: 'summary',
            trendEnabled: true,
            attentionAccent: true
        }
    }
};
const settingsUiState = {
    initialized: false,
    controlsInitialized: false,
    mode: 'basic',
    query: '',
    sections: [],
    baselineByInputId: new Map(),
    activeSectionKey: '',
    advancedTab: 'automation',
    searchAllAdvanced: false,
    expandedAdvancedSections: new Set(),
    knownAdvancedSections: new Set(),
    hasExpandedAdvancedPreference: false,
    wizardShown: false
};
const setupAssistantState = {
    version: SETUP_ASSISTANT_VERSION,
    open: false,
    force: false,
    step: 0,
    busy: false,
    applying: false,
    progressLabel: '',
    progressPercent: 0,
    route: 'new',
    mode: 'basic',
    profile: 'balanced',
    applyProfileDefaults: true,
    environmentPreset: 'home_lab',
    applyEnvironmentDefaults: true,
    dryRunOnly: false,
    context: null,
    importPlans: {
        docker: null,
        vm: null
    },
    ruleBootstrap: {
        docker: {
            enabled: false,
            suggestions: []
        },
        vm: {
            enabled: false,
            suggestions: []
        }
    },
    behavior: {
        docker: null,
        vm: null
    },
    reviewNotes: [],
    rollbackCheckpointName: '',
    draftRestored: false,
    restoredDraftSavedAt: ''
};
let setupAssistantLastFocusedElement = null;
let overflowGuardBound = false;
const MOBILE_SETTINGS_BREAKPOINT_PX = 760;

const supportsTouchInput = () => (
    ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0)
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
);

const isMobileSettingsViewport = () => (
    window.matchMedia
    && window.matchMedia(`(max-width: ${MOBILE_SETTINGS_BREAKPOINT_PX}px)`).matches
);

const shouldUseMobileSectionToggle = () => supportsTouchInput() && isMobileSettingsViewport();
if (requestClient && typeof requestClient.configureSecurityHeaders === 'function') {
    requestClient.configureSecurityHeaders({
        tokenStorageKey: REQUEST_TOKEN_STORAGE_KEY
    });
}

const getOptionalRequestToken = () => {
    const metaToken = document.querySelector('meta[name="fv-request-token"]');
    if (metaToken && typeof metaToken.content === 'string') {
        const fromMeta = String(metaToken.content || '').trim();
        if (fromMeta) {
            return fromMeta;
        }
    }
    try {
        return String(localStorage.getItem(REQUEST_TOKEN_STORAGE_KEY) || '').trim();
    } catch (_error) {
        return '';
    }
};

const slugifySectionKey = (text) => String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getInputSerializedValue = (input) => {
    if (!input) {
        return '';
    }
    if (input.type === 'checkbox') {
        return input.checked ? '1' : '0';
    }
    return String(input.value ?? '');
};

const getTrackedInputs = () => Array.from(document.querySelectorAll('input[id], select[id], textarea[id]'));

const normalizeAdvancedGroup = (value) => (
    ADVANCED_GROUPS.includes(String(value || ''))
        ? String(value || '')
        : 'operations'
);

const persistExpandedAdvancedSections = () => {
    const payload = JSON.stringify(Array.from(settingsUiState.expandedAdvancedSections || []));
    settingsUiState.hasExpandedAdvancedPreference = true;
    localStorage.setItem(ADVANCED_EXPANDED_STORAGE_KEY, payload);
};

const persistKnownAdvancedSections = () => {
    const payload = JSON.stringify(Array.from(settingsUiState.knownAdvancedSections || []));
    localStorage.setItem(ADVANCED_KNOWN_STORAGE_KEY, payload);
};

const setsEqual = (a, b) => {
    if (a.size !== b.size) {
        return false;
    }
    for (const item of a) {
        if (!b.has(item)) {
            return false;
        }
    }
    return true;
};

const normalizeExpandedAdvancedSections = () => {
    const advancedKeys = settingsUiState.sections
        .filter((section) => section.advanced)
        .map((section) => section.key);
    const knownKeys = new Set(advancedKeys);
    const priorExpanded = new Set(settingsUiState.expandedAdvancedSections || []);
    let knownAdvanced = new Set(
        Array.from(settingsUiState.knownAdvancedSections || [])
            .map((key) => String(key || '').trim())
            .filter((key) => key !== '' && knownKeys.has(key))
    );

    // Guard for old installs: if we had expansion prefs but no known-section list,
    // treat legacy sections as known so newly added sections auto-expand once.
    if (settingsUiState.hasExpandedAdvancedPreference && knownAdvanced.size === 0) {
        knownAdvanced = new Set(
            LEGACY_ADVANCED_SECTION_KEYS.filter((key) => knownKeys.has(key))
        );
    }

    const normalized = new Set(
        Array.from(settingsUiState.expandedAdvancedSections || [])
            .map((key) => String(key || '').trim())
            .filter((key) => key !== '' && knownKeys.has(key))
    );
    if (!settingsUiState.hasExpandedAdvancedPreference) {
        for (const key of advancedKeys) {
            normalized.add(key);
        }
        settingsUiState.expandedAdvancedSections = normalized;
        if (advancedKeys.length > 0) {
            persistExpandedAdvancedSections();
        }
        settingsUiState.knownAdvancedSections = new Set(advancedKeys);
        persistKnownAdvancedSections();
        return;
    }

    for (const key of advancedKeys) {
        if (!knownAdvanced.has(key)) {
            normalized.add(key);
        }
    }

    const changedByCleanup = !setsEqual(normalized, priorExpanded);
    settingsUiState.expandedAdvancedSections = normalized;
    if (changedByCleanup) {
        persistExpandedAdvancedSections();
    }

    const nextKnown = new Set(advancedKeys);
    const knownChanged = !setsEqual(nextKnown, settingsUiState.knownAdvancedSections);
    settingsUiState.knownAdvancedSections = nextKnown;
    if (knownChanged) {
        persistKnownAdvancedSections();
    }
};

const persistActiveAdvancedSection = (sectionKey) => {
    const key = String(sectionKey || '').trim();
    if (!key) {
        localStorage.removeItem(ADVANCED_SECTION_STORAGE_KEY);
        return;
    }
    localStorage.setItem(ADVANCED_SECTION_STORAGE_KEY, key);
};

const setAdvancedTab = (tab, persist = true) => {
    settingsUiState.advancedTab = normalizeAdvancedGroup(tab);
    if (persist) {
        localStorage.setItem(ADVANCED_TAB_STORAGE_KEY, settingsUiState.advancedTab);
    }
};

const setActionBarStatus = (text) => {
    const status = $('#fv-action-status');
    if (!status.length) {
        return;
    }
    const message = String(text || '').trim();
    status.text(message);
    status.toggleClass('is-visible', message !== '');
};

const updateActionBarSaveState = () => {
    const changed = getTrackedInputs().filter((input) => (
        settingsUiState.baselineByInputId.has(input.id)
        && settingsUiState.baselineByInputId.get(input.id) !== getInputSerializedValue(input)
    ));
    const count = changed.length;
    const saveButton = $('#fv-action-save');
    const saveCloseButton = $('#fv-action-save-close');
    saveButton.prop('disabled', count === 0);
    saveCloseButton.prop('disabled', count === 0);
    if (count === 0) {
        setActionBarStatus('');
    } else {
        setActionBarStatus(`${count} unsaved field change${count === 1 ? '' : 's'} in this session.`);
    }
};

const captureSettingsBaseline = () => {
    settingsUiState.baselineByInputId.clear();
    for (const input of getTrackedInputs()) {
        settingsUiState.baselineByInputId.set(input.id, getInputSerializedValue(input));
    }
    updateActionBarSaveState();
};

const isInputInvalidForUi = (input) => {
    if (!input) {
        return false;
    }
    if (input.type === 'number' && input.value !== '') {
        const parsed = Number(input.value);
        if (!Number.isFinite(parsed)) {
            return true;
        }
        if (input.min !== '' && parsed < Number(input.min)) {
            return true;
        }
        if (input.max !== '' && parsed > Number(input.max)) {
            return true;
        }
    }
    if ((input.id === 'docker-rule-pattern' || input.id === 'vm-rule-pattern') && String(input.value || '').trim()) {
        try {
            // eslint-disable-next-line no-new
            new RegExp(String(input.value || '').trim());
        } catch (_error) {
            return true;
        }
    }
    return false;
};

const refreshInputInvalidStyles = () => {
    for (const input of getTrackedInputs()) {
        input.classList.toggle('fv-input-invalid', isInputInvalidForUi(input));
    }
};

const buildSettingsSections = () => {
    const headings = Array.from(document.querySelectorAll('h2[data-fv-section]'));
    const sections = [];

    for (const heading of headings) {
        const key = String(heading.dataset.fvSection || slugifySectionKey(heading.textContent));
        const title = Array.from(heading.childNodes)
            .filter((node) => !(
                node instanceof HTMLElement
                && (
                    node.classList.contains('fv-section-badge')
                    || node.classList.contains('fv-section-toggle')
                )
            ))
            .map((node) => node.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        const advanced = heading.dataset.fvAdvanced === '1' || ADVANCED_SECTION_KEYS.has(key);
        const advancedGroup = advanced
            ? normalizeAdvancedGroup(heading.dataset.fvAdvancedGroup || ADVANCED_GROUP_BY_SECTION[key] || 'operations')
            : 'main';
        const sectionRow = heading.closest('[data-fv-section-row="1"]');
        const sectionStartNode = sectionRow instanceof HTMLElement ? sectionRow : heading;
        const nodes = [sectionStartNode];

        let cursor = sectionStartNode.nextElementSibling;
        while (cursor && cursor.tagName !== 'H2' && cursor.tagName !== 'SCRIPT') {
            if (cursor.querySelector?.('h2[data-fv-section]')) {
                break;
            }
            // Keep shared modals outside section visibility toggles so dialogs never render blank.
            if (cursor.id === 'import-preview-dialog') {
                break;
            }
            if (cursor.id === 'fv-settings-action-bar') {
                break;
            }
            nodes.push(cursor);
            cursor = cursor.nextElementSibling;
        }

        heading.id = heading.id || `fv-section-${key}`;
        heading.dataset.fvSection = key;
        heading.dataset.fvAdvancedGroup = advancedGroup;
        heading.dataset.fvAdvanced = advanced ? '1' : '0';

        let badge = heading.querySelector('.fv-section-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'fv-section-badge is-ok';
            heading.appendChild(badge);
        }

        let toggle = heading.querySelector('.fv-section-toggle');
        if (advanced && !toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'fv-section-toggle';
            toggle.dataset.sectionToggle = key;
            toggle.setAttribute('aria-label', `Toggle ${title || key}`);
            toggle.textContent = 'Compact';
            heading.appendChild(toggle);
        }

        const contentNodes = nodes.filter((node) => node !== sectionStartNode);

        sections.push({
            key,
            title,
            advanced,
            advancedGroup,
            heading,
            badge,
            toggle,
            nodes,
            contentNodes
        });
    }

    settingsUiState.sections = sections;
};

const getSectionSearchHaystack = (section) => section.nodes
    .map((node) => node.textContent || '')
    .join(' ')
    .toLowerCase();

const isBasicWorkspaceSection = (section) => BASIC_WORKSPACE_SECTION_KEYS.has(String(section?.key || ''));

const getVisibleSections = () => settingsUiState.sections.filter((section) => {
    const modeVisible = settingsUiState.mode === 'advanced'
        ? !isBasicWorkspaceSection(section)
        : isBasicWorkspaceSection(section);
    if (!modeVisible) {
        return false;
    }
    const query = settingsUiState.query;
    const searchAcrossAllAdvanced = settingsUiState.searchAllAdvanced && Boolean(query);
    if (
        settingsUiState.mode === 'advanced'
        && section.advanced
        && !searchAcrossAllAdvanced
        && section.advancedGroup !== settingsUiState.advancedTab
    ) {
        return false;
    }
    if (!query) {
        return true;
    }
    return getSectionSearchHaystack(section).includes(query);
});

const renderAdvancedNav = () => {
    const container = $('#fv-advanced-nav');
    if (!container.length) {
        return;
    }
    if (settingsUiState.mode !== 'advanced') {
        container.hide().empty();
        return;
    }

    const advancedSections = settingsUiState.sections.filter((section) => section.advanced);
    if (!advancedSections.length) {
        container.hide().empty();
        return;
    }

    const groups = ADVANCED_GROUPS
        .map((group) => ({
            group,
            count: advancedSections.filter((section) => section.advancedGroup === group).length
        }))
        .filter((entry) => entry.count > 0);
    const tabsHtml = groups
        .map((entry, index) => {
            const active = settingsUiState.advancedTab === entry.group ? 'is-active' : '';
            const label = ADVANCED_GROUP_LABELS[entry.group] || entry.group;
            const step = index + 1;
            const countTitle = `${entry.count} section${entry.count === 1 ? '' : 's'} in ${label}`;
            return `<button type="button" class="fv-advanced-tab ${active}" data-fv-advanced-tab="${entry.group}" title="${escapeHtml(countTitle)}">${escapeHtml(label)} <span class="fv-advanced-count">${step}</span></button>`;
        })
        .join('');
    const activeTabSections = advancedSections.filter((section) => section.advancedGroup === settingsUiState.advancedTab);
    const allExpandedInTab = activeTabSections.length > 0
        && activeTabSections.every((section) => settingsUiState.expandedAdvancedSections.has(section.key));
    const compactLabel = allExpandedInTab ? 'Compact tab' : 'Expand tab';
    const compactHoverLabel = 'Compact tab';
    const compactIcon = allExpandedInTab ? 'fa-compress' : 'fa-expand';

    container.html(`
        <div class="fv-advanced-nav-inner">
            <span class="fv-advanced-nav-label">Advanced sections</span>
            <div class="fv-advanced-controls">
                <div class="fv-advanced-tabs">${tabsHtml}</div>
                <button type="button" id="fv-advanced-compact" class="fv-advanced-compact" title="${escapeHtml(compactHoverLabel)}" aria-label="${escapeHtml(compactLabel)}"><i class="fa ${compactIcon}" aria-hidden="true"></i></button>
            </div>
        </div>
    `).show();
};

const toggleAdvancedTabCompactState = () => {
    const tabSections = settingsUiState.sections.filter((section) => (
        section.advanced && section.advancedGroup === settingsUiState.advancedTab
    ));
    if (!tabSections.length) {
        return;
    }
    const shouldCompact = tabSections.every((section) => settingsUiState.expandedAdvancedSections.has(section.key));
    for (const section of tabSections) {
        if (shouldCompact) {
            settingsUiState.expandedAdvancedSections.delete(section.key);
        } else {
            settingsUiState.expandedAdvancedSections.add(section.key);
        }
    }
    persistExpandedAdvancedSections();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
};

const toggleAdvancedSectionByKey = (sectionKey) => {
    const key = String(sectionKey || '').trim();
    if (!key) {
        return false;
    }
    const section = settingsUiState.sections.find((entry) => entry.key === key);
    if (!section || !section.advanced) {
        return false;
    }

    if (settingsUiState.expandedAdvancedSections.has(key)) {
        settingsUiState.expandedAdvancedSections.delete(key);
    } else {
        settingsUiState.expandedAdvancedSections.add(key);
        settingsUiState.activeSectionKey = key;
        persistActiveAdvancedSection(key);
        setAdvancedTab(section.advancedGroup);
    }
    persistExpandedAdvancedSections();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
    return true;
};

const applySettingsSectionVisibility = () => {
    const visibleKeys = new Set(getVisibleSections().map((section) => section.key));
    const forceExpandForQuery = Boolean(settingsUiState.query);

    for (const section of settingsUiState.sections) {
        const visible = visibleKeys.has(section.key);
        const expanded = !section.advanced
            || settingsUiState.expandedAdvancedSections.has(section.key)
            || forceExpandForQuery;
        for (const node of section.nodes) {
            node.classList.toggle('fv-section-hidden', !visible);
        }
        for (const node of section.contentNodes || []) {
            node.classList.toggle('fv-section-content-hidden', visible && !expanded);
        }
        if (section.toggle) {
            const toggleLabel = expanded ? 'Compact' : 'Expand';
            section.toggle.textContent = toggleLabel;
            section.toggle.title = `${toggleLabel} section`;
            section.toggle.setAttribute('aria-label', `${toggleLabel} ${section.title || section.key}`);
            section.toggle.classList.toggle('is-expanded', expanded);
            section.toggle.classList.toggle('is-collapsed', !expanded);
        }
        section.heading.classList.toggle('fv-search-match', visible && Boolean(settingsUiState.query));
        section.heading.classList.toggle('fv-section-collapsed', visible && section.advanced && !expanded);
    }

    renderAdvancedNav();
    const searchScopeToggle = $('#fv-search-all-advanced');
    if (searchScopeToggle.length) {
        const enabled = settingsUiState.mode === 'advanced';
        searchScopeToggle.prop('disabled', !enabled);
        searchScopeToggle.prop('checked', settingsUiState.searchAllAdvanced === true);
        searchScopeToggle.closest('.fv-search-scope').toggleClass('is-disabled', !enabled);
    }
    const modeButtons = $('.fv-mode-btn');
    modeButtons.removeClass('is-active');
    modeButtons.filter(`[data-mode="${settingsUiState.mode}"]`).addClass('is-active');
    $('#fv-settings-topbar').attr('data-fv-mode', settingsUiState.mode);
};

const syncSectionJumpOptions = () => {
    const visibleSections = getVisibleSections();
    if (!visibleSections.length) {
        settingsUiState.activeSectionKey = '';
        persistActiveAdvancedSection('');
        return;
    }
    const keep = settingsUiState.activeSectionKey && visibleSections.some((section) => section.key === settingsUiState.activeSectionKey);
    if (!keep) {
        settingsUiState.activeSectionKey = visibleSections[0]?.key || '';
    }
    const activeSection = settingsUiState.sections.find((section) => section.key === settingsUiState.activeSectionKey);
    if (activeSection?.advanced) {
        setAdvancedTab(activeSection.advancedGroup);
    }
    persistActiveAdvancedSection(settingsUiState.activeSectionKey);

    const select = $('#fv-section-jump');
    if (!select.length) {
        return;
    }
    const options = visibleSections.map((section) => (
        `<option value="${escapeHtml(section.key)}">${escapeHtml(section.title)}</option>`
    ));
    select.html(options.join(''));
    if (settingsUiState.activeSectionKey) {
        select.val(settingsUiState.activeSectionKey);
    }
};

const scrollToSectionKey = (key) => {
    const section = settingsUiState.sections.find((entry) => entry.key === key);
    if (!section) {
        return;
    }
    settingsUiState.activeSectionKey = key;
    syncSectionJumpOptions();
    section.heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const setSettingsMode = (mode) => {
    settingsUiState.mode = mode === 'advanced' ? 'advanced' : 'basic';
    localStorage.setItem(UI_MODE_STORAGE_KEY, settingsUiState.mode);
    if (settingsUiState.mode === 'advanced') {
        const activeSection = settingsUiState.sections.find((section) => section.key === settingsUiState.activeSectionKey);
        if (activeSection?.advanced) {
            setAdvancedTab(activeSection.advancedGroup);
        }
    }
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
};

const getServerSettingsMode = () => {
    const dockerMode = prefsByType?.docker?.settingsMode;
    const vmMode = prefsByType?.vm?.settingsMode;
    if (dockerMode === 'advanced' || dockerMode === 'basic') {
        return dockerMode;
    }
    if (vmMode === 'advanced' || vmMode === 'basic') {
        return vmMode;
    }
    return null;
};

const isWizardCompletedServerSide = () => (
    prefsByType?.docker?.setupWizardCompleted === true
    || prefsByType?.vm?.setupWizardCompleted === true
);

const hasExistingPluginData = () => {
    const dockerFolders = Object.keys(dockers || {}).length;
    const vmFolders = Object.keys(vms || {}).length;
    if (dockerFolders > 0 || vmFolders > 0) {
        return true;
    }
    const hasRules = ((prefsByType?.docker?.autoRules || []).length + (prefsByType?.vm?.autoRules || []).length) > 0;
    const hasPinned = ((prefsByType?.docker?.pinnedFolderIds || []).length + (prefsByType?.vm?.pinnedFolderIds || []).length) > 0;
    return hasRules || hasPinned;
};

const persistSetupPrefsToServer = async ({ mode = null, completed = null } = {}) => {
    const nextMode = mode === 'advanced' ? 'advanced' : 'basic';
    const completedValue = completed === true;
    for (const type of ['docker', 'vm']) {
        const current = utils.normalizePrefs(prefsByType[type] || {});
        const next = {
            ...current,
            settingsMode: mode === null ? current.settingsMode : nextMode,
            setupWizardCompleted: completed === null ? current.setupWizardCompleted : completedValue
        };
        const unchanged = (
            current.settingsMode === next.settingsMode
            && current.setupWizardCompleted === next.setupWizardCompleted
        );
        if (unchanged) {
            continue;
        }
        try {
            prefsByType[type] = await postPrefs(type, next);
        } catch (_error) {
            // Keep UX responsive even if this persistence call fails.
        }
    }
};

const setSettingsSearchQuery = (query) => {
    settingsUiState.query = String(query || '').trim().toLowerCase();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
};

const setSearchAllAdvanced = (enabled) => {
    settingsUiState.searchAllAdvanced = enabled === true;
    localStorage.setItem(SEARCH_ALL_ADVANCED_STORAGE_KEY, settingsUiState.searchAllAdvanced ? '1' : '0');
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
};

const refreshSectionHealthBadges = () => {
    for (const section of settingsUiState.sections) {
        const inputs = [];
        for (const node of section.nodes) {
            if (!(node instanceof HTMLElement)) {
                continue;
            }
            inputs.push(...Array.from(node.querySelectorAll('input[id], select[id], textarea[id]')));
        }

        const uniqueInputs = Array.from(new Map(inputs.map((input) => [input.id, input])).values());
        let changedCount = 0;
        let invalidCount = 0;

        for (const input of uniqueInputs) {
            if (settingsUiState.baselineByInputId.has(input.id)) {
                if (settingsUiState.baselineByInputId.get(input.id) !== getInputSerializedValue(input)) {
                    changedCount += 1;
                }
            }
            if (isInputInvalidForUi(input)) {
                invalidCount += 1;
            }
        }

        const badge = section.badge;
        badge.classList.remove('is-ok', 'is-changed', 'is-invalid');
        if (invalidCount > 0) {
            badge.classList.add('is-invalid');
            badge.textContent = `${invalidCount} invalid`;
        } else if (changedCount > 0) {
            badge.classList.add('is-changed');
            badge.textContent = `${changedCount} changed`;
        } else {
            badge.classList.add('is-ok');
            badge.textContent = 'all good';
        }
    }
};

const saveActionBarChanges = async (closeAfterSave = false) => {
    const changedInputs = getTrackedInputs().filter((input) => (
        settingsUiState.baselineByInputId.has(input.id)
        && settingsUiState.baselineByInputId.get(input.id) !== getInputSerializedValue(input)
    ));
    changedInputs.forEach((input) => {
        $(input).trigger('change');
    });
    captureSettingsBaseline();
    refreshSectionHealthBadges();
    setActionBarStatus('Saved current settings snapshot.');
    if (closeAfterSave) {
        setTimeout(() => {
            window.history.back();
        }, 180);
    }
};

const resetCurrentSectionToBaseline = () => {
    if (!settingsUiState.activeSectionKey) {
        setActionBarStatus('Select a section first.');
        return;
    }
    const section = settingsUiState.sections.find((entry) => entry.key === settingsUiState.activeSectionKey);
    if (!section) {
        return;
    }
    const seen = new Set();
    for (const node of section.nodes) {
        if (!(node instanceof HTMLElement)) {
            continue;
        }
        const inputs = node.querySelectorAll('input[id], select[id], textarea[id]');
        for (const input of inputs) {
            if (seen.has(input.id) || !settingsUiState.baselineByInputId.has(input.id)) {
                continue;
            }
            seen.add(input.id);
            const baseline = settingsUiState.baselineByInputId.get(input.id);
            if (input.type === 'checkbox') {
                input.checked = baseline === '1';
            } else {
                input.value = baseline;
            }
            $(input).trigger('input');
            $(input).trigger('change');
        }
    }
    refreshInputInvalidStyles();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
    setActionBarStatus(`Reset section "${section.title}" to baseline snapshot.`);
};

const ensureRegexPresetUi = (type) => {
    const patternInput = $(`#${type}-rule-pattern`);
    if (!patternInput.length) {
        return;
    }
    const presetId = `${type}-rule-presets`;
    const hintId = `${type}-rule-live-match`;
    if (!$(`#${presetId}`).length) {
        patternInput.after(`
            <div id="${presetId}" class="rule-presets">
                <span>Regex presets:</span>
                <button type="button" data-type="${type}" data-preset="starts_with">Starts with</button>
                <button type="button" data-type="${type}" data-preset="contains">Contains</button>
                <button type="button" data-type="${type}" data-preset="ends_with">Ends with</button>
                <button type="button" data-type="${type}" data-preset="exact">Exact</button>
            </div>
        `);
    }
    if (!$(`#${hintId}`).length) {
        $(`#${presetId}`).after(`<div id="${hintId}" class="rule-live-match">Live matches: 0</div>`);
    }
};

const escapeRegexLiteral = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const applyRegexPreset = (type, preset) => {
    const input = $(`#${type}-rule-pattern`);
    if (!input.length) {
        return;
    }
    const plainText = window.prompt('Enter plain text for this preset:');
    if (plainText === null) {
        return;
    }
    const escaped = escapeRegexLiteral(plainText);
    let pattern = escaped;
    if (preset === 'starts_with') {
        pattern = `^${escaped}`;
    } else if (preset === 'contains') {
        pattern = escaped;
    } else if (preset === 'ends_with') {
        pattern = `${escaped}$`;
    } else if (preset === 'exact') {
        pattern = `^${escaped}$`;
    }

    if (type === 'docker' && String($('#docker-rule-kind').val() || '') !== 'name_regex') {
        $('#docker-rule-kind').val('name_regex');
        toggleRuleKindFields('docker');
    }
    input.val(pattern);
    input.trigger('input');
    input.trigger('change');
};

const getDockerItemLabels = (itemInfo) => itemInfo?.Labels || itemInfo?.info?.Config?.Labels || {};

const updateRuleLiveMatch = (type) => {
    const output = $(`#${type}-rule-live-match`);
    if (!output.length) {
        return;
    }
    const names = Object.keys(infoByType[type] || {});
    if (!names.length) {
        output.removeClass('is-invalid is-ok').text('Live matches: no items available.');
        return;
    }

    if (type === 'vm') {
        const pattern = String($('#vm-rule-pattern').val() || '').trim();
        if (!pattern) {
            output.removeClass('is-invalid is-ok').text('Live matches: enter a regex pattern.');
            return;
        }
        try {
            const regex = new RegExp(pattern);
            const count = names.filter((name) => regex.test(name)).length;
            output.removeClass('is-invalid').addClass('is-ok').text(`Live matches: ${count}/${names.length} VMs`);
        } catch (error) {
            output.removeClass('is-ok').addClass('is-invalid').text(`Invalid regex: ${error.message}`);
        }
        return;
    }

    const kind = String($('#docker-rule-kind').val() || 'name_regex');
    const pattern = String($('#docker-rule-pattern').val() || '').trim();
    const labelKey = String($('#docker-rule-label-key').val() || '').trim();
    const labelValue = String($('#docker-rule-label-value').val() || '').trim();
    const info = infoByType.docker || {};

    let count = 0;
    try {
        if (kind === 'name_regex' || kind === 'image_regex' || kind === 'compose_project_regex') {
            if (!pattern) {
                output.removeClass('is-invalid is-ok').text('Live matches: enter a regex pattern.');
                return;
            }
            const regex = new RegExp(pattern);
            for (const name of names) {
                const row = info[name] || {};
                const labels = getDockerItemLabels(row);
                const image = row?.info?.Config?.Image || '';
                const composeProject = labels['com.docker.compose.project'] || '';
                const value = kind === 'image_regex' ? image : (kind === 'compose_project_regex' ? composeProject : name);
                regex.lastIndex = 0;
                if (regex.test(String(value || ''))) {
                    count += 1;
                }
            }
        } else if (kind === 'label' || kind === 'label_contains' || kind === 'label_starts_with') {
            if (!labelKey) {
                output.removeClass('is-invalid is-ok').text('Live matches: enter a label key.');
                return;
            }
            for (const name of names) {
                const row = info[name] || {};
                const labels = getDockerItemLabels(row);
                const value = String(labels[labelKey] || '');
                if (kind === 'label' && (labelValue ? value === labelValue : Boolean(value))) {
                    count += 1;
                }
                if (kind === 'label_contains' && labelValue && value.includes(labelValue)) {
                    count += 1;
                }
                if (kind === 'label_starts_with' && labelValue && value.startsWith(labelValue)) {
                    count += 1;
                }
            }
        }
        output.removeClass('is-invalid').addClass('is-ok').text(`Live matches: ${count}/${names.length} containers`);
    } catch (error) {
        output.removeClass('is-ok').addClass('is-invalid').text(`Invalid regex: ${error.message}`);
    }
};

const runQuickSetupWizard = (force = false) => {
    openSetupAssistant(force === true);
};

const initSettingsControls = () => {
    if (settingsUiState.controlsInitialized) {
        return;
    }
    const controls = $('#fv-settings-topbar');
    const actionBar = $('#fv-settings-action-bar');
    if (!controls.length || !actionBar.length) {
        return;
    }

    const topbarHtml = settingsChrome && typeof settingsChrome.getTopbarHtml === 'function'
        ? settingsChrome.getTopbarHtml()
        : `
            <div class="fv-settings-inline">
                <div class="fv-settings-left" aria-label="Plugin settings title">
                    <h2 class="fv-settings-title">FolderView Plus</h2>
                    <span class="fv-settings-subtitle">Plugin settings</span>
                </div>
                <div class="fv-settings-right">
                    <input type="text" id="fv-settings-search" placeholder="Search settings" aria-label="Search settings">
                    <button type="button" id="fv-settings-clear-search" title="Clear search" aria-label="Clear search"><i class="fa fa-times"></i></button>
                    <label class="fv-search-scope" title="Limit search to currently selected advanced tab">
                        <input type="checkbox" id="fv-search-all-advanced">
                        Search all advanced
                    </label>
                    <span class="fv-mode-toggle" title="Settings mode">
                        <button type="button" class="fv-mode-btn" data-mode="basic" aria-label="Use basic settings mode">Basic</button>
                        <button type="button" class="fv-mode-btn" data-mode="advanced" aria-label="Use advanced settings mode">Advanced</button>
                    </span>
                    <button type="button" id="fv-run-wizard" title="Run setup assistant"><i class="fa fa-magic"></i> Wizard</button>
                </div>
            </div>
        `;
    controls.html(topbarHtml);

    if (!$('#fv-advanced-nav').length) {
        $('.fv-customizations-header').after('<div id="fv-advanced-nav" class="fv-advanced-nav" style="display:none"></div>');
    }

    const actionBarHtml = settingsChrome && typeof settingsChrome.getActionBarHtml === 'function'
        ? settingsChrome.getActionBarHtml()
        : `
            <div class="fv-action-buttons">
                <button type="button" id="fv-action-save"><i class="fa fa-save"></i> Save</button>
                <button type="button" id="fv-action-save-close"><i class="fa fa-check"></i> Save &amp; Close</button>
                <button type="button" id="fv-action-cancel"><i class="fa fa-undo"></i> Cancel</button>
                <button type="button" id="fv-action-reset-section"><i class="fa fa-refresh"></i> Reset section</button>
            </div>
            <span id="fv-action-status" class="fv-action-status" aria-live="polite"></span>
        `;
    actionBar.html(actionBarHtml);

    $('.fv-mode-btn').off('click.fvui').on('click.fvui', (event) => {
        const mode = String($(event.currentTarget).attr('data-mode') || 'basic');
        setSettingsMode(mode);
    });
    $('#fv-settings-search').off('input.fvui').on('input.fvui', (event) => {
        setSettingsSearchQuery($(event.currentTarget).val());
    });
    $('#fv-search-all-advanced').off('change.fvui').on('change.fvui', (event) => {
        setSearchAllAdvanced($(event.currentTarget).prop('checked') === true);
    });
    $('#fv-settings-clear-search').off('click.fvui').on('click.fvui', () => {
        $('#fv-settings-search').val('');
        setSettingsSearchQuery('');
    });
    $('#fv-action-save').off('click.fvui').on('click.fvui', () => {
        void saveActionBarChanges(false);
    });
    $('#fv-action-save-close').off('click.fvui').on('click.fvui', () => {
        void saveActionBarChanges(true);
    });
    $('#fv-action-cancel').off('click.fvui').on('click.fvui', () => {
        location.reload();
    });
    $('#fv-action-reset-section').off('click.fvui').on('click.fvui', () => {
        resetCurrentSectionToBaseline();
    });
    $('#fv-run-wizard').off('click.fvui').on('click.fvui', () => {
        runQuickSetupWizard(true);
    });

    $(document).off('input.fvhealth change.fvhealth', 'input,select,textarea').on('input.fvhealth change.fvhealth', 'input,select,textarea', () => {
        refreshInputInvalidStyles();
        refreshSectionHealthBadges();
        updateActionBarSaveState();
    });

    $(document).off('click.fvpreset', '.rule-presets button').on('click.fvpreset', '.rule-presets button', (event) => {
        const type = String($(event.currentTarget).attr('data-type') || '');
        const preset = String($(event.currentTarget).attr('data-preset') || '');
        applyRegexPreset(type, preset);
    });

    $(document).off('click.fvhealthfilter', '[data-fv-health-filter]').on('click.fvhealthfilter', '[data-fv-health-filter]', (event) => {
        const type = String($(event.currentTarget).attr('data-fv-health-type') || 'docker');
        const mode = String($(event.currentTarget).attr('data-fv-health-filter') || 'all');
        setHealthFolderFilter(type, mode);
    });

    $(document).off('click.fvhealthaction', '[data-fv-health-action]').on('click.fvhealthaction', '[data-fv-health-action]', (event) => {
        const type = String($(event.currentTarget).attr('data-fv-health-type') || 'docker');
        const action = String($(event.currentTarget).attr('data-fv-health-action') || '');
        if (action === 'jump-table') {
            setSettingsMode('basic');
            scrollToSectionKey(type === 'vm' ? 'vms' : 'docker');
            return;
        }
        if (action === 'scan-conflicts') {
            setSettingsMode('advanced');
            setAdvancedTab('automation');
            scrollToSectionKey('conflict-inspector');
            void runConflictInspector(type);
            return;
        }
        if (action === 'run-diagnostics') {
            setSettingsMode('advanced');
            setAdvancedTab('diagnostics');
            scrollToSectionKey('diagnostics');
            void runDiagnostics();
        }
    });

    $(document).off('click.fvtab', '.fv-advanced-tab').on('click.fvtab', '.fv-advanced-tab', (event) => {
        const tab = String($(event.currentTarget).attr('data-fv-advanced-tab') || '');
        setAdvancedTab(tab);
        applySettingsSectionVisibility();
        syncSectionJumpOptions();
        refreshSectionHealthBadges();
        updateActionBarSaveState();
    });
    $(document).off('click.fvcompact', '#fv-advanced-compact').on('click.fvcompact', '#fv-advanced-compact', (event) => {
        event.preventDefault();
        toggleAdvancedTabCompactState();
    });

    $(document).off('click.fvsectiontoggle', '.fv-section-toggle').on('click.fvsectiontoggle', '.fv-section-toggle', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const key = String($(event.currentTarget).attr('data-section-toggle') || '').trim();
        toggleAdvancedSectionByKey(key);
    });

    $(document).off('click.fvsectionheader', 'h2[data-fv-section][data-fv-advanced="1"]').on('click.fvsectionheader', 'h2[data-fv-section][data-fv-advanced="1"]', (event) => {
        if (!shouldUseMobileSectionToggle()) {
            return;
        }
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('.fv-section-toggle, button, a, input, select, textarea, label')) {
            return;
        }
        const key = String($(event.currentTarget).attr('data-fv-section') || '').trim();
        toggleAdvancedSectionByKey(key);
    });

    $('#docker-rule-kind, #docker-rule-pattern, #docker-rule-label-key, #docker-rule-label-value')
        .off('input.fvlivematch change.fvlivematch')
        .on('input.fvlivematch change.fvlivematch', () => updateRuleLiveMatch('docker'));
    $('#vm-rule-pattern')
        .off('input.fvlivematch change.fvlivematch')
        .on('input.fvlivematch change.fvlivematch', () => updateRuleLiveMatch('vm'));

    $('#fv-settings-search').val(settingsUiState.query || '');
    $('#fv-search-all-advanced').prop('checked', settingsUiState.searchAllAdvanced === true);

    settingsUiState.controlsInitialized = true;
};

const refreshSettingsUx = () => {
    buildSettingsSections();
    normalizeExpandedAdvancedSections();
    const advancedSections = settingsUiState.sections.filter((section) => section.advanced);
    if (advancedSections.length) {
        const hasCurrentTab = advancedSections.some((section) => section.advancedGroup === settingsUiState.advancedTab);
        if (!hasCurrentTab) {
            setAdvancedTab(advancedSections[0].advancedGroup);
        }
        if (settingsUiState.activeSectionKey) {
            const activeSection = settingsUiState.sections.find((section) => section.key === settingsUiState.activeSectionKey);
            if (activeSection?.advanced) {
                setAdvancedTab(activeSection.advancedGroup);
            }
        }
    }
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshInputInvalidStyles();
    refreshSectionHealthBadges();
    updateActionBarSaveState();
};

const toPrettyJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
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

const normalizeImportMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === 'replace' || mode === 'skip') {
        return mode;
    }
    return 'merge';
};

const normalizeImportPresetDefinition = (value, fallbackId = '') => {
    const source = value && typeof value === 'object' ? value : {};
    const id = String(source.id || fallbackId || '').trim();
    if (!id) {
        return null;
    }
    const name = String(source.name || '').trim().slice(0, 64);
    if (!name) {
        return null;
    }
    return {
        id,
        name,
        mode: normalizeImportMode(source.mode),
        dryRunOnly: source.dryRunOnly === true
    };
};

const normalizeImportPresetStoreType = (entry) => {
    const normalizedPrefs = utils.normalizePrefs({
        importPresets: entry && typeof entry === 'object' ? entry : {}
    });
    const source = normalizedPrefs.importPresets && typeof normalizedPrefs.importPresets === 'object'
        ? normalizedPrefs.importPresets
        : { defaultId: IMPORT_PRESET_DEFAULT_ID, custom: [] };
    return {
        defaultId: String(source.defaultId || IMPORT_PRESET_DEFAULT_ID),
        custom: Array.isArray(source.custom) ? source.custom.map((row) => ({ ...row })) : []
    };
};

const getImportPresetStoreTypeFromPrefs = (type, prefsOverride = null) => {
    const resolvedType = normalizeManagedType(type);
    const sourcePrefs = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[resolvedType]);
    return normalizeImportPresetStoreType(sourcePrefs.importPresets || {});
};

const persistImportPresetStoreTypeToServer = async (type, nextStore) => {
    const resolvedType = normalizeManagedType(type);
    const currentPrefs = utils.normalizePrefs(prefsByType[resolvedType]);
    const nextPrefs = utils.normalizePrefs({
        ...currentPrefs,
        importPresets: normalizeImportPresetStoreType(nextStore)
    });
    prefsByType[resolvedType] = await postPrefs(resolvedType, nextPrefs);
    return getImportPresetStoreTypeFromPrefs(resolvedType, prefsByType[resolvedType]);
};

const getImportPresetsForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const custom = Array.isArray(store?.custom) ? store.custom : [];
    return [
        ...IMPORT_PRESET_BUILTINS.map((preset) => ({ ...preset })),
        ...custom.map((preset) => ({ ...preset }))
    ];
};

const findImportPresetById = (type, presetId) => {
    const id = String(presetId || '').trim();
    if (!id) {
        return null;
    }
    return getImportPresetsForType(type).find((preset) => preset.id === id) || null;
};

const findImportPresetByModeAndDryRun = (type, mode, dryRunOnly) => {
    const normalizedMode = normalizeImportMode(mode);
    const normalizedDryRun = dryRunOnly === true;
    return getImportPresetsForType(type).find((preset) => (
        normalizeImportMode(preset.mode) === normalizedMode
        && (preset.dryRunOnly === true) === normalizedDryRun
    )) || null;
};

const getDefaultImportPresetIdForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const defaultId = String(store?.defaultId || IMPORT_PRESET_DEFAULT_ID).trim();
    return defaultId || IMPORT_PRESET_DEFAULT_ID;
};

const getDefaultImportPresetForType = (type) => {
    const preferredId = getDefaultImportPresetIdForType(type);
    return (
        findImportPresetById(type, preferredId)
        || findImportPresetById(type, IMPORT_PRESET_DEFAULT_ID)
        || getImportPresetsForType(type)[0]
        || null
    );
};

const saveCustomImportPresetForType = async (type, preset) => {
    const resolvedType = normalizeManagedType(type);
    const source = preset && typeof preset === 'object' ? preset : {};
    const generatedId = `custom:${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const normalized = normalizeImportPresetDefinition(source, generatedId);
    if (!normalized) {
        throw new Error('Invalid preset.');
    }
    if (normalized.id.startsWith('builtin:')) {
        throw new Error('Built-in preset IDs are reserved.');
    }

    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const current = Array.isArray(store?.custom) ? store.custom : [];
    const next = [normalized, ...current.filter((row) => row.id !== normalized.id)].slice(0, 30);
    await persistImportPresetStoreTypeToServer(resolvedType, {
        custom: next,
        defaultId: store?.defaultId || IMPORT_PRESET_DEFAULT_ID
    });
    return normalized;
};

const deleteCustomImportPresetForType = async (type, presetId) => {
    const resolvedType = normalizeManagedType(type);
    const id = String(presetId || '').trim();
    if (!id || id.startsWith('builtin:')) {
        return false;
    }
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const current = Array.isArray(store?.custom) ? store.custom : [];
    const next = current.filter((row) => row.id !== id);
    if (next.length === current.length) {
        return false;
    }
    const defaultId = String(store?.defaultId || IMPORT_PRESET_DEFAULT_ID).trim();
    await persistImportPresetStoreTypeToServer(resolvedType, {
        custom: next,
        defaultId: defaultId === id ? IMPORT_PRESET_DEFAULT_ID : defaultId
    });
    return true;
};

const setDefaultImportPresetIdForType = async (type, presetId) => {
    const resolvedType = normalizeManagedType(type);
    const id = String(presetId || '').trim();
    if (!id || !findImportPresetById(resolvedType, id)) {
        throw new Error('Preset not found.');
    }
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    await persistImportPresetStoreTypeToServer(resolvedType, {
        custom: store.custom,
        defaultId: id
    });
};

const formatImportPresetLabel = (preset) => {
    const mode = normalizeImportMode(preset?.mode);
    const modeLabel = mode === 'replace' ? 'Replace' : mode === 'skip' ? 'Skip existing' : 'Merge';
    const dryRunSuffix = preset?.dryRunOnly === true ? ', dry run' : '';
    return `${String(preset?.name || 'Preset')} (${modeLabel}${dryRunSuffix})`;
};

const setTypeFolders = (type, value) => {
    if (type === 'docker') {
        dockers = value;
        return;
    }
    vms = value;
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getFolderMap = (type) => utils.normalizeFolderMap(typeFolders(type));

const folderNameForId = (type, id) => {
    const folders = getFolderMap(type);
    return folders[id]?.name || id;
};

const isFolderPinned = (type, folderId) => {
    const pinned = Array.isArray(prefsByType[type]?.pinnedFolderIds) ? prefsByType[type].pinnedFolderIds : [];
    return pinned.includes(String(folderId || ''));
};

const normalizeHealthFilterMode = (value) => {
    const mode = String(value || 'all').trim().toLowerCase();
    return ['all', 'attention', 'empty', 'stopped', 'conflict'].includes(mode) ? mode : 'all';
};

const normalizeHealthPrefs = (type, prefsOverride = null) => {
    const source = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[type]);
    const incoming = source?.health && typeof source.health === 'object' ? source.health : {};
    const warnRaw = Number(incoming.warnStoppedPercent);
    const warnStoppedPercent = Number.isFinite(warnRaw) ? Math.min(100, Math.max(0, Math.round(warnRaw))) : 60;
    return {
        cardsEnabled: incoming.cardsEnabled !== false,
        runtimeBadgeEnabled: incoming.runtimeBadgeEnabled === true,
        compact: incoming.compact === true,
        warnStoppedPercent
    };
};

const normalizeStatusMode = (value) => (
    String(value || '').trim().toLowerCase() === 'dominant' ? 'dominant' : 'summary'
);

const normalizeStatusPrefs = (type, prefsOverride = null) => {
    const source = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[type]);
    const incoming = source?.status && typeof source.status === 'object' ? source.status : {};
    const warnRaw = Number(incoming.warnStoppedPercent);
    const warnStoppedPercent = Number.isFinite(warnRaw) ? Math.min(100, Math.max(0, Math.round(warnRaw))) : 60;
    return {
        mode: normalizeStatusMode(incoming.mode),
        trendEnabled: incoming.trendEnabled !== false,
        attentionAccent: incoming.attentionAccent !== false,
        warnStoppedPercent
    };
};

const createSetupAssistantImportPlan = () => ({
    include: false,
    mode: 'merge',
    fileName: '',
    parsed: null,
    summary: null,
    operations: null,
    diffRows: [],
    error: ''
});

const createSetupAssistantBehavior = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type] || {});
    const status = normalizeStatusPrefs(type, prefs);
    const health = normalizeHealthPrefs(type, prefs);
    return {
        sortMode: prefs.sortMode || 'created',
        hideEmptyFolders: prefs.hideEmptyFolders === true,
        statusMode: status.mode,
        statusWarnStoppedPercent: status.warnStoppedPercent,
        healthCardsEnabled: health.cardsEnabled === true,
        runtimeBadgeEnabled: health.runtimeBadgeEnabled === true
    };
};

const normalizeSetupAssistantEnvironmentPreset = (value) => (
    Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_ENV_PRESETS, String(value || ''))
        ? String(value || '')
        : 'home_lab'
);

const normalizeSetupAssistantBehaviorFromValue = (type, value = null) => {
    const base = createSetupAssistantBehavior(type);
    const incoming = value && typeof value === 'object' ? value : {};
    const normalizedSortMode = ['created', 'manual', 'alpha'].includes(String(incoming.sortMode || ''))
        ? String(incoming.sortMode)
        : base.sortMode;
    const statusWarnRaw = Number(incoming.statusWarnStoppedPercent);
    const normalizedWarn = Number.isFinite(statusWarnRaw)
        ? Math.max(0, Math.min(100, Math.round(statusWarnRaw)))
        : base.statusWarnStoppedPercent;

    return {
        sortMode: normalizedSortMode,
        hideEmptyFolders: incoming.hideEmptyFolders === true,
        statusMode: normalizeStatusMode(incoming.statusMode || base.statusMode),
        statusWarnStoppedPercent: normalizedWarn,
        healthCardsEnabled: incoming.healthCardsEnabled !== false,
        runtimeBadgeEnabled: incoming.runtimeBadgeEnabled === true
    };
};

const applySetupAssistantEnvironmentPresetToState = () => {
    if (setupAssistantState.applyEnvironmentDefaults !== true) {
        return;
    }
    const presetKey = normalizeSetupAssistantEnvironmentPreset(setupAssistantState.environmentPreset);
    setupAssistantState.environmentPreset = presetKey;
    const preset = SETUP_ASSISTANT_ENV_PRESETS[presetKey] || SETUP_ASSISTANT_ENV_PRESETS.home_lab;
    setupAssistantState.behavior = {
        docker: normalizeSetupAssistantBehaviorFromValue('docker', preset?.behavior?.docker || {}),
        vm: normalizeSetupAssistantBehaviorFromValue('vm', preset?.behavior?.vm || {})
    };
};

const serializeSetupAssistantRuleSuggestions = (suggestions) => {
    if (!Array.isArray(suggestions)) {
        return [];
    }
    return suggestions.slice(0, 60).map((row) => ({
        folderIdHint: String(row?.folderIdHint || '').trim(),
        folderName: String(row?.folderName || '').trim(),
        pattern: String(row?.pattern || '').trim(),
        enabled: row?.enabled !== false
    })).filter((row) => row.folderName && row.pattern);
};

const serializeSetupAssistantDraft = () => ({
    version: SETUP_ASSISTANT_VERSION,
    savedAt: new Date().toISOString(),
    step: Number(setupAssistantState.step) || 0,
    route: String(setupAssistantState.route || 'new'),
    mode: String(setupAssistantState.mode || 'basic'),
    profile: String(setupAssistantState.profile || 'balanced'),
    applyProfileDefaults: setupAssistantState.applyProfileDefaults === true,
    environmentPreset: normalizeSetupAssistantEnvironmentPreset(setupAssistantState.environmentPreset),
    applyEnvironmentDefaults: setupAssistantState.applyEnvironmentDefaults !== false,
    dryRunOnly: setupAssistantState.dryRunOnly === true,
    importPlans: {
        docker: {
            include: setupAssistantState.importPlans?.docker?.include === true,
            mode: normalizeImportMode(setupAssistantState.importPlans?.docker?.mode),
            fileName: String(setupAssistantState.importPlans?.docker?.fileName || ''),
            parsed: setupAssistantState.importPlans?.docker?.parsed || null
        },
        vm: {
            include: setupAssistantState.importPlans?.vm?.include === true,
            mode: normalizeImportMode(setupAssistantState.importPlans?.vm?.mode),
            fileName: String(setupAssistantState.importPlans?.vm?.fileName || ''),
            parsed: setupAssistantState.importPlans?.vm?.parsed || null
        }
    },
    ruleBootstrap: {
        docker: {
            enabled: setupAssistantState.ruleBootstrap?.docker?.enabled === true,
            suggestions: serializeSetupAssistantRuleSuggestions(setupAssistantState.ruleBootstrap?.docker?.suggestions || [])
        },
        vm: {
            enabled: setupAssistantState.ruleBootstrap?.vm?.enabled === true,
            suggestions: serializeSetupAssistantRuleSuggestions(setupAssistantState.ruleBootstrap?.vm?.suggestions || [])
        }
    },
    behavior: {
        docker: normalizeSetupAssistantBehaviorFromValue('docker', setupAssistantState.behavior?.docker || {}),
        vm: normalizeSetupAssistantBehaviorFromValue('vm', setupAssistantState.behavior?.vm || {})
    }
});

const persistSetupAssistantDraft = () => {
    if (!setupAssistantState.open || setupAssistantState.applying) {
        return;
    }
    try {
        localStorage.setItem(SETUP_ASSISTANT_DRAFT_STORAGE_KEY, JSON.stringify(serializeSetupAssistantDraft()));
    } catch (_error) {
        // Ignore localStorage failures to keep setup flow functional.
    }
};

const clearSetupAssistantDraft = () => {
    try {
        localStorage.removeItem(SETUP_ASSISTANT_DRAFT_STORAGE_KEY);
    } catch (_error) {
        // Ignore localStorage failures to keep setup flow functional.
    }
};

const restoreSetupAssistantDraftFromStorage = () => {
    let parsed = null;
    try {
        const raw = localStorage.getItem(SETUP_ASSISTANT_DRAFT_STORAGE_KEY);
        if (!raw) {
            return false;
        }
        parsed = JSON.parse(raw);
    } catch (_error) {
        clearSetupAssistantDraft();
        return false;
    }
    if (!parsed || typeof parsed !== 'object') {
        clearSetupAssistantDraft();
        return false;
    }
    const savedAt = Date.parse(String(parsed.savedAt || ''));
    if (!Number.isFinite(savedAt) || (Date.now() - savedAt) > SETUP_ASSISTANT_DRAFT_MAX_AGE_MS) {
        clearSetupAssistantDraft();
        return false;
    }

    setupAssistantState.step = Math.max(0, Math.min(SETUP_ASSISTANT_STEPS.length - 1, Number(parsed.step) || 0));
    setupAssistantState.route = ['new', 'migrate', 'advanced'].includes(String(parsed.route || ''))
        ? String(parsed.route)
        : setupAssistantState.route;
    setupAssistantState.mode = String(parsed.mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
    setupAssistantState.profile = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, String(parsed.profile || ''))
        ? String(parsed.profile)
        : setupAssistantState.profile;
    setupAssistantState.applyProfileDefaults = parsed.applyProfileDefaults === true;
    setupAssistantState.environmentPreset = normalizeSetupAssistantEnvironmentPreset(parsed.environmentPreset);
    setupAssistantState.applyEnvironmentDefaults = parsed.applyEnvironmentDefaults !== false;
    setupAssistantState.dryRunOnly = parsed.dryRunOnly === true;

    for (const type of ['docker', 'vm']) {
        const incomingPlan = parsed.importPlans?.[type];
        if (incomingPlan && typeof incomingPlan === 'object') {
            setupAssistantState.importPlans[type] = {
                ...createSetupAssistantImportPlan(),
                include: incomingPlan.include === true,
                mode: normalizeImportMode(incomingPlan.mode),
                fileName: String(incomingPlan.fileName || ''),
                parsed: incomingPlan.parsed && typeof incomingPlan.parsed === 'object'
                    ? incomingPlan.parsed
                    : null
            };
        }
        const incomingRules = parsed.ruleBootstrap?.[type];
        if (incomingRules && typeof incomingRules === 'object') {
            setupAssistantState.ruleBootstrap[type].enabled = incomingRules.enabled === true;
            setupAssistantState.ruleBootstrap[type].suggestions = serializeSetupAssistantRuleSuggestions(incomingRules.suggestions || []).map((row, index) => ({
                id: `setup-rule-${type}-draft-${index + 1}`,
                enabled: row.enabled !== false,
                folderIdHint: row.folderIdHint,
                folderName: row.folderName,
                kind: 'name_regex',
                effect: 'include',
                pattern: row.pattern,
                note: `Matches names starting with "${String(row.pattern || '').replace(/^\^/, '')}".`
            }));
        }
        const incomingBehavior = parsed.behavior?.[type];
        if (incomingBehavior && typeof incomingBehavior === 'object') {
            setupAssistantState.behavior[type] = normalizeSetupAssistantBehaviorFromValue(type, incomingBehavior);
        }
    }

    setupAssistantState.draftRestored = true;
    setupAssistantState.restoredDraftSavedAt = String(parsed.savedAt || '');
    return true;
};

const isSetupAssistantCompletedLocal = () => {
    try {
        return (
            localStorage.getItem(SETUP_ASSISTANT_DONE_STORAGE_KEY) === '1'
            || localStorage.getItem(WIZARD_DONE_STORAGE_KEY) === '1'
        );
    } catch (_error) {
        return false;
    }
};

const markSetupAssistantCompletedLocal = () => {
    try {
        localStorage.setItem(WIZARD_DONE_STORAGE_KEY, '1');
        localStorage.setItem(SETUP_ASSISTANT_DONE_STORAGE_KEY, '1');
        clearSetupAssistantDraft();
    } catch (_error) {
        // Local storage can be blocked; keep UX operational.
    }
};

const resetSetupAssistantState = (force = false) => {
    const mode = settingsUiState.mode === 'advanced' ? 'advanced' : 'basic';
    const dockerFolders = Object.keys(getFolderMap('docker')).length;
    const vmFolders = Object.keys(getFolderMap('vm')).length;
    const dockerRules = (prefsByType?.docker?.autoRules || []).length;
    const vmRules = (prefsByType?.vm?.autoRules || []).length;
    const dockerBackups = (backupsByType?.docker || []).length;
    const vmBackups = (backupsByType?.vm || []).length;
    const dockerTemplates = (templatesByType?.docker || []).length;
    const vmTemplates = (templatesByType?.vm || []).length;
    const hasExistingData = hasExistingPluginData();
    const route = hasExistingData ? 'migrate' : 'new';

    setupAssistantState.open = true;
    setupAssistantState.force = force === true;
    setupAssistantState.step = 0;
    setupAssistantState.busy = false;
    setupAssistantState.applying = false;
    setupAssistantState.progressLabel = '';
    setupAssistantState.progressPercent = 0;
    setupAssistantState.route = route;
    setupAssistantState.mode = mode;
    setupAssistantState.profile = 'balanced';
    setupAssistantState.applyProfileDefaults = route === 'new';
    setupAssistantState.environmentPreset = 'home_lab';
    setupAssistantState.applyEnvironmentDefaults = route === 'new';
    setupAssistantState.dryRunOnly = false;
    setupAssistantState.context = {
        dockerFolders,
        vmFolders,
        dockerRules,
        vmRules,
        dockerBackups,
        vmBackups,
        dockerTemplates,
        vmTemplates,
        hasExistingData
    };
    setupAssistantState.importPlans = {
        docker: createSetupAssistantImportPlan(),
        vm: createSetupAssistantImportPlan()
    };
    setupAssistantState.ruleBootstrap = {
        docker: {
            enabled: false,
            suggestions: []
        },
        vm: {
            enabled: false,
            suggestions: []
        }
    };
    setupAssistantState.behavior = {
        docker: createSetupAssistantBehavior('docker'),
        vm: createSetupAssistantBehavior('vm')
    };
    if (setupAssistantState.applyEnvironmentDefaults === true) {
        applySetupAssistantEnvironmentPresetToState();
    }
    setupAssistantState.reviewNotes = [];
    setupAssistantState.rollbackCheckpointName = '';
    setupAssistantState.draftRestored = false;
    setupAssistantState.restoredDraftSavedAt = '';
};

const clampSetupAssistantStep = () => {
    const maxStep = SETUP_ASSISTANT_STEPS.length - 1;
    setupAssistantState.step = Math.max(0, Math.min(maxStep, Number(setupAssistantState.step) || 0));
};

const currentSetupAssistantStepKey = () => {
    clampSetupAssistantStep();
    return SETUP_ASSISTANT_STEPS[setupAssistantState.step] || 'welcome';
};

const setSetupAssistantProgress = (label, percent = 0) => {
    setupAssistantState.progressLabel = String(label || '').trim();
    const parsed = Number(percent);
    setupAssistantState.progressPercent = Number.isFinite(parsed)
        ? Math.max(0, Math.min(100, Math.round(parsed)))
        : 0;
};

const clearSetupAssistantProgress = () => {
    setupAssistantState.progressLabel = '';
    setupAssistantState.progressPercent = 0;
};

const ensureSetupAssistantDom = () => {
    if ($('#fv-setup-assistant-dialog').length && $('#fv-setup-assistant-overlay').length) {
        return;
    }
    $('body').append(`
        <div id="fv-setup-assistant-overlay" style="display:none;"></div>
        <div id="fv-setup-assistant-dialog" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="fv-setup-assistant-title">
            <div id="fv-setup-assistant-content"></div>
        </div>
    `);
};

const summarizeSetupAssistantImportPlan = (type) => {
    const resolvedType = normalizeManagedType(type);
    const plan = setupAssistantState.importPlans?.[resolvedType];
    if (!plan || !plan.parsed) {
        return null;
    }
    const folders = getFolderMap(resolvedType);
    const mode = normalizeImportMode(plan.mode);
    const summary = utils.summarizeImport(folders, plan.parsed, mode);
    const operations = utils.buildImportOperations(folders, plan.parsed, mode);
    const diffRows = utils.buildImportDiffRows(folders, plan.parsed, mode);
    plan.summary = summary;
    plan.operations = operations;
    plan.diffRows = diffRows;
    plan.error = '';
    return plan;
};

const extractSetupAssistantSourceFolders = (type) => {
    const resolvedType = normalizeManagedType(type);
    const plan = setupAssistantState.importPlans?.[resolvedType];
    const parsed = plan?.parsed;
    const rows = [];
    if (parsed?.mode === 'single' && parsed?.folder && typeof parsed.folder.name === 'string') {
        rows.push({
            folderId: parsed.folderId || '',
            folderName: String(parsed.folder.name || '').trim()
        });
    } else if (parsed?.mode === 'full' && parsed?.folders && typeof parsed.folders === 'object') {
        for (const [folderId, folder] of Object.entries(parsed.folders)) {
            const folderName = String(folder?.name || '').trim();
            if (!folderName) {
                continue;
            }
            rows.push({
                folderId: String(folderId || '').trim(),
                folderName
            });
        }
    }
    if (!rows.length) {
        for (const [folderId, folder] of Object.entries(getFolderMap(resolvedType))) {
            const folderName = String(folder?.name || '').trim();
            if (!folderName) {
                continue;
            }
            rows.push({
                folderId: String(folderId || '').trim(),
                folderName
            });
        }
    }
    return rows;
};

const buildSetupAssistantRuleSuggestionsForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const candidates = extractSetupAssistantSourceFolders(resolvedType);
    const dedupedByName = new Map();
    for (const row of candidates) {
        const key = String(row.folderName || '').trim().toLowerCase();
        if (!key || dedupedByName.has(key)) {
            continue;
        }
        dedupedByName.set(key, row);
    }

    const suggestions = [];
    for (const row of dedupedByName.values()) {
        const folderName = String(row.folderName || '').trim();
        const compact = folderName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const token = compact.split(/\s+/).find((piece) => piece.length >= 3) || compact.replace(/\s+/g, '');
        if (!token) {
            continue;
        }
        suggestions.push({
            id: `setup-rule-${resolvedType}-${suggestions.length + 1}`,
            enabled: true,
            folderIdHint: String(row.folderId || '').trim(),
            folderName,
            kind: 'name_regex',
            effect: 'include',
            pattern: `^${escapeRegexLiteral(token)}`,
            note: `Matches names starting with "${token}".`
        });
        if (suggestions.length >= 12) {
            break;
        }
    }
    return suggestions;
};

const refreshSetupAssistantRuleSuggestions = () => {
    for (const type of ['docker', 'vm']) {
        const existing = setupAssistantState.ruleBootstrap[type]?.suggestions || [];
        const existingChecked = new Map(
            existing.map((row) => [`${String(row.folderName || '').toLowerCase()}|${String(row.pattern || '')}`, row.enabled !== false])
        );
        const next = buildSetupAssistantRuleSuggestionsForType(type).map((row) => {
            const key = `${String(row.folderName || '').toLowerCase()}|${String(row.pattern || '')}`;
            return {
                ...row,
                enabled: existingChecked.has(key) ? existingChecked.get(key) : true
            };
        });
        setupAssistantState.ruleBootstrap[type].suggestions = next;
        if (next.length === 0) {
            setupAssistantState.ruleBootstrap[type].enabled = false;
        }
    }
};

const getSetupAssistantRulePreviewPool = (type) => {
    const resolvedType = normalizeManagedType(type);
    const source = infoByType?.[resolvedType];
    if (!source || typeof source !== 'object') {
        return [];
    }
    return Object.keys(source).map((name) => String(name || '').trim()).filter(Boolean);
};

const previewSetupAssistantRuleMatches = (type, pattern) => {
    const trimmed = String(pattern || '').trim();
    if (!trimmed) {
        return {
            valid: false,
            count: 0,
            samples: [],
            text: 'Pattern is empty.'
        };
    }
    let regex = null;
    try {
        regex = new RegExp(trimmed, 'i');
    } catch (error) {
        return {
            valid: false,
            count: 0,
            samples: [],
            text: `Invalid regex: ${error?.message || 'parse failed'}`
        };
    }

    const names = getSetupAssistantRulePreviewPool(type);
    const matches = [];
    for (const name of names) {
        regex.lastIndex = 0;
        if (regex.test(name)) {
            matches.push(name);
        }
    }
    const samples = matches.slice(0, 4);
    const extra = matches.length > samples.length ? ` (+${matches.length - samples.length} more)` : '';
    const text = matches.length > 0
        ? `Matches ${matches.length}: ${samples.join(', ')}${extra}`
        : 'No current matches in existing items.';
    return {
        valid: true,
        count: matches.length,
        samples,
        text
    };
};

const previewSetupAssistantRuleOutcomesForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const bootstrap = setupAssistantState.ruleBootstrap?.[resolvedType];
    if (!bootstrap || bootstrap.enabled !== true) {
        return {
            selected: 0,
            creatable: 0,
            duplicates: 0,
            unresolvedFolder: 0,
            invalidPattern: 0
        };
    }

    const selected = (bootstrap.suggestions || []).filter((row) => row.enabled !== false);
    if (!selected.length) {
        return {
            selected: 0,
            creatable: 0,
            duplicates: 0,
            unresolvedFolder: 0,
            invalidPattern: 0
        };
    }

    const existingRules = Array.isArray(prefsByType?.[resolvedType]?.autoRules)
        ? prefsByType[resolvedType].autoRules
        : [];
    let creatable = 0;
    let duplicates = 0;
    let unresolvedFolder = 0;
    let invalidPattern = 0;
    for (const suggestion of selected) {
        const folderId = resolveSetupAssistantFolderId(
            resolvedType,
            suggestion.folderName,
            suggestion.folderIdHint || ''
        );
        if (!folderId) {
            unresolvedFolder += 1;
            continue;
        }
        const normalizedPattern = String(suggestion.pattern || '').trim();
        if (!normalizedPattern) {
            invalidPattern += 1;
            continue;
        }
        const duplicate = existingRules.some((rule) => (
            String(rule?.folderId || '') === folderId
            && String(rule?.kind || '') === 'name_regex'
            && String(rule?.effect || 'include') === 'include'
            && String(rule?.pattern || '') === normalizedPattern
        ));
        if (duplicate) {
            duplicates += 1;
            continue;
        }
        creatable += 1;
    }
    return {
        selected: selected.length,
        creatable,
        duplicates,
        unresolvedFolder,
        invalidPattern
    };
};

const buildSetupAssistantPrefsDiffForType = (type) => {
    const current = utils.normalizePrefs(prefsByType[type] || {});
    let next = utils.normalizePrefs({
        ...current,
        settingsMode: setupAssistantState.mode,
        setupWizardCompleted: true
    });
    if (setupAssistantState.applyProfileDefaults) {
        next = applySetupAssistantProfileToPrefs(next, setupAssistantState.profile);
    }
    next = applySetupAssistantBehaviorToPrefs(next, setupAssistantState.behavior[type]);

    const changes = [];
    const register = (label, currentValue, nextValue) => {
        if (String(currentValue ?? '') !== String(nextValue ?? '')) {
            changes.push(label);
        }
    };
    register('settings mode', current.settingsMode || 'basic', next.settingsMode || 'basic');
    register('setup completed flag', current.setupWizardCompleted === true ? '1' : '0', next.setupWizardCompleted === true ? '1' : '0');
    register('sort mode', current.sortMode || 'created', next.sortMode || 'created');
    register('hide empty folders', current.hideEmptyFolders === true ? '1' : '0', next.hideEmptyFolders === true ? '1' : '0');
    register('status mode', current?.status?.mode || 'summary', next?.status?.mode || 'summary');
    register('status warn %', Number(current?.status?.warnStoppedPercent ?? 60), Number(next?.status?.warnStoppedPercent ?? 60));
    register('health cards', current?.health?.cardsEnabled !== false ? '1' : '0', next?.health?.cardsEnabled !== false ? '1' : '0');
    register('runtime badge', current?.health?.runtimeBadgeEnabled === true ? '1' : '0', next?.health?.runtimeBadgeEnabled === true ? '1' : '0');
    if (setupAssistantState.applyProfileDefaults) {
        register('live refresh', current.liveRefreshEnabled === true ? '1' : '0', next.liveRefreshEnabled === true ? '1' : '0');
        register('refresh interval', Number(current.liveRefreshSeconds ?? 20), Number(next.liveRefreshSeconds ?? 20));
        register('performance mode', current.performanceMode === true ? '1' : '0', next.performanceMode === true ? '1' : '0');
        register('lazy previews', current.lazyPreviewEnabled === true ? '1' : '0', next.lazyPreviewEnabled === true ? '1' : '0');
        register('lazy threshold', Number(current.lazyPreviewThreshold ?? 30), Number(next.lazyPreviewThreshold ?? 30));
    }
    return {
        count: changes.length,
        changes
    };
};

const buildSetupAssistantImpactSummary = () => {
    const importByType = {};
    const importTotals = {
        creates: 0,
        updates: 0,
        deletes: 0,
        totalOps: 0
    };
    const prefByType = {};
    let totalPrefChanges = 0;

    for (const type of ['docker', 'vm']) {
        const plan = setupAssistantState.importPlans[type];
        const summary = plan?.summary || { creates: [], updates: [], deletes: [] };
        const includeImport = plan?.include === true && plan?.parsed;
        const creates = includeImport ? (summary.creates?.length || 0) : 0;
        const updates = includeImport ? (summary.updates?.length || 0) : 0;
        const deletes = includeImport ? (summary.deletes?.length || 0) : 0;
        const totalOps = creates + updates + deletes;
        importByType[type] = { creates, updates, deletes, totalOps };
        importTotals.creates += creates;
        importTotals.updates += updates;
        importTotals.deletes += deletes;
        importTotals.totalOps += totalOps;

        const diff = buildSetupAssistantPrefsDiffForType(type);
        prefByType[type] = diff;
        totalPrefChanges += diff.count;
    }

    const ruleDocker = previewSetupAssistantRuleOutcomesForType('docker');
    const ruleVm = previewSetupAssistantRuleOutcomesForType('vm');
    const rules = {
        docker: ruleDocker,
        vm: ruleVm,
        selected: ruleDocker.selected + ruleVm.selected,
        creatable: ruleDocker.creatable + ruleVm.creatable,
        duplicates: ruleDocker.duplicates + ruleVm.duplicates,
        unresolvedFolder: ruleDocker.unresolvedFolder + ruleVm.unresolvedFolder,
        invalidPattern: ruleDocker.invalidPattern + ruleVm.invalidPattern
    };
    return {
        imports: {
            byType: importByType,
            totals: importTotals
        },
        prefs: {
            byType: prefByType,
            totalChanges: totalPrefChanges
        },
        rules,
        totalPlannedChanges: importTotals.totalOps + totalPrefChanges + rules.creatable
    };
};

const getSetupAssistantStepValidation = (stepKey = currentSetupAssistantStepKey()) => {
    const step = String(stepKey || '').trim();
    const blockers = [];
    const warnings = [];

    if (step === 'profile') {
        if (setupAssistantState.applyProfileDefaults === true
            && !Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, setupAssistantState.profile)) {
            blockers.push('Choose a valid profile preset.');
        }
        if (setupAssistantState.applyEnvironmentDefaults === true
            && !Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_ENV_PRESETS, setupAssistantState.environmentPreset)) {
            blockers.push('Choose a valid environment preset.');
        }
    }

    if (step === 'import' || step === 'review') {
        const includeTypes = [];
        for (const type of ['docker', 'vm']) {
            const plan = setupAssistantState.importPlans[type];
            if (!plan) {
                continue;
            }
            if (plan.include === true) {
                includeTypes.push(type);
                if (!plan.parsed) {
                    blockers.push(`${type.toUpperCase()} import is enabled but no file is selected.`);
                }
            }
        }
        if (setupAssistantState.route === 'migrate' && includeTypes.length === 0) {
            blockers.push('Migrate route requires at least one enabled import.');
        }
    }

    if (step === 'behavior' || step === 'review') {
        for (const type of ['docker', 'vm']) {
            const behavior = setupAssistantState.behavior?.[type] || {};
            const warn = Number(behavior.statusWarnStoppedPercent);
            if (!Number.isFinite(warn) || warn < 0 || warn > 100) {
                blockers.push(`${type.toUpperCase()} status warn threshold must be between 0 and 100.`);
            }
        }
    }

    if (step === 'rules' || step === 'review') {
        for (const type of ['docker', 'vm']) {
            const bootstrap = setupAssistantState.ruleBootstrap?.[type];
            if (!bootstrap || bootstrap.enabled !== true) {
                continue;
            }
            const selectedCount = (bootstrap.suggestions || []).filter((row) => row.enabled !== false).length;
            if (selectedCount <= 0) {
                warnings.push(`${type.toUpperCase()} starter rules are enabled with no selected entries.`);
            }
        }
    }

    if (step === 'review') {
        const impact = buildSetupAssistantImpactSummary();
        if (impact.totalPlannedChanges <= 0 && setupAssistantState.dryRunOnly !== true) {
            warnings.push('No changes are currently planned. Enable imports/rules or adjust behavior before apply.');
        }
        if (setupAssistantState.dryRunOnly === true) {
            warnings.push('Dry run mode is ON. Apply will preview only and will not persist changes.');
        }
    }

    return {
        blockers,
        warnings
    };
};

const applySetupAssistantProfileToPrefs = (prefs, profileId) => {
    const preset = SETUP_ASSISTANT_PROFILE_PRESETS[profileId] || SETUP_ASSISTANT_PROFILE_PRESETS.balanced;
    const next = utils.normalizePrefs({
        ...prefs,
        liveRefreshEnabled: preset.runtime.liveRefreshEnabled,
        liveRefreshSeconds: preset.runtime.liveRefreshSeconds,
        performanceMode: preset.runtime.performanceMode,
        lazyPreviewEnabled: preset.runtime.lazyPreviewEnabled,
        lazyPreviewThreshold: preset.runtime.lazyPreviewThreshold,
        health: {
            ...(prefs.health || {}),
            cardsEnabled: preset.health.cardsEnabled,
            runtimeBadgeEnabled: preset.health.runtimeBadgeEnabled
        },
        status: {
            ...(prefs.status || {}),
            mode: preset.status.mode,
            trendEnabled: preset.status.trendEnabled,
            attentionAccent: preset.status.attentionAccent
        }
    });
    return next;
};

const applySetupAssistantBehaviorToPrefs = (prefs, behavior) => {
    const source = behavior && typeof behavior === 'object' ? behavior : {};
    const normalizedSortMode = ['created', 'manual', 'alpha'].includes(String(source.sortMode || ''))
        ? String(source.sortMode)
        : 'created';
    const statusWarnRaw = Number(source.statusWarnStoppedPercent);
    const statusWarnStoppedPercent = Number.isFinite(statusWarnRaw)
        ? Math.max(0, Math.min(100, Math.round(statusWarnRaw)))
        : 60;

    return utils.normalizePrefs({
        ...prefs,
        sortMode: normalizedSortMode,
        hideEmptyFolders: source.hideEmptyFolders === true,
        health: {
            ...(prefs.health || {}),
            cardsEnabled: source.healthCardsEnabled !== false,
            runtimeBadgeEnabled: source.runtimeBadgeEnabled === true
        },
        status: {
            ...(prefs.status || {}),
            mode: normalizeStatusMode(source.statusMode),
            warnStoppedPercent: statusWarnStoppedPercent
        }
    });
};

const resolveSetupAssistantFolderId = (type, folderName, folderIdHint = '') => {
    const folders = getFolderMap(type);
    const hint = String(folderIdHint || '').trim();
    if (hint && Object.prototype.hasOwnProperty.call(folders, hint)) {
        return hint;
    }
    const targetName = String(folderName || '').trim().toLowerCase();
    if (!targetName) {
        return '';
    }
    for (const [folderId, folder] of Object.entries(folders)) {
        if (String(folder?.name || '').trim().toLowerCase() === targetName) {
            return folderId;
        }
    }
    return '';
};

const applySetupAssistantRulesForType = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const bootstrap = setupAssistantState.ruleBootstrap?.[resolvedType];
    if (!bootstrap || bootstrap.enabled !== true) {
        return { created: 0, skipped: 0 };
    }
    const selectedSuggestions = (bootstrap.suggestions || []).filter((row) => row.enabled !== false);
    if (!selectedSuggestions.length) {
        return { created: 0, skipped: 0 };
    }

    const existingPrefs = utils.normalizePrefs(prefsByType[resolvedType] || {});
    const existingRules = Array.isArray(existingPrefs.autoRules) ? [...existingPrefs.autoRules] : [];
    let created = 0;
    let skipped = 0;
    let changed = false;

    for (const suggestion of selectedSuggestions) {
        const folderId = resolveSetupAssistantFolderId(
            resolvedType,
            suggestion.folderName,
            suggestion.folderIdHint || ''
        );
        if (!folderId) {
            skipped += 1;
            continue;
        }

        const normalizedPattern = String(suggestion.pattern || '').trim();
        if (!normalizedPattern) {
            skipped += 1;
            continue;
        }

        const duplicate = existingRules.some((rule) => (
            String(rule.folderId || '') === folderId
            && String(rule.kind || '') === 'name_regex'
            && String(rule.effect || 'include') === 'include'
            && String(rule.pattern || '') === normalizedPattern
        ));
        if (duplicate) {
            skipped += 1;
            continue;
        }

        existingRules.push({
            id: `rule-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            enabled: true,
            folderId,
            effect: 'include',
            kind: 'name_regex',
            pattern: normalizedPattern,
            labelKey: '',
            labelValue: ''
        });
        created += 1;
        changed = true;
    }

    if (!changed) {
        return { created, skipped };
    }

    const nextPrefs = utils.normalizePrefs({
        ...existingPrefs,
        autoRules: existingRules
    });
    prefsByType[resolvedType] = await postPrefs(resolvedType, nextPrefs);
    return { created, skipped };
};

const buildSetupAssistantReviewNotes = () => {
    const notes = [];
    const reviewValidation = getSetupAssistantStepValidation('review');
    if (reviewValidation.blockers.length) {
        notes.push(...reviewValidation.blockers);
    }
    if (reviewValidation.warnings.length) {
        notes.push(...reviewValidation.warnings);
    }
    for (const type of ['docker', 'vm']) {
        const plan = setupAssistantState.importPlans[type];
        if (!plan?.include || !plan?.parsed) {
            continue;
        }
        const operationCount = countImportOperations(plan.operations || { creates: [], upserts: [], deletes: [] });
        if (operationCount === 0) {
            notes.push(`${type.toUpperCase()} import file is loaded, but no folder changes were detected.`);
        }
    }
    return notes;
};

const setupAssistantStepLabel = (stepKey) => {
    if (stepKey === 'welcome') {
        return 'Welcome';
    }
    if (stepKey === 'profile') {
        return 'Profile';
    }
    if (stepKey === 'import') {
        return 'Import';
    }
    if (stepKey === 'rules') {
        return 'Rules';
    }
    if (stepKey === 'behavior') {
        return 'Behavior';
    }
    return 'Review';
};

const renderSetupAssistantWelcomeStep = () => {
    const context = setupAssistantState.context || {
        dockerFolders: 0,
        vmFolders: 0,
        dockerRules: 0,
        vmRules: 0,
        dockerBackups: 0,
        vmBackups: 0,
        dockerTemplates: 0,
        vmTemplates: 0
    };
    const routeDescriptions = {
        new: 'New install (recommended when starting fresh).',
        migrate: 'Migrate existing config from export files.',
        advanced: 'Advanced custom setup with manual choices.'
    };
    return `
        <div class="fv-setup-step-grid">
            <section class="fv-setup-card">
                <h4>Detected environment</h4>
                <div class="fv-setup-chip-row">
                    <span class="fv-setup-chip">Docker folders: ${context.dockerFolders}</span>
                    <span class="fv-setup-chip">VM folders: ${context.vmFolders}</span>
                    <span class="fv-setup-chip">Rules: ${context.dockerRules + context.vmRules}</span>
                    <span class="fv-setup-chip">Backups: ${context.dockerBackups + context.vmBackups}</span>
                    <span class="fv-setup-chip">Templates: ${context.dockerTemplates + context.vmTemplates}</span>
                </div>
                <div class="fv-setup-route-grid">
                    ${['new', 'migrate', 'advanced'].map((route) => `
                        <label class="fv-setup-route-option ${setupAssistantState.route === route ? 'is-active' : ''}">
                            <input type="radio" name="fv-setup-route" value="${route}" ${setupAssistantState.route === route ? 'checked' : ''}>
                            <span class="fv-setup-route-title">${escapeHtml(route === 'new' ? 'New install' : route === 'migrate' ? 'Migrate existing' : 'Advanced custom')}</span>
                            <span class="fv-setup-route-help">${escapeHtml(routeDescriptions[route])}</span>
                        </label>
                    `).join('')}
                </div>
            </section>
            <section class="fv-setup-card">
                <h4>Default settings mode</h4>
                <p class="fv-setup-muted">You can change this any time in the top bar.</p>
                <div class="fv-setup-mode-toggle">
                    <button type="button" class="${setupAssistantState.mode === 'basic' ? 'is-active' : ''}" data-fv-setup-mode="basic">Basic</button>
                    <button type="button" class="${setupAssistantState.mode === 'advanced' ? 'is-active' : ''}" data-fv-setup-mode="advanced">Advanced</button>
                </div>
                <p class="fv-setup-muted">Basic keeps day-to-day settings visible. Advanced unlocks all sections.</p>
            </section>
        </div>
    `;
};

const renderSetupAssistantProfileStep = () => {
    return `
        <div class="fv-setup-card">
            <h4>Choose a defaults profile</h4>
            <p class="fv-setup-muted">Profile defaults only apply if you enable them below.</p>
            <div class="fv-setup-profile-grid">
                ${Object.entries(SETUP_ASSISTANT_PROFILE_PRESETS).map(([profileKey, preset]) => `
                    <label class="fv-setup-profile-option ${setupAssistantState.profile === profileKey ? 'is-active' : ''}">
                        <input type="radio" name="fv-setup-profile" value="${escapeHtml(profileKey)}" ${setupAssistantState.profile === profileKey ? 'checked' : ''}>
                        <span class="fv-setup-profile-title">${escapeHtml(preset.label)}</span>
                        <span class="fv-setup-profile-help">${escapeHtml(preset.description)}</span>
                    </label>
                `).join('')}
            </div>
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" id="fv-setup-apply-profile" ${setupAssistantState.applyProfileDefaults ? 'checked' : ''}>
                Apply profile runtime/status defaults during setup
            </label>
            <h4>Environment preset</h4>
            <p class="fv-setup-muted">Environment presets tune folder behavior defaults for Docker and VMs.</p>
            <div class="fv-setup-env-grid">
                ${Object.entries(SETUP_ASSISTANT_ENV_PRESETS).map(([presetKey, preset]) => `
                    <label class="fv-setup-env-option ${setupAssistantState.environmentPreset === presetKey ? 'is-active' : ''}">
                        <input type="radio" name="fv-setup-environment" value="${escapeHtml(presetKey)}" ${setupAssistantState.environmentPreset === presetKey ? 'checked' : ''}>
                        <span class="fv-setup-env-title">${escapeHtml(preset.label)}</span>
                        <span class="fv-setup-env-help">${escapeHtml(preset.description)}</span>
                    </label>
                `).join('')}
            </div>
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" id="fv-setup-apply-environment" ${setupAssistantState.applyEnvironmentDefaults ? 'checked' : ''}>
                Apply environment behavior defaults during setup
            </label>
        </div>
    `;
};

const renderSetupAssistantImportTypeCard = (type) => {
    const resolvedType = normalizeManagedType(type);
    const title = resolvedType === 'docker' ? 'Docker' : 'VM';
    const plan = setupAssistantState.importPlans[resolvedType];
    const hasFile = Boolean(plan?.parsed);
    const operationCount = hasFile
        ? countImportOperations(plan.operations || { creates: [], upserts: [], deletes: [] })
        : 0;
    const summary = plan?.summary;
    const schemaText = hasFile
        ? (plan.parsed.schemaVersion !== null ? `Schema v${plan.parsed.schemaVersion}` : 'Legacy schema')
        : 'No file selected';

    return `
        <section class="fv-setup-card fv-setup-import-card">
            <div class="fv-setup-import-header">
                <h4>${title} import</h4>
                <div class="fv-setup-chip-row">
                    <span class="fv-setup-chip">${escapeHtml(schemaText)}</span>
                    <span class="fv-setup-chip">${hasFile ? escapeHtml(plan.parsed.mode === 'single' ? 'Single folder' : 'Full export') : 'Waiting for file'}</span>
                    <span class="fv-setup-chip">Operations: ${operationCount}</span>
                </div>
            </div>
            <div class="fv-setup-import-actions">
                <button type="button" data-fv-setup-import-select="${resolvedType}"><i class="fa fa-upload"></i> Select ${title} export</button>
                <button type="button" data-fv-setup-import-clear="${resolvedType}" ${hasFile ? '' : 'disabled'}><i class="fa fa-trash"></i> Clear</button>
            </div>
            <div class="fv-setup-muted">${hasFile ? escapeHtml(plan.fileName || 'Selected file') : `Choose a ${title} export JSON to preview changes.`}</div>
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" data-fv-setup-import-include="${resolvedType}" ${plan.include ? 'checked' : ''} ${hasFile ? '' : 'disabled'}>
                Include this ${title} import in Apply
            </label>
            <label class="fv-setup-field">
                <span>Import mode</span>
                <select data-fv-setup-import-mode="${resolvedType}" ${hasFile ? '' : 'disabled'}>
                    <option value="merge" ${plan.mode === 'merge' ? 'selected' : ''}>Merge (add + update)</option>
                    <option value="replace" ${plan.mode === 'replace' ? 'selected' : ''}>Replace (delete missing)</option>
                    <option value="skip" ${plan.mode === 'skip' ? 'selected' : ''}>Skip existing (add new only)</option>
                </select>
            </label>
            ${hasFile ? `
                <div class="fv-setup-chip-row">
                    <span class="fv-setup-chip is-create">Create: ${summary?.creates?.length || 0}</span>
                    <span class="fv-setup-chip is-update">Update: ${summary?.updates?.length || 0}</span>
                    <span class="fv-setup-chip is-delete">Delete: ${summary?.deletes?.length || 0}</span>
                    <span class="fv-setup-chip">Unchanged: ${summary?.unchanged?.length || 0}</span>
                </div>
            ` : ''}
            ${plan.error ? `<div class="fv-setup-error">${escapeHtml(plan.error)}</div>` : ''}
        </section>
    `;
};

const renderSetupAssistantImportStep = () => `
    <div class="fv-setup-step-grid">
        ${renderSetupAssistantImportTypeCard('docker')}
        ${renderSetupAssistantImportTypeCard('vm')}
    </div>
`;

const renderSetupAssistantRuleTypeCard = (type) => {
    const resolvedType = normalizeManagedType(type);
    const title = resolvedType === 'docker' ? 'Docker' : 'VM';
    const bootstrap = setupAssistantState.ruleBootstrap[resolvedType];
    const suggestions = Array.isArray(bootstrap?.suggestions) ? bootstrap.suggestions : [];
    const selectedCount = suggestions.filter((row) => row.enabled !== false).length;
    const rowsHtml = suggestions.map((row, index) => {
        const preview = previewSetupAssistantRuleMatches(resolvedType, row.pattern);
        const previewClass = preview.valid ? (preview.count > 0 ? 'is-match' : 'is-empty') : 'is-error';
        return `
            <label class="fv-setup-rule-row">
                <input type="checkbox" data-fv-setup-rule-toggle="${resolvedType}" data-fv-setup-rule-index="${index}" ${row.enabled !== false ? 'checked' : ''} ${bootstrap.enabled ? '' : 'disabled'}>
                <span class="fv-setup-rule-main">${escapeHtml(row.folderName)} -> <code>${escapeHtml(row.pattern)}</code></span>
                <span class="fv-setup-rule-help">${escapeHtml(row.note || '')}</span>
                <span class="fv-setup-rule-preview ${previewClass}">${escapeHtml(preview.text)}</span>
            </label>
        `;
    }).join('');

    return `
        <section class="fv-setup-card">
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" data-fv-setup-rules-enable="${resolvedType}" ${bootstrap.enabled ? 'checked' : ''} ${suggestions.length ? '' : 'disabled'}>
                Add starter ${title} rules (${selectedCount}/${suggestions.length} selected)
            </label>
            ${suggestions.length ? `
                <div class="fv-setup-rule-list">
                    ${rowsHtml}
                </div>
            ` : '<div class="fv-setup-muted">No suggestions available yet. Select import files first or create folders manually.</div>'}
        </section>
    `;
};

const renderSetupAssistantRulesStep = () => `
    <div class="fv-setup-step-grid">
        ${renderSetupAssistantRuleTypeCard('docker')}
        ${renderSetupAssistantRuleTypeCard('vm')}
    </div>
`;

const renderSetupAssistantBehaviorTypeCard = (type) => {
    const resolvedType = normalizeManagedType(type);
    const behavior = setupAssistantState.behavior[resolvedType];
    const title = resolvedType === 'docker' ? 'Docker' : 'VM';
    return `
        <section class="fv-setup-card">
            <h4>${title} behavior</h4>
            <div class="fv-setup-field-grid">
                <label class="fv-setup-field">
                    <span>Sort mode</span>
                    <select data-fv-setup-behavior-sort="${resolvedType}">
                        <option value="created" ${behavior.sortMode === 'created' ? 'selected' : ''}>Created order</option>
                        <option value="manual" ${behavior.sortMode === 'manual' ? 'selected' : ''}>Manual</option>
                        <option value="alpha" ${behavior.sortMode === 'alpha' ? 'selected' : ''}>Name (A-Z)</option>
                    </select>
                </label>
                <label class="fv-setup-field">
                    <span>Status mode</span>
                    <select data-fv-setup-behavior-status="${resolvedType}">
                        <option value="summary" ${behavior.statusMode === 'summary' ? 'selected' : ''}>Summary</option>
                        <option value="dominant" ${behavior.statusMode === 'dominant' ? 'selected' : ''}>Dominant</option>
                    </select>
                </label>
                <label class="fv-setup-field">
                    <span>Status warn (%)</span>
                    <input type="number" min="0" max="100" step="1" data-fv-setup-behavior-status-warn="${resolvedType}" value="${Number(behavior.statusWarnStoppedPercent) || 60}">
                </label>
            </div>
            <div class="fv-setup-inline-grid">
                <label class="fv-setup-inline-toggle"><input type="checkbox" data-fv-setup-behavior-hide-empty="${resolvedType}" ${behavior.hideEmptyFolders ? 'checked' : ''}> Hide empty folders</label>
                <label class="fv-setup-inline-toggle"><input type="checkbox" data-fv-setup-behavior-health-cards="${resolvedType}" ${behavior.healthCardsEnabled ? 'checked' : ''}> Health cards</label>
                <label class="fv-setup-inline-toggle"><input type="checkbox" data-fv-setup-behavior-runtime-badge="${resolvedType}" ${behavior.runtimeBadgeEnabled ? 'checked' : ''}> Runtime summary badge</label>
            </div>
        </section>
    `;
};

const renderSetupAssistantBehaviorStep = () => `
    <div class="fv-setup-step-grid">
        ${renderSetupAssistantBehaviorTypeCard('docker')}
        ${renderSetupAssistantBehaviorTypeCard('vm')}
    </div>
`;

const renderSetupAssistantReviewStep = () => {
    const impact = buildSetupAssistantImpactSummary();
    const notes = buildSetupAssistantReviewNotes();
    setupAssistantState.reviewNotes = notes;

    return `
        <div class="fv-setup-card">
            <h4>Review planned changes</h4>
            <div class="fv-setup-review-grid">
                <span class="fv-setup-chip">Mode: ${escapeHtml(setupAssistantState.mode)}</span>
                <span class="fv-setup-chip">Route: ${escapeHtml(setupAssistantState.route)}</span>
                <span class="fv-setup-chip">Profile: ${escapeHtml(setupAssistantState.profile)}</span>
                <span class="fv-setup-chip">Environment: ${escapeHtml(SETUP_ASSISTANT_ENV_PRESETS[setupAssistantState.environmentPreset]?.label || 'Home Lab')}</span>
                <span class="fv-setup-chip">Dry run: ${setupAssistantState.dryRunOnly ? 'ON' : 'OFF'}</span>
            </div>
            <div class="fv-setup-impact-grid">
                <article class="fv-setup-impact-card">
                    <h5>Preferences</h5>
                    <p>${impact.prefs.totalChanges} changes planned</p>
                    <div class="fv-setup-chip-row">
                        <span class="fv-setup-chip">Docker: ${impact.prefs.byType.docker.count}</span>
                        <span class="fv-setup-chip">VM: ${impact.prefs.byType.vm.count}</span>
                    </div>
                </article>
                <article class="fv-setup-impact-card">
                    <h5>Imports</h5>
                    <p>${impact.imports.totals.totalOps} operations planned</p>
                    <div class="fv-setup-chip-row">
                        <span class="fv-setup-chip is-create">Create: ${impact.imports.totals.creates}</span>
                        <span class="fv-setup-chip is-update">Update: ${impact.imports.totals.updates}</span>
                        <span class="fv-setup-chip is-delete">Delete: ${impact.imports.totals.deletes}</span>
                    </div>
                </article>
                <article class="fv-setup-impact-card">
                    <h5>Starter rules</h5>
                    <p>${impact.rules.creatable} new rules planned</p>
                    <div class="fv-setup-chip-row">
                        <span class="fv-setup-chip">Selected: ${impact.rules.selected}</span>
                        <span class="fv-setup-chip">Duplicates: ${impact.rules.duplicates}</span>
                        <span class="fv-setup-chip">Missing folder: ${impact.rules.unresolvedFolder}</span>
                    </div>
                </article>
                <article class="fv-setup-impact-card">
                    <h5>Total impact</h5>
                    <p>${impact.totalPlannedChanges} net changes estimated</p>
                    <div class="fv-setup-chip-row">
                        <span class="fv-setup-chip">${setupAssistantState.route === 'migrate' ? 'Migration' : 'Configuration'} flow</span>
                    </div>
                </article>
            </div>
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" id="fv-setup-dry-run" ${setupAssistantState.dryRunOnly ? 'checked' : ''}>
                Dry run only (preview changes, do not modify folders or settings)
            </label>
            ${notes.length ? `
                <div class="fv-setup-warning-box">
                    <strong>Review notes</strong>
                    <ul>
                        ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
                    </ul>
                </div>
            ` : '<div class="fv-setup-muted">No warnings detected. Apply to finalize setup.</div>'}
        </div>
    `;
};

const renderSetupAssistantValidationBox = (validation) => {
    if (!validation || (!validation.blockers?.length && !validation.warnings?.length)) {
        return '';
    }
    return `
        <div class="fv-setup-validation-box ${validation.blockers?.length ? 'is-blocking' : 'is-warning'}">
            ${validation.blockers?.length ? `
                <div class="fv-setup-validation-title"><i class="fa fa-exclamation-circle"></i> Required before continuing</div>
                <ul>${validation.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            ` : ''}
            ${validation.warnings?.length ? `
                <div class="fv-setup-validation-title"><i class="fa fa-info-circle"></i> Review notes</div>
                <ul>${validation.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            ` : ''}
        </div>
    `;
};

const renderSetupAssistantStepBody = () => {
    const step = currentSetupAssistantStepKey();
    if (step === 'welcome') {
        return renderSetupAssistantWelcomeStep();
    }
    if (step === 'profile') {
        return renderSetupAssistantProfileStep();
    }
    if (step === 'import') {
        return renderSetupAssistantImportStep();
    }
    if (step === 'rules') {
        return renderSetupAssistantRulesStep();
    }
    if (step === 'behavior') {
        return renderSetupAssistantBehaviorStep();
    }
    return renderSetupAssistantReviewStep();
};

const getSetupAssistantFocusableElements = () => {
    const dialog = $('#fv-setup-assistant-dialog');
    if (!dialog.length) {
        return [];
    }
    return dialog.find(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ).filter(':visible').toArray();
};

const handleSetupAssistantDialogKeydown = (event) => {
    if (!setupAssistantState.open) {
        return;
    }
    if (event.key === 'Escape') {
        if (!setupAssistantState.busy && !setupAssistantState.applying) {
            event.preventDefault();
            closeSetupAssistant();
        }
        return;
    }
    if (event.key !== 'Tab') {
        return;
    }
    const focusable = getSetupAssistantFocusableElements();
    if (!focusable.length) {
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
        if (active === first || !focusable.includes(active)) {
            event.preventDefault();
            last.focus();
        }
        return;
    }
    if (active === last) {
        event.preventDefault();
        first.focus();
    }
};

const focusSetupAssistantIfNeeded = () => {
    const dialog = $('#fv-setup-assistant-dialog');
    if (!dialog.length) {
        return;
    }
    const current = document.activeElement;
    const ownsCurrentFocus = current && dialog[0].contains(current);
    if (ownsCurrentFocus) {
        return;
    }
    const focusable = getSetupAssistantFocusableElements();
    if (focusable.length > 0) {
        focusable[0].focus();
        return;
    }
    dialog.attr('tabindex', '-1');
    dialog[0].focus();
};

const formatSetupAssistantSavedAt = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return 'recently';
    }
    const formatted = formatTimestamp(raw);
    return formatted || raw;
};

const buildSetupAssistantVerificationReport = (importOutcomes, ruleOutcomes, validationWarnings = []) => {
    const checks = [];
    const register = (label, ok, detail = '') => {
        checks.push({
            label,
            ok: ok === true,
            detail
        });
    };
    for (const type of ['docker', 'vm']) {
        const prefs = utils.normalizePrefs(prefsByType[type] || {});
        register(`${type.toUpperCase()} setup flag persisted`, prefs.setupWizardCompleted === true);
        register(`${type.toUpperCase()} mode persisted`, prefs.settingsMode === setupAssistantState.mode, `Expected ${setupAssistantState.mode}`);
        if ((importOutcomes?.[type] || 0) > 0) {
            register(`${type.toUpperCase()} import applied`, true, `${importOutcomes[type]} operations`);
        }
        if ((ruleOutcomes?.[type]?.created || 0) > 0) {
            register(`${type.toUpperCase()} starter rules created`, true, `${ruleOutcomes[type].created} created`);
        }
    }
    register(
        'Rollback checkpoint created',
        Boolean(setupAssistantState.rollbackCheckpointName),
        setupAssistantState.rollbackCheckpointName || 'Not available'
    );
    if (validationWarnings.length) {
        register('Validation warnings', false, validationWarnings.join(' | '));
    }
    const passed = checks.filter((check) => check.ok).length;
    return {
        checks,
        passed,
        total: checks.length
    };
};

const renderSetupAssistant = () => {
    ensureSetupAssistantDom();
    const overlay = $('#fv-setup-assistant-overlay');
    const dialog = $('#fv-setup-assistant-dialog');
    const content = $('#fv-setup-assistant-content');

    if (!setupAssistantState.open) {
        overlay.hide();
        dialog.hide().attr('aria-hidden', 'true');
        dialog.off('keydown.fvsetupa11y');
        return;
    }

    clampSetupAssistantStep();
    const step = currentSetupAssistantStepKey();
    const atFirstStep = setupAssistantState.step === 0;
    const atLastStep = setupAssistantState.step >= SETUP_ASSISTANT_STEPS.length - 1;
    const canMove = !setupAssistantState.busy && !setupAssistantState.applying;
    const stepValidation = getSetupAssistantStepValidation(step);
    const hasBlockers = stepValidation.blockers.length > 0;
    const canNext = !atLastStep && canMove && !hasBlockers;
    const canApply = atLastStep && canMove && !hasBlockers;
    const restoredBanner = setupAssistantState.draftRestored
        ? `
            <div class="fv-setup-draft-banner">
                <span><i class="fa fa-history"></i> Restored draft from ${escapeHtml(formatSetupAssistantSavedAt(setupAssistantState.restoredDraftSavedAt))}.</span>
                <button type="button" id="fv-setup-discard-draft"><i class="fa fa-trash"></i> Start fresh</button>
            </div>
        `
        : '';

    content.html(`
        <div class="fv-setup-assistant-shell">
            <aside class="fv-setup-assistant-sidebar">
                <h3 id="fv-setup-assistant-title">Setup Assistant</h3>
                <p class="fv-setup-muted">Step ${setupAssistantState.step + 1} of ${SETUP_ASSISTANT_STEPS.length}</p>
                <ol class="fv-setup-step-list">
                    ${SETUP_ASSISTANT_STEPS.map((stepKey, index) => `
                        <li class="${index === setupAssistantState.step ? 'is-active' : (index < setupAssistantState.step ? 'is-complete' : '')}">
                            <span class="fv-setup-step-index">${index + 1}</span>
                            <span class="fv-setup-step-label">${escapeHtml(setupAssistantStepLabel(stepKey))}</span>
                        </li>
                    `).join('')}
                </ol>
            </aside>
            <section class="fv-setup-assistant-main">
                <header class="fv-setup-assistant-head">
                    <h4>${escapeHtml(setupAssistantStepLabel(step))}</h4>
                    <button type="button" id="fv-setup-close" ${canMove ? '' : 'disabled'}><i class="fa fa-times"></i> Close</button>
                </header>
                <div class="fv-setup-assistant-body">
                    ${restoredBanner}
                    ${renderSetupAssistantStepBody()}
                    ${renderSetupAssistantValidationBox(stepValidation)}
                </div>
                <footer class="fv-setup-assistant-foot">
                    <div class="fv-setup-foot-left">
                        <button type="button" id="fv-setup-prev" ${(!canMove || atFirstStep) ? 'disabled' : ''}><i class="fa fa-arrow-left"></i> Back</button>
                        <button type="button" id="fv-setup-next" ${canNext ? '' : 'disabled'}>Next <i class="fa fa-arrow-right"></i></button>
                    </div>
                    <div class="fv-setup-foot-right">
                        <button type="button" id="fv-setup-apply" ${canApply ? '' : 'disabled'}><i class="fa fa-check"></i> Apply setup</button>
                    </div>
                </footer>
                <div class="fv-setup-progress ${setupAssistantState.progressLabel ? 'is-visible' : ''}" aria-live="polite" aria-atomic="true">
                    <div class="fv-setup-progress-head">
                        <span>${escapeHtml(setupAssistantState.progressLabel || '')}</span>
                        <span>${setupAssistantState.progressPercent}%</span>
                    </div>
                    <div class="fv-setup-progress-track"><span style="width:${setupAssistantState.progressPercent}%;"></span></div>
                </div>
            </section>
        </div>
    `);

    overlay.show();
    dialog.show().attr('aria-hidden', 'false');
    bindSetupAssistantEvents();
    dialog.off('keydown.fvsetupa11y').on('keydown.fvsetupa11y', handleSetupAssistantDialogKeydown);
    persistSetupAssistantDraft();
    focusSetupAssistantIfNeeded();
};

const closeSetupAssistant = () => {
    if (setupAssistantState.open && setupAssistantState.applying !== true) {
        persistSetupAssistantDraft();
    }
    setupAssistantState.open = false;
    setupAssistantState.busy = false;
    setupAssistantState.applying = false;
    clearSetupAssistantProgress();
    renderSetupAssistant();
    if (setupAssistantLastFocusedElement && typeof setupAssistantLastFocusedElement.focus === 'function') {
        setupAssistantLastFocusedElement.focus();
    }
};

const openSetupAssistant = (force = false) => {
    if (!force && (isWizardCompletedServerSide() || isSetupAssistantCompletedLocal())) {
        return;
    }
    setupAssistantLastFocusedElement = document.activeElement;
    resetSetupAssistantState(force);
    const restored = restoreSetupAssistantDraftFromStorage();
    summarizeSetupAssistantImportPlan('docker');
    summarizeSetupAssistantImportPlan('vm');
    refreshSetupAssistantRuleSuggestions();
    if (restored) {
        summarizeSetupAssistantImportPlan('docker');
        summarizeSetupAssistantImportPlan('vm');
    }
    renderSetupAssistant();
};

const applySetupAssistantPlan = async () => {
    if (setupAssistantState.applying) {
        return;
    }
    const reviewValidation = getSetupAssistantStepValidation('review');
    if (reviewValidation.blockers.length) {
        setupAssistantState.step = SETUP_ASSISTANT_STEPS.length - 1;
        renderSetupAssistant();
        return;
    }

    setupAssistantState.applying = true;
    setupAssistantState.busy = true;
    const impactSummary = buildSetupAssistantImpactSummary();
    setSetupAssistantProgress(setupAssistantState.dryRunOnly ? 'Running dry run checks...' : 'Creating rollback checkpoint...', 5);
    renderSetupAssistant();

    let rollbackCreated = false;
    const ruleOutcomes = { docker: { created: 0, skipped: 0 }, vm: { created: 0, skipped: 0 } };
    const importOutcomes = { docker: 0, vm: 0 };
    try {
        if (setupAssistantState.dryRunOnly === true) {
            await new Promise((resolve) => setTimeout(resolve, 140));
            setSetupAssistantProgress('Dry run complete.', 100);
            renderSetupAssistant();
            const dryRunLines = [
                `Route: ${setupAssistantState.route}`,
                `Mode: ${setupAssistantState.mode}`,
                `Environment: ${SETUP_ASSISTANT_ENV_PRESETS[setupAssistantState.environmentPreset]?.label || 'Home Lab'}`,
                `Preference changes planned: ${impactSummary.prefs.totalChanges}`,
                `Import operations planned: ${impactSummary.imports.totals.totalOps}`,
                `Starter rules planned: ${impactSummary.rules.creatable}`,
                `Warnings: ${reviewValidation.warnings.length ? reviewValidation.warnings.join(' | ') : 'None'}`
            ];
            swal({
                title: 'Dry run complete',
                text: dryRunLines.join('\n'),
                type: 'success'
            });
            return;
        }

        const rollback = await createGlobalRollbackCheckpointApi('setup_assistant_apply');
        rollbackCreated = true;
        setupAssistantState.rollbackCheckpointName = rollback?.name || rollback?.checkpoint || '';

        setSetupAssistantProgress('Applying settings profile...', 16);
        renderSetupAssistant();
        for (const type of ['docker', 'vm']) {
            const currentPrefs = utils.normalizePrefs(prefsByType[type] || {});
            let nextPrefs = utils.normalizePrefs({
                ...currentPrefs,
                settingsMode: setupAssistantState.mode,
                setupWizardCompleted: true
            });
            if (setupAssistantState.applyProfileDefaults) {
                nextPrefs = applySetupAssistantProfileToPrefs(nextPrefs, setupAssistantState.profile);
            }
            nextPrefs = applySetupAssistantBehaviorToPrefs(nextPrefs, setupAssistantState.behavior[type]);
            prefsByType[type] = await postPrefs(type, nextPrefs);
        }

        settingsUiState.mode = setupAssistantState.mode;
        setSettingsMode(setupAssistantState.mode);

        setSetupAssistantProgress('Applying imports...', 34);
        renderSetupAssistant();
        for (const type of ['docker', 'vm']) {
            const plan = setupAssistantState.importPlans[type];
            if (!(plan?.include && plan?.parsed)) {
                continue;
            }
            summarizeSetupAssistantImportPlan(type);
            const operations = plan.operations || { creates: [], upserts: [], deletes: [] };
            const operationCount = countImportOperations(operations);
            if (operationCount <= 0) {
                continue;
            }
            importOutcomes[type] = operationCount;
            const startPercent = type === 'docker' ? 40 : 56;
            const span = 14;
            await applyImportOperations(type, operations, ({ completed, total, label }) => {
                const safeTotal = Math.max(1, Number(total) || 1);
                const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
                const progress = startPercent + Math.round((safeCompleted / safeTotal) * span);
                setSetupAssistantProgress(label || `Applying ${type} import...`, progress);
                renderSetupAssistant();
            });
            await Promise.all([refreshType(type), refreshBackups(type)]);
        }

        setSetupAssistantProgress('Applying starter rules...', 74);
        renderSetupAssistant();
        for (const type of ['docker', 'vm']) {
            ruleOutcomes[type] = await applySetupAssistantRulesForType(type);
        }

        setSetupAssistantProgress('Refreshing settings...', 88);
        renderSetupAssistant();
        await refreshAll();
        refreshSettingsUx();
        captureSettingsBaseline();

        setSetupAssistantProgress('Running validation checks...', 95);
        renderSetupAssistant();
        const validationWarnings = [];
        for (const type of ['docker', 'vm']) {
            const prefs = utils.normalizePrefs(prefsByType[type] || {});
            if (prefs.setupWizardCompleted !== true) {
                validationWarnings.push(`${type.toUpperCase()} setup completion flag was not persisted.`);
            }
            if (prefs.settingsMode !== setupAssistantState.mode) {
                validationWarnings.push(`${type.toUpperCase()} mode did not persist as "${setupAssistantState.mode}".`);
            }
        }

        const verification = buildSetupAssistantVerificationReport(importOutcomes, ruleOutcomes, validationWarnings);
        markSetupAssistantCompletedLocal();
        settingsUiState.wizardShown = true;
        await persistSetupPrefsToServer({
            mode: setupAssistantState.mode,
            completed: true
        });

        setSetupAssistantProgress('Setup complete.', 100);
        renderSetupAssistant();
        await new Promise((resolve) => setTimeout(resolve, 220));
        closeSetupAssistant();
        await maybeShowUpdateNotesPanel();

        const checkpointText = setupAssistantState.rollbackCheckpointName
            ? `Rollback checkpoint: ${setupAssistantState.rollbackCheckpointName}`
            : 'Rollback checkpoint created.';
        const summaryLines = [
            `Mode: ${setupAssistantState.mode}`,
            `Profile defaults: ${setupAssistantState.applyProfileDefaults ? setupAssistantState.profile : 'not applied'}`,
            `Environment defaults: ${setupAssistantState.applyEnvironmentDefaults ? (SETUP_ASSISTANT_ENV_PRESETS[setupAssistantState.environmentPreset]?.label || 'Home Lab') : 'not applied'}`,
            `Docker import operations: ${importOutcomes.docker}`,
            `VM import operations: ${importOutcomes.vm}`,
            `Docker starter rules added: ${ruleOutcomes.docker.created}`,
            `VM starter rules added: ${ruleOutcomes.vm.created}`,
            `Verification: ${verification.passed}/${verification.total} checks passed`,
            checkpointText
        ];
        if (validationWarnings.length) {
            summaryLines.push(`Validation warnings: ${validationWarnings.join(' | ')}`);
        }

        swal({
            title: 'Setup assistant complete',
            text: `${summaryLines.join('\n')}\n\nUndo this setup now?`,
            type: 'success',
            showCancelButton: true,
            confirmButtonText: 'Undo setup',
            cancelButtonText: 'Done',
            showLoaderOnConfirm: true,
            closeOnConfirm: false
        }, async (undoNow) => {
            if (!undoNow) {
                return;
            }
            try {
                const restore = await restorePreviousGlobalRollbackCheckpointApi();
                await refreshAll();
                swal({
                    title: 'Setup reverted',
                    text: `Restored ${restore?.targetName || restore?.name || 'previous checkpoint'}.`,
                    type: 'success'
                });
            } catch (error) {
                showError('Setup undo failed', error);
            }
        });
    } catch (error) {
        let rollbackMessage = '';
        if (rollbackCreated) {
            try {
                await restorePreviousGlobalRollbackCheckpointApi();
                await refreshAll();
                rollbackMessage = '\nAutomatic rollback restored the previous checkpoint.';
            } catch (rollbackError) {
                rollbackMessage = `\nAutomatic rollback failed: ${rollbackError?.message || rollbackError}`;
            }
        }
        showError('Setup assistant failed', new Error(`${error?.message || error}${rollbackMessage}`));
    } finally {
        setupAssistantState.applying = false;
        setupAssistantState.busy = false;
        clearSetupAssistantProgress();
        renderSetupAssistant();
    }
};

const bindSetupAssistantEvents = () => {
    const root = $('#fv-setup-assistant-content');
    if (!root.length) {
        return;
    }
    const rerender = () => {
        renderSetupAssistant();
    };

    root.find('#fv-setup-close').off('click.fvsetup').on('click.fvsetup', () => {
        closeSetupAssistant();
    });
    root.find('#fv-setup-discard-draft').off('click.fvsetup').on('click.fvsetup', () => {
        clearSetupAssistantDraft();
        resetSetupAssistantState(true);
        summarizeSetupAssistantImportPlan('docker');
        summarizeSetupAssistantImportPlan('vm');
        refreshSetupAssistantRuleSuggestions();
        renderSetupAssistant();
    });
    root.find('#fv-setup-prev').off('click.fvsetup').on('click.fvsetup', () => {
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        setupAssistantState.step = Math.max(0, setupAssistantState.step - 1);
        rerender();
    });
    root.find('#fv-setup-next').off('click.fvsetup').on('click.fvsetup', () => {
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        const validation = getSetupAssistantStepValidation(currentSetupAssistantStepKey());
        if (validation.blockers.length) {
            rerender();
            return;
        }
        setupAssistantState.step = Math.min(SETUP_ASSISTANT_STEPS.length - 1, setupAssistantState.step + 1);
        rerender();
    });
    root.find('#fv-setup-apply').off('click.fvsetup').on('click.fvsetup', () => {
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        void applySetupAssistantPlan();
    });
    root.find('input[name="fv-setup-route"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.route = String($(event.currentTarget).val() || 'new');
        if (setupAssistantState.route === 'new') {
            setupAssistantState.applyProfileDefaults = true;
            setupAssistantState.applyEnvironmentDefaults = true;
        }
        rerender();
    });
    root.find('[data-fv-setup-mode]').off('click.fvsetup').on('click.fvsetup', (event) => {
        setupAssistantState.mode = String($(event.currentTarget).attr('data-fv-setup-mode') || 'basic') === 'advanced' ? 'advanced' : 'basic';
        rerender();
    });
    root.find('input[name="fv-setup-profile"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const value = String($(event.currentTarget).val() || 'balanced');
        setupAssistantState.profile = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, value) ? value : 'balanced';
        rerender();
    });
    root.find('#fv-setup-apply-profile').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.applyProfileDefaults = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('input[name="fv-setup-environment"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.environmentPreset = normalizeSetupAssistantEnvironmentPreset($(event.currentTarget).val());
        if (setupAssistantState.applyEnvironmentDefaults) {
            applySetupAssistantEnvironmentPresetToState();
        }
        rerender();
    });
    root.find('#fv-setup-apply-environment').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.applyEnvironmentDefaults = $(event.currentTarget).prop('checked') === true;
        if (setupAssistantState.applyEnvironmentDefaults) {
            applySetupAssistantEnvironmentPresetToState();
        }
        rerender();
    });
    root.find('#fv-setup-dry-run').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.dryRunOnly = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('[data-fv-setup-import-mode]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-import-mode'));
        setupAssistantState.importPlans[type].mode = normalizeImportMode($(event.currentTarget).val());
        summarizeSetupAssistantImportPlan(type);
        refreshSetupAssistantRuleSuggestions();
        rerender();
    });
    root.find('[data-fv-setup-import-include]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-import-include'));
        setupAssistantState.importPlans[type].include = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('[data-fv-setup-import-clear]').off('click.fvsetup').on('click.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-import-clear'));
        setupAssistantState.importPlans[type] = createSetupAssistantImportPlan();
        refreshSetupAssistantRuleSuggestions();
        rerender();
    });
    root.find('[data-fv-setup-import-select]').off('click.fvsetup').on('click.fvsetup', async (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-import-select'));
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        setupAssistantState.busy = true;
        setSetupAssistantProgress(`Select a ${type === 'docker' ? 'Docker' : 'VM'} export file...`, 0);
        renderSetupAssistant();
        try {
            const selected = await selectJsonFile();
            if (!selected) {
                return;
            }
            let parsedFile = null;
            try {
                parsedFile = JSON.parse(selected.text);
            } catch (_error) {
                throw new Error('Selected file is not valid JSON.');
            }
            const parsed = utils.parseImportPayload(parsedFile, type);
            if (!parsed.ok) {
                throw new Error(parsed.error || 'Invalid import payload.');
            }
            setupAssistantState.importPlans[type].fileName = selected.name || `${type}.json`;
            setupAssistantState.importPlans[type].parsed = parsed;
            setupAssistantState.importPlans[type].include = true;
            setupAssistantState.importPlans[type].error = '';
            summarizeSetupAssistantImportPlan(type);
            refreshSetupAssistantRuleSuggestions();
        } catch (error) {
            setupAssistantState.importPlans[type].error = String(error?.message || error);
            showError('Import file validation failed', error);
        } finally {
            setupAssistantState.busy = false;
            clearSetupAssistantProgress();
            rerender();
        }
    });
    root.find('[data-fv-setup-rules-enable]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-rules-enable'));
        setupAssistantState.ruleBootstrap[type].enabled = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('[data-fv-setup-rule-toggle]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-rule-toggle'));
        const index = Number($(event.currentTarget).attr('data-fv-setup-rule-index'));
        const row = setupAssistantState.ruleBootstrap[type].suggestions[index];
        if (row) {
            row.enabled = $(event.currentTarget).prop('checked') === true;
        }
        rerender();
    });
    root.find('[data-fv-setup-behavior-sort]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-sort'));
        setupAssistantState.behavior[type].sortMode = String($(event.currentTarget).val() || 'created');
        rerender();
    });
    root.find('[data-fv-setup-behavior-status]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-status'));
        setupAssistantState.behavior[type].statusMode = normalizeStatusMode($(event.currentTarget).val());
        rerender();
    });
    root.find('[data-fv-setup-behavior-status-warn]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-status-warn'));
        const value = Number($(event.currentTarget).val());
        setupAssistantState.behavior[type].statusWarnStoppedPercent = Number.isFinite(value)
            ? Math.max(0, Math.min(100, Math.round(value)))
            : 60;
        rerender();
    });
    root.find('[data-fv-setup-behavior-hide-empty]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-hide-empty'));
        setupAssistantState.behavior[type].hideEmptyFolders = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('[data-fv-setup-behavior-health-cards]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-health-cards'));
        setupAssistantState.behavior[type].healthCardsEnabled = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('[data-fv-setup-behavior-runtime-badge]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-runtime-badge'));
        setupAssistantState.behavior[type].runtimeBadgeEnabled = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    $('#fv-setup-assistant-overlay').off('click.fvsetup').on('click.fvsetup', () => {
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        closeSetupAssistant();
    });
};

const normalizeStatusFilterMode = (value) => {
    const mode = String(value || 'all').trim().toLowerCase();
    return ['all', 'started', 'paused', 'stopped', 'mixed', 'empty'].includes(mode) ? mode : 'all';
};

const getStatusFilterLabel = (mode) => {
    if (mode === 'started') {
        return 'started folders';
    }
    if (mode === 'paused') {
        return 'paused folders';
    }
    if (mode === 'stopped') {
        return 'stopped folders';
    }
    if (mode === 'mixed') {
        return 'mixed folders';
    }
    if (mode === 'empty') {
        return 'empty folders';
    }
    return 'all folders';
};

const getItemRuntimeStateKind = (type, itemInfo) => {
    const source = itemInfo && typeof itemInfo === 'object' ? itemInfo : {};
    if (type === 'vm') {
        const raw = String(source.state || source.State || '').toLowerCase();
        if (raw === 'running') {
            return 'started';
        }
        if (raw === 'paused' || raw === 'unknown' || raw === 'pmsuspended') {
            return 'paused';
        }
        return 'stopped';
    }
    const nested = source?.info?.State || source?.State || {};
    const running = Boolean(nested?.Running ?? source?.state ?? source?.running);
    const paused = Boolean(nested?.Paused ?? source?.pause ?? source?.paused);
    if (running && paused) {
        return 'paused';
    }
    if (running) {
        return 'started';
    }
    return 'stopped';
};

const valueIsTruthy = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) && value !== 0;
    }
    const text = String(value || '').trim().toLowerCase();
    return text === 'true' || text === '1' || text === 'yes' || text === 'on' || text === 'enabled';
};

const deriveFolderStatusKey = (countsByState, totalMembers) => {
    const total = Number(totalMembers) || 0;
    if (total <= 0) {
        return 'empty';
    }
    const started = Number(countsByState?.started || 0);
    const paused = Number(countsByState?.paused || 0);
    const stopped = Number(countsByState?.stopped || 0);
    const nonZeroKinds = [started, paused, stopped].filter((value) => value > 0).length;
    if (nonZeroKinds > 1) {
        return 'mixed';
    }
    if (started > 0) {
        return 'started';
    }
    if (paused > 0) {
        return 'paused';
    }
    return 'stopped';
};

const statusClassForKey = (statusKey) => {
    if (statusKey === 'started') {
        return 'is-started';
    }
    if (statusKey === 'paused') {
        return 'is-paused';
    }
    if (statusKey === 'stopped') {
        return 'is-stopped';
    }
    if (statusKey === 'mixed') {
        return 'is-mixed';
    }
    return 'is-empty';
};

const statusLabelForKey = (statusKey) => {
    if (statusKey === 'started') {
        return 'Started';
    }
    if (statusKey === 'paused') {
        return 'Paused';
    }
    if (statusKey === 'stopped') {
        return 'Stopped';
    }
    if (statusKey === 'mixed') {
        return 'Mixed';
    }
    return 'Empty';
};

const formatStatusSummaryText = (countsByState, totalMembers) => {
    const total = Number(totalMembers) || 0;
    if (total <= 0) {
        return 'Empty';
    }
    const parts = [];
    if ((countsByState?.started || 0) > 0) {
        parts.push(`${countsByState.started} started`);
    }
    if ((countsByState?.paused || 0) > 0) {
        parts.push(`${countsByState.paused} paused`);
    }
    if ((countsByState?.stopped || 0) > 0) {
        parts.push(`${countsByState.stopped} stopped`);
    }
    return parts.join(' | ');
};

const formatStatusDominantText = (statusKey, countsByState, totalMembers) => {
    const total = Number(totalMembers) || 0;
    if (total <= 0) {
        return 'Empty';
    }
    const label = statusLabelForKey(statusKey);
    if (statusKey === 'mixed') {
        return 'Mixed';
    }
    const count = statusKey === 'started'
        ? Number(countsByState?.started || 0)
        : (statusKey === 'paused' ? Number(countsByState?.paused || 0) : Number(countsByState?.stopped || 0));
    return `${label} ${count}/${total}`;
};

const folderMatchesStatusFilter = (statusFilterMode, countsByState, totalMembers) => {
    const mode = normalizeStatusFilterMode(statusFilterMode);
    if (mode === 'all') {
        return true;
    }
    const total = Number(totalMembers) || 0;
    if (mode === 'empty') {
        return total <= 0;
    }
    if (total <= 0) {
        return false;
    }
    const started = Number(countsByState?.started || 0);
    const paused = Number(countsByState?.paused || 0);
    const stopped = Number(countsByState?.stopped || 0);
    if (mode === 'started') {
        return started > 0;
    }
    if (mode === 'paused') {
        return paused > 0;
    }
    if (mode === 'stopped') {
        return stopped > 0;
    }
    if (mode === 'mixed') {
        return [started, paused, stopped].filter((value) => value > 0).length > 1;
    }
    return true;
};

const summarizeStatusMembers = (label, names, maxItems = 6) => {
    const list = Array.isArray(names) ? names : [];
    if (!list.length) {
        return `${label}: none`;
    }
    const preview = list.slice(0, maxItems).join(', ');
    const extra = list.length > maxItems ? ` (+${list.length - maxItems} more)` : '';
    return `${label}: ${preview}${extra}`;
};

const resolveFolderStatusWarnThreshold = (folder, fallbackThreshold) => {
    const safeFallback = Number.isFinite(Number(fallbackThreshold))
        ? Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold))))
        : 60;
    const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
        ? folder.settings
        : {};
    const raw = settings.status_warn_stopped_percent;
    if (raw === '' || raw === null || raw === undefined) {
        return { value: safeFallback, source: 'global' };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return { value: safeFallback, source: 'global' };
    }
    return {
        value: Math.min(100, Math.max(0, Math.round(parsed))),
        source: 'folder'
    };
};

const buildStatusSnapshot = (type, folders, memberSnapshot, infoByName) => {
    const snapshot = {};
    for (const [id] of Object.entries(folders || {})) {
        const members = Array.isArray(memberSnapshot?.[id]?.members) ? memberSnapshot[id].members : [];
        const countsByState = { started: 0, paused: 0, stopped: 0 };
        for (const member of members) {
            const runtimeState = getItemRuntimeStateKind(type, infoByName[member] || {});
            if (runtimeState === 'started') {
                countsByState.started += 1;
            } else if (runtimeState === 'paused') {
                countsByState.paused += 1;
            } else {
                countsByState.stopped += 1;
            }
        }
        snapshot[String(id)] = {
            total: members.length,
            started: countsByState.started,
            paused: countsByState.paused,
            stopped: countsByState.stopped,
            statusKey: deriveFolderStatusKey(countsByState, members.length)
        };
    }
    return snapshot;
};

const isDockerUpdateAvailable = (itemInfo) => {
    const source = itemInfo && typeof itemInfo === 'object' ? itemInfo : {};
    const state = source?.info?.State || source?.State || {};
    // Mirror Docker tab behavior exactly:
    // update-ready means manager is dockerman and Updated is strict boolean false.
    return state?.manager === 'dockerman' && state?.Updated === false;
};

const formatGiBFromKiB = (kibValue) => {
    const kib = Number(kibValue) || 0;
    if (kib <= 0) {
        return '0 GiB';
    }
    const gib = kib / (1024 * 1024);
    const fixed = gib >= 100 ? gib.toFixed(0) : gib.toFixed(1);
    return `${fixed} GiB`;
};

const hasInvalidFolderRegex = (folder) => {
    const pattern = String(folder?.regex || '').trim();
    if (!pattern) {
        return false;
    }
    try {
        // eslint-disable-next-line no-new
        new RegExp(pattern);
        return false;
    } catch (_error) {
        return true;
    }
};

const buildTypeHealthMetrics = (type, folders, memberSnapshot = {}, prefsOverride = null) => {
    const normalizedType = type === 'vm' ? 'vm' : 'docker';
    const folderMap = utils.normalizeFolderMap(folders);
    const prefs = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[normalizedType]);
    const healthPrefs = normalizeHealthPrefs(normalizedType, prefs);
    const info = infoByType[normalizedType] || {};
    const pinnedSet = new Set(Array.isArray(prefs.pinnedFolderIds) ? prefs.pinnedFolderIds : []);
    const regexRuleKinds = new Set(['name_regex', 'image_regex', 'compose_project_regex']);
    const invalidRuleRegexCount = (prefs.autoRules || []).reduce((count, rule) => {
        if (!regexRuleKinds.has(String(rule?.kind || ''))) {
            return count;
        }
        const pattern = String(rule?.pattern || '').trim();
        if (!pattern) {
            return count;
        }
        try {
            // eslint-disable-next-line no-new
            new RegExp(pattern);
            return count;
        } catch (_error) {
            return count + 1;
        }
    }, 0);
    const conflictReport = utils.getConflictReport({
        type: normalizedType,
        folders: folderMap,
        prefs,
        infoByName: info
    });
    const conflictFolderIds = new Set();
    for (const row of conflictReport.rows || []) {
        if (!row?.hasConflict) {
            continue;
        }
        for (const matched of row.matchedFolders || []) {
            const folderId = String(matched?.folderId || '').trim();
            if (folderId) {
                conflictFolderIds.add(folderId);
            }
        }
    }

    const memberTotals = { total: 0, started: 0, paused: 0, stopped: 0 };
    const folderStatusTotals = { started: 0, paused: 0, stopped: 0, empty: 0 };
    const folderIssues = {};
    let invalidFolderRegexCount = 0;

    for (const [folderId, folder] of Object.entries(folderMap)) {
        const members = Array.isArray(memberSnapshot?.[folderId]?.members) ? memberSnapshot[folderId].members : [];
        let started = 0;
        let paused = 0;
        let stopped = 0;
        for (const name of members) {
            const state = getItemRuntimeStateKind(normalizedType, info[name] || {});
            if (state === 'started') {
                started += 1;
            } else if (state === 'paused') {
                paused += 1;
            } else {
                stopped += 1;
            }
        }
        memberTotals.total += members.length;
        memberTotals.started += started;
        memberTotals.paused += paused;
        memberTotals.stopped += stopped;

        const isEmpty = members.length === 0;
        const isStoppedOnly = members.length > 0 && started === 0 && paused === 0;
        const hasConflict = conflictFolderIds.has(String(folderId));
        const invalidRegex = hasInvalidFolderRegex(folder);
        const needsAttention = isEmpty || isStoppedOnly || hasConflict || invalidRegex;

        if (isEmpty) {
            folderStatusTotals.empty += 1;
        } else if (started > 0) {
            folderStatusTotals.started += 1;
        } else if (paused > 0) {
            folderStatusTotals.paused += 1;
        } else {
            folderStatusTotals.stopped += 1;
        }
        if (invalidRegex) {
            invalidFolderRegexCount += 1;
        }

        folderIssues[String(folderId)] = {
            empty: isEmpty,
            stoppedOnly: isStoppedOnly,
            conflict: hasConflict,
            invalidRegex,
            attention: needsAttention,
            memberCount: members.length
        };
    }

    const stoppedPercent = memberTotals.total > 0
        ? Math.round((memberTotals.stopped / memberTotals.total) * 100)
        : 0;
    const attentionCount = Object.values(folderIssues).filter((issue) => issue.attention).length;
    let severity = 'ok';
    if (invalidFolderRegexCount > 0 || invalidRuleRegexCount > 0 || conflictReport.conflictingItems > 0) {
        severity = 'danger';
    } else if (stoppedPercent >= healthPrefs.warnStoppedPercent || attentionCount > 0) {
        severity = 'warning';
    }

    return {
        type: normalizedType,
        severity,
        folderCount: Object.keys(folderMap).length,
        pinnedCount: Array.from(pinnedSet).filter((id) => Object.prototype.hasOwnProperty.call(folderMap, id)).length,
        ruleCount: (prefs.autoRules || []).length,
        invalidFolderRegexCount,
        invalidRuleRegexCount,
        conflictItemCount: Number(conflictReport.conflictingItems || 0),
        stoppedPercent,
        memberTotals,
        folderStatusTotals,
        attentionCount,
        folderIssues
    };
};

const folderMatchesHealthFilter = (type, folderId, healthMetrics) => {
    const mode = normalizeHealthFilterMode(healthFilterByType[type]);
    if (mode === 'all') {
        return true;
    }
    const issue = healthMetrics?.folderIssues?.[String(folderId)] || {};
    if (mode === 'attention') {
        return issue.attention === true;
    }
    if (mode === 'empty') {
        return issue.empty === true;
    }
    if (mode === 'stopped') {
        return issue.stoppedOnly === true;
    }
    if (mode === 'conflict') {
        return issue.conflict === true;
    }
    return true;
};

const getHealthFilterLabel = (mode) => {
    if (mode === 'attention') {
        return 'needs attention';
    }
    if (mode === 'empty') {
        return 'empty';
    }
    if (mode === 'stopped') {
        return 'stopped';
    }
    if (mode === 'conflict') {
        return 'conflicts';
    }
    return 'all';
};

const getEffectiveMemberSnapshot = (type, folders) => {
    const info = infoByType[type] || {};
    const names = Object.keys(info);
    const rules = prefsByType[type]?.autoRules || [];
    const snapshot = {};
    for (const [folderId, folder] of Object.entries(folders || {})) {
        const members = utils.getEffectiveFolderMembers({
            type,
            folderId,
            folder,
            names,
            infoByName: info,
            rules
        });
        snapshot[String(folderId)] = members;
    }
    return snapshot;
};

const getRuntimePlanForFolder = (type, folderId, action) => {
    const folders = getFolderMap(type);
    const folder = folders[folderId];
    if (!folder) {
        return null;
    }
    return utils.planFolderRuntimeAction({
        type,
        folderId,
        folder,
        names: Object.keys(infoByType[type] || {}),
        infoByName: infoByType[type] || {},
        rules: prefsByType[type]?.autoRules || [],
        action
    });
};

const runtimePreviewText = (type, folderId, action, plan) => {
    if (!plan) {
        return 'No plan available.';
    }
    const folderName = folderNameForId(type, folderId);
    const lines = [];
    lines.push(`Type: ${type}`);
    lines.push(`Folder: ${folderName} (${folderId})`);
    lines.push(`Action: ${action}`);
    lines.push(`Requested: ${plan.requestedCount}`);
    lines.push(`Eligible: ${plan.eligible.length}`);
    lines.push(`Skipped: ${plan.skipped.length}`);
    lines.push(`State counts: started=${plan.countsByState?.started || 0}, paused=${plan.countsByState?.paused || 0}, stopped=${plan.countsByState?.stopped || 0}`);
    lines.push('');
    if (plan.eligible.length) {
        lines.push(`Eligible items (${plan.eligible.length}):`);
        for (const row of plan.eligible) {
            lines.push(`- ${row.name} [${row.state}]${row.reasons?.length ? ` via ${row.reasons.join(', ')}` : ''}`);
        }
        lines.push('');
    }
    if (plan.skipped.length) {
        lines.push(`Skipped items (${plan.skipped.length}):`);
        for (const row of plan.skipped) {
            lines.push(`- ${row.name} [${row.state}] - ${row.reason}`);
        }
    }
    return `${lines.join('\n')}\n`;
};

const normalizedFilter = (value) => String(value || '').trim().toLowerCase();
const setFilterQuery = (section, type, value) => {
    if (!filtersByType[type] || !Object.prototype.hasOwnProperty.call(filtersByType[type], section)) {
        return;
    }
    filtersByType[type][section] = normalizedFilter(value);
    if (section === 'folders') {
        renderTable(type);
        return;
    }
    if (section === 'rules') {
        renderRulesTable(type);
        return;
    }
    if (section === 'backups') {
        renderBackupRows(type);
        return;
    }
    if (section === 'templates') {
        renderTemplateRows(type);
    }
};

const normalizeHealthSeverityFilterMode = (mode) => {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'good' || normalized === 'warn' || normalized === 'critical' || normalized === 'empty') {
        return normalized;
    }
    return 'all';
};

const getHealthSeverityFilterLabel = (mode) => {
    if (mode === 'good') {
        return 'good health';
    }
    if (mode === 'warn') {
        return 'warn health';
    }
    if (mode === 'critical') {
        return 'critical health';
    }
    if (mode === 'empty') {
        return 'empty health';
    }
    return 'all health';
};

const resolveFolderWarnThreshold = (folder, fallbackThreshold) => {
    const safeFallback = Number.isFinite(Number(fallbackThreshold))
        ? Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold))))
        : 60;
    const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
        ? folder.settings
        : {};
    const raw = settings.health_warn_stopped_percent;
    if (raw === '' || raw === null || raw === undefined) {
        return { value: safeFallback, source: 'global' };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return { value: safeFallback, source: 'global' };
    }
    return {
        value: Math.min(100, Math.max(0, Math.round(parsed))),
        source: 'folder'
    };
};

const evaluateDockerFolderHealth = (folder, members, countsByState, updateCount, fallbackWarnThreshold) => {
    const totalMembers = Number(members) || 0;
    const started = Number(countsByState?.started || 0);
    const paused = Number(countsByState?.paused || 0);
    const stopped = Number(countsByState?.stopped || 0);
    const thresholdInfo = resolveFolderWarnThreshold(folder, fallbackWarnThreshold);
    const warnThreshold = thresholdInfo.value;
    if (totalMembers === 0) {
        return {
            severity: 'empty',
            text: 'Empty',
            className: 'is-empty',
            isAlert: false,
            details: ['No members in this folder.']
        };
    }

    const stoppedPercent = Math.round((stopped / totalMembers) * 100);
    const allStopped = started === 0 && paused === 0 && stopped > 0;
    const hasUpdates = updateCount > 0;
    const thresholdLabel = thresholdInfo.source === 'folder'
        ? `Warn threshold: ${warnThreshold}% stopped (folder override).`
        : `Warn threshold: ${warnThreshold}% stopped (global default).`;

    const details = [];
    if (allStopped) {
        details.push(`All ${stopped}/${totalMembers} members are stopped.`);
    } else {
        details.push(`${started} started, ${paused} paused, ${stopped} stopped.`);
    }
    details.push(`Stopped percentage: ${stoppedPercent}%.`);
    if (hasUpdates) {
        details.push(`${updateCount} update${updateCount === 1 ? '' : 's'} available.`);
    } else {
        details.push('No updates available.');
    }
    details.push(thresholdLabel);

    const criticalThreshold = Math.min(100, Math.max(warnThreshold + 25, 90));
    if (allStopped || stoppedPercent >= criticalThreshold || updateCount >= 10) {
        return {
            severity: 'critical',
            text: 'Critical',
            className: 'is-danger',
            isAlert: true,
            details
        };
    }
    if (stoppedPercent >= warnThreshold || paused > 0 || hasUpdates) {
        return {
            severity: 'warn',
            text: 'Warn',
            className: 'is-warning',
            isAlert: true,
            details
        };
    }
    return {
        severity: 'good',
        text: 'Good',
        className: 'is-ok',
        isAlert: false,
        details
    };
};

const toggleDockerUpdatesFilter = (hasUpdatesInRow = false) => {
    if (dockerUpdatesOnlyFilter) {
        dockerUpdatesOnlyFilter = false;
        renderTable('docker');
        return;
    }
    if (hasUpdatesInRow) {
        dockerUpdatesOnlyFilter = true;
        renderTable('docker');
        return;
    }
    swal({
        title: 'No updates in this folder',
        text: 'Choose a folder with updates to enable the updates-only filter.',
        type: 'info'
    });
};

const toggleHealthSeverityFilter = (type = 'docker', severity = 'all') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const target = normalizeHealthSeverityFilterMode(severity);
    const current = normalizeHealthSeverityFilterMode(healthSeverityFilterByType[resolvedType]);
    healthSeverityFilterByType[resolvedType] = current === target ? 'all' : target;
    renderTable(resolvedType);
};

const toggleStatusFilter = (type = 'docker', statusKey = 'all') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const target = normalizeStatusFilterMode(statusKey);
    const current = normalizeStatusFilterMode(statusFilterByType[resolvedType]);
    statusFilterByType[resolvedType] = current === target ? 'all' : target;
    renderTable(resolvedType);
};

const clearFolderTableFilters = (type = 'docker') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (filtersByType[resolvedType]) {
        filtersByType[resolvedType].folders = '';
        $(`#${resolvedType}-folder-filter`).val('');
    }
    healthFilterByType[resolvedType] = 'all';
    healthSeverityFilterByType[resolvedType] = 'all';
    statusFilterByType[resolvedType] = 'all';
    if (resolvedType === 'docker') {
        dockerUpdatesOnlyFilter = false;
    }
    renderTable(resolvedType);
};

const apiGetText = async (url, options = {}) => {
    if (requestClient && typeof requestClient.getText === 'function') {
        return requestClient.getText(url, options);
    }
    return $.get(url, options?.data).promise();
};

const apiPostText = async (url, data = {}, options = {}) => {
    if (requestClient && typeof requestClient.postText === 'function') {
        return requestClient.postText(url, data, options);
    }
    return $.post(url, data).promise();
};

const apiGetJson = async (url, options = {}) => {
    if (requestClient && typeof requestClient.getJson === 'function') {
        return requestClient.getJson(url, options);
    }
    return parseJsonResponse(await $.get(url, options?.data).promise());
};

const apiPostJson = async (url, data = {}, options = {}) => {
    if (requestClient && typeof requestClient.postJson === 'function') {
        return requestClient.postJson(url, data, options);
    }
    return parseJsonResponse(await $.post(url, data).promise());
};

const fetchPluginVersion = async () => {
    try {
        pluginVersion = String(await apiGetText('/plugins/folderview.plus/server/version.php')).trim() || '0.0.0';
    } catch (error) {
        pluginVersion = '0.0.0';
    }
};

const fetchCurrentUpdateNotes = async () => apiGetJson('/plugins/folderview.plus/server/update_notes.php');

const getUpdateNotesSeenVersion = () => {
    try {
        return String(localStorage.getItem(UPDATE_NOTES_SEEN_VERSION_STORAGE_KEY) || '').trim();
    } catch (_error) {
        return '';
    }
};

const setUpdateNotesSeenVersion = (version) => {
    try {
        localStorage.setItem(UPDATE_NOTES_SEEN_VERSION_STORAGE_KEY, String(version || '').trim());
    } catch (_error) {
        // Best effort only.
    }
};

const showUpdateNotesPanel = ({ version, lines }) => {
    const panel = $('#fv-update-notes-panel');
    if (!panel.length) {
        return;
    }

    const normalizedLines = Array.isArray(lines)
        ? lines
            .map((line) => String(line || '').trim())
            .filter((line) => line !== '' && line !== '...')
            .map((line) => line.replace(/^[-*]\s*/, ''))
        : [];
    const listHtml = normalizedLines.length
        ? normalizedLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')
        : '<li>This update includes fixes and quality improvements.</li>';

    panel.html(`
        <div class="fv-update-notes-head">
            <div class="fv-update-notes-title-wrap">
                <span class="fv-update-notes-kicker">What changed</span>
                <h3>FolderView Plus ${escapeHtml(version)}</h3>
            </div>
            <div class="fv-update-notes-actions">
                <button type="button" id="fv-update-notes-open-changelog"><i class="fa fa-external-link"></i> Changelog</button>
                <button type="button" id="fv-update-notes-hide"><i class="fa fa-times"></i> Hide for now</button>
                <button type="button" id="fv-update-notes-dismiss"><i class="fa fa-check"></i> Dismiss</button>
            </div>
        </div>
        <ul class="fv-update-notes-list">${listHtml}</ul>
        <div class="fv-update-notes-foot">This panel remains visible after updates until you click Dismiss.</div>
    `).show();

    $('#fv-update-notes-open-changelog').off('click').on('click', () => {
        const popup = window.open(UPDATE_NOTES_CHANGELOG_URL, '_blank', 'noopener,noreferrer');
        if (popup) {
            popup.opener = null;
        }
    });
    $('#fv-update-notes-hide').off('click').on('click', () => {
        panel.slideUp(120);
    });
    $('#fv-update-notes-dismiss').off('click').on('click', () => {
        setUpdateNotesSeenVersion(version);
        panel.slideUp(120);
    });
};

const maybeShowUpdateNotesPanel = async () => {
    const currentVersion = String(pluginVersion || '').trim();
    if (!currentVersion || currentVersion === '0.0.0') {
        $('#fv-update-notes-panel').hide().empty();
        return;
    }

    const seenVersion = getUpdateNotesSeenVersion();
    if (seenVersion === currentVersion) {
        $('#fv-update-notes-panel').hide().empty();
        return;
    }

    let notes = [];
    try {
        const response = await fetchCurrentUpdateNotes();
        const lines = Array.isArray(response?.lines)
            ? response.lines.map((line) => String(line || '').trim()).filter((line) => line !== '')
            : [];
        if (lines.length) {
            notes = lines;
        }
    } catch (_error) {
        // Non-fatal: keep fallback message.
    }
    showUpdateNotesPanel({ version: currentVersion, lines: notes });
};

const fetchFolders = async (type) => apiGetJson(`/plugins/folderview.plus/server/read.php?type=${type}`);
const fetchTypeInfo = async (type) => apiGetJson(`/plugins/folderview.plus/server/read_info.php?type=${type}`);

const fetchBackups = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiGetJson('/plugins/folderview.plus/server/backup.php', {
        data: {
            type: resolvedType,
            action: 'list'
        }
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch backups.');
    }
    return Array.isArray(response.backups) ? response.backups : [];
};

const fetchBackupSnapshot = async (type, name) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiGetJson('/plugins/folderview.plus/server/backup.php', {
        data: {
            type: resolvedType,
            action: 'read',
            name
        }
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to read backup snapshot.');
    }
    return response.snapshot || {};
};

const restoreBackupByName = async (type, name) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'restore',
        name
    });
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const deleteBackupByName = async (type, name) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'delete',
        name
    });
    if (!response.ok) {
        throw new Error(response.error || 'Delete failed.');
    }
    return Array.isArray(response.backups) ? response.backups : [];
};

const fetchTemplates = async (type) => {
    const response = await apiGetJson('/plugins/folderview.plus/server/templates.php', {
        data: {
            type,
            action: 'list'
        }
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch templates.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const createTemplate = async (type, folderId, name) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'create',
        folderId,
        name
    });
    if (!response.ok) {
        throw new Error(response.error || 'Template create failed.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const deleteTemplate = async (type, templateId) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'delete',
        templateId
    });
    if (!response.ok) {
        throw new Error(response.error || 'Template delete failed.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const applyTemplate = async (type, templateId, folderId) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'apply',
        templateId,
        folderId
    });
    if (!response.ok) {
        throw new Error(response.error || 'Template apply failed.');
    }
    return response.apply || {};
};

const bulkAssign = async (type, folderId, items) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/bulk_assign.php', {
        type,
        folderId,
        items: JSON.stringify(items || [])
    });
    if (!response.ok) {
        throw new Error(response.error || 'Bulk assignment failed.');
    }
    return response.result;
};

const getDiagnostics = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=report&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Diagnostics failed.');
    }
    return response.diagnostics || {};
};

const getSupportBundle = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=support_bundle&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Support bundle failed.');
    }
    return response.bundle || {};
};

const runDiagnosticAction = async (action, type, privacy = 'sanitized') => {
    const payload = { action };
    if (type) {
        payload.type = type;
    }
    payload.privacy = privacy || 'sanitized';
    const response = await apiPostJson('/plugins/folderview.plus/server/diagnostics.php', payload);
    if (!response.ok) {
        throw new Error(response.error || 'Diagnostics action failed.');
    }
    return response.diagnostics || {};
};

const trackDiagnosticsEvent = async ({ eventType, type = null, status = 'ok', source = 'ui', details = {} }) => {
    if (!eventType) {
        return;
    }
    const payload = {
        action: 'track_event',
        eventType: String(eventType),
        status: String(status || 'ok'),
        source: String(source || 'ui'),
        details: JSON.stringify(details || {})
    };
    if (type) {
        payload.type = type;
    }
    try {
        await apiPostText('/plugins/folderview.plus/server/diagnostics.php', payload, {
            retries: 0,
            timeoutMs: 8000
        });
    } catch (error) {
        // Event tracking is best-effort and should never block UI actions.
    }
};

const fetchPrefs = async (type) => {
    try {
        const response = await apiGetJson(`/plugins/folderview.plus/server/prefs.php?type=${type}`);
        if (response.ok && response.prefs) {
            return utils.normalizePrefs(response.prefs);
        }
    } catch (error) {
        // Keep defaults.
    }
    return utils.normalizePrefs({});
};

const postPrefs = async (type, prefs) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/prefs.php', {
        type,
        prefs: JSON.stringify(prefs)
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to save preferences.');
    }
    latestPrefsBackupByType[type] = response.backup || null;
    return utils.normalizePrefs(response.prefs || prefs);
};

const createBackup = async (type, reason) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'create',
        reason
    });
    if (!response.ok) {
        throw new Error(response.error || 'Backup failed.');
    }
    return response.backup;
};

const createGlobalRollbackCheckpointApi = async (reason = 'manual') => {
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        action: 'rollback_checkpoint',
        reason
    });
    if (!response.ok) {
        throw new Error(response.error || 'Rollback checkpoint failed.');
    }
    return response.rollback || {};
};

const restorePreviousGlobalRollbackCheckpointApi = async () => {
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        action: 'rollback_restore_previous'
    });
    if (!response.ok) {
        throw new Error(response.error || 'Rollback restore failed.');
    }
    return response.restore || {};
};

const restoreLatest = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'restore_latest'
    });
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const restoreLatestUndo = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'restore_latest_undo'
    });
    if (!response.ok) {
        throw new Error(response.error || 'Undo restore failed.');
    }
    return response.restore;
};

const executeFolderRuntimeAction = async (type, runtimeAction, items) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/bulk_folder_action.php', {
        type,
        runtimeAction,
        items: JSON.stringify(items || [])
    });
    if (!response.ok) {
        throw new Error(response.error || 'Runtime action failed.');
    }
    return response.result || {};
};

const runScheduledBackup = async (type) => {
    const payload = {
        action: 'run_schedule'
    };
    if (type) {
        payload.type = type;
    }
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', payload);
    if (!response.ok) {
        throw new Error(response.error || 'Scheduled backup run failed.');
    }
    return response.schedules || {};
};

const syncDockerOrder = async () => {
    await apiPostText('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' });
};

const setUpdateStatus = (text) => {
    $('#update-check-status').text(text || '');
};

const setRollbackStatus = (text) => {
    $('#rollback-status').text(text || '');
};

const formatTimestamp = (isoString) => {
    if (!isoString) {
        return 'Unknown';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return String(isoString);
    }
    return date.toLocaleString();
};

const showError = (title, error) => {
    swal({
        title,
        text: error?.message || String(error),
        type: 'error'
    });
};

const copyTextToClipboard = async (text) => {
    const value = String(text || '');
    if (!value) {
        throw new Error('Nothing to copy.');
    }

    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } finally {
        document.body.removeChild(textarea);
    }
    if (!copied) {
        throw new Error('Clipboard access is unavailable in this browser context.');
    }
};

const copyFolderId = async (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const resolvedId = String(folderId || '').trim();
    if (!resolvedId) {
        return;
    }
    try {
        await copyTextToClipboard(resolvedId);
        swal({
            title: 'Copied',
            text: `${resolvedType === 'docker' ? 'Docker' : 'VM'} folder ID copied:\n${resolvedId}`,
            type: 'success',
            timer: 1400,
            showConfirmButton: false
        });
    } catch (error) {
        showError('Copy failed', error);
    }
};

const setImportantStyle = (element, property, value) => {
    if (!element || !element.style || typeof element.style.setProperty !== 'function') {
        return;
    }
    element.style.setProperty(property, value, 'important');
};

const enforceNoHorizontalOverflow = () => {
    const rootTargets = [
        document.documentElement,
        document.body,
        document.querySelector('.canvas'),
        document.querySelector('#content'),
        document.querySelector('#canvas')
    ].filter(Boolean);

    for (const target of rootTargets) {
        setImportantStyle(target, 'overflow-x', 'hidden');
    }

    const tableTargets = document.querySelectorAll('.folder-table .table-wrap, .folder-table table, .folder-table table th, .folder-table table td');
    tableTargets.forEach((target) => {
        setImportantStyle(target, 'max-width', '100%');
        setImportantStyle(target, 'min-width', '0');
    });
    document.querySelectorAll('.folder-table .table-wrap').forEach((target) => {
        setImportantStyle(target, 'overflow-x', 'hidden');
        setImportantStyle(target, 'overflow-y', 'visible');
    });
};

const initOverflowGuard = () => {
    if (overflowGuardBound) {
        enforceNoHorizontalOverflow();
        return;
    }
    overflowGuardBound = true;
    enforceNoHorizontalOverflow();
    window.addEventListener('resize', enforceNoHorizontalOverflow);
    const observer = new MutationObserver(() => {
        enforceNoHorizontalOverflow();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};

const closeImportApplyProgressDialog = () => {
    const overlay = $('#import-apply-progress-overlay');
    const dialog = $('#import-apply-progress-dialog');
    if (!dialog.length) {
        return;
    }
    overlay.hide();
    dialog.hide().attr('aria-hidden', 'true');
};

const updateImportApplyProgressDialog = ({ completed = 0, total = 1, label = '' }) => {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
    const percent = Math.round((safeCompleted / safeTotal) * 100);
    $('#import-apply-progress-label').text(label || 'Applying import...');
    $('#import-apply-progress-step').text(`Step ${safeCompleted} of ${safeTotal}`);
    $('#import-apply-progress-percent').text(`Progress ${percent}%`);
    $('#import-apply-progress-bar').css('width', `${percent}%`);
};

const openImportApplyProgressDialog = (type, totalSteps) => {
    const resolvedType = normalizeManagedType(type);
    const overlay = $('#import-apply-progress-overlay');
    const dialog = $('#import-apply-progress-dialog');
    if (!dialog.length || !overlay.length) {
        return;
    }
    closeImportApplyProgressDialog();
    dialog.removeClass('fv-section-hidden fv-section-content-hidden');
    updateImportApplyProgressDialog({
        completed: 0,
        total: totalSteps,
        label: `Preparing ${resolvedType === 'docker' ? 'Docker' : 'VM'} import...`
    });
    overlay.show();
    dialog.show().attr('aria-hidden', 'false');
};

const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file, 'UTF-8');
});

const selectJsonFile = () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = async (event) => {
        const file = event.target.files?.[0];
        document.body.removeChild(input);
        if (!file) {
            resolve(null);
            return;
        }
        try {
            const text = await readFileAsText(file);
            resolve({ name: file.name, text });
        } catch (error) {
            reject(error);
        }
    };
    document.body.appendChild(input);
    input.click();
});

const downloadFile = (name, content) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = name;
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
};

const formatSummaryList = (label, rows) => {
    if (!rows.length) {
        return `${label}: 0`;
    }
    const names = rows.slice(0, 10).map((row) => row.name || row.id || 'unnamed');
    const extra = rows.length > 10 ? ` (+${rows.length - 10} more)` : '';
    return `${label}: ${rows.length} | ${names.join(', ')}${extra}`;
};

const formatImportSummary = (summary) => [
    formatSummaryList('Create', summary.creates),
    formatSummaryList('Update', summary.updates),
    formatSummaryList('Skip', summary.skipped),
    formatSummaryList('Unchanged', summary.unchanged),
    formatSummaryList('Delete', summary.deletes),
    ...summary.notes
].join('\n');

const renderImportDiffTable = (rows, options = {}) => {
    const container = $('#import-preview-diff');
    const shouldResetPage = options?.resetPage === true;
    if (Array.isArray(rows)) {
        importDiffPagingState.rows = rows;
    }
    if (shouldResetPage) {
        importDiffPagingState.page = 1;
    }
    const effectiveRows = Array.isArray(importDiffPagingState.rows) ? importDiffPagingState.rows : [];
    if (!effectiveRows.length) {
        container.html('<div class="hint-line">No row-level changes detected.</div>');
        return;
    }
    const totalPages = Math.max(1, Math.ceil(effectiveRows.length / importDiffPagingState.pageSize));
    importDiffPagingState.page = Math.max(1, Math.min(totalPages, Number(importDiffPagingState.page) || 1));
    const start = (importDiffPagingState.page - 1) * importDiffPagingState.pageSize;
    const pageRows = effectiveRows.slice(start, start + importDiffPagingState.pageSize);
    const body = pageRows.map((row) => {
        const action = String(row.action || '').toUpperCase();
        const id = row.id ? escapeHtml(String(row.id)) : '-';
        const name = escapeHtml(String(row.name || '-'));
        const fields = Array.isArray(row.fields) ? row.fields.join(', ') : '';
        return `<tr><td>${escapeHtml(action)}</td><td>${id}</td><td>${name}</td><td>${escapeHtml(fields || '-')}</td></tr>`;
    }).join('');

    container.html(`
        <table>
            <thead>
                <tr>
                    <th>Action</th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Changed fields</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
        <div class="fv-table-pager">
            <button type="button" class="fv-import-diff-prev" ${importDiffPagingState.page <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="fv-table-pager-info">Page ${importDiffPagingState.page} / ${totalPages}</span>
            <button type="button" class="fv-import-diff-next" ${importDiffPagingState.page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `);
    container.find('.fv-import-diff-prev').off('click.fvimport').on('click.fvimport', () => {
        if (importDiffPagingState.page > 1) {
            importDiffPagingState.page -= 1;
            renderImportDiffTable(null);
        }
    });
    container.find('.fv-import-diff-next').off('click.fvimport').on('click.fvimport', () => {
        if (importDiffPagingState.page < totalPages) {
            importDiffPagingState.page += 1;
            renderImportDiffTable(null);
        }
    });
};

const buildOperationSelectionState = (operations, existingFolders) => {
    const folders = utils.normalizeFolderMap(existingFolders);
    return {
        creates: operations.creates.map((item, index) => ({ index, checked: true, label: item.folder?.name || `New folder ${index + 1}` })),
        upserts: operations.upserts.map((item, index) => ({ index, checked: true, label: item.folder?.name || folders[item.id]?.name || item.id || `Folder ${index + 1}` })),
        deletes: operations.deletes.map((id, index) => ({ index, checked: true, label: folders[id]?.name || id }))
    };
};

const filterOperationsBySelection = (operations) => {
    if (!importSelectionState) {
        return operations;
    }
    const createIndexes = new Set(importSelectionState.creates.filter((item) => item.checked).map((item) => item.index));
    const upsertIndexes = new Set(importSelectionState.upserts.filter((item) => item.checked).map((item) => item.index));
    const deleteIndexes = new Set(importSelectionState.deletes.filter((item) => item.checked).map((item) => item.index));

    return {
        mode: operations.mode,
        creates: operations.creates.filter((_, index) => createIndexes.has(index)),
        upserts: operations.upserts.filter((_, index) => upsertIndexes.has(index)),
        deletes: operations.deletes.filter((_, index) => deleteIndexes.has(index))
    };
};

const renderOperationSelection = (onSelectionChanged = null) => {
    const container = $('#import-preview-selection');
    if (!importSelectionState) {
        container.empty();
        return;
    }
    const previousScrollTop = Number(container.scrollTop()) || 0;

    const sections = [
        { key: 'creates', title: 'Create', items: importSelectionState.creates },
        { key: 'upserts', title: 'Update', items: importSelectionState.upserts },
        { key: 'deletes', title: 'Delete', items: importSelectionState.deletes }
    ];

    const html = sections.map((section) => {
        if (!section.items.length) {
            return '';
        }
        const allChecked = section.items.every((item) => item.checked);
        const rows = section.items.map((item) => (`<label class="import-selection-item"><input type="checkbox" data-group="${section.key}" data-index="${item.index}" ${item.checked ? 'checked' : ''}> ${escapeHtml(item.label)}</label>`)).join('');
        return `<div class="import-selection-group"><h4><label><input type="checkbox" data-group-toggle="${section.key}" ${allChecked ? 'checked' : ''}> ${section.title} (${section.items.length})</label></h4>${rows}</div>`;
    }).join('');

    container.html(html);
    if (previousScrollTop > 0) {
        const maxScroll = Math.max(0, container.prop('scrollHeight') - container.innerHeight());
        container.scrollTop(Math.min(previousScrollTop, maxScroll));
    }

    container.find('input[data-group-toggle]').off('change.fvimport').on('change.fvimport', (event) => {
        const group = String($(event.currentTarget).attr('data-group-toggle') || '');
        const checked = Boolean($(event.currentTarget).prop('checked'));
        if (Array.isArray(importSelectionState[group])) {
            importSelectionState[group].forEach((item) => {
                item.checked = checked;
            });
        }
        renderOperationSelection(onSelectionChanged);
    });

    container.find('input[data-group]').off('change.fvimport').on('change.fvimport', (event) => {
        const group = String($(event.currentTarget).attr('data-group') || '');
        const index = Number($(event.currentTarget).attr('data-index'));
        if (Array.isArray(importSelectionState[group])) {
            const row = importSelectionState[group].find((item) => item.index === index);
            if (row) {
                row.checked = Boolean($(event.currentTarget).prop('checked'));
            }
        }
        renderOperationSelection(onSelectionChanged);
    });

    if (typeof onSelectionChanged === 'function') {
        onSelectionChanged();
    }
};

const showImportPreviewDialog = (type, parsed) => new Promise((resolve) => {
    const dialog = $('#import-preview-dialog');
    dialog.removeClass('fv-section-hidden fv-section-content-hidden');
    const modeSelect = $('#import-mode-select');
    const presetSelect = $('#import-preset-select');
    const presetSaveButton = $('#import-preset-save');
    const presetDefaultButton = $('#import-preset-default');
    const presetDeleteButton = $('#import-preset-delete');
    const previewText = $('#import-preview-text');
    const meta = $('#import-preview-meta');
    const result = $('#import-preview-result');
    const counts = $('#import-preview-counts');
    const folders = getFolderMap(type);
    let dialogResult = null;
    let activePresetId = '';
    let currentOperations = { mode: 'merge', creates: [], upserts: [], deletes: [] };
    let currentDryRunOnly = false;
    const isImportDryRunOnly = () => {
        const checkbox = $('#import-dry-run-only');
        return checkbox.length ? checkbox.prop('checked') === true : false;
    };
    const setImportDryRunOnly = (enabled) => {
        const checkbox = $('#import-dry-run-only');
        if (checkbox.length) {
            checkbox.prop('checked', enabled === true);
        }
    };
    const updateSelectionSummary = () => {
        const selectedOperations = filterOperationsBySelection(currentOperations);
        const selectedCount = countImportOperations(selectedOperations);
        const selectedCreates = selectedOperations.creates.length;
        const selectedUpdates = selectedOperations.upserts.length;
        const selectedDeletes = selectedOperations.deletes.length;

        if (selectedCount === 0) {
            result.text('No operations selected yet. Use the checkboxes below to include at least one change.');
        } else if (currentDryRunOnly) {
            result.text(`${selectedCount} operation${selectedCount === 1 ? '' : 's'} selected. Dry run is ON, so no folder changes will be applied.`);
        } else {
            result.text(`${selectedCount} operation${selectedCount === 1 ? '' : 's'} selected and ready to apply.`);
        }

        counts.html(`
            <span class="import-count-chip is-create">Create: ${selectedCreates}/${currentOperations.creates.length}</span>
            <span class="import-count-chip is-update">Update: ${selectedUpdates}/${currentOperations.upserts.length}</span>
            <span class="import-count-chip is-delete">Delete: ${selectedDeletes}/${currentOperations.deletes.length}</span>
            <span class="import-count-chip is-selected">Selected: ${selectedCount}</span>
            <span class="import-count-chip is-dryrun">Dry run: ${currentDryRunOnly ? 'ON' : 'OFF'}</span>
        `);
    };
    const refreshPresetControls = () => {
        if (!presetSelect.length) {
            return;
        }
        const presets = getImportPresetsForType(type);
        const defaultPresetId = getDefaultImportPresetIdForType(type);
        const knownIds = new Set(presets.map((preset) => preset.id));
        const selectedIsCustomUnsaved = activePresetId === '__custom__';

        const options = presets.map((preset) => {
            const isDefault = preset.id === defaultPresetId;
            const label = isDefault ? `${formatImportPresetLabel(preset)} (default)` : formatImportPresetLabel(preset);
            return `<option value="${escapeHtml(preset.id)}">${escapeHtml(label)}</option>`;
        });
        if (selectedIsCustomUnsaved) {
            options.push('<option value="__custom__">Custom (unsaved)</option>');
        }
        presetSelect.html(options.join(''));

        if (!activePresetId || (!knownIds.has(activePresetId) && activePresetId !== '__custom__')) {
            activePresetId = defaultPresetId;
        }
        if (activePresetId && (knownIds.has(activePresetId) || activePresetId === '__custom__')) {
            presetSelect.val(activePresetId);
        } else if (presets.length) {
            activePresetId = presets[0].id;
            presetSelect.val(activePresetId);
        }

        const selectedPresetId = String(presetSelect.val() || '');
        const canSetDefault = selectedPresetId !== '' && selectedPresetId !== '__custom__';
        const canDelete = selectedPresetId.startsWith('custom:');
        presetDefaultButton.prop('disabled', !canSetDefault);
        presetDeleteButton.prop('disabled', !canDelete);
    };
    const applyPresetById = (presetId) => {
        const preset = findImportPresetById(type, presetId);
        if (!preset) {
            return false;
        }
        modeSelect.val(normalizeImportMode(preset.mode));
        setImportDryRunOnly(preset.dryRunOnly === true);
        activePresetId = preset.id;
        refreshPresetControls();
        return true;
    };
    const syncPresetFromCurrentInputs = () => {
        const matched = findImportPresetByModeAndDryRun(type, modeSelect.val(), isImportDryRunOnly());
        activePresetId = matched ? matched.id : '__custom__';
        refreshPresetControls();
    };

    modeSelect.html(`
        <option value="merge">Merge (add new + update existing)</option>
        <option value="replace">Replace (sync exactly, delete missing)</option>
        <option value="skip">Skip existing (only add new)</option>
    `);

    if (!$('#import-mode-help').length) {
        modeSelect.after('<div id="import-mode-help">Optional dry run: enable preview-only mode if you want to review without applying changes.</div>');
    }
    if (!$('#import-dry-run-row').length) {
        $('#import-mode-help').after('<label id="import-dry-run-row"><input id="import-dry-run-only" type="checkbox"> Dry run only (preview changes, do not modify folders)</label>');
    }
    // Safety default: keep dry-run disabled unless a user preset explicitly turns it on.
    $('#import-dry-run-only').prop('checked', false);
    if (!applyPresetById(getDefaultImportPresetForType(type)?.id || IMPORT_PRESET_DEFAULT_ID)) {
        modeSelect.val('merge');
        setImportDryRunOnly(false);
        activePresetId = '__custom__';
    }

    const renderPreview = () => {
        const mode = modeSelect.val();
        const summary = utils.summarizeImport(folders, parsed, mode);
        const operations = utils.buildImportOperations(folders, parsed, mode);
        const diffRows = utils.buildImportDiffRows(folders, parsed, mode);
        const dryRunOnly = isImportDryRunOnly();
        currentOperations = operations;
        currentDryRunOnly = dryRunOnly;
        importSelectionState = buildOperationSelectionState(operations, folders);
        renderOperationSelection(updateSelectionSummary);
        renderImportDiffTable(diffRows, { resetPage: true });
        previewText.val(formatImportSummary(summary));

        const metaItems = [
            { label: 'Type', value: type },
            { label: 'Format', value: `${parsed.mode}${parsed.legacy ? ' (legacy)' : ''}` },
            { label: 'Schema', value: parsed.schemaVersion !== null ? `v${parsed.schemaVersion}` : 'legacy' },
            { label: 'Plugin', value: parsed.pluginVersion || 'unknown' },
            { label: 'Exported', value: parsed.exportedAt || 'unknown' },
            { label: 'Safety', value: 'Auto backup before apply' }
        ];
        meta.html(metaItems.map((item) => (
            `<span class="preview-meta-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(String(item.value))}</span>`
        )).join(''));
        syncPresetFromCurrentInputs();
    };

    modeSelect.off('change.fvimport').on('change.fvimport', () => {
        renderPreview();
    });
    $('#import-dry-run-only').off('change.fvimport').on('change.fvimport', () => {
        renderPreview();
    });
    presetSelect.off('change.fvimportpreset').on('change.fvimportpreset', () => {
        const selectedId = String(presetSelect.val() || '');
        if (selectedId === '' || selectedId === '__custom__') {
            return;
        }
        if (applyPresetById(selectedId)) {
            renderPreview();
        }
    });
    presetSaveButton.off('click.fvimportpreset').on('click.fvimportpreset', async () => {
        const suggestedName = String((findImportPresetById(type, activePresetId)?.name || 'My import preset')).trim();
        const name = window.prompt('Preset name:', suggestedName);
        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
            return;
        }
        try {
            const saved = await saveCustomImportPresetForType(type, {
                name: trimmedName,
                mode: modeSelect.val(),
                dryRunOnly: isImportDryRunOnly()
            });
            activePresetId = saved.id;
            refreshPresetControls();
        } catch (error) {
            showError('Failed to save preset', error);
        }
    });
    presetDefaultButton.off('click.fvimportpreset').on('click.fvimportpreset', async () => {
        const selectedId = String(presetSelect.val() || '');
        if (!selectedId || selectedId === '__custom__') {
            return;
        }
        try {
            await setDefaultImportPresetIdForType(type, selectedId);
            activePresetId = selectedId;
            refreshPresetControls();
        } catch (error) {
            showError('Failed to set default preset', error);
        }
    });
    presetDeleteButton.off('click.fvimportpreset').on('click.fvimportpreset', () => {
        const selectedId = String(presetSelect.val() || '');
        if (!selectedId || !selectedId.startsWith('custom:')) {
            return;
        }
        swal({
            title: 'Delete import preset?',
            text: 'This only removes the saved custom preset.',
            type: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        }, async (confirmed) => {
            if (!confirmed) {
                return;
            }
            try {
                const deleted = await deleteCustomImportPresetForType(type, selectedId);
                if (deleted) {
                    activePresetId = getDefaultImportPresetIdForType(type);
                    refreshPresetControls();
                    renderPreview();
                }
            } catch (error) {
                showError('Failed to delete preset', error);
            }
        });
    });

    refreshPresetControls();
    renderPreview();

    const modalWidth = Math.min(980, Math.max(760, Math.floor(window.innerWidth * 0.92)));
    dialog.dialog({
        title: `Import ${type === 'docker' ? 'Docker' : 'VM'} Folders`,
        resizable: false,
        width: modalWidth,
        modal: true,
        dialogClass: 'fv-import-preview-modal',
        closeText: '',
        show: { effect: 'fade', duration: 120 },
        hide: { effect: 'fade', duration: 120 },
        close: () => resolve(dialogResult),
        buttons: {
            'Apply Import': function() {
                const mode = modeSelect.val();
                const operations = filterOperationsBySelection(utils.buildImportOperations(folders, parsed, mode));
                const dryRunOnly = isImportDryRunOnly();
                dialogResult = { mode, operations, dryRunOnly };
                $(this).dialog('close');
            },
            Cancel: function() {
                dialogResult = null;
                $(this).dialog('close');
            }
        }
    });
});
const countImportOperations = (operations) => (
    operations.creates.length + operations.upserts.length + operations.deletes.length
);

const pauseImportApplyChunk = () => new Promise((resolve) => {
    window.setTimeout(resolve, IMPORT_APPLY_CHUNK_PAUSE_MS);
});

const runImportChunked = async (items, runner) => {
    const list = Array.isArray(items) ? items : [];
    for (let start = 0; start < list.length; start += IMPORT_APPLY_CHUNK_SIZE) {
        const end = Math.min(start + IMPORT_APPLY_CHUNK_SIZE, list.length);
        for (let index = start; index < end; index += 1) {
            await runner(list[index], index);
        }
        if (end < list.length) {
            await pauseImportApplyChunk();
        }
    }
};

const applyImportOperations = async (type, operations, onProgress = null) => {
    const resolvedType = normalizeManagedType(type);
    const startedAt = perfNowMs();
    const deletes = Array.isArray(operations?.deletes) ? operations.deletes : [];
    const upserts = Array.isArray(operations?.upserts) ? operations.upserts : [];
    const creates = Array.isArray(operations?.creates) ? operations.creates : [];
    const currentFolders = getFolderMap(resolvedType);
    const totalSteps = deletes.length + upserts.length + creates.length + (resolvedType === 'docker' ? 1 : 0);
    let completed = 0;
    const emit = (label) => {
        if (typeof onProgress === 'function') {
            onProgress({ completed, total: totalSteps, label: String(label || '') });
        }
    };

    await runImportChunked(deletes, async (id) => {
        const folderName = String(currentFolders[id]?.name || id || 'folder');
        await apiPostText('/plugins/folderview.plus/server/delete.php', { type: resolvedType, id });
        completed += 1;
        emit(`Deleted ${folderName}`);
    });

    await runImportChunked(upserts, async (item) => {
        const folderName = String(item?.folder?.name || currentFolders[item?.id]?.name || item?.id || 'folder');
        await apiPostText('/plugins/folderview.plus/server/update.php', {
            type: resolvedType,
            id: item.id,
            content: JSON.stringify(item.folder)
        });
        completed += 1;
        emit(`Updated ${folderName}`);
    });

    await runImportChunked(creates, async (item) => {
        const folderName = String(item?.folder?.name || 'folder');
        await apiPostText('/plugins/folderview.plus/server/create.php', {
            type: resolvedType,
            content: JSON.stringify(item.folder)
        });
        completed += 1;
        emit(`Created ${folderName}`);
    });

    if (resolvedType === 'docker') {
        await syncDockerOrder();
        completed += 1;
        emit('Synced Docker folder order');
    }

    recordPerformanceDiagnosticsSample('import', resolvedType, perfNowMs() - startedAt, {
        deletes: deletes.length,
        updates: upserts.length,
        creates: creates.length
    });

    return {
        completed,
        total: totalSteps
    };
};

const offerUndoAction = async (type, backup, actionLabel) => {
    if (!backup || !backup.name) {
        return;
    }

    swal({
        title: `${actionLabel} complete`,
        text: `Backup created: ${backup.name}\nUndo this change now?`,
        type: 'success',
        showCancelButton: true,
        confirmButtonText: 'Undo now',
        cancelButtonText: 'Keep changes',
        closeOnConfirm: false,
        showLoaderOnConfirm: true
    }, async (shouldUndo) => {
        if (!shouldUndo) {
            return;
        }

        try {
            const restore = await restoreBackupByName(type, backup.name);
            await Promise.all([refreshType(type), refreshBackups(type)]);
            swal({
                title: 'Undo complete',
                text: `Restored ${restore.name}`,
                type: 'success'
            });
        } catch (error) {
            showError('Undo failed', error);
        }
    });
};

const buildRowsHtml = (type, folders, memberSnapshot = {}, hideEmptyFolders = false, healthMetrics = null, statusContext = null) => {
    const isDockerType = type === 'docker';
    const TABLE_COLUMN_COUNT = 10;
    const dockerHealthPrefs = isDockerType ? normalizeHealthPrefs('docker') : null;
    const statusPrefs = normalizeStatusPrefs(type);
    const rows = [];
    const filter = normalizedFilter(filtersByType[type]?.folders);
    const healthFilterMode = normalizeHealthFilterMode(healthFilterByType[type]);
    const healthSeverityFilterMode = normalizeHealthSeverityFilterMode(healthSeverityFilterByType[type]);
    const statusFilterMode = normalizeStatusFilterMode(statusFilterByType[type]);
    const previousStatusSnapshot = statusContext?.previous && typeof statusContext.previous === 'object'
        ? statusContext.previous
        : {};
    for (const [id, folder] of Object.entries(folders)) {
        const nameText = String(folder.name || '');
        const haystack = `${String(id)} ${nameText}`.toLowerCase();
        if (filter && !haystack.includes(filter)) {
            continue;
        }
        const members = Array.isArray(memberSnapshot[id]?.members) ? memberSnapshot[id].members : [];
        if (hideEmptyFolders && members.length === 0) {
            continue;
        }
        if (!folderMatchesHealthFilter(type, id, healthMetrics)) {
            continue;
        }
        const pinned = isFolderPinned(type, id);
        const pinTitle = pinned ? 'Unpin folder' : 'Pin folder to top';
        const safeName = escapeHtml(folder.name);
        const safeIcon = escapeHtml(folder.icon || '');
        const infoByName = infoByType[type] || {};
        const countsByState = { started: 0, paused: 0, stopped: 0 };
        const namesByState = { started: [], paused: [], stopped: [] };
        for (const member of members) {
            const runtimeState = getItemRuntimeStateKind(type, infoByName[member] || {});
            if (runtimeState === 'started') {
                countsByState.started += 1;
                namesByState.started.push(String(member));
            } else if (runtimeState === 'paused') {
                countsByState.paused += 1;
                namesByState.paused.push(String(member));
            } else {
                countsByState.stopped += 1;
                namesByState.stopped.push(String(member));
            }
        }
        if (!folderMatchesStatusFilter(statusFilterMode, countsByState, members.length)) {
            continue;
        }
        const statusWarnThresholdInfo = resolveFolderStatusWarnThreshold(folder, statusPrefs.warnStoppedPercent);
        const statusWarnThreshold = statusWarnThresholdInfo.value;
        const stoppedPercent = members.length > 0 ? Math.round((countsByState.stopped / members.length) * 100) : 0;
        const allStopped = members.length > 0
            && countsByState.started === 0
            && countsByState.paused === 0
            && countsByState.stopped > 0;
        const pausedOnly = members.length > 0
            && countsByState.started === 0
            && countsByState.paused > 0
            && countsByState.stopped === 0;
        const stoppedAttention = statusPrefs.attentionAccent === true
            && countsByState.stopped > 0
            && (allStopped || stoppedPercent >= statusWarnThreshold);
        const pausedAttention = statusPrefs.attentionAccent === true
            && !stoppedAttention
            && pausedOnly;
        const statusThresholdLabel = statusWarnThresholdInfo.source === 'folder'
            ? `Status warn threshold: ${statusWarnThreshold}% stopped (folder override).`
            : `Status warn threshold: ${statusWarnThreshold}% stopped (global default).`;
        const statusChips = [];
        if (members.length <= 0) {
            statusChips.push({
                key: 'empty',
                count: 0,
                names: [],
                attention: false
            });
        } else {
            if (countsByState.started > 0) {
                statusChips.push({
                    key: 'started',
                    count: countsByState.started,
                    names: namesByState.started,
                    attention: false
                });
            }
            if (countsByState.paused > 0) {
                statusChips.push({
                    key: 'paused',
                    count: countsByState.paused,
                    names: namesByState.paused,
                    attention: pausedAttention
                });
            }
            if (countsByState.stopped > 0) {
                statusChips.push({
                    key: 'stopped',
                    count: countsByState.stopped,
                    names: namesByState.stopped,
                    attention: stoppedAttention
                });
            }
        }
        const statusChipsHtml = `<span class="status-chip-list">${statusChips.map((chip) => {
            const chipClass = statusClassForKey(chip.key);
            const chipFilterActive = statusFilterMode === chip.key;
            const chipHint = chipFilterActive
                ? 'Click to show all statuses.'
                : `Click to show folders with ${statusLabelForKey(chip.key).toLowerCase()} members.`;
            const chipCountLabel = chip.key === 'empty'
                ? 'No members in this folder.'
                : `${chip.count} ${chip.key} member${chip.count === 1 ? '' : 's'}.`;
            const chipMemberDetails = chip.key === 'started'
                ? summarizeStatusMembers('Started items', namesByState.started)
                : (chip.key === 'paused'
                    ? summarizeStatusMembers('Paused items', namesByState.paused)
                    : (chip.key === 'stopped'
                        ? summarizeStatusMembers('Stopped items', namesByState.stopped)
                        : 'Started items: none'));
            const chipTitle = [
                `Status: ${statusLabelForKey(chip.key)}`,
                `Members: ${members.length} total`,
                `${countsByState.started} started, ${countsByState.paused} paused, ${countsByState.stopped} stopped`,
                chipCountLabel,
                chipMemberDetails,
                chip.key === 'stopped' ? `Stopped percentage: ${stoppedPercent}%` : '',
                chip.key === 'stopped' ? statusThresholdLabel : '',
                chipHint
            ].filter(Boolean).join('\n');
            const chipText = chip.key === 'empty'
                ? 'Empty'
                : (statusPrefs.mode === 'dominant'
                    ? `${statusLabelForKey(chip.key)} ${chip.count}/${members.length}`
                    : `${chip.count} ${chip.key}`);
            return `<button type="button" class="folder-runtime-status status-chip ${chipClass} ${chip.attention ? 'is-attention' : ''} ${chipFilterActive ? 'is-filter-active' : ''}" title="${escapeHtml(chipTitle)}" aria-label="${escapeHtml(chipTitle)}" onclick="toggleStatusFilter('${type}','${escapeHtml(chip.key)}')"><span>${escapeHtml(chipText)}</span></button>`;
        }).join('')}</span>`;

        let statusTrendHtml = '';
        if (statusPrefs.trendEnabled === true) {
            const previousStatus = previousStatusSnapshot[String(id)] || null;
            if (previousStatus) {
                const deltaStarted = countsByState.started - Number(previousStatus.started || 0);
                const deltaPaused = countsByState.paused - Number(previousStatus.paused || 0);
                const deltaStopped = countsByState.stopped - Number(previousStatus.stopped || 0);
                let trendClass = '';
                let trendIcon = '';
                let trendText = '';
                if (deltaStarted > 0 && deltaStopped <= 0) {
                    trendClass = 'is-up';
                    trendIcon = 'fa-arrow-up';
                    trendText = `+${deltaStarted} started`;
                } else if (deltaStopped > 0 && deltaStarted <= 0) {
                    trendClass = 'is-down';
                    trendIcon = 'fa-arrow-down';
                    trendText = `+${deltaStopped} stopped`;
                } else if (deltaPaused !== 0 || deltaStarted !== 0 || deltaStopped !== 0) {
                    trendClass = deltaStopped > deltaStarted ? 'is-down' : 'is-up';
                    trendIcon = trendClass === 'is-down' ? 'fa-exchange' : 'fa-random';
                    trendText = `S:${deltaStarted >= 0 ? '+' : ''}${deltaStarted} P:${deltaPaused >= 0 ? '+' : ''}${deltaPaused} X:${deltaStopped >= 0 ? '+' : ''}${deltaStopped}`;
                }
                if (trendText) {
                    statusTrendHtml = `<span class="status-trend ${trendClass}" aria-label="${escapeHtml(`Status trend ${trendText}`)}"><i class="fa ${trendIcon}" aria-hidden="true"></i><span>${escapeHtml(trendText)}</span></span>`;
                }
            }
        }
        const folderRules = (prefsByType[type]?.autoRules || []).filter((rule) => String(rule?.folderId || '') === String(id));
        const activeRuleCount = folderRules.reduce((count, rule) => (rule?.enabled === false ? count : count + 1), 0);
        const ruleText = folderRules.length === 0 ? '0' : (activeRuleCount === folderRules.length ? String(folderRules.length) : `${activeRuleCount}/${folderRules.length}`);
        const ruleTitle = folderRules.length === 0
            ? 'No rules for this folder'
            : `${activeRuleCount} active of ${folderRules.length} total rules`;

        const lastChangedRaw = String(folder.updatedAt || folder.createdAt || '').trim();
        const lastChangedText = lastChangedRaw ? formatTimestamp(lastChangedRaw) : 'Unknown';
        const pinnedText = pinned ? 'Pinned' : 'No';
        const pinnedClass = pinned ? 'is-pinned' : '';

        let typeSpecificColumns = '';
        if (isDockerType) {
            let updateCount = 0;
            const updateNames = [];
            for (const member of members) {
                if (isDockerUpdateAvailable(infoByName[member] || {})) {
                    updateCount += 1;
                    updateNames.push(String(member));
                }
            }
            if (dockerUpdatesOnlyFilter && updateCount === 0) {
                continue;
            }
            let updateText = 'Up to date';
            let updateClass = 'is-ok';
            let updateIcon = 'fa-check-circle';
            if (updateCount > 0 && updateCount <= 9) {
                updateText = `${updateCount} update${updateCount === 1 ? '' : 's'}`;
                updateClass = 'is-warning';
                updateIcon = 'fa-exclamation-circle';
            } else if (updateCount > 9) {
                updateText = `${updateCount} updates`;
                updateClass = 'is-danger';
                updateIcon = 'fa-exclamation-triangle';
            }
            const updatePreview = updateNames.slice(0, 5).join(', ');
            const updateExtra = updateNames.length > 5 ? ` (+${updateNames.length - 5} more)` : '';
            const updateTitle = updateNames.length
                ? `Containers with updates: ${updatePreview}${updateExtra}\nClick to ${dockerUpdatesOnlyFilter ? 'show all folders' : 'show folders with updates only'}`
                : `${members.length > 0 ? 'No updates in this folder' : 'Folder has no members'}\nClick to ${dockerUpdatesOnlyFilter ? 'show all folders' : 'show folders with updates only'}`;
            const healthStatus = evaluateDockerFolderHealth(
                folder,
                members.length,
                countsByState,
                updateCount,
                Number(dockerHealthPrefs?.warnStoppedPercent) || 60
            );
            if (healthSeverityFilterMode !== 'all' && healthStatus.severity !== healthSeverityFilterMode) {
                continue;
            }
            const healthFilterActive = healthSeverityFilterMode === healthStatus.severity;
            const healthToggleHint = healthFilterActive
                ? 'Click to show all folders.'
                : `Click to show ${healthStatus.text} folders only.`;
            const healthTitle = [...healthStatus.details, healthToggleHint].join('\n');
            typeSpecificColumns = ''
                + `<td class="updates-cell"><button type="button" class="folder-metric-chip updates-chip ${updateClass} ${dockerUpdatesOnlyFilter ? 'is-filter-active' : ''}" title="${escapeHtml(updateTitle)}" aria-label="${escapeHtml(updateTitle)}" onclick="toggleDockerUpdatesFilter(${updateCount > 0 ? 'true' : 'false'})"><i class="fa ${updateIcon}" aria-hidden="true"></i><span>${escapeHtml(updateText)}</span></button></td>`
                + `<td class="health-cell"><button type="button" class="folder-metric-chip health-chip ${healthStatus.className} ${healthFilterActive ? 'is-filter-active' : ''}" title="${escapeHtml(healthTitle)}" aria-label="${escapeHtml(healthTitle)}" onclick="toggleHealthSeverityFilter('${type}','${escapeHtml(healthStatus.severity)}')">${escapeHtml(healthStatus.text)}</button></td>`;
        } else {
            let autostartCount = 0;
            const autostartMembers = [];
            let vcpusTotal = 0;
            let memoryKiBTotal = 0;
            for (const member of members) {
                const vmInfo = infoByName[member] || {};
                if (valueIsTruthy(vmInfo.autostart)) {
                    autostartCount += 1;
                    autostartMembers.push(String(member));
                }
                vcpusTotal += Number(vmInfo.vcpus ?? vmInfo.nrVirtCpu ?? 0) || 0;
                memoryKiBTotal += Number(vmInfo.memoryKiB ?? vmInfo.memory ?? vmInfo.maxMem ?? 0) || 0;
            }
            const membersCount = members.length;
            const autostartRatio = `${autostartCount}/${membersCount}`;
            let autostartClass = 'is-empty';
            let autostartIcon = 'fa-circle-o';
            let autostartText = 'Empty';
            if (membersCount > 0 && autostartCount === membersCount) {
                autostartClass = 'is-ok';
                autostartIcon = 'fa-check-circle';
                autostartText = `All auto ${autostartRatio}`;
            } else if (membersCount > 0 && autostartCount > 0) {
                autostartClass = 'is-paused';
                autostartIcon = 'fa-adjust';
                autostartText = `Mixed ${autostartRatio}`;
            } else if (membersCount > 0) {
                autostartClass = 'is-warning';
                autostartIcon = 'fa-pause-circle';
                autostartText = `Manual ${autostartRatio}`;
            }
            const autostartMembersPreview = autostartMembers.slice(0, 5).join(', ');
            const autostartMembersExtra = autostartMembers.length > 5 ? ` (+${autostartMembers.length - 5} more)` : '';
            const autostartTitle = membersCount <= 0
                ? 'No VMs in this folder.'
                : [
                    `Autostart enabled: ${autostartCount}/${membersCount}`,
                    autostartMembers.length > 0
                        ? `Autostart VMs: ${autostartMembersPreview}${autostartMembersExtra}`
                        : 'Autostart VMs: none'
                ].join('\n');
            const memoryTotalText = formatGiBFromKiB(memoryKiBTotal);
            const avgVcpus = membersCount > 0 ? (vcpusTotal / membersCount) : 0;
            const avgMemoryKiB = membersCount > 0 ? Math.round(memoryKiBTotal / membersCount) : 0;
            const avgVcpusText = Number.isInteger(avgVcpus) ? String(avgVcpus) : avgVcpus.toFixed(1);
            const avgMemoryText = formatGiBFromKiB(avgMemoryKiB);
            const resourcesTitle = membersCount <= 0
                ? 'No VMs in this folder.'
                : [
                    `Total: ${vcpusTotal} vCPU | ${memoryTotalText}`,
                    `Average per VM: ${avgVcpusText} vCPU | ${avgMemoryText}`
                ].join('\n');
            typeSpecificColumns = ''
                + `<td class="autostart-cell"><span class="folder-metric-chip autostart-chip ${autostartClass}" title="${escapeHtml(autostartTitle)}"><i class="fa ${autostartIcon}" aria-hidden="true"></i><span>${escapeHtml(autostartText)}</span></span></td>`
                + `<td class="resources-cell"><span class="vm-resource-stack" title="${escapeHtml(resourcesTitle)}"><span class="folder-metric-chip vm-resource-chip is-cpu ${vcpusTotal > 0 ? '' : 'is-empty'}"><i class="fa fa-cogs" aria-hidden="true"></i><span class="vm-resource-label">CPU</span><span class="vm-resource-value">${escapeHtml(`${vcpusTotal} vCPU`)}</span></span><span class="folder-metric-chip vm-resource-chip is-ram ${memoryKiBTotal > 0 ? '' : 'is-empty'}"><i class="fa fa-hdd-o" aria-hidden="true"></i><span class="vm-resource-label">RAM</span><span class="vm-resource-value">${escapeHtml(memoryTotalText)}</span></span></span></td>`;
        }
        rows.push(
            `<tr data-folder-id="${escapeHtml(id)}" tabindex="0" onkeydown="handleFolderRowKeydown('${type}','${escapeHtml(id)}',event)">`
            + `<td><span class="row-order-actions"><button title="Move up" aria-label="Move ${safeName} up" onclick="moveFolderRow('${type}','${escapeHtml(id)}',-1)"><i class="fa fa-chevron-up"></i></button><button title="Move down" aria-label="Move ${safeName} down" onclick="moveFolderRow('${type}','${escapeHtml(id)}',1)"><i class="fa fa-chevron-down"></i></button></span></td>`
            + `<td class="name-cell" title="${escapeHtml(id)}"><span class="name-cell-content"><img src="${safeIcon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"><span class="name-cell-text">${safeName}</span></span></td>`
            + `<td class="members-cell">${members.length}</td>`
            + `<td class="status-cell"><span class="status-cell-content">${statusChipsHtml}${statusTrendHtml}</span></td>`
            + `<td class="rules-cell" title="${escapeHtml(ruleTitle)}">${escapeHtml(ruleText)}</td>`
            + `<td class="last-changed-cell" title="${escapeHtml(lastChangedRaw || '')}">${escapeHtml(lastChangedText)}</td>`
            + `<td class="pinned-cell"><span class="folder-pin-state ${pinnedClass}">${escapeHtml(pinnedText)}</span></td>`
            + typeSpecificColumns
            + `<td class="actions-cell"><button class="folder-action-btn folder-pin-btn ${pinned ? 'is-pinned' : ''}" title="${pinTitle}" aria-label="${pinTitle}" onclick="toggleFolderPin('${type}','${escapeHtml(id)}')"><i class="fa ${pinned ? 'fa-star' : 'fa-star-o'}"></i></button><button class="folder-action-btn" title="Export" aria-label="Export ${safeName}" onclick="${type === 'docker' ? 'downloadDocker' : 'downloadVm'}('${escapeHtml(id)}')"><i class="fa fa-download"></i></button><button class="folder-action-btn" title="Delete" aria-label="Delete ${safeName}" onclick="${type === 'docker' ? 'clearDocker' : 'clearVm'}('${escapeHtml(id)}')"><i class="fa fa-trash"></i></button><button class="folder-action-btn" title="Copy ID" aria-label="Copy ID for ${safeName}" onclick="copyFolderId('${type}','${escapeHtml(id)}')"><i class="fa fa-clipboard"></i></button></td>`
            + '</tr>'
        );
    }
    if (rows.length === 0) {
        const suffixes = [];
        if (healthFilterMode !== 'all') {
            suffixes.push(`${getHealthFilterLabel(healthFilterMode)} filter`);
        }
        if (isDockerType && dockerUpdatesOnlyFilter) {
            suffixes.push('updates only');
        }
        if (isDockerType && healthSeverityFilterMode !== 'all') {
            suffixes.push(getHealthSeverityFilterLabel(healthSeverityFilterMode));
        }
        if (statusFilterMode !== 'all') {
            suffixes.push(getStatusFilterLabel(statusFilterMode));
        }
        const filterSuffix = suffixes.length ? ` (${suffixes.join(', ')})` : '';
        const showClearFilters = Boolean(
            filter
            || healthFilterMode !== 'all'
            || statusFilterMode !== 'all'
            || (isDockerType && (dockerUpdatesOnlyFilter || healthSeverityFilterMode !== 'all'))
        );
        const clearButton = showClearFilters
            ? `<button type="button" class="folder-empty-clear-filter" onclick="clearFolderTableFilters('${type}')">Clear filters</button>`
            : '';
        return `<tr><td colspan="${TABLE_COLUMN_COUNT}" class="folder-empty-cell">No folders match current filters${filterSuffix}. ${clearButton}</td></tr>`;
    }
    return rows.join('');
};

const currentOrderedIdsFromTable = (type) => {
    const tbodyId = tableIdByType[type];
    return $(`tbody#${tbodyId} tr[data-folder-id]`).map((_, row) => $(row).attr('data-folder-id')).get();
};

const persistManualOrderFromDom = async (type) => {
    const order = currentOrderedIdsFromTable(type);
    const reorderResponse = await apiPostJson('/plugins/folderview.plus/server/reorder.php', {
        type,
        order: JSON.stringify(order)
    });

    if (!reorderResponse.ok) {
        throw new Error(reorderResponse.error || 'Failed to persist folder order.');
    }

    const nextPrefs = utils.normalizePrefs({
        ...prefsByType[type],
        sortMode: 'manual',
        manualOrder: order
    });

    try {
        prefsByType[type] = await postPrefs(type, nextPrefs);
    } catch (error) {
        prefsByType[type] = nextPrefs;
    }

    await refreshType(type);
};

const moveFolderRow = async (type, folderId, direction) => {
    let sortMode = prefsByType[type]?.sortMode || 'created';
    if (sortMode !== 'manual') {
        await changeSortMode(type, 'manual');
        sortMode = 'manual';
    }

    if (sortMode !== 'manual') {
        return;
    }

    const tbodyId = tableIdByType[type];
    const tbody = $(`tbody#${tbodyId}`);
    const row = tbody.find(`tr[data-folder-id="${folderId}"]`);
    if (!row.length) {
        return;
    }

    if (direction < 0) {
        const prev = row.prev('tr[data-folder-id]');
        if (prev.length) {
            prev.before(row);
        }
    } else if (direction > 0) {
        const next = row.next('tr[data-folder-id]');
        if (next.length) {
            next.after(row);
        }
    }

    try {
        await persistManualOrderFromDom(type);
    } catch (error) {
        showError('Order save failed', error);
    }
};

const handleFolderRowKeydown = (type, folderId, event) => {
    if (!event) {
        return;
    }
    if (!event.altKey) {
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        void moveFolderRow(type, folderId, -1);
        return;
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        void moveFolderRow(type, folderId, 1);
    }
};

const renderFolderSelectOptions = (type) => {
    const folders = getFolderMap(type);
    const entries = Object.entries(folders);
    const options = entries.map(([id, folder]) => `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`).join('');

    $(`#${type}-rule-folder`).html(options);
    $(`#${type}-bulk-folder`).html(options);
    $(`#${type}-template-source-folder`).html(options);
    $(`#${type}-runtime-folder`).html(options);
};

const renderBadgeToggles = (type) => {
    const badges = prefsByType[type]?.badges || {};
    $(`#${type}-badge-running`).prop('checked', badges.running !== false);
    $(`#${type}-badge-stopped`).prop('checked', badges.stopped === true);
    if (type === 'docker') {
        $('#docker-badge-updates').prop('checked', badges.updates !== false);
    }
};

const syncRuntimeDependentFields = (type) => {
    const liveEnabled = $(`#${type}-live-refresh-enabled`).is(':checked');
    const lazyEnabled = $(`#${type}-lazy-preview-enabled`).is(':checked');
    $(`#${type}-live-refresh-seconds-row`).toggleClass('is-hidden', !liveEnabled);
    $(`#${type}-lazy-preview-threshold-row`).toggleClass('is-hidden', !lazyEnabled);
};

const renderRuntimeControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    $(`#${type}-live-refresh-enabled`).prop('checked', prefs.liveRefreshEnabled === true);
    $(`#${type}-live-refresh-seconds`).val(String(prefs.liveRefreshSeconds || 20));
    $(`#${type}-performance-mode`).prop('checked', prefs.performanceMode === true);
    $(`#${type}-lazy-preview-enabled`).prop('checked', prefs.lazyPreviewEnabled === true);
    $(`#${type}-lazy-preview-threshold`).val(String(prefs.lazyPreviewThreshold || 30));
    syncRuntimeDependentFields(type);
};

const renderStatusControls = (type) => {
    const status = normalizeStatusPrefs(type);
    $(`#${type}-status-mode`).val(status.mode);
    $(`#${type}-status-trend-enabled`).prop('checked', status.trendEnabled === true);
    $(`#${type}-status-attention-accent`).prop('checked', status.attentionAccent === true);
    $(`#${type}-status-warn-threshold`).val(String(status.warnStoppedPercent));
};

const renderHealthControls = (type) => {
    const health = normalizeHealthPrefs(type);
    $(`#${type}-health-cards-enabled`).prop('checked', health.cardsEnabled === true);
    $(`#${type}-health-runtime-badge-enabled`).prop('checked', health.runtimeBadgeEnabled === true);
    $(`#${type}-health-compact`).prop('checked', health.compact === true);
    $(`#${type}-health-warn-threshold`).val(String(health.warnStoppedPercent));
    $(`#${type}-health-warn-threshold-row`).toggleClass('is-hidden', health.cardsEnabled !== true);
    if (health.cardsEnabled !== true) {
        healthFilterByType[type] = 'all';
    }
};

const renderVisibilityControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    $(`#${type}-hide-empty-folders`).prop('checked', prefs.hideEmptyFolders === true);
};

const renderBackupScheduleControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    const schedule = prefs.backupSchedule || {};
    $(`#${type}-backup-schedule-enabled`).prop('checked', schedule.enabled === true);
    $(`#${type}-backup-interval-hours`).val(String(schedule.intervalHours || 24));
    $(`#${type}-backup-retention`).val(String(schedule.retention || 25));
    const lastRunText = schedule.lastRunAt ? `Last scheduled run: ${formatTimestamp(schedule.lastRunAt)}` : 'Last scheduled run: never';
    $(`#${type}-backup-last-run`).text(lastRunText);
};

const renderFilterInputs = (type) => {
    const filterState = filtersByType[type] || {};
    $(`#${type}-folder-filter`).val(filterState.folders || '');
    $(`#${type}-rules-filter`).val(filterState.rules || '');
    $(`#${type}-backups-filter`).val(filterState.backups || '');
    $(`#${type}-templates-filter`).val(filterState.templates || '');
};

const buildHealthCardHtml = (type, metrics, healthPrefs) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const title = resolvedType === 'docker' ? 'Docker' : 'VMs';
    const severityClass = metrics.severity === 'danger'
        ? 'is-danger'
        : (metrics.severity === 'warning' ? 'is-warning' : '');
    const statusText = metrics.severity === 'danger'
        ? 'Needs attention'
        : (metrics.severity === 'warning' ? 'Watch list' : 'Healthy');
    const statusClass = metrics.severity === 'danger'
        ? 'is-danger'
        : (metrics.severity === 'warning' ? 'is-warning' : '');
    const compactClass = healthPrefs.compact ? 'is-compact' : '';
    const activeFilter = normalizeHealthFilterMode(healthFilterByType[resolvedType]);
    const filterButton = (mode, label) => {
        const active = activeFilter === mode ? 'is-active' : '';
        return `<button type="button" class="folder-health-filter ${active}" data-fv-health-filter="${escapeHtml(mode)}" data-fv-health-type="${escapeHtml(resolvedType)}">${escapeHtml(label)}</button>`;
    };

    return `
        <section class="folder-health-card ${severityClass} ${compactClass}">
            <div class="folder-health-header">
                <h4>${escapeHtml(title)}</h4>
                <span class="folder-health-state ${statusClass}">${escapeHtml(statusText)}</span>
            </div>
            <div class="folder-health-metrics">
                <span class="folder-health-metric"><span>Folders</span><strong>${metrics.folderCount}</strong></span>
                <span class="folder-health-metric"><span>Pinned</span><strong>${metrics.pinnedCount}</strong></span>
                <span class="folder-health-metric"><span>Empty</span><strong>${metrics.folderStatusTotals.empty}</strong></span>
                <span class="folder-health-metric"><span>Stopped folders</span><strong>${metrics.folderStatusTotals.stopped}</strong></span>
                <span class="folder-health-metric"><span>Conflicts</span><strong>${metrics.conflictItemCount}</strong></span>
                <span class="folder-health-metric"><span>Invalid regex</span><strong>${metrics.invalidFolderRegexCount + metrics.invalidRuleRegexCount}</strong></span>
                <span class="folder-health-metric"><span>Stopped members</span><strong>${metrics.memberTotals.stopped}/${metrics.memberTotals.total}</strong></span>
                <span class="folder-health-metric"><span>Stopped %</span><strong>${metrics.stoppedPercent}%</strong></span>
            </div>
            <div class="folder-health-filters">
                ${filterButton('all', 'All')}
                ${filterButton('attention', 'Attention')}
                ${filterButton('empty', 'Empty')}
                ${filterButton('stopped', 'Stopped')}
                ${filterButton('conflict', 'Conflict')}
            </div>
            <div class="folder-health-actions">
                <button type="button" data-fv-health-action="jump-table" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-table"></i> Open ${escapeHtml(title)} table</button>
                <button type="button" data-fv-health-action="scan-conflicts" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-search"></i> Scan conflicts</button>
                <button type="button" data-fv-health-action="run-diagnostics" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-stethoscope"></i> Run diagnostics</button>
            </div>
        </section>
    `;
};

const renderFolderHealthCards = () => {
    const container = $('#folder-health-content');
    if (!container.length) {
        return;
    }
    const cards = [];
    for (const type of ['docker', 'vm']) {
        const healthPrefs = normalizeHealthPrefs(type);
        if (healthPrefs.cardsEnabled !== true) {
            continue;
        }
        const metrics = healthMetricsByType[type] || buildTypeHealthMetrics(type, getFolderMap(type), getEffectiveMemberSnapshot(type, getFolderMap(type)));
        cards.push(buildHealthCardHtml(type, metrics, healthPrefs));
    }
    if (!cards.length) {
        container.html('<div class="folder-health-empty">Health cards are disabled. Enable them in Docker or VM settings cards.</div>');
        return;
    }
    container.html(cards.join(''));
};

const ruleDescription = (rule) => {
    const effect = rule.effect === 'exclude' ? 'Exclude' : 'Include';
    if (rule.kind === 'label') {
        return `${effect} | Label equals: ${rule.labelKey || '(missing key)'}${rule.labelValue ? ` = ${rule.labelValue}` : ' (any value)'}`;
    }
    if (rule.kind === 'label_contains') {
        return `${effect} | Label contains: ${rule.labelKey || '(missing key)'} contains "${rule.labelValue || ''}"`;
    }
    if (rule.kind === 'label_starts_with') {
        return `${effect} | Label starts with: ${rule.labelKey || '(missing key)'} starts "${rule.labelValue || ''}"`;
    }
    if (rule.kind === 'image_regex') {
        return `${effect} | Image regex: ${rule.pattern || '(empty)'}`;
    }
    if (rule.kind === 'compose_project_regex') {
        return `${effect} | Compose project regex: ${rule.pattern || '(empty)'}`;
    }
    return `${effect} | Name regex: ${rule.pattern || '(empty)'}`;
};

const renderRulesTable = (type) => {
    const rulesBody = $(`#${type}-rules`);
    const rules = prefsByType[type]?.autoRules || [];
    const selected = selectedRuleIdsByType[type] || new Set();
    const validSelected = new Set(Array.from(selected).filter((id) => rules.some((rule) => String(rule.id) === id)));
    selectedRuleIdsByType[type] = validSelected;
    const filter = normalizedFilter(filtersByType[type]?.rules);

    const filteredRules = rules.filter((rule) => {
        const folderName = folderNameForId(type, rule.folderId);
        const haystack = `${folderName} ${ruleDescription(rule)} ${rule.id || ''}`.toLowerCase();
        return !filter || haystack.includes(filter);
    });

    if (!filteredRules.length) {
        rulesBody.html('<tr><td colspan="5">No rules defined.</td></tr>');
        $(`#${type}-rules-select-all`).prop('checked', false);
        return;
    }

    const rows = filteredRules.map((rule, index) => {
        const folderName = folderNameForId(type, rule.folderId);
        const stateLabel = rule.enabled ? 'Disable' : 'Enable';
        const stateIcon = rule.enabled ? 'fa-eye-slash' : 'fa-eye';
        const globalIndex = rules.findIndex((item) => item.id === rule.id);
        const upDisabled = globalIndex === 0 ? 'disabled' : '';
        const downDisabled = globalIndex === rules.length - 1 ? 'disabled' : '';
        const checked = validSelected.has(String(rule.id || '')) ? 'checked' : '';

        return `<tr>
            <td>
                <input type="checkbox" ${checked} onchange="toggleRuleSelection('${type}','${escapeHtml(rule.id)}', this.checked)">
            </td>
            <td>
                <span>#${globalIndex + 1}</span>
                <span class="rule-priority-actions">
                    <button ${upDisabled} title="Move up" onclick="moveAutoRule('${type}','${escapeHtml(rule.id)}',-1)"><i class="fa fa-chevron-up"></i></button>
                    <button ${downDisabled} title="Move down" onclick="moveAutoRule('${type}','${escapeHtml(rule.id)}',1)"><i class="fa fa-chevron-down"></i></button>
                </span>
            </td>
            <td>${escapeHtml(folderName)}</td>
            <td>${escapeHtml(ruleDescription(rule))}</td>
            <td>
                <button onclick="toggleAutoRule('${type}','${escapeHtml(rule.id)}')"><i class="fa ${stateIcon}"></i> ${stateLabel}</button>
                <button onclick="deleteAutoRule('${type}','${escapeHtml(rule.id)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });

    rulesBody.html(rows.join(''));
    const allSelected = filteredRules.every((rule) => validSelected.has(String(rule.id || '')));
    $(`#${type}-rules-select-all`).prop('checked', allSelected);
};

const renderBulkItemOptions = (type) => {
    const infoByName = infoByType[type] || {};
    const names = Object.keys(infoByName).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    const options = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    $(`#${type}-bulk-items`).html(options);
};

const renderBackupRows = (type) => {
    const rowsEl = $(`#${type}-backups`);
    const filter = normalizedFilter(filtersByType[type]?.backups);
    const backups = (backupsByType[type] || []).filter((backup) => {
        if (!filter) {
            return true;
        }
        const haystack = `${String(backup.name || '')} ${String(backup.reason || '')}`.toLowerCase();
        return haystack.includes(filter);
    });
    if (!backups.length) {
        rowsEl.html('<tr><td colspan="4">No backups found.</td></tr>');
        renderBackupCompareControls(type);
        return;
    }

    const rows = backups.map((backup) => {
        const name = String(backup.name || '');
        const count = Number.isFinite(Number(backup.count)) ? Number(backup.count) : '-';
        const reason = backup.reason ? escapeHtml(backup.reason) : '-';
        return `<tr>
            <td>${escapeHtml(formatTimestamp(backup.createdAt))}</td>
            <td>${reason}</td>
            <td>${count}</td>
            <td>
                <button onclick="restoreBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-history"></i> Restore</button>
                <button onclick="downloadBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-download"></i> Download</button>
                <button onclick="deleteBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });

    rowsEl.html(rows.join(''));
    renderBackupCompareControls(type);
};

const getBackupCompareOptionLabel = (backup) => {
    const created = formatTimestamp(backup?.createdAt || '');
    const reason = String(backup?.reason || '').trim();
    const base = String(backup?.name || '');
    if (!reason) {
        return `${created} | ${base}`;
    }
    return `${created} | ${reason} | ${base}`;
};

const renderBackupCompareControls = (type) => {
    const resolvedType = normalizeManagedType(type);
    const leftSelect = $(`#${resolvedType}-backup-compare-left`);
    const rightSelect = $(`#${resolvedType}-backup-compare-right`);
    const includePrefsCheckbox = $(`#${resolvedType}-backup-compare-include-prefs`);
    if (!leftSelect.length || !rightSelect.length || !includePrefsCheckbox.length) {
        return;
    }

    const backups = Array.isArray(backupsByType[resolvedType]) ? backupsByType[resolvedType] : [];
    if (!backups.length) {
        leftSelect.html('<option value="">No backups available</option>').prop('disabled', true);
        rightSelect.html('<option value="__current__">Current live folders</option>').prop('disabled', true);
        includePrefsCheckbox.prop('checked', true).prop('disabled', true);
        backupCompareSelectionByType[resolvedType] = {
            left: '',
            right: '__current__',
            includePrefs: true
        };
        return;
    }

    leftSelect.prop('disabled', false);
    rightSelect.prop('disabled', false);
    includePrefsCheckbox.prop('disabled', false);
    const previous = backupCompareSelectionByType[resolvedType] || { left: '', right: '__current__', includePrefs: true };
    const availableNames = new Set(backups.map((backup) => String(backup?.name || '')));

    const leftOptions = backups.map((backup) => (
        `<option value="${escapeHtml(String(backup?.name || ''))}">${escapeHtml(getBackupCompareOptionLabel(backup))}</option>`
    )).join('');
    const rightOptions = [
        '<option value="__current__">Current live folders</option>',
        ...backups.map((backup) => (
            `<option value="${escapeHtml(String(backup?.name || ''))}">${escapeHtml(getBackupCompareOptionLabel(backup))}</option>`
        ))
    ].join('');

    leftSelect.html(leftOptions);
    rightSelect.html(rightOptions);

    const defaultLeft = availableNames.has(previous.left) ? previous.left : String(backups[0]?.name || '');
    let defaultRight = previous.right;
    if (defaultRight !== '__current__' && !availableNames.has(defaultRight)) {
        defaultRight = '__current__';
    }
    if (!defaultRight) {
        defaultRight = '__current__';
    }
    if (defaultRight === defaultLeft) {
        defaultRight = '__current__';
    }

    leftSelect.val(defaultLeft);
    rightSelect.val(defaultRight);
    includePrefsCheckbox.prop('checked', previous.includePrefs !== false);

    backupCompareSelectionByType[resolvedType] = {
        left: String(leftSelect.val() || ''),
        right: String(rightSelect.val() || '__current__'),
        includePrefs: includePrefsCheckbox.prop('checked') === true
    };

    leftSelect.off('change.fvcompare').on('change.fvcompare', () => {
        backupCompareSelectionByType[resolvedType].left = String(leftSelect.val() || '');
        if (String(rightSelect.val() || '') === backupCompareSelectionByType[resolvedType].left) {
            rightSelect.val('__current__');
            backupCompareSelectionByType[resolvedType].right = '__current__';
        }
    });
    rightSelect.off('change.fvcompare').on('change.fvcompare', () => {
        backupCompareSelectionByType[resolvedType].right = String(rightSelect.val() || '__current__');
        if (backupCompareSelectionByType[resolvedType].right === backupCompareSelectionByType[resolvedType].left) {
            backupCompareSelectionByType[resolvedType].right = '__current__';
            rightSelect.val('__current__');
        }
    });
    includePrefsCheckbox.off('change.fvcompare').on('change.fvcompare', () => {
        backupCompareSelectionByType[resolvedType].includePrefs = includePrefsCheckbox.prop('checked') === true;
    });
};

const buildBackupSnapshotDiff = (leftFolders, rightFolders) => {
    const left = utils.normalizeFolderMap(leftFolders);
    const right = utils.normalizeFolderMap(rightFolders);
    const ids = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort((a, b) => a.localeCompare(b));
    const rows = [];
    const counts = {
        create: 0,
        update: 0,
        delete: 0,
        unchanged: 0
    };

    for (const id of ids) {
        const before = left[id];
        const after = right[id];
        if (!before && after) {
            counts.create += 1;
            rows.push({
                action: 'create',
                id,
                beforeName: '-',
                afterName: String(after.name || id),
                fields: ['folder']
            });
            continue;
        }
        if (before && !after) {
            counts.delete += 1;
            rows.push({
                action: 'delete',
                id,
                beforeName: String(before.name || id),
                afterName: '-',
                fields: ['folder']
            });
            continue;
        }
        const fields = utils.diffFolderFields(before, after);
        if (fields.length === 0) {
            counts.unchanged += 1;
            continue;
        }
        counts.update += 1;
        rows.push({
            action: 'update',
            id,
            beforeName: String(before?.name || id),
            afterName: String(after?.name || id),
            fields
        });
    }

    return {
        rows,
        counts,
        totalCompared: ids.length,
        leftCount: Object.keys(left).length,
        rightCount: Object.keys(right).length
    };
};

const getObjectValueByPath = (source, path) => {
    const segments = String(path || '').split('.').filter((segment) => segment !== '');
    let cursor = source;
    for (const segment of segments) {
        if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
            return undefined;
        }
        cursor = cursor[segment];
    }
    return cursor;
};

const serializePrefsDiffValue = (value) => {
    if (value === undefined) {
        return '(unset)';
    }
    if (Array.isArray(value)) {
        const preview = value.slice(0, 5).map((item) => String(item));
        const suffix = value.length > 5 ? ` (+${value.length - 5} more)` : '';
        return `${value.length} item(s): ${preview.join(', ')}${suffix}`;
    }
    if (value && typeof value === 'object') {
        const json = JSON.stringify(value);
        if (json.length <= 220) {
            return json;
        }
        return `${json.slice(0, 217)}...`;
    }
    return String(value);
};

const buildBackupPrefsDiff = (leftPrefs, rightPrefs) => {
    const left = utils.normalizePrefs(leftPrefs || {});
    const right = utils.normalizePrefs(rightPrefs || {});
    const descriptors = [
        { key: 'sortMode', label: 'Sort mode' },
        { key: 'manualOrder', label: 'Manual order' },
        { key: 'pinnedFolderIds', label: 'Pinned folders' },
        { key: 'hideEmptyFolders', label: 'Hide empty folders' },
        { key: 'badges', label: 'Badge visibility' },
        { key: 'liveRefreshEnabled', label: 'Live refresh enabled' },
        { key: 'liveRefreshSeconds', label: 'Live refresh interval' },
        { key: 'performanceMode', label: 'Performance mode' },
        { key: 'lazyPreviewEnabled', label: 'Lazy previews' },
        { key: 'lazyPreviewThreshold', label: 'Lazy preview threshold' },
        { key: 'health', label: 'Health card settings' },
        { key: 'status', label: 'Status column settings' },
        { key: 'backupSchedule', label: 'Backup schedule' },
        { key: 'importPresets', label: 'Import preset settings' }
    ];
    const rows = [];
    for (const descriptor of descriptors) {
        const before = getObjectValueByPath(left, descriptor.key);
        const after = getObjectValueByPath(right, descriptor.key);
        if (JSON.stringify(before) === JSON.stringify(after)) {
            continue;
        }
        rows.push({
            key: descriptor.key,
            label: descriptor.label,
            before,
            after
        });
    }
    return {
        rows,
        comparedCount: descriptors.length
    };
};

const renderBackupCompareDiffTable = (rows, options = {}) => {
    const container = $('#backup-compare-diff');
    if (Array.isArray(rows)) {
        backupCompareDiffPagingState.rows = rows;
    }
    if (options?.resetPage === true) {
        backupCompareDiffPagingState.page = 1;
    }
    const effectiveRows = Array.isArray(backupCompareDiffPagingState.rows) ? backupCompareDiffPagingState.rows : [];
    if (!effectiveRows.length) {
        container.html('<div class="hint-line">No differences found between the selected snapshots.</div>');
        return;
    }
    const totalPages = Math.max(1, Math.ceil(effectiveRows.length / backupCompareDiffPagingState.pageSize));
    backupCompareDiffPagingState.page = Math.max(1, Math.min(totalPages, Number(backupCompareDiffPagingState.page) || 1));
    const start = (backupCompareDiffPagingState.page - 1) * backupCompareDiffPagingState.pageSize;
    const pageRows = effectiveRows.slice(start, start + backupCompareDiffPagingState.pageSize);
    const body = pageRows.map((row) => (
        `<tr>
            <td>${escapeHtml(String(row.action || '').toUpperCase())}</td>
            <td>${escapeHtml(String(row.id || '-'))}</td>
            <td>${escapeHtml(String(row.beforeName || '-'))}</td>
            <td>${escapeHtml(String(row.afterName || '-'))}</td>
            <td>${escapeHtml(Array.isArray(row.fields) ? row.fields.join(', ') : '-')}</td>
        </tr>`
    )).join('');
    container.html(`
        <table>
            <thead>
                <tr>
                    <th>Action</th>
                    <th>ID</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Changed fields</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
        <div class="fv-table-pager">
            <button type="button" class="fv-backup-diff-prev" ${backupCompareDiffPagingState.page <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="fv-table-pager-info">Page ${backupCompareDiffPagingState.page} / ${totalPages}</span>
            <button type="button" class="fv-backup-diff-next" ${backupCompareDiffPagingState.page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `);
    container.find('.fv-backup-diff-prev').off('click.fvbackupdiff').on('click.fvbackupdiff', () => {
        if (backupCompareDiffPagingState.page > 1) {
            backupCompareDiffPagingState.page -= 1;
            renderBackupCompareDiffTable(null);
        }
    });
    container.find('.fv-backup-diff-next').off('click.fvbackupdiff').on('click.fvbackupdiff', () => {
        if (backupCompareDiffPagingState.page < totalPages) {
            backupCompareDiffPagingState.page += 1;
            renderBackupCompareDiffTable(null);
        }
    });
};

const renderBackupComparePrefsDiff = ({ includePrefs, prefsDiff, prefsAvailable }) => {
    const container = $('#backup-compare-prefs');
    if (!container.length) {
        return;
    }
    if (!includePrefs) {
        container.html('<div class="backup-compare-prefs-empty">Preference comparison is disabled for this run.</div>');
        return;
    }
    if (!prefsAvailable) {
        container.html('<div class="backup-compare-prefs-empty">Preference data is unavailable in one of the selected snapshots.</div>');
        return;
    }
    if (!prefsDiff || !Array.isArray(prefsDiff.rows) || prefsDiff.rows.length === 0) {
        container.html('<div class="backup-compare-prefs-empty">No preference differences detected.</div>');
        return;
    }
    const body = prefsDiff.rows.map((row) => (
        `<tr>
            <td>${escapeHtml(String(row.label || row.key || '-'))}</td>
            <td>${escapeHtml(serializePrefsDiffValue(row.before))}</td>
            <td>${escapeHtml(serializePrefsDiffValue(row.after))}</td>
        </tr>`
    )).join('');
    container.html(`
        <p class="backup-compare-prefs-title">Preference changes (${prefsDiff.rows.length})</p>
        <table>
            <thead>
                <tr>
                    <th>Field</th>
                    <th>Before</th>
                    <th>After</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `);
};

const renderBackupCompareDialog = ({ type, leftSnapshot, rightSnapshot, diff, includePrefs, prefsDiff, prefsAvailable }) => {
    const dialog = $('#backup-compare-dialog');
    const meta = $('#backup-compare-meta');
    const counts = $('#backup-compare-counts');
    if (!dialog.length || !meta.length || !counts.length) {
        return;
    }

    const metaItems = [
        { label: 'Type', value: type === 'vm' ? 'vm' : 'docker' },
        { label: 'From', value: leftSnapshot.label },
        { label: 'To', value: rightSnapshot.label },
        { label: 'From folders', value: diff.leftCount },
        { label: 'To folders', value: diff.rightCount }
    ];
    meta.html(metaItems.map((item) => (
        `<span class="preview-meta-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(String(item.value))}</span>`
    )).join(''));

    counts.html(`
        <span class="import-count-chip is-create">Create: ${diff.counts.create}</span>
        <span class="import-count-chip is-update">Update: ${diff.counts.update}</span>
        <span class="import-count-chip is-delete">Delete: ${diff.counts.delete}</span>
        <span class="import-count-chip is-selected">Unchanged: ${diff.counts.unchanged}</span>
        <span class="import-count-chip is-dryrun">Prefs changed: ${includePrefs && prefsAvailable ? (prefsDiff?.rows?.length || 0) : 'n/a'}</span>
    `);

    renderBackupCompareDiffTable(diff.rows, { resetPage: true });
    renderBackupComparePrefsDiff({ includePrefs, prefsDiff, prefsAvailable });

    const modalWidth = Math.min(980, Math.max(760, Math.floor(window.innerWidth * 0.92)));
    dialog.dialog({
        title: `Compare ${type === 'docker' ? 'Docker' : 'VM'} snapshots`,
        resizable: false,
        width: modalWidth,
        modal: true,
        dialogClass: 'fv-backup-compare-modal',
        buttons: {
            Close: function() {
                $(this).dialog('close');
            }
        }
    });
};

const resolveBackupCompareSnapshot = async (type, target) => {
    const resolvedType = normalizeManagedType(type);
    const targetId = String(target || '').trim();
    if (!targetId || targetId === '__current__') {
        const folders = getFolderMap(resolvedType);
        const prefs = utils.normalizePrefs(prefsByType[resolvedType]);
        return {
            targetId: '__current__',
            label: 'Current live folders',
            folders,
            prefs
        };
    }
    const snapshot = await fetchBackupSnapshot(resolvedType, targetId);
    const labelReason = String(snapshot.reason || '').trim();
    const labelPrefix = formatTimestamp(snapshot.createdAt || '');
    const label = labelReason
        ? `${labelPrefix} | ${labelReason}`
        : `${labelPrefix} | ${targetId}`;
    return {
        targetId,
        label,
        folders: utils.normalizeFolderMap(snapshot.folders || {}),
        prefs: snapshot && typeof snapshot === 'object' && snapshot.prefs && typeof snapshot.prefs === 'object'
            ? snapshot.prefs
            : null
    };
};

const compareBackupSnapshots = async (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Compare failed', error);
        return;
    }

    const leftTarget = String($(`#${resolvedType}-backup-compare-left`).val() || '').trim();
    const rightTarget = String($(`#${resolvedType}-backup-compare-right`).val() || '__current__').trim() || '__current__';
    const includePrefs = $(`#${resolvedType}-backup-compare-include-prefs`).prop('checked') === true;
    if (!leftTarget) {
        swal({
            title: 'Compare unavailable',
            text: 'Create at least one backup snapshot first.',
            type: 'warning'
        });
        return;
    }
    if (leftTarget === rightTarget) {
        swal({
            title: 'Choose different snapshots',
            text: 'Select two different targets to compare.',
            type: 'warning'
        });
        return;
    }

    try {
        const [leftSnapshot, rightSnapshot] = await Promise.all([
            resolveBackupCompareSnapshot(resolvedType, leftTarget),
            resolveBackupCompareSnapshot(resolvedType, rightTarget)
        ]);
        const diff = buildBackupSnapshotDiff(leftSnapshot.folders, rightSnapshot.folders);
        const prefsAvailable = leftSnapshot.prefs !== null && rightSnapshot.prefs !== null;
        const prefsDiff = includePrefs && prefsAvailable
            ? buildBackupPrefsDiff(leftSnapshot.prefs, rightSnapshot.prefs)
            : { rows: [], comparedCount: 0 };
        renderBackupCompareDialog({
            type: resolvedType,
            leftSnapshot,
            rightSnapshot,
            diff,
            includePrefs,
            prefsDiff,
            prefsAvailable
        });
    } catch (error) {
        showError('Compare failed', error);
    }
};

const renderTemplateRows = (type) => {
    const rowsEl = $(`#${type}-templates`);
    const allTemplates = templatesByType[type] || [];
    const selected = selectedTemplateIdsByType[type] || new Set();
    const validSelected = new Set(Array.from(selected).filter((id) => allTemplates.some((template) => String(template.id || '') === id)));
    selectedTemplateIdsByType[type] = validSelected;
    const filter = normalizedFilter(filtersByType[type]?.templates);
    const templates = allTemplates.filter((template) => {
        if (!filter) {
            return true;
        }
        const haystack = `${String(template.name || '')} ${String(template.id || '')}`.toLowerCase();
        return haystack.includes(filter);
    });
    const folders = getFolderMap(type);
    const folderOptions = Object.entries(folders).map(([id, folder]) => (
        `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`
    )).join('');

    if (!templates.length) {
        rowsEl.html('<tr><td colspan="4">No templates saved.</td></tr>');
        $(`#${type}-templates-select-all`).prop('checked', false);
        return;
    }

    const rows = templates.map((template) => {
        const templateId = String(template.id || '');
        const templateName = String(template.name || templateId);
        const selectId = `${type}-template-target-${templateId}`;
        const checked = validSelected.has(templateId) ? 'checked' : '';
        return `<tr>
            <td><input type="checkbox" ${checked} onchange="toggleTemplateSelection('${type}','${escapeHtml(templateId)}', this.checked)"></td>
            <td>${escapeHtml(templateName)}</td>
            <td>${escapeHtml(formatTimestamp(template.updatedAt || template.createdAt))}</td>
            <td>
                <select id="${escapeHtml(selectId)}">${folderOptions}</select>
                <button onclick="applyTemplateToFolder('${type}','${escapeHtml(templateId)}','${escapeHtml(selectId)}')"><i class="fa fa-clone"></i> Apply</button>
                <button onclick="deleteTemplateEntry('${type}','${escapeHtml(templateId)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });
    rowsEl.html(rows.join(''));
    const allSelected = templates.every((template) => validSelected.has(String(template.id || '')));
    $(`#${type}-templates-select-all`).prop('checked', allSelected);
};

const renderTable = (type) => {
    const folders = getFolderMap(type);
    const ordered = utils.orderFoldersByPrefs(folders, prefsByType[type]);
    const memberSnapshot = getEffectiveMemberSnapshot(type, ordered);
    const previousStatusSnapshot = statusSnapshotByType[type] && typeof statusSnapshotByType[type] === 'object'
        ? statusSnapshotByType[type]
        : {};
    const nextStatusSnapshot = buildStatusSnapshot(type, ordered, memberSnapshot, infoByType[type] || {});
    const healthMetrics = buildTypeHealthMetrics(type, ordered, memberSnapshot, prefsByType[type]);
    healthMetricsByType[type] = healthMetrics;
    const hideEmptyFolders = utils.normalizePrefs(prefsByType[type]).hideEmptyFolders === true;

    const sortMode = prefsByType[type]?.sortMode || 'created';
    $(`#${type}-sort-mode`).val(sortMode);
    const tbodyId = tableIdByType[type];
    $(`tbody#${tbodyId}`).html(buildRowsHtml(type, ordered, memberSnapshot, hideEmptyFolders, healthMetrics, {
        previous: previousStatusSnapshot,
        current: nextStatusSnapshot
    }));
    statusSnapshotByType[type] = nextStatusSnapshot;

    renderFolderSelectOptions(type);
    renderBadgeToggles(type);
    renderRuntimeControls(type);
    renderStatusControls(type);
    renderHealthControls(type);
    renderVisibilityControls(type);
    renderBackupScheduleControls(type);
    renderFilterInputs(type);
    renderRulesTable(type);
    renderBulkItemOptions(type);
    renderTemplateRows(type);
    renderFolderHealthCards();
    updateRuleLiveMatch(type);
    refreshSettingsUx();
    enforceNoHorizontalOverflow();
};

const perfNowMs = () => ((window.performance && typeof window.performance.now === 'function')
    ? window.performance.now()
    : Date.now());

const recordPerformanceDiagnosticsSample = (bucket, type, durationMs, details = {}) => {
    const resolvedType = normalizeManagedType(type);
    if (!performanceDiagnosticsState[bucket] || !Array.isArray(performanceDiagnosticsState[bucket][resolvedType])) {
        return;
    }
    const duration = Number(durationMs);
    if (!Number.isFinite(duration) || duration < 0) {
        return;
    }
    const target = performanceDiagnosticsState[bucket][resolvedType];
    target.push({
        at: Date.now(),
        durationMs: Number(duration.toFixed(2)),
        details: details && typeof details === 'object' ? details : {}
    });
    if (target.length > PERF_DIAGNOSTICS_SAMPLE_LIMIT) {
        target.splice(0, target.length - PERF_DIAGNOSTICS_SAMPLE_LIMIT);
    }
    performanceDiagnosticsState.updatedAt = Date.now();
    renderPerformanceDiagnostics();
};

const summarizePerformanceDiagnosticsSamples = (samples) => {
    const list = Array.isArray(samples) ? samples : [];
    if (!list.length) {
        return null;
    }
    const durations = list
        .map((row) => Number(row?.durationMs))
        .filter((value) => Number.isFinite(value) && value >= 0);
    if (!durations.length) {
        return null;
    }
    const total = durations.reduce((sum, value) => sum + value, 0);
    return {
        count: durations.length,
        lastMs: Number(durations[durations.length - 1].toFixed(2)),
        avgMs: Number((total / durations.length).toFixed(2)),
        maxMs: Number(Math.max(...durations).toFixed(2))
    };
};

const renderPerformanceDiagnostics = () => {
    const host = $('#performance-diagnostics-output');
    if (!host.length) {
        return;
    }
    const renderRow = (label, summary) => {
        if (!summary) {
            return `<tr><th>${escapeHtml(label)}</th><td colspan="4">No samples yet</td></tr>`;
        }
        return `<tr><th>${escapeHtml(label)}</th><td>${summary.count}</td><td>${summary.lastMs}ms</td><td>${summary.avgMs}ms</td><td>${summary.maxMs}ms</td></tr>`;
    };
    const rows = [
        renderRow('Docker refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.docker)),
        renderRow('VM refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.vm)),
        renderRow('Docker import', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.docker)),
        renderRow('VM import', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.vm))
    ].join('');
    const updatedAt = performanceDiagnosticsState.updatedAt > 0
        ? new Date(performanceDiagnosticsState.updatedAt).toLocaleString()
        : 'Not yet sampled';
    host.html(`
        <div class="fv-perf-summary-note">Recent UI operation timings from this browser session.</div>
        <table class="fv-perf-table">
            <thead>
                <tr><th>Operation</th><th>Samples</th><th>Last</th><th>Avg</th><th>Max</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="fv-perf-summary-note">Updated: ${escapeHtml(updatedAt)}</div>
    `);
};

const refreshType = async (type) => {
    const startedAt = perfNowMs();
    const [folders, prefs, info] = await Promise.all([
        fetchFolders(type),
        fetchPrefs(type),
        fetchTypeInfo(type).catch(() => ({}))
    ]);

    prefsByType[type] = utils.normalizePrefs(prefs || {});
    infoByType[type] = info && typeof info === 'object' ? info : {};
    setTypeFolders(type, folders);
    renderTable(type);
    recordPerformanceDiagnosticsSample('refresh', type, perfNowMs() - startedAt, {
        folderCount: Object.keys(folders || {}).length,
        infoCount: Object.keys(info || {}).length
    });
};

const refreshBackups = async (type) => {
    try {
        backupsByType[type] = await fetchBackups(type);
    } catch (error) {
        backupsByType[type] = [];
        showError(`Failed to load ${type.toUpperCase()} backups`, error);
    }
    renderBackupRows(type);
    renderBackupScheduleControls(type);
    refreshSettingsUx();
};

const refreshTemplates = async (type) => {
    try {
        templatesByType[type] = await fetchTemplates(type);
    } catch (error) {
        templatesByType[type] = [];
        showError(`Failed to load ${type.toUpperCase()} templates`, error);
    }
    renderTemplateRows(type);
    refreshSettingsUx();
};

const refreshAll = async () => {
    await Promise.all([refreshType('docker'), refreshType('vm')]);
    await Promise.all([refreshBackups('docker'), refreshBackups('vm')]);
    await Promise.all([refreshTemplates('docker'), refreshTemplates('vm')]);
    ensureRegexPresetUi('docker');
    ensureRegexPresetUi('vm');
    toggleRuleKindFields('docker');
    updateRuleLiveMatch('docker');
    updateRuleLiveMatch('vm');
    await refreshChangeHistory();
    renderFolderHealthCards();
    refreshSettingsUx();
};

const downloadType = async (type, id) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Export failed', error);
        return;
    }

    const folders = getFolderMap(resolvedType);
    const progressTotal = 2;
    let progressOpen = false;
    const setProgress = (completed, label) => {
        updateImportApplyProgressDialog({
            completed: Math.max(0, Math.min(progressTotal, completed)),
            total: progressTotal,
            label
        });
    };

    try {
        openImportApplyProgressDialog(resolvedType, progressTotal);
        progressOpen = true;
        setProgress(0, `Preparing ${resolvedType === 'docker' ? 'Docker' : 'VM'} export...`);

        if (id) {
            const folder = folders[id];
            if (!folder) {
                throw new Error('Folder not found for export.');
            }
            const payload = utils.buildSingleExportPayload({
                type: resolvedType,
                folderId: id,
                folder,
                pluginVersion
            });
            downloadFile(`${folder.name}.json`, toPrettyJson(payload));
            setProgress(progressTotal, 'Export download started.');
            await trackDiagnosticsEvent({
                eventType: 'export',
                type: resolvedType,
                details: {
                    mode: 'single',
                    folderCount: 1,
                    schemaVersion: utils.EXPORT_SCHEMA_VERSION
                }
            });
            await new Promise((resolve) => setTimeout(resolve, 140));
            return;
        }

        const payload = utils.buildFullExportPayload({
            type: resolvedType,
            folders,
            pluginVersion
        });

        const name = resolvedType === 'docker' ? `${EXPORT_BASENAME}.json` : `${EXPORT_BASENAME} VM.json`;
        downloadFile(name, toPrettyJson(payload));
        setProgress(progressTotal, 'Export download started.');
        await trackDiagnosticsEvent({
            eventType: 'export',
            type: resolvedType,
            details: {
                mode: 'full',
                folderCount: Object.keys(folders).length,
                schemaVersion: utils.EXPORT_SCHEMA_VERSION
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 140));
    } catch (error) {
        showError('Export failed', error);
    } finally {
        if (progressOpen) {
            closeImportApplyProgressDialog();
        }
    }
};
const importType = async (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Error', error);
        return;
    }

    let selected;
    try {
        selected = await selectJsonFile();
    } catch (error) {
        showError('Error', error);
        return;
    }

    if (!selected) {
        return;
    }

    let parsedFile;
    try {
        parsedFile = JSON.parse(selected.text);
    } catch (error) {
        swal({
            title: 'Error',
            text: 'Error parsing the input file, please select a valid JSON file.',
            type: 'error'
        });
        return;
    }

    const parsed = utils.parseImportPayload(parsedFile, resolvedType);
    if (!parsed.ok) {
        swal({
            title: 'Error',
            text: parsed.error || 'Invalid import format.',
            type: 'error'
        });
        return;
    }

    const dialogResult = await showImportPreviewDialog(resolvedType, parsed);
    if (!dialogResult) {
        return;
    }

    const operations = dialogResult.operations;
    if (!operations || countImportOperations(operations) === 0) {
        swal({
            title: 'No changes selected',
            text: 'Nothing was selected to import.',
            type: 'info'
        });
        return;
    }

    if (dialogResult.dryRunOnly) {
        await trackDiagnosticsEvent({
            eventType: 'import_dry_run',
            type: resolvedType,
            details: {
                mode: dialogResult.mode,
                creates: operations.creates.length,
                updates: operations.upserts.length,
                deletes: operations.deletes.length
            }
        });
        swal({
            title: 'Dry run complete',
            text: `No changes were applied.\nCreates: ${operations.creates.length}, Updates: ${operations.upserts.length}, Deletes: ${operations.deletes.length}`,
            type: 'success'
        });
        return;
    }

    let transactionBackup = null;
    const operationCount = countImportOperations(operations);
    const syncStepCount = resolvedType === 'docker' ? 1 : 0;
    const progressTotal = Math.max(3, operationCount + syncStepCount + 2);
    let progressOpen = false;
    const setProgress = (completed, label) => {
        updateImportApplyProgressDialog({
            completed: Math.max(0, Math.min(progressTotal, completed)),
            total: progressTotal,
            label
        });
    };
    try {
        openImportApplyProgressDialog(resolvedType, progressTotal);
        progressOpen = true;
        setProgress(0, 'Creating safety backup...');

        transactionBackup = await createBackup(resolvedType, `before-import-transaction-${dialogResult.mode}`);
        setProgress(1, `Safety backup created: ${transactionBackup?.name || 'ready'}`);

        await applyImportOperations(resolvedType, operations, ({ completed, label }) => {
            setProgress(1 + completed, label || 'Applying import operations...');
        });

        setProgress(progressTotal - 1, `Refreshing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders...`);
        await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
        setProgress(progressTotal, 'Import complete.');
        await new Promise((resolve) => setTimeout(resolve, 180));
        closeImportApplyProgressDialog();
        progressOpen = false;

        await trackDiagnosticsEvent({
            eventType: 'import',
            type: resolvedType,
            details: {
                mode: dialogResult.mode,
                creates: operations.creates.length,
                updates: operations.upserts.length,
                deletes: operations.deletes.length
            }
        });
        await offerUndoAction(resolvedType, transactionBackup, 'Import');
    } catch (error) {
        if (progressOpen) {
            closeImportApplyProgressDialog();
            progressOpen = false;
        }
        let rollbackMessage = 'No rollback backup available.';
        if (transactionBackup && transactionBackup.name) {
            try {
                await restoreBackupByName(resolvedType, transactionBackup.name);
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                rollbackMessage = `Automatic rollback restored backup: ${transactionBackup.name}`;
            } catch (rollbackError) {
                rollbackMessage = `Rollback failed: ${rollbackError?.message || rollbackError}`;
            }
        }
        showError('Import failed', new Error(`${error?.message || error}\n${rollbackMessage}`));
    }
};

const clearType = (type, id) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Delete failed', error);
        return;
    }
    const folders = getFolderMap(resolvedType);
    const folderName = id ? folders[id]?.name : null;
    const text = id ? `Remove folder: ${folderName || id}` : 'Remove ALL folders';

    swal({
        title: 'Are you sure?',
        text,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        const deleteIds = id ? [id] : Object.keys(getFolderMap(resolvedType));
        const syncStepCount = resolvedType === 'docker' ? 1 : 0;
        const progressTotal = Math.max(3, deleteIds.length + syncStepCount + 2);
        let progressOpen = false;
        const setProgress = (completed, label) => {
            updateImportApplyProgressDialog({
                completed: Math.max(0, Math.min(progressTotal, completed)),
                total: progressTotal,
                label
            });
        };
        try {
            openImportApplyProgressDialog(resolvedType, progressTotal);
            progressOpen = true;
            setProgress(0, 'Creating safety backup...');

            const backup = await createBackup(resolvedType, id ? `before-delete-${id}` : 'before-clear-all');
            setProgress(1, `Safety backup created: ${backup?.name || 'ready'}`);

            let completed = 1;
            const foldersBeforeDelete = getFolderMap(resolvedType);
            for (const currentId of deleteIds) {
                const currentName = foldersBeforeDelete[currentId]?.name || currentId;
                await apiPostText('/plugins/folderview.plus/server/delete.php', { type: resolvedType, id: currentId });
                completed += 1;
                setProgress(completed, `Deleted ${currentName}`);
            }

            if (resolvedType === 'docker') {
                await syncDockerOrder();
                completed += 1;
                setProgress(completed, 'Synced Docker folder order');
            }

            setProgress(progressTotal - 1, `Refreshing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders...`);
            await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
            setProgress(progressTotal, id ? 'Folder deleted.' : 'All folders cleared.');
            await new Promise((resolve) => setTimeout(resolve, 180));
            closeImportApplyProgressDialog();
            progressOpen = false;

            await trackDiagnosticsEvent({
                eventType: id ? 'delete_folder' : 'clear_folders',
                type: resolvedType,
                details: {
                    deletedCount: deleteIds.length,
                    singleFolder: Boolean(id)
                }
            });
            await offerUndoAction(resolvedType, backup, id ? 'Delete folder' : 'Clear folders');
        } catch (error) {
            if (progressOpen) {
                closeImportApplyProgressDialog();
            }
            showError('Delete failed', error);
        }
    });
};

const changeSortMode = async (type, mode) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        sortMode: mode
    };

    if (mode === 'manual' && (!Array.isArray(next.manualOrder) || next.manualOrder.length === 0)) {
        next.manualOrder = Object.keys(getFolderMap(type));
    }

    try {
        prefsByType[type] = await postPrefs(type, next);
        await refreshType(type);
    } catch (error) {
        showError('Sort mode save failed', error);
    }
};

const changeBadgePref = async (type, badgeKey, checked) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        badges: {
            ...current.badges,
            [badgeKey]: Boolean(checked)
        }
    };

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderBadgeToggles(type);
    } catch (error) {
        showError('Badge preferences save failed', error);
    }
};

const changeVisibilityPref = async (type, key, checked) => {
    if (key !== 'hideEmptyFolders') {
        return;
    }
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        hideEmptyFolders: checked === true
    };
    try {
        prefsByType[type] = await postPrefs(type, next);
        renderVisibilityControls(type);
        renderTable(type);
    } catch (error) {
        showError('Visibility preference save failed', error);
    }
};

const changeStatusPref = async (type, key, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const current = utils.normalizePrefs(prefsByType[resolvedType]);
    const currentStatus = normalizeStatusPrefs(resolvedType, current);
    const nextStatus = {
        ...currentStatus
    };

    if (key === 'mode') {
        nextStatus.mode = normalizeStatusMode(value);
    } else if (key === 'trendEnabled') {
        nextStatus.trendEnabled = value === true;
    } else if (key === 'attentionAccent') {
        nextStatus.attentionAccent = value === true;
    } else if (key === 'warnStoppedPercent') {
        const parsed = Number(value);
        nextStatus.warnStoppedPercent = Number.isFinite(parsed)
            ? Math.min(100, Math.max(0, Math.round(parsed)))
            : currentStatus.warnStoppedPercent;
    } else {
        return;
    }

    const next = {
        ...current,
        status: nextStatus
    };

    try {
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        renderStatusControls(resolvedType);
        renderTable(resolvedType);
    } catch (error) {
        renderStatusControls(resolvedType);
        showError('Status preferences save failed', error);
    }
};

const setHealthFolderFilter = (type, mode) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const nextMode = normalizeHealthFilterMode(mode);
    const healthPrefs = normalizeHealthPrefs(resolvedType);
    healthFilterByType[resolvedType] = healthPrefs.cardsEnabled ? nextMode : 'all';
    renderTable(resolvedType);
};

const changeHealthPref = async (type, key, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const current = utils.normalizePrefs(prefsByType[resolvedType]);
    const currentHealth = normalizeHealthPrefs(resolvedType, current);
    const nextHealth = {
        ...currentHealth
    };

    if (key === 'cardsEnabled') {
        nextHealth.cardsEnabled = value === true;
    } else if (key === 'runtimeBadgeEnabled') {
        nextHealth.runtimeBadgeEnabled = value === true;
    } else if (key === 'compact') {
        nextHealth.compact = value === true;
    } else if (key === 'warnStoppedPercent') {
        const parsed = Number(value);
        nextHealth.warnStoppedPercent = Number.isFinite(parsed)
            ? Math.min(100, Math.max(0, Math.round(parsed)))
            : currentHealth.warnStoppedPercent;
    } else {
        return;
    }

    const next = {
        ...current,
        health: nextHealth
    };
    if (!nextHealth.cardsEnabled) {
        healthFilterByType[resolvedType] = 'all';
    }

    try {
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        renderHealthControls(resolvedType);
        renderTable(resolvedType);
    } catch (error) {
        renderHealthControls(resolvedType);
        showError('Health preferences save failed', error);
    }
};

const toggleFolderPin = async (type, folderId) => {
    const id = String(folderId || '');
    if (!id) {
        return;
    }
    const current = utils.normalizePrefs(prefsByType[type]);
    const pinned = Array.isArray(current.pinnedFolderIds) ? [...current.pinnedFolderIds] : [];
    const exists = pinned.includes(id);
    const nextPinned = exists
        ? pinned.filter((item) => item !== id)
        : [...pinned, id];
    const next = {
        ...current,
        pinnedFolderIds: nextPinned
    };
    try {
        prefsByType[type] = await postPrefs(type, next);
        await refreshType(type);
    } catch (error) {
        showError('Pin update failed', error);
    }
};

const changeRuntimePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current
    };
    if (key === 'liveRefreshEnabled') {
        next.liveRefreshEnabled = value === true;
    } else if (key === 'liveRefreshSeconds') {
        const parsed = Number(value);
        next.liveRefreshSeconds = Number.isFinite(parsed) ? Math.min(300, Math.max(10, Math.round(parsed))) : current.liveRefreshSeconds;
    } else if (key === 'performanceMode') {
        next.performanceMode = value === true;
    } else if (key === 'lazyPreviewEnabled') {
        next.lazyPreviewEnabled = value === true;
    } else if (key === 'lazyPreviewThreshold') {
        const parsed = Number(value);
        next.lazyPreviewThreshold = Number.isFinite(parsed) ? Math.min(200, Math.max(10, Math.round(parsed))) : current.lazyPreviewThreshold;
    } else {
        return;
    }

    if (key === 'liveRefreshEnabled' || key === 'lazyPreviewEnabled') {
        syncRuntimeDependentFields(type);
    }

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderRuntimeControls(type);
    } catch (error) {
        renderRuntimeControls(type);
        showError('Runtime preference save failed', error);
    }
};

const changeBackupSchedulePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const schedule = {
        ...(current.backupSchedule || {})
    };

    if (key === 'enabled') {
        schedule.enabled = value === true;
    } else if (key === 'intervalHours') {
        const parsed = Number(value);
        schedule.intervalHours = Number.isFinite(parsed) ? Math.min(168, Math.max(1, Math.round(parsed))) : schedule.intervalHours || 24;
    } else if (key === 'retention') {
        const parsed = Number(value);
        schedule.retention = Number.isFinite(parsed) ? Math.min(200, Math.max(1, Math.round(parsed))) : schedule.retention || 25;
    } else {
        return;
    }

    try {
        prefsByType[type] = await postPrefs(type, {
            ...current,
            backupSchedule: schedule
        });
        renderBackupScheduleControls(type);
    } catch (error) {
        showError('Backup schedule save failed', error);
    }
};

const addAutoRule = async (type) => {
    const folderId = String($(`#${type}-rule-folder`).val() || '');
    const effect = String($(`#${type}-rule-effect`).val() || 'include');
    const kind = String($(`#${type}-rule-kind`).val() || 'name_regex');
    const pattern = String($(`#${type}-rule-pattern`).val() || '').trim();
    const labelKey = String($(`#${type}-rule-label-key`).val() || '').trim();
    const labelValue = String($(`#${type}-rule-label-value`).val() || '').trim();
    const regexKinds = ['name_regex', 'image_regex', 'compose_project_regex'];
    const labelKinds = ['label', 'label_contains', 'label_starts_with'];

    if (!folderId) {
        swal({ title: 'Error', text: 'Select a folder before adding a rule.', type: 'error' });
        return;
    }

    if (regexKinds.includes(kind)) {
        if (!pattern) {
            swal({ title: 'Error', text: 'Regex pattern cannot be empty.', type: 'error' });
            return;
        }
        try {
            new RegExp(pattern);
        } catch (error) {
            swal({ title: 'Error', text: `Invalid regex: ${error.message}`, type: 'error' });
            return;
        }
    }

    if (labelKinds.includes(kind) && !labelKey) {
        swal({ title: 'Error', text: 'Label key cannot be empty for label rules.', type: 'error' });
        return;
    }
    if ((kind === 'label_contains' || kind === 'label_starts_with') && !labelValue) {
        swal({ title: 'Error', text: 'Label value cannot be empty for contains/starts-with rules.', type: 'error' });
        return;
    }

    const nextRule = {
        id: `rule-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        enabled: true,
        folderId,
        effect: effect === 'exclude' ? 'exclude' : 'include',
        kind,
        pattern: regexKinds.includes(kind) ? pattern : '',
        labelKey: labelKinds.includes(kind) ? labelKey : '',
        labelValue: labelKinds.includes(kind) ? labelValue : ''
    };

    try {
        const nextPrefs = utils.normalizePrefs({
            ...prefsByType[type],
            autoRules: [...(prefsByType[type].autoRules || []), nextRule]
        });
        prefsByType[type] = await postPrefs(type, nextPrefs);

        $(`#${type}-rule-pattern`).val('');
        $(`#${type}-rule-label-key`).val('');
        $(`#${type}-rule-label-value`).val('');
        $(`#${type}-rule-effect`).val('include');
        renderRulesTable(type);
    } catch (error) {
        showError('Rule save failed', error);
    }
};

const toggleAutoRule = async (type, ruleId) => {
    const rules = [...(prefsByType[type].autoRules || [])];
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) {
        return;
    }

    rules[index] = {
        ...rules[index],
        enabled: !rules[index].enabled
    };

    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule update failed', error);
    }
};

const deleteAutoRule = async (type, ruleId) => {
    const rules = (prefsByType[type].autoRules || []).filter((rule) => rule.id !== ruleId);
    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule delete failed', error);
    }
};

const moveAutoRule = async (type, ruleId, direction) => {
    const rules = [...(prefsByType[type].autoRules || [])];
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) {
        return;
    }

    const newIndex = direction < 0 ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) {
        return;
    }

    const [moved] = rules.splice(index, 1);
    rules.splice(newIndex, 0, moved);

    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule reorder failed', error);
    }
};

const toggleRuleKindFields = (type) => {
    if (type !== 'docker') {
        return;
    }

    const kind = String($('#docker-rule-kind').val() || 'name_regex');
    const regexKinds = ['name_regex', 'image_regex', 'compose_project_regex'];
    const labelKinds = ['label', 'label_contains', 'label_starts_with'];
    $('#docker-rule-pattern').attr('placeholder', kind === 'image_regex'
        ? 'Regex pattern (example: linuxserver/)'
        : kind === 'compose_project_regex'
            ? 'Regex pattern (example: ^media$)'
            : 'Regex pattern (example: ^media-)');
    $('#docker-rule-pattern').toggle(regexKinds.includes(kind));
    $('#docker-rule-label-key').toggle(labelKinds.includes(kind));
    $('#docker-rule-label-value').toggle(labelKinds.includes(kind));
    updateRuleLiveMatch('docker');
};

const testAutoRule = (type) => {
    const rules = prefsByType[type]?.autoRules || [];
    const output = $(`#${type}-rule-test-output`);

    const testName = String($(`#${type}-rule-test-name`).val() || '').trim();
    if (!testName) {
        output.text('Enter a test name first.');
        return;
    }

    const info = {
        ...(infoByType[type] || {})
    };

    if (type === 'docker') {
        const key = String($('#docker-rule-test-label-key').val() || '').trim();
        const value = String($('#docker-rule-test-label-value').val() || '').trim();
        const image = String($('#docker-rule-test-image').val() || '').trim();
        const compose = String($('#docker-rule-test-compose').val() || '').trim();
        if (key) {
            const existing = info[testName] || {};
            const existingLabels = existing.Labels || existing.info?.Config?.Labels || {};
            info[testName] = {
                ...existing,
                Labels: {
                    ...existingLabels,
                    [key]: value || '1'
                }
            };
        }
        if (image) {
            const existing = info[testName] || {};
            info[testName] = {
                ...existing,
                info: {
                    ...(existing.info || {}),
                    Config: {
                        ...((existing.info || {}).Config || {}),
                        Image: image,
                        Labels: {
                            ...(((existing.info || {}).Config || {}).Labels || existing.Labels || {}),
                            ...(compose ? { 'com.docker.compose.project': compose } : {})
                        }
                    }
                }
            };
        } else if (compose) {
            const existing = info[testName] || {};
            const existingLabels = existing.Labels || existing.info?.Config?.Labels || {};
            info[testName] = {
                ...existing,
                Labels: {
                    ...existingLabels,
                    'com.docker.compose.project': compose
                }
            };
        }
    }

    const decision = utils.getAutoRuleDecision({
        rules,
        name: testName,
        infoByName: info,
        type
    });
    const firstMatch = decision.assignedRule;

    if (decision.blockedBy) {
        const blockedPriority = rules.findIndex((rule) => rule.id === decision.blockedBy.id) + 1;
        output.text(`Blocked by exclude rule #${blockedPriority}: ${ruleDescription(decision.blockedBy)}`);
        return;
    }

    if (!firstMatch) {
        output.text('No matching rule. This item would remain unassigned.');
        return;
    }

    const priority = rules.findIndex((rule) => rule.id === firstMatch.id) + 1;
    output.text(`Matched priority #${priority}: ${folderNameForId(type, firstMatch.folderId)} (${ruleDescription(firstMatch)})`);
};

const assignSelectedItems = async (type) => {
    const folderId = String($(`#${type}-bulk-folder`).val() || '');
    const selected = ($(`#${type}-bulk-items`).val() || []).map((name) => String(name));

    if (!folderId) {
        swal({ title: 'Error', text: 'Select a folder for bulk assignment.', type: 'error' });
        return;
    }

    if (!selected.length) {
        swal({ title: 'Error', text: 'Select at least one item to assign.', type: 'error' });
        return;
    }

    try {
        const backup = await createBackup(type, 'before-bulk-assign');
        await bulkAssign(type, folderId, selected);
        await Promise.all([refreshType(type), refreshBackups(type)]);
        await trackDiagnosticsEvent({
            eventType: 'bulk_assign',
            type,
            details: {
                folderId,
                itemCount: selected.length
            }
        });
        await offerUndoAction(type, backup, 'Bulk assignment');
    } catch (error) {
        showError('Bulk assignment failed', error);
    }
};

const previewFolderRuntimeAction = (type) => {
    const folderId = String($(`#${type}-runtime-folder`).val() || '');
    const action = String($(`#${type}-runtime-action`).val() || '');
    const output = $(`#${type}-runtime-preview-output`);
    if (!folderId || !action) {
        output.text('Select a folder and action first.');
        return;
    }
    const plan = getRuntimePlanForFolder(type, folderId, action);
    output.text(runtimePreviewText(type, folderId, action, plan));
};

const applyFolderRuntimeAction = (type) => {
    const folderId = String($(`#${type}-runtime-folder`).val() || '');
    const action = String($(`#${type}-runtime-action`).val() || '');
    const output = $(`#${type}-runtime-preview-output`);
    if (!folderId || !action) {
        output.text('Select a folder and action first.');
        return;
    }
    const plan = getRuntimePlanForFolder(type, folderId, action);
    if (!plan) {
        output.text('No valid action plan was generated.');
        return;
    }
    if (!plan.eligible.length) {
        output.text(runtimePreviewText(type, folderId, action, plan));
        swal({
            title: 'Nothing to apply',
            text: 'No eligible items were found for this action.',
            type: 'info'
        });
        return;
    }

    const folderName = folderNameForId(type, folderId);
    swal({
        title: 'Apply folder action?',
        text: `${action.toUpperCase()} on "${folderName}"\nEligible: ${plan.eligible.length}\nSkipped: ${plan.skipped.length}`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            const result = await executeFolderRuntimeAction(type, action, plan.eligible.map((row) => row.name));
            await refreshType(type);
            output.text(toPrettyJson({
                preview: plan,
                result
            }));
            await trackDiagnosticsEvent({
                eventType: 'runtime_bulk_action',
                type,
                details: {
                    action,
                    folderId,
                    requested: plan.requestedCount,
                    eligible: plan.eligible.length,
                    executed: result.executed || 0,
                    failed: result.failed || 0
                }
            });
            swal({
                title: 'Action complete',
                text: `Executed: ${result.executed || 0}, succeeded: ${result.succeeded || 0}, failed: ${result.failed || 0}, skipped: ${(result.skipped || []).length}`,
                type: (result.failed || 0) > 0 ? 'warning' : 'success'
            });
        } catch (error) {
            showError('Folder runtime action failed', error);
        }
    });
};

const renderChangeHistory = (diagnostics) => {
    const timeline = Array.isArray(diagnostics?.recentTimeline) ? diagnostics.recentTimeline : [];
    if (!timeline.length) {
        $('#change-history-output').text('No recent changes found.');
        return;
    }
    const lines = [];
    lines.push(`Recent events: ${timeline.length}`);
    lines.push('');
    for (const row of timeline.slice(0, 40)) {
        const ts = row.timestamp || '';
        const action = row.action || '';
        const type = row.type || '-';
        const status = row.status || 'ok';
        const summary = row.summary ? ` | ${row.summary}` : '';
        lines.push(`${ts} | ${action} | ${type} | ${status}${summary}`);
    }
    $('#change-history-output').text(`${lines.join('\n')}\n`);
};

const refreshChangeHistory = async () => {
    try {
        const diagnostics = await getDiagnostics('sanitized');
        renderDiagnostics(diagnostics);
        renderChangeHistory(diagnostics);
    } catch (error) {
        showError('Change history refresh failed', error);
    }
};

const undoLatestChange = (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Undo failed', error);
        return;
    }
    swal({
        title: 'Undo latest change?',
        text: `Restore the latest undo-capable ${resolvedType.toUpperCase()} backup snapshot.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Undo',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            const restore = await restoreLatestUndo(resolvedType);
            await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
            await refreshChangeHistory();
            swal({
                title: 'Undo complete',
                text: `Restored ${restore.name || 'latest undo backup'}.`,
                type: 'success'
            });
        } catch (error) {
            showError('Undo failed', error);
        }
    });
};

const createManualBackup = async (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Backup failed', error);
        return;
    }
    try {
        const backup = await createBackup(resolvedType, 'manual');
        await refreshBackups(resolvedType);
        swal({
            title: 'Backup created',
            text: backup.name,
            type: 'success'
        });
    } catch (error) {
        showError('Backup failed', error);
    }
};

const restoreBackupEntry = (type, name) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Restore failed', error);
        return;
    }
    swal({
        title: 'Restore this backup?',
        text: `This will overwrite current ${resolvedType} folders.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        try {
            const undoBackup = await createBackup(resolvedType, `before-restore-${name}`);
            await restoreBackupByName(resolvedType, name);
            await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
            await offerUndoAction(resolvedType, undoBackup, 'Backup restore');
        } catch (error) {
            showError('Restore failed', error);
        }
    });
};

const restoreLatestBackup = (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Restore failed', error);
        return;
    }
    swal({
        title: 'Restore latest backup?',
        text: `This will overwrite current ${resolvedType} folders with the latest backup snapshot.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        const progressTotal = 4;
        let progressOpen = false;
        const setProgress = (completed, label) => {
            updateImportApplyProgressDialog({
                completed: Math.max(0, Math.min(progressTotal, completed)),
                total: progressTotal,
                label
            });
        };
        try {
            openImportApplyProgressDialog(resolvedType, progressTotal);
            progressOpen = true;
            setProgress(0, 'Creating safety backup...');

            const undoBackup = await createBackup(resolvedType, 'before-restore-latest');
            setProgress(1, `Safety backup created: ${undoBackup?.name || 'ready'}`);

            await restoreLatest(resolvedType);
            setProgress(2, 'Restored latest backup snapshot.');

            await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
            setProgress(3, `Refreshed ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders.`);
            setProgress(progressTotal, 'Restore complete.');
            await new Promise((resolve) => setTimeout(resolve, 180));
            closeImportApplyProgressDialog();
            progressOpen = false;

            await offerUndoAction(resolvedType, undoBackup, 'Restore latest backup');
        } catch (error) {
            if (progressOpen) {
                closeImportApplyProgressDialog();
            }
            showError('Restore failed', error);
        }
    });
};

const downloadBackupEntry = (type, name) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Download failed', error);
        return;
    }
    const resolvedName = String(name || '').trim();
    if (!resolvedName) {
        showError('Download failed', new Error('Backup name is required.'));
        return;
    }

    const frameName = `fv-download-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const iframe = document.createElement('iframe');
    iframe.name = frameName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/plugins/folderview.plus/server/backup.php';
    form.target = frameName;
    form.style.display = 'none';

    const addField = (fieldName, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = fieldName;
        input.value = String(value ?? '');
        form.appendChild(input);
    };

    addField('action', 'download_post');
    addField('type', resolvedType);
    addField('name', resolvedName);
    const token = getOptionalRequestToken();
    if (token) {
        addField('token', token);
    }

    document.body.appendChild(form);
    form.submit();

    window.setTimeout(() => {
        if (form.parentNode) {
            form.parentNode.removeChild(form);
        }
    }, 1000);
    window.setTimeout(() => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    }, 20000);
};

const deleteBackupEntry = (type, name) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Delete failed', error);
        return;
    }
    swal({
        title: 'Delete backup?',
        text: `Delete ${name}? This cannot be undone.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        try {
            backupsByType[resolvedType] = await deleteBackupByName(resolvedType, name);
            renderBackupRows(resolvedType);
        } catch (error) {
            showError('Delete failed', error);
        }
    });
};

const createTemplateFromFolder = async (type) => {
    const folderId = String($(`#${type}-template-source-folder`).val() || '');
    const templateName = String($(`#${type}-template-name`).val() || '').trim();
    if (!folderId) {
        swal({ title: 'Error', text: 'Select a source folder first.', type: 'error' });
        return;
    }
    if (!templateName) {
        swal({ title: 'Error', text: 'Enter a template name.', type: 'error' });
        return;
    }
    try {
        templatesByType[type] = await createTemplate(type, folderId, templateName);
        $(`#${type}-template-name`).val('');
        renderTemplateRows(type);
        swal({ title: 'Template saved', text: 'Template created successfully.', type: 'success' });
    } catch (error) {
        showError('Template create failed', error);
    }
};

const applyTemplateToFolder = (type, templateId, selectId) => {
    const folderId = String($(`#${selectId}`).val() || '');
    if (!folderId) {
        swal({ title: 'Error', text: 'Select a target folder.', type: 'error' });
        return;
    }
    swal({
        title: 'Apply template?',
        text: 'This overwrites icon/settings/actions/regex on the target folder.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            const backup = await createBackup(type, 'before-template-apply');
            await applyTemplate(type, templateId, folderId);
            await Promise.all([refreshType(type), refreshBackups(type)]);
            await offerUndoAction(type, backup, 'Template apply');
        } catch (error) {
            showError('Template apply failed', error);
        }
    });
};

const deleteTemplateEntry = (type, templateId) => {
    swal({
        title: 'Delete template?',
        text: 'This cannot be undone.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            templatesByType[type] = await deleteTemplate(type, templateId);
            renderTemplateRows(type);
        } catch (error) {
            showError('Template delete failed', error);
        }
    });
};

const toggleRuleSelection = (type, ruleId, checked) => {
    const selected = selectedRuleIdsByType[type] || new Set();
    if (checked) {
        selected.add(String(ruleId || ''));
    } else {
        selected.delete(String(ruleId || ''));
    }
    selectedRuleIdsByType[type] = selected;
    renderRulesTable(type);
};

const toggleAllRuleSelections = (type, checked) => {
    const rules = prefsByType[type]?.autoRules || [];
    const selected = selectedRuleIdsByType[type] || new Set();
    const filter = normalizedFilter(filtersByType[type]?.rules);
    for (const rule of rules) {
        const haystack = `${folderNameForId(type, rule.folderId)} ${ruleDescription(rule)} ${rule.id || ''}`.toLowerCase();
        if (filter && !haystack.includes(filter)) {
            continue;
        }
        if (checked) {
            selected.add(String(rule.id || ''));
        } else {
            selected.delete(String(rule.id || ''));
        }
    }
    selectedRuleIdsByType[type] = selected;
    renderRulesTable(type);
};

const bulkRuleAction = async (type, action) => {
    const rules = prefsByType[type]?.autoRules || [];
    const selected = selectedRuleIdsByType[type] || new Set();
    const selectedIds = Array.from(selected).filter((id) => rules.some((rule) => String(rule.id) === id));
    if (!selectedIds.length) {
        swal({ title: 'Nothing selected', text: 'Select at least one rule first.', type: 'warning' });
        return;
    }

    if (action === 'export') {
        const selectedRules = rules.filter((rule) => selectedIds.includes(String(rule.id)));
        const payload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            type,
            mode: 'rules',
            rules: selectedRules
        };
        downloadFile(`FolderView Plus ${type.toUpperCase()} Rules.json`, toPrettyJson(payload));
        return;
    }

    if (action === 'delete') {
        swal({
            title: 'Delete selected rules?',
            text: `Delete ${selectedIds.length} selected rule(s)?`,
            type: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        }, async (confirmed) => {
            if (!confirmed) {
                return;
            }
            try {
                const nextRules = rules.filter((rule) => !selectedIds.includes(String(rule.id)));
                prefsByType[type] = await postPrefs(type, {
                    ...prefsByType[type],
                    autoRules: nextRules
                });
                selectedRuleIdsByType[type] = new Set();
                renderRulesTable(type);
            } catch (error) {
                showError('Rule delete failed', error);
            }
        });
        return;
    }

    const enabled = action === 'enable';
    try {
        const nextRules = rules.map((rule) => (
            selectedIds.includes(String(rule.id))
                ? { ...rule, enabled }
                : rule
        ));
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: nextRules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule bulk update failed', error);
    }
};

const runRuleSimulator = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const rules = prefsByType[resolvedType]?.autoRules || [];
    const info = infoByType[resolvedType] || {};
    const names = Object.keys(info).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    const rows = names.map((name) => {
        const decision = utils.getAutoRuleDecision({
            rules,
            name,
            infoByName: info,
            type: resolvedType
        });
        if (decision.blockedBy) {
            return {
                item: name,
                result: 'blocked',
                folder: folderNameForId(resolvedType, decision.blockedBy.folderId || ''),
                rule: ruleDescription(decision.blockedBy)
            };
        }
        if (decision.assignedRule) {
            return {
                item: name,
                result: 'assigned',
                folder: folderNameForId(resolvedType, decision.assignedRule.folderId || ''),
                rule: ruleDescription(decision.assignedRule)
            };
        }
        return {
            item: name,
            result: 'unassigned',
            folder: '-',
            rule: '-'
        };
    });
    const summary = {
        total: rows.length,
        assigned: rows.filter((row) => row.result === 'assigned').length,
        blocked: rows.filter((row) => row.result === 'blocked').length,
        unassigned: rows.filter((row) => row.result === 'unassigned').length
    };
    $(`#${resolvedType}-rule-sim-output`).text(toPrettyJson({
        type: resolvedType,
        generatedAt: new Date().toISOString(),
        summary,
        rows
    }));
    await trackDiagnosticsEvent({
        eventType: 'rule_simulator',
        type: resolvedType,
        details: summary
    });
};

const toggleTemplateSelection = (type, templateId, checked) => {
    const selected = selectedTemplateIdsByType[type] || new Set();
    if (checked) {
        selected.add(String(templateId || ''));
    } else {
        selected.delete(String(templateId || ''));
    }
    selectedTemplateIdsByType[type] = selected;
    renderTemplateRows(type);
};

const toggleAllTemplateSelections = (type, checked) => {
    const templates = templatesByType[type] || [];
    const selected = selectedTemplateIdsByType[type] || new Set();
    const filter = normalizedFilter(filtersByType[type]?.templates);
    for (const template of templates) {
        const templateId = String(template.id || '');
        const haystack = `${String(template.name || '')} ${templateId}`.toLowerCase();
        if (filter && !haystack.includes(filter)) {
            continue;
        }
        if (checked) {
            selected.add(templateId);
        } else {
            selected.delete(templateId);
        }
    }
    selectedTemplateIdsByType[type] = selected;
    renderTemplateRows(type);
};

const bulkTemplateAction = (type, action) => {
    const templates = templatesByType[type] || [];
    const selected = selectedTemplateIdsByType[type] || new Set();
    const selectedTemplates = templates.filter((template) => selected.has(String(template.id || '')));
    if (!selectedTemplates.length) {
        swal({ title: 'Nothing selected', text: 'Select at least one template first.', type: 'warning' });
        return;
    }

    if (action === 'export') {
        const payload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            type,
            mode: 'templates',
            templates: selectedTemplates
        };
        downloadFile(`FolderView Plus ${type.toUpperCase()} Templates.json`, toPrettyJson(payload));
        return;
    }

    swal({
        title: 'Delete selected templates?',
        text: `Delete ${selectedTemplates.length} selected template(s)?`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            let nextTemplates = templates;
            for (const template of selectedTemplates) {
                nextTemplates = await deleteTemplate(type, String(template.id || ''));
            }
            templatesByType[type] = nextTemplates;
            selectedTemplateIdsByType[type] = new Set();
            renderTemplateRows(type);
        } catch (error) {
            showError('Template bulk delete failed', error);
        }
    });
};

const runScheduledBackupNow = async (type) => {
    try {
        await runScheduledBackup(type);
        await Promise.all([refreshType(type), refreshBackups(type)]);
        swal({
            title: 'Scheduler run complete',
            text: `Scheduled backup check executed for ${type.toUpperCase()}.`,
            type: 'success'
        });
    } catch (error) {
        showError('Scheduler run failed', error);
    }
};

const issueReportFromDiagnostics = (diagnostics) => {
    const report = diagnostics || {};
    const lines = [];
    lines.push('# FolderView Plus Issue Report');
    lines.push(`Generated: ${report.checkedAt || new Date().toISOString()}`);
    lines.push(`Plugin version: ${report.pluginVersion || 'unknown'}`);
    lines.push(`Privacy mode: ${report.privacyMode || 'sanitized'}`);
    lines.push('');

    const env = report.environment || {};
    lines.push('## Environment');
    lines.push(`- Unraid: ${env.unraidVersion || 'unknown'}`);
    lines.push(`- PHP: ${env.phpVersion || 'unknown'}`);
    lines.push(`- OS: ${env.os || 'unknown'}`);
    lines.push('');

    lines.push('## Type Summary');
    for (const type of ['docker', 'vm']) {
        const typeData = report.types?.[type] || {};
        const integrity = typeData.integrityChecks || {};
        const issueCount = Number.isFinite(Number(integrity.issuesCount))
            ? Number(integrity.issuesCount)
            : Number(integrity.issueCount || 0);
        lines.push(`- ${type.toUpperCase()}: folders=${typeData.folderCount || 0}, rules=${typeData.ruleCount || 0}, backups=${typeData.backupCount || 0}, templates=${typeData.templateCount || 0}, issueCount=${issueCount}`);
    }
    lines.push('');

    const timeline = Array.isArray(report.recentTimeline) ? report.recentTimeline.slice(0, 15) : [];
    lines.push('## Recent Timeline');
    if (!timeline.length) {
        lines.push('- No recent timeline events available.');
    } else {
        for (const row of timeline) {
            lines.push(`- ${row.timestamp || ''} | ${row.action || ''} | ${row.type || '-'} | ${row.status || 'ok'}${row.summary ? ` | ${row.summary}` : ''}`);
        }
    }
    lines.push('');
    lines.push('## Notes');
    lines.push('- Attach `FolderView Plus Diagnostics.json` and support bundle export if available.');
    return lines.join('\n');
};

const copyIssueReport = async () => {
    try {
        let diagnostics = lastDiagnostics;
        if (!diagnostics) {
            diagnostics = await getDiagnostics('sanitized');
            renderDiagnostics(diagnostics);
        }
        const text = issueReportFromDiagnostics(diagnostics);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        swal({
            title: 'Copied',
            text: 'Issue report copied to clipboard.',
            type: 'success'
        });
    } catch (error) {
        showError('Copy issue report failed', error);
    }
};

const renderDiagnostics = (diagnostics) => {
    lastDiagnostics = diagnostics || null;
    if (!diagnostics) {
        $('#diagnostics-output').text('No diagnostics data.');
        renderChangeHistory(null);
        return;
    }
    $('#diagnostics-output').text(toPrettyJson(diagnostics));
    renderChangeHistory(diagnostics);
};

const runDiagnostics = async () => {
    try {
        const diagnostics = await getDiagnostics();
        renderDiagnostics(diagnostics);
    } catch (error) {
        showError('Diagnostics failed', error);
    }
};

const repairDiagnostics = async (action) => {
    try {
        const diagnostics = await runDiagnosticAction(action);
        renderDiagnostics(diagnostics);
        swal({
            title: 'Repair complete',
            text: 'Repair action finished successfully.',
            type: 'success'
        });
        await Promise.all([refreshType('docker'), refreshType('vm'), refreshBackups('docker'), refreshBackups('vm')]);
    } catch (error) {
        showError('Repair failed', error);
    }
};

const exportDiagnosticsByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    let diagnostics = null;

    const cachedMode = (lastDiagnostics?.privacyMode || 'sanitized');
    if (lastDiagnostics && cachedMode === mode) {
        diagnostics = lastDiagnostics;
    }

    if (!diagnostics) {
        try {
            diagnostics = await getDiagnostics(mode);
            renderDiagnostics(diagnostics);
        } catch (error) {
            if (lastDiagnostics) {
                diagnostics = lastDiagnostics;
            } else {
                diagnostics = {
                    schemaVersion: 2,
                    privacyMode: mode,
                    checkedAt: new Date().toISOString(),
                    error: error?.message || String(error)
                };
            }
        }
    }

    downloadFile('FolderView Plus Diagnostics.json', toPrettyJson(diagnostics || {}));
    trackDiagnosticsEvent({
        eventType: 'diagnostics_export',
        details: {
            privacyMode: mode,
            schemaVersion: diagnostics?.schemaVersion || null
        }
    });
};

const exportDiagnostics = () => {
    swal({
        title: 'Export diagnostics',
        text: 'Choose export mode.\nFull includes all details. Sanitized redacts sensitive fields.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Full export',
        cancelButtonText: 'Sanitized export',
        closeOnConfirm: true,
        closeOnCancel: true
    }, (useFull) => {
        void exportDiagnosticsByMode(useFull ? 'full' : 'sanitized');
    });
};

const exportSupportBundleByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    try {
        const bundle = await getSupportBundle(mode);
        const generatedAt = String(bundle.generatedAt || '').replace(/[:]/g, '-');
        const suffix = generatedAt ? `-${generatedAt}` : '';
        downloadFile(`FolderView Plus Support Bundle${suffix}.json`, toPrettyJson(bundle));
        await trackDiagnosticsEvent({
            eventType: 'support_bundle_export',
            details: {
                privacyMode: mode,
                bundleVersion: bundle?.bundleVersion || null
            }
        });
    } catch (error) {
        showError('Support bundle export failed', error);
    }
};

const exportSupportBundle = () => {
    swal({
        title: 'Export support bundle',
        text: 'Choose export mode.\nFull includes all details. Sanitized redacts sensitive fields.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Full export',
        cancelButtonText: 'Sanitized export',
        closeOnConfirm: true,
        closeOnCancel: true
    }, (useFull) => {
        void exportSupportBundleByMode(useFull ? 'full' : 'sanitized');
    });
};

const runConflictInspector = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const folders = getFolderMap(resolvedType);
    const prefs = prefsByType[resolvedType] || utils.normalizePrefs({});
    const info = infoByType[resolvedType] || {};

    const report = utils.getConflictReport({
        type: resolvedType,
        folders,
        prefs,
        infoByName: info
    });

    const conflicts = report.rows.filter((row) => row.hasConflict);
    const blocked = report.rows.filter((row) => row.blockedByRule);
    const output = {
        type: resolvedType,
        scannedAt: new Date().toISOString(),
        summary: {
            totalItems: report.totalItems,
            conflictingItems: report.conflictingItems,
            blockedByExcludeRules: blocked.length
        },
        conflictingRows: conflicts,
        blockedRows: blocked
    };

    $('#conflict-output').text(toPrettyJson(output));
    await trackDiagnosticsEvent({
        eventType: 'conflict_scan',
        type: resolvedType,
        details: {
            totalItems: report.totalItems,
            conflictingItems: report.conflictingItems,
            blockedByExcludeRules: blocked.length
        }
    });
};

const checkForUpdatesNow = async () => {
    setUpdateStatus('Checking for updates...');

    try {
        const response = await apiGetJson('/plugins/folderview.plus/server/update_check.php');
        if (!response.ok) {
            setUpdateStatus('Update check failed.');
            swal({
                title: 'Update check failed',
                text: response.error || 'Unable to check for updates right now.',
                type: 'error'
            });
            return;
        }

        const message = response.updateAvailable
            ? `Update available: ${response.currentVersion} -> ${response.remoteVersion}`
            : `Up to date: ${response.currentVersion}`;

        const statusMeta = `${response.responseStatus || 'status unknown'} | ${response.durationMs ?? '?'}ms`;
        setUpdateStatus(`${message} (checked ${response.checkedAt})`);
        swal({
            title: response.updateAvailable ? 'Update available' : 'No update available',
            text: `${message}\nSource: ${response.manifestUrl}\nRequest: ${response.requestUrl || response.manifestUrl}\nNetwork: ${statusMeta}`,
            type: response.updateAvailable ? 'warning' : 'success'
        });
    } catch (error) {
        setUpdateStatus('Update check failed.');
        showError('Update check failed', error);
    }
};

const createRollbackCheckpoint = async () => {
    try {
        const checkpoint = await createGlobalRollbackCheckpointApi('manual');
        const message = checkpoint?.name ? `Created: ${checkpoint.name}` : 'Rollback checkpoint created.';
        setRollbackStatus(message);
        swal({
            title: 'Rollback checkpoint created',
            text: message,
            type: 'success'
        });
    } catch (error) {
        setRollbackStatus('Rollback checkpoint failed.');
        showError('Rollback checkpoint failed', error);
    }
};

const rollbackLatestCheckpoint = () => {
    swal({
        title: 'Rollback plugin settings?',
        text: 'This restores Docker + VM folders and settings from the previous rollback snapshot.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Rollback now',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            const restore = await restorePreviousGlobalRollbackCheckpointApi();
            await refreshAll();
            const target = restore?.targetName || restore?.name || 'previous snapshot';
            const undo = restore?.undoSnapshot ? `\nUndo snapshot created: ${restore.undoSnapshot}` : '';
            const status = `Restored ${target}`;
            setRollbackStatus(status);
            swal({
                title: 'Rollback complete',
                text: `${status}${undo}`,
                type: 'success'
            });
        } catch (error) {
            setRollbackStatus('Rollback failed.');
            showError('Rollback failed', error);
        }
    });
};

const fileManager = () => {
    location.href = `${location.pathname}/Browse?dir=/boot/config/plugins/folderview.plus`;
};

const downloadDocker = (id) => downloadType('docker', id);
const downloadVm = (id) => downloadType('vm', id);
const importDocker = () => importType('docker');
const importVm = () => importType('vm');
const clearDocker = (id) => clearType('docker', id);
const clearVm = (id) => clearType('vm', id);

window.downloadDocker = downloadDocker;
window.downloadVm = downloadVm;
window.importDocker = importDocker;
window.importVm = importVm;
window.clearDocker = clearDocker;
window.clearVm = clearVm;
window.fileManager = fileManager;
window.createRollbackCheckpoint = createRollbackCheckpoint;
window.rollbackLatestCheckpoint = rollbackLatestCheckpoint;
window.changeSortMode = changeSortMode;
window.changeBadgePref = changeBadgePref;
window.changeVisibilityPref = changeVisibilityPref;
window.changeStatusPref = changeStatusPref;
window.changeRuntimePref = changeRuntimePref;
window.changeHealthPref = changeHealthPref;
window.changeBackupSchedulePref = changeBackupSchedulePref;
window.setFilterQuery = setFilterQuery;
window.addAutoRule = addAutoRule;
window.toggleAutoRule = toggleAutoRule;
window.deleteAutoRule = deleteAutoRule;
window.moveAutoRule = moveAutoRule;
window.toggleRuleSelection = toggleRuleSelection;
window.toggleAllRuleSelections = toggleAllRuleSelections;
window.bulkRuleAction = bulkRuleAction;
window.runRuleSimulator = runRuleSimulator;
window.toggleRuleKindFields = toggleRuleKindFields;
window.testAutoRule = testAutoRule;
window.assignSelectedItems = assignSelectedItems;
window.createManualBackup = createManualBackup;
window.refreshBackups = refreshBackups;
window.runScheduledBackupNow = runScheduledBackupNow;
window.restoreLatestBackup = restoreLatestBackup;
window.compareBackupSnapshots = compareBackupSnapshots;
window.restoreBackupEntry = restoreBackupEntry;
window.downloadBackupEntry = downloadBackupEntry;
window.deleteBackupEntry = deleteBackupEntry;
window.previewFolderRuntimeAction = previewFolderRuntimeAction;
window.applyFolderRuntimeAction = applyFolderRuntimeAction;
window.refreshChangeHistory = refreshChangeHistory;
window.undoLatestChange = undoLatestChange;
window.createTemplateFromFolder = createTemplateFromFolder;
window.applyTemplateToFolder = applyTemplateToFolder;
window.deleteTemplateEntry = deleteTemplateEntry;
window.toggleTemplateSelection = toggleTemplateSelection;
window.toggleAllTemplateSelections = toggleAllTemplateSelections;
window.bulkTemplateAction = bulkTemplateAction;
window.runDiagnostics = runDiagnostics;
window.repairDiagnostics = repairDiagnostics;
window.exportDiagnostics = exportDiagnostics;
window.exportSupportBundle = exportSupportBundle;
window.copyIssueReport = copyIssueReport;
window.runConflictInspector = runConflictInspector;
window.checkForUpdatesNow = checkForUpdatesNow;
window.moveFolderRow = moveFolderRow;
window.handleFolderRowKeydown = handleFolderRowKeydown;
window.toggleFolderPin = toggleFolderPin;
window.copyFolderId = copyFolderId;
window.toggleDockerUpdatesFilter = toggleDockerUpdatesFilter;
window.toggleHealthSeverityFilter = toggleHealthSeverityFilter;
window.toggleStatusFilter = toggleStatusFilter;
window.clearFolderTableFilters = clearFolderTableFilters;
window.setHealthFolderFilter = setHealthFolderFilter;
window.refreshPerformanceDiagnostics = renderPerformanceDiagnostics;
window.runQuickSetupWizard = runQuickSetupWizard;
window.setSettingsMode = setSettingsMode;

(async () => {
    try {
        settingsUiState.mode = localStorage.getItem(UI_MODE_STORAGE_KEY) === 'advanced' ? 'advanced' : 'basic';
        setAdvancedTab(localStorage.getItem(ADVANCED_TAB_STORAGE_KEY) || 'automation', false);
        settingsUiState.searchAllAdvanced = localStorage.getItem(SEARCH_ALL_ADVANCED_STORAGE_KEY) === '1';
        settingsUiState.activeSectionKey = String(localStorage.getItem(ADVANCED_SECTION_STORAGE_KEY) || '').trim();
        const expandedRaw = localStorage.getItem(ADVANCED_EXPANDED_STORAGE_KEY);
        const knownRaw = localStorage.getItem(ADVANCED_KNOWN_STORAGE_KEY);
        settingsUiState.hasExpandedAdvancedPreference = expandedRaw !== null;
        if (expandedRaw !== null) {
            try {
                const expanded = JSON.parse(expandedRaw);
                settingsUiState.expandedAdvancedSections = new Set(
                    Array.isArray(expanded) ? expanded.map((key) => String(key || '').trim()).filter((key) => key !== '') : []
                );
            } catch (_error) {
                settingsUiState.hasExpandedAdvancedPreference = false;
                settingsUiState.expandedAdvancedSections = new Set();
            }
        } else {
            settingsUiState.expandedAdvancedSections = new Set();
        }
        if (knownRaw !== null) {
            try {
                const known = JSON.parse(knownRaw);
                settingsUiState.knownAdvancedSections = new Set(
                    Array.isArray(known) ? known.map((key) => String(key || '').trim()).filter((key) => key !== '') : []
                );
            } catch (_error) {
                settingsUiState.knownAdvancedSections = new Set();
            }
        } else {
            settingsUiState.knownAdvancedSections = new Set();
        }
        initSettingsControls();
        initOverflowGuard();
        renderPerformanceDiagnostics();
        await fetchPluginVersion();
        await refreshAll();
        const serverMode = getServerSettingsMode();
        if (serverMode) {
            settingsUiState.mode = serverMode;
        }
        refreshSettingsUx();
        captureSettingsBaseline();
        if (settingsUiState.mode) {
            setSettingsMode(settingsUiState.mode);
        }
        if (isWizardCompletedServerSide()) {
            markSetupAssistantCompletedLocal();
        } else if (hasExistingPluginData()) {
            markSetupAssistantCompletedLocal();
            await persistSetupPrefsToServer({
                mode: settingsUiState.mode,
                completed: true
            });
        }
        const shouldRunWizard = !isWizardCompletedServerSide() && !isSetupAssistantCompletedLocal();
        if (shouldRunWizard) {
            runQuickSetupWizard(false);
        } else {
            await maybeShowUpdateNotesPanel();
        }
        settingsUiState.initialized = true;
    } catch (error) {
        showError('Initialization failed', error);
    }
})();
