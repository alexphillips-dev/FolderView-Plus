// FolderView Plus setup assistant module.
// Extracted from folderviewplus.js to keep core settings runtime easier to maintain.

const createSetupAssistantImportPlan = () => ({
    include: false,
    mode: 'merge',
    fileName: '',
    fileSizeBytes: 0,
    fileLastModified: '',
    parsed: null,
    summary: null,
    operations: null,
    diffRows: [],
    warnings: [],
    error: ''
});

const normalizeSetupAssistantExperienceMode = (value) => (
    SETUP_ASSISTANT_EXPERIENCE_MODES.has(String(value || ''))
        ? String(value || '')
        : 'guided'
);

const normalizeSetupAssistantSafetyMode = (value) => (
    SETUP_ASSISTANT_APPLY_SAFETY_MODES.has(String(value || ''))
        ? String(value || '')
        : 'auto'
);

const SETUP_ASSISTANT_CONTRAST_PREFERENCES = new Set(['auto', 'normal', 'high', 'max']);
const SETUP_ASSISTANT_CONTRAST_TIER_SEQUENCE = Object.freeze(['normal', 'high', 'max']);
const SETUP_ASSISTANT_CONTRAST_TARGETS = Object.freeze([
    { selector: '.fv-setup-assistant-head h4', minRatio: 4.5 },
    { selector: '.fv-setup-card h4', minRatio: 4.5 },
    { selector: '.fv-setup-muted', minRatio: 4.0 },
    { selector: '.fv-setup-step-label', minRatio: 4.0 },
    { selector: '.fv-setup-chip', minRatio: 3.5 }
]);

let setupAssistantViewportAccessibilityBound = false;

const normalizeSetupAssistantContrastPreference = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return SETUP_ASSISTANT_CONTRAST_PREFERENCES.has(normalized) ? normalized : 'auto';
};

const normalizeSetupAssistantContrastTier = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return SETUP_ASSISTANT_CONTRAST_TIER_SEQUENCE.includes(normalized) ? normalized : 'normal';
};

const isSetupAssistantCompactViewport = () => {
    const bodyCompact = document?.body?.classList?.contains('fv-mobile-compact') === true;
    if (bodyCompact) {
        return true;
    }
    try {
        return window.matchMedia('(max-width: 860px)').matches;
    } catch (_error) {
        return window.innerWidth <= 860;
    }
};

const parseSetupAssistantCssColor = (value) => {
    const text = String(value || '').trim().toLowerCase();
    if (!text || text === 'transparent') {
        return null;
    }
    const rgbaMatch = text.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
    if (rgbaMatch) {
        return {
            r: Math.max(0, Math.min(255, Number(rgbaMatch[1]) || 0)),
            g: Math.max(0, Math.min(255, Number(rgbaMatch[2]) || 0)),
            b: Math.max(0, Math.min(255, Number(rgbaMatch[3]) || 0)),
            a: Math.max(0, Math.min(1, rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]) || 0))
        };
    }
    const hexMatch = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!hexMatch) {
        return null;
    }
    const hex = hexMatch[1];
    if (hex.length === 3) {
        return {
            r: parseInt(`${hex[0]}${hex[0]}`, 16),
            g: parseInt(`${hex[1]}${hex[1]}`, 16),
            b: parseInt(`${hex[2]}${hex[2]}`, 16),
            a: 1
        };
    }
    if (hex.length === 6 || hex.length === 8) {
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: hex.length === 8 ? Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 1000) / 1000 : 1
        };
    }
    return null;
};

const blendSetupAssistantColor = (foreground, background) => {
    const alpha = Math.max(0, Math.min(1, Number(foreground?.a ?? 1)));
    return {
        r: (foreground.r * alpha) + (background.r * (1 - alpha)),
        g: (foreground.g * alpha) + (background.g * (1 - alpha)),
        b: (foreground.b * alpha) + (background.b * (1 - alpha)),
        a: 1
    };
};

const setupAssistantColorToLinear = (channel) => {
    const value = Math.max(0, Math.min(255, Number(channel) || 0)) / 255;
    return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
};

const getSetupAssistantLuminance = (color) => (
    (0.2126 * setupAssistantColorToLinear(color.r))
    + (0.7152 * setupAssistantColorToLinear(color.g))
    + (0.0722 * setupAssistantColorToLinear(color.b))
);

const getSetupAssistantContrastRatio = (foreground, background) => {
    const light = Math.max(getSetupAssistantLuminance(foreground), getSetupAssistantLuminance(background));
    const dark = Math.min(getSetupAssistantLuminance(foreground), getSetupAssistantLuminance(background));
    return (light + 0.05) / (dark + 0.05);
};

const isSetupAssistantElementVisible = (element) => {
    if (!element) {
        return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) {
        return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
};

const resolveSetupAssistantBackgroundColor = (element, fallback) => {
    let current = element;
    let color = fallback;
    while (current && current !== document.body) {
        const parsed = parseSetupAssistantCssColor(window.getComputedStyle(current).backgroundColor);
        if (parsed && parsed.a > 0) {
            color = blendSetupAssistantColor(parsed, color);
            if (parsed.a >= 0.98) {
                break;
            }
        }
        current = current.parentElement;
    }
    return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: 1
    };
};

const evaluateSetupAssistantContrast = (dialog) => {
    const fallback = parseSetupAssistantCssColor(window.getComputedStyle(dialog).backgroundColor)
        || { r: 10, g: 14, b: 20, a: 1 };
    let minimumRatio = Number.POSITIVE_INFINITY;
    const failures = [];
    for (const target of SETUP_ASSISTANT_CONTRAST_TARGETS) {
        const elements = Array.from(dialog.querySelectorAll(target.selector)).filter((element) => isSetupAssistantElementVisible(element));
        if (!elements.length) {
            continue;
        }
        const sample = elements[0];
        const foreground = parseSetupAssistantCssColor(window.getComputedStyle(sample).color);
        if (!foreground) {
            continue;
        }
        const background = resolveSetupAssistantBackgroundColor(sample, fallback);
        const ratio = getSetupAssistantContrastRatio({ ...foreground, a: 1 }, background);
        minimumRatio = Math.min(minimumRatio, ratio);
        if (ratio < target.minRatio) {
            failures.push({
                selector: target.selector,
                ratio,
                minRatio: target.minRatio
            });
        }
    }
    return {
        minRatio: Number.isFinite(minimumRatio) ? minimumRatio : 21,
        failures,
        pass: failures.length === 0
    };
};

const applySetupAssistantContrastTier = () => {
    const dialog = document.querySelector('#fv-setup-assistant-dialog');
    if (!dialog || setupAssistantState.open !== true) {
        return;
    }
    const preference = normalizeSetupAssistantContrastPreference(setupAssistantState.contrastPreference);
    const candidates = preference === 'auto'
        ? SETUP_ASSISTANT_CONTRAST_TIER_SEQUENCE
        : [normalizeSetupAssistantContrastTier(preference)];
    let chosenTier = candidates[candidates.length - 1] || 'normal';
    let chosenReport = null;

    for (const tier of candidates) {
        dialog.setAttribute('data-fv-wizard-contrast-tier', tier);
        const report = evaluateSetupAssistantContrast(dialog);
        chosenReport = report;
        chosenTier = tier;
        if (report.pass) {
            break;
        }
    }

    setupAssistantState.contrastPreference = preference;
    setupAssistantState.contrastTierApplied = chosenTier;
    setupAssistantState.lastContrastReport = chosenReport;
    dialog.setAttribute('data-fv-wizard-contrast-tier', chosenTier);
    dialog.setAttribute('data-fv-wizard-contrast-auto', preference === 'auto' ? '1' : '0');
    dialog.setAttribute('data-fv-wizard-contrast-score', String((chosenReport?.minRatio || 0).toFixed(2)));
};

const cycleSetupAssistantContrastPreference = () => {
    const ordered = ['auto', 'normal', 'high', 'max'];
    const current = normalizeSetupAssistantContrastPreference(setupAssistantState.contrastPreference);
    const index = ordered.indexOf(current);
    const next = ordered[(index + 1) % ordered.length];
    setupAssistantState.contrastPreference = next;
    renderSetupAssistant();
};

const decorateSetupAssistantChipRows = () => {
    const root = document.getElementById('fv-setup-assistant-content');
    if (!root) {
        return;
    }
    const compact = isSetupAssistantCompactViewport();
    if (!setupAssistantState.collapsedChipRows || typeof setupAssistantState.collapsedChipRows !== 'object') {
        setupAssistantState.collapsedChipRows = {};
    }
    const rows = root.querySelectorAll('.fv-setup-chip-row[data-fv-chip-collapsible="1"]');
    rows.forEach((row, rowIndex) => {
        const chips = Array.from(row.querySelectorAll('.fv-setup-chip'));
        const maxVisible = Math.max(2, Number(row.getAttribute('data-fv-chip-max')) || 4);
        const rowKey = String(row.getAttribute('data-fv-chip-key') || `row-${rowIndex + 1}`);
        row.setAttribute('data-fv-chip-key', rowKey);
        row.classList.remove('is-collapsible', 'is-collapsed');
        chips.forEach((chip) => chip.classList.remove('is-chip-hidden'));
        const nextSibling = row.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('fv-setup-chip-toggle')) {
            nextSibling.remove();
        }
        if (!compact || chips.length <= maxVisible) {
            delete setupAssistantState.collapsedChipRows[rowKey];
            return;
        }
        const collapsed = setupAssistantState.collapsedChipRows[rowKey] !== false;
        row.classList.add('is-collapsible');
        if (collapsed) {
            row.classList.add('is-collapsed');
            chips.slice(maxVisible).forEach((chip) => chip.classList.add('is-chip-hidden'));
        }
        const hiddenCount = Math.max(0, chips.length - maxVisible);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'fv-setup-chip-toggle';
        toggle.setAttribute('data-fv-chip-toggle', rowKey);
        toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        toggle.innerHTML = collapsed
            ? `<i class="fa fa-angle-down"></i> Show ${hiddenCount} more`
            : '<i class="fa fa-angle-up"></i> Show fewer';
        row.insertAdjacentElement('afterend', toggle);
    });
};

const bindSetupAssistantViewportAccessibilityHandlers = () => {
    if (setupAssistantViewportAccessibilityBound) {
        return;
    }
    const rerun = () => {
        if (setupAssistantState.open !== true) {
            return;
        }
        decorateSetupAssistantChipRows();
        applySetupAssistantContrastTier();
    };
    $(window).off('resize.fvsetupwizardaccess').on('resize.fvsetupwizardaccess', () => {
        window.requestAnimationFrame(rerun);
    });
    setupAssistantViewportAccessibilityBound = true;
};

const detectSetupAssistantDefaultsFromContext = (context = null) => {
    const source = context && typeof context === 'object' ? context : {};
    const dockerFolders = Math.max(0, Number(source.dockerFolders) || 0);
    const vmFolders = Math.max(0, Number(source.vmFolders) || 0);
    const totalFolders = dockerFolders + vmFolders;
    const totalRules = Math.max(0, Number(source.dockerRules) || 0) + Math.max(0, Number(source.vmRules) || 0);
    const totalBackups = Math.max(0, Number(source.dockerBackups) || 0) + Math.max(0, Number(source.vmBackups) || 0);
    const hasExistingData = source.hasExistingData === true || totalFolders > 0 || totalRules > 0;

    let route = hasExistingData ? 'migrate' : 'new';
    let mode = hasExistingData ? 'advanced' : 'basic';
    let quickPreset = 'balanced';
    const reasonParts = [];

    if (totalFolders >= 20 || totalRules >= 16) {
        quickPreset = 'power';
        reasonParts.push('large environment detected');
    } else if (dockerFolders >= 10 && vmFolders <= 2) {
        quickPreset = 'media_stack';
        reasonParts.push('docker-heavy media layout detected');
    } else if (!hasExistingData) {
        quickPreset = 'balanced';
    }

    if (!hasExistingData) {
        route = 'new';
        mode = 'basic';
        reasonParts.push('no existing folders or rules found');
    } else if (totalBackups >= 4) {
        route = 'migrate';
        mode = 'advanced';
        reasonParts.push('existing backups available');
    } else if (totalFolders >= 8 || totalRules >= 8) {
        route = 'advanced';
        mode = 'advanced';
        reasonParts.push('existing setup likely needs fine tuning');
    } else {
        route = 'migrate';
        mode = 'basic';
        reasonParts.push('existing setup found');
    }

    return {
        route: ['new', 'migrate', 'advanced'].includes(route) ? route : 'new',
        mode: mode === 'advanced' ? 'advanced' : 'basic',
        quickPreset: normalizeQuickProfilePresetId(quickPreset, 'balanced'),
        reason: reasonParts.join('; ')
    };
};

const getSetupAssistantStepSequence = (routeOverride = null) => {
    const route = ['new', 'migrate', 'advanced'].includes(String(routeOverride || setupAssistantState.route || ''))
        ? String(routeOverride || setupAssistantState.route)
        : 'new';
    if (route === 'new') {
        const hasNewRouteImports = ['docker', 'vm'].some((type) => {
            const plan = setupAssistantState?.importPlans?.[type];
            return Boolean(plan?.parsed) || plan?.include === true;
        });
        if (hasNewRouteImports) {
            return SETUP_ASSISTANT_STEPS;
        }
    }
    const sequence = SETUP_ASSISTANT_STEPS_BY_ROUTE[route];
    if (Array.isArray(sequence) && sequence.length > 0) {
        return sequence;
    }
    return SETUP_ASSISTANT_STEPS;
};

const formatBytesShort = (bytes) => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) {
        return '';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    const rounded = size >= 100 || index === 0 ? Math.round(size) : Number(size.toFixed(1));
    return `${rounded} ${units[index]}`;
};

const getSetupAssistantImportFormatLabel = (parsed) => {
    if (!parsed || typeof parsed !== 'object') {
        return 'No import selected';
    }
    if (parsed.legacy === true) {
        return 'Legacy format (folder.view2/folder.view3)';
    }
    if (Number.isFinite(Number(parsed.schemaVersion))) {
        return `Schema v${Number(parsed.schemaVersion)} (FolderView Plus)`;
    }
    return 'Custom/unknown format';
};

const resolveImportTrustInfo = (parsed) => {
    const trustValue = parsed && typeof parsed === 'object' && parsed.trust && typeof parsed.trust === 'object'
        ? parsed.trust
        : {};
    const rawLevel = String(trustValue.level || '').trim().toLowerCase();
    let level = 'trusted';
    if (rawLevel === 'legacy' || rawLevel === 'untrusted') {
        level = rawLevel;
    } else if (parsed?.legacy === true) {
        level = 'legacy';
    }

    const defaultLabels = {
        trusted: 'Validated schema',
        legacy: 'Legacy compatibility',
        untrusted: 'Validation warning'
    };
    const label = String(trustValue.label || '').trim() || defaultLabels[level];
    const reason = String(trustValue.reason || '').trim();
    return {
        level,
        label,
        reason
    };
};

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

const normalizeSetupAssistantQuickPresetState = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'custom') {
        return 'custom';
    }
    return normalizeQuickProfilePresetId(raw, 'balanced');
};

const applySetupAssistantQuickPresetToState = (presetId) => {
    const key = normalizeQuickProfilePresetId(presetId, 'balanced');
    const preset = QUICK_PROFILE_PRESETS[key] || QUICK_PROFILE_PRESETS.balanced;
    const profileKey = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, preset.profile)
        ? preset.profile
        : 'balanced';
    const envKey = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_ENV_PRESETS, preset.environment)
        ? preset.environment
        : 'home_lab';
    const envBehavior = SETUP_ASSISTANT_ENV_PRESETS[envKey]?.behavior || {};

    setupAssistantState.quickPreset = key;
    setupAssistantState.presetDraftName = `${key}-profile`;
    setupAssistantState.profile = profileKey;
    setupAssistantState.environmentPreset = envKey;
    setupAssistantState.applyProfileDefaults = true;
    setupAssistantState.applyEnvironmentDefaults = true;
    setupAssistantState.behavior = {
        docker: normalizeSetupAssistantBehaviorFromValue('docker', envBehavior.docker || {}),
        vm: normalizeSetupAssistantBehaviorFromValue('vm', envBehavior.vm || {})
    };

    for (const type of ['docker', 'vm']) {
        const overrides = preset?.overridesByType?.[type] || null;
        if (!overrides || typeof overrides !== 'object') {
            continue;
        }
        const current = {
            ...(setupAssistantState.behavior?.[type] || {})
        };
        if (Object.prototype.hasOwnProperty.call(overrides, 'hideEmptyFolders')) {
            current.hideEmptyFolders = overrides.hideEmptyFolders === true;
        }
        if (overrides.health && typeof overrides.health === 'object') {
            if (Object.prototype.hasOwnProperty.call(overrides.health, 'cardsEnabled')) {
                current.healthCardsEnabled = overrides.health.cardsEnabled === true;
            }
            if (Object.prototype.hasOwnProperty.call(overrides.health, 'runtimeBadgeEnabled')) {
                current.runtimeBadgeEnabled = overrides.health.runtimeBadgeEnabled === true;
            }
        }
        setupAssistantState.behavior[type] = normalizeSetupAssistantBehaviorFromValue(type, current);
    }
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
    experienceMode: normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode),
    applySafetyMode: normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode),
    selectedPresetId: String(setupAssistantState.selectedPresetId || ''),
    presetDraftName: String(setupAssistantState.presetDraftName || ''),
    quickPreset: normalizeSetupAssistantQuickPresetState(setupAssistantState.quickPreset),
    profile: String(setupAssistantState.profile || 'balanced'),
    applyProfileDefaults: setupAssistantState.applyProfileDefaults === true,
    environmentPreset: normalizeSetupAssistantEnvironmentPreset(setupAssistantState.environmentPreset),
    applyEnvironmentDefaults: setupAssistantState.applyEnvironmentDefaults !== false,
    dryRunOnly: setupAssistantState.dryRunOnly === true,
    focusModeEnabled: setupAssistantState.focusModeEnabled !== false,
    contrastPreference: normalizeSetupAssistantContrastPreference(setupAssistantState.contrastPreference),
    contrastTierApplied: normalizeSetupAssistantContrastTier(setupAssistantState.contrastTierApplied),
    collapsedChipRows: setupAssistantState.collapsedChipRows && typeof setupAssistantState.collapsedChipRows === 'object'
        ? { ...setupAssistantState.collapsedChipRows }
        : {},
    importPlans: {
        docker: {
            include: setupAssistantState.importPlans?.docker?.include === true,
            mode: normalizeImportMode(setupAssistantState.importPlans?.docker?.mode),
            fileName: String(setupAssistantState.importPlans?.docker?.fileName || ''),
            fileSizeBytes: Number(setupAssistantState.importPlans?.docker?.fileSizeBytes) || 0,
            fileLastModified: String(setupAssistantState.importPlans?.docker?.fileLastModified || ''),
            parsed: setupAssistantState.importPlans?.docker?.parsed || null
        },
        vm: {
            include: setupAssistantState.importPlans?.vm?.include === true,
            mode: normalizeImportMode(setupAssistantState.importPlans?.vm?.mode),
            fileName: String(setupAssistantState.importPlans?.vm?.fileName || ''),
            fileSizeBytes: Number(setupAssistantState.importPlans?.vm?.fileSizeBytes) || 0,
            fileLastModified: String(setupAssistantState.importPlans?.vm?.fileLastModified || ''),
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

const readSetupAssistantPresetStore = () => {
    try {
        const raw = localStorage.getItem(SETUP_ASSISTANT_PRESETS_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry) => (
            entry
            && typeof entry === 'object'
            && String(entry.id || '').trim()
            && String(entry.name || '').trim()
            && entry.payload
            && typeof entry.payload === 'object'
        )).slice(0, SETUP_ASSISTANT_PRESETS_MAX);
    } catch (_error) {
        return [];
    }
};

const writeSetupAssistantPresetStore = (rows) => {
    const safeRows = Array.isArray(rows) ? rows.slice(0, SETUP_ASSISTANT_PRESETS_MAX) : [];
    try {
        localStorage.setItem(SETUP_ASSISTANT_PRESETS_STORAGE_KEY, JSON.stringify(safeRows));
    } catch (_error) {
        // Ignore localStorage failures; wizard remains fully usable.
    }
};

const buildSetupAssistantPresetPayload = () => ({
    route: String(setupAssistantState.route || 'new'),
    mode: String(setupAssistantState.mode || 'basic'),
    experienceMode: normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode),
    applySafetyMode: normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode),
    quickPreset: normalizeSetupAssistantQuickPresetState(setupAssistantState.quickPreset),
    profile: String(setupAssistantState.profile || 'balanced'),
    applyProfileDefaults: setupAssistantState.applyProfileDefaults === true,
    environmentPreset: normalizeSetupAssistantEnvironmentPreset(setupAssistantState.environmentPreset),
    applyEnvironmentDefaults: setupAssistantState.applyEnvironmentDefaults !== false,
    dryRunOnly: setupAssistantState.dryRunOnly === true,
    focusModeEnabled: setupAssistantState.focusModeEnabled !== false,
    contrastPreference: normalizeSetupAssistantContrastPreference(setupAssistantState.contrastPreference),
    importPlans: {
        docker: {
            include: setupAssistantState.importPlans?.docker?.include === true,
            mode: normalizeImportMode(setupAssistantState.importPlans?.docker?.mode)
        },
        vm: {
            include: setupAssistantState.importPlans?.vm?.include === true,
            mode: normalizeImportMode(setupAssistantState.importPlans?.vm?.mode)
        }
    },
    ruleBootstrap: {
        docker: {
            enabled: setupAssistantState.ruleBootstrap?.docker?.enabled === true
        },
        vm: {
            enabled: setupAssistantState.ruleBootstrap?.vm?.enabled === true
        }
    },
    behavior: {
        docker: normalizeSetupAssistantBehaviorFromValue('docker', setupAssistantState.behavior?.docker || {}),
        vm: normalizeSetupAssistantBehaviorFromValue('vm', setupAssistantState.behavior?.vm || {})
    }
});

const applySetupAssistantPresetPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    setupAssistantState.route = ['new', 'migrate', 'advanced'].includes(String(payload.route || ''))
        ? String(payload.route)
        : setupAssistantState.route;
    setupAssistantState.mode = String(payload.mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
    setupAssistantState.experienceMode = normalizeSetupAssistantExperienceMode(payload.experienceMode);
    setupAssistantState.applySafetyMode = normalizeSetupAssistantSafetyMode(payload.applySafetyMode);
    setupAssistantState.quickPreset = normalizeSetupAssistantQuickPresetState(payload.quickPreset);
    setupAssistantState.profile = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, String(payload.profile || ''))
        ? String(payload.profile)
        : setupAssistantState.profile;
    setupAssistantState.applyProfileDefaults = payload.applyProfileDefaults === true;
    setupAssistantState.environmentPreset = normalizeSetupAssistantEnvironmentPreset(payload.environmentPreset);
    setupAssistantState.applyEnvironmentDefaults = payload.applyEnvironmentDefaults !== false;
    setupAssistantState.dryRunOnly = payload.dryRunOnly === true;
    setupAssistantState.focusModeEnabled = payload.focusModeEnabled !== false;
    setupAssistantState.contrastPreference = normalizeSetupAssistantContrastPreference(payload.contrastPreference);
    setupAssistantState.collapsedChipRows = {};

    for (const type of ['docker', 'vm']) {
        const incomingPlan = payload.importPlans?.[type];
        if (incomingPlan && typeof incomingPlan === 'object') {
            setupAssistantState.importPlans[type].include = incomingPlan.include === true;
            setupAssistantState.importPlans[type].mode = normalizeImportMode(incomingPlan.mode);
            summarizeSetupAssistantImportPlan(type);
        }
        const incomingRules = payload.ruleBootstrap?.[type];
        if (incomingRules && typeof incomingRules === 'object') {
            setupAssistantState.ruleBootstrap[type].enabled = incomingRules.enabled === true;
        }
        const incomingBehavior = payload.behavior?.[type];
        if (incomingBehavior && typeof incomingBehavior === 'object') {
            setupAssistantState.behavior[type] = normalizeSetupAssistantBehaviorFromValue(type, incomingBehavior);
        }
    }
    clampSetupAssistantStep();
    return true;
};

const saveCurrentSetupAssistantPreset = (name) => {
    const label = String(name || '').trim();
    if (!label) {
        return {
            ok: false,
            error: 'Preset name is required.'
        };
    }
    const nextEntry = {
        id: `setup-preset-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name: label.slice(0, 60),
        savedAt: new Date().toISOString(),
        payload: buildSetupAssistantPresetPayload()
    };
    const existing = readSetupAssistantPresetStore();
    const deduped = existing.filter((entry) => String(entry.name || '').trim().toLowerCase() !== nextEntry.name.toLowerCase());
    deduped.unshift(nextEntry);
    writeSetupAssistantPresetStore(deduped);
    return {
        ok: true,
        id: nextEntry.id,
        name: nextEntry.name
    };
};

const loadSetupAssistantPresetById = (presetId) => {
    const key = String(presetId || '').trim();
    if (!key) {
        return false;
    }
    const existing = readSetupAssistantPresetStore();
    const selected = existing.find((entry) => String(entry.id || '') === key);
    if (!selected) {
        return false;
    }
    return applySetupAssistantPresetPayload(selected.payload || {});
};

const deleteSetupAssistantPresetById = (presetId) => {
    const key = String(presetId || '').trim();
    if (!key) {
        return false;
    }
    const existing = readSetupAssistantPresetStore();
    const next = existing.filter((entry) => String(entry.id || '') !== key);
    if (next.length === existing.length) {
        return false;
    }
    writeSetupAssistantPresetStore(next);
    return true;
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

    const restoredRoute = ['new', 'migrate', 'advanced'].includes(String(parsed.route || ''))
        ? String(parsed.route)
        : setupAssistantState.route;
    setupAssistantState.route = restoredRoute;
    const stepSequence = getSetupAssistantStepSequence(restoredRoute);
    setupAssistantState.step = Math.max(0, Math.min(stepSequence.length - 1, Number(parsed.step) || 0));
    setupAssistantState.mode = String(parsed.mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
    setupAssistantState.experienceMode = normalizeSetupAssistantExperienceMode(parsed.experienceMode);
    setupAssistantState.applySafetyMode = normalizeSetupAssistantSafetyMode(parsed.applySafetyMode);
    setupAssistantState.selectedPresetId = String(parsed.selectedPresetId || '');
    setupAssistantState.presetDraftName = String(parsed.presetDraftName || '');
    setupAssistantState.quickPreset = normalizeSetupAssistantQuickPresetState(parsed.quickPreset);
    if (!setupAssistantState.presetDraftName) {
        setupAssistantState.presetDraftName = `${setupAssistantState.quickPreset}-profile`;
    }
    setupAssistantState.profile = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, String(parsed.profile || ''))
        ? String(parsed.profile)
        : setupAssistantState.profile;
    setupAssistantState.applyProfileDefaults = parsed.applyProfileDefaults === true;
    setupAssistantState.environmentPreset = normalizeSetupAssistantEnvironmentPreset(parsed.environmentPreset);
    setupAssistantState.applyEnvironmentDefaults = parsed.applyEnvironmentDefaults !== false;
    setupAssistantState.dryRunOnly = parsed.dryRunOnly === true;
    setupAssistantState.focusModeEnabled = parsed.focusModeEnabled !== false;
    setupAssistantState.contrastPreference = normalizeSetupAssistantContrastPreference(parsed.contrastPreference);
    setupAssistantState.contrastTierApplied = normalizeSetupAssistantContrastTier(parsed.contrastTierApplied);
    setupAssistantState.collapsedChipRows = parsed.collapsedChipRows && typeof parsed.collapsedChipRows === 'object'
        ? { ...parsed.collapsedChipRows }
        : {};

    for (const type of ['docker', 'vm']) {
        const incomingPlan = parsed.importPlans?.[type];
        if (incomingPlan && typeof incomingPlan === 'object') {
            setupAssistantState.importPlans[type] = {
                ...createSetupAssistantImportPlan(),
                include: incomingPlan.include === true,
                mode: normalizeImportMode(incomingPlan.mode),
                fileName: String(incomingPlan.fileName || ''),
                fileSizeBytes: Math.max(0, Number(incomingPlan.fileSizeBytes) || 0),
                fileLastModified: String(incomingPlan.fileLastModified || ''),
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

const applyDetectedSetupAssistantDefaults = () => {
    setupAssistantState.route = ['new', 'migrate', 'advanced'].includes(setupAssistantState.suggestedRoute)
        ? setupAssistantState.suggestedRoute
        : setupAssistantState.route;
    setupAssistantState.mode = setupAssistantState.suggestedMode === 'advanced' ? 'advanced' : 'basic';
    setupAssistantState.quickPreset = normalizeQuickProfilePresetId(setupAssistantState.suggestedQuickPreset, 'balanced');
    setupAssistantState.presetDraftName = `${setupAssistantState.quickPreset}-profile`;
    if (Object.prototype.hasOwnProperty.call(QUICK_PROFILE_PRESETS, setupAssistantState.quickPreset)) {
        applySetupAssistantQuickPresetToState(setupAssistantState.quickPreset);
    }
    setupAssistantState.applyProfileDefaults = setupAssistantState.route !== 'migrate';
    setupAssistantState.applyEnvironmentDefaults = setupAssistantState.route !== 'migrate';
    if (setupAssistantState.applyEnvironmentDefaults) {
        applySetupAssistantEnvironmentPresetToState();
    }
    summarizeSetupAssistantImportPlan('docker');
    summarizeSetupAssistantImportPlan('vm');
    refreshSetupAssistantRuleSuggestions();
    clampSetupAssistantStep();
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
    const detectedDefaults = detectSetupAssistantDefaultsFromContext({
        dockerFolders,
        vmFolders,
        dockerRules,
        vmRules,
        dockerBackups,
        vmBackups,
        dockerTemplates,
        vmTemplates,
        hasExistingData
    });
    const route = detectedDefaults.route;

    setupAssistantState.open = true;
    setupAssistantState.force = force === true;
    setupAssistantState.step = 0;
    setupAssistantState.busy = false;
    setupAssistantState.applying = false;
    setupAssistantState.progressLabel = '';
    setupAssistantState.progressPercent = 0;
    setupAssistantState.route = route;
    setupAssistantState.mode = detectedDefaults.mode || mode;
    setupAssistantState.experienceMode = 'guided';
    setupAssistantState.applySafetyMode = 'auto';
    setupAssistantState.quickPreset = normalizeQuickProfilePresetId(detectedDefaults.quickPreset, 'balanced');
    setupAssistantState.profile = QUICK_PROFILE_PRESETS?.[setupAssistantState.quickPreset]?.profile || 'balanced';
    setupAssistantState.applyProfileDefaults = route !== 'migrate';
    setupAssistantState.environmentPreset = 'home_lab';
    setupAssistantState.applyEnvironmentDefaults = route !== 'migrate';
    setupAssistantState.dryRunOnly = false;
    setupAssistantState.focusModeEnabled = true;
    setupAssistantState.contrastPreference = 'auto';
    setupAssistantState.contrastTierApplied = 'normal';
    setupAssistantState.lastContrastReport = null;
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
    setupAssistantState.suggestedRoute = route;
    setupAssistantState.suggestedMode = setupAssistantState.mode;
    setupAssistantState.suggestedQuickPreset = setupAssistantState.quickPreset;
    setupAssistantState.suggestedReason = detectedDefaults.reason || '';
    setupAssistantState.selectedPresetId = '';
    setupAssistantState.presetDraftName = `${setupAssistantState.quickPreset}-profile`;
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
    if (Object.prototype.hasOwnProperty.call(QUICK_PROFILE_PRESETS, setupAssistantState.quickPreset)) {
        applySetupAssistantQuickPresetToState(setupAssistantState.quickPreset);
        setupAssistantState.applyProfileDefaults = route !== 'migrate';
        setupAssistantState.applyEnvironmentDefaults = route !== 'migrate';
    }
    if (setupAssistantState.applyEnvironmentDefaults === true || route === 'new') {
        applySetupAssistantEnvironmentPresetToState();
    }
    if (setupAssistantState.applyEnvironmentDefaults !== true && route !== 'new') {
        setupAssistantState.behavior = {
            docker: createSetupAssistantBehavior('docker'),
            vm: createSetupAssistantBehavior('vm')
        };
    }
    setupAssistantState.reviewNotes = [];
    setupAssistantState.impactBaseline = buildSetupAssistantImpactSummary();
    setupAssistantState.lastApplyReport = null;
    setupAssistantState.rollbackCheckpointName = '';
    setupAssistantState.draftRestored = false;
    setupAssistantState.restoredDraftSavedAt = '';
    setupAssistantState.mobileSidebarSummaryOpen = false;
    setupAssistantState.collapsedChipRows = {};
};

const clampSetupAssistantStep = () => {
    const maxStep = getSetupAssistantStepSequence().length - 1;
    setupAssistantState.step = Math.max(0, Math.min(maxStep, Number(setupAssistantState.step) || 0));
};

const currentSetupAssistantStepKey = () => {
    clampSetupAssistantStep();
    const sequence = getSetupAssistantStepSequence();
    return sequence[setupAssistantState.step] || 'welcome';
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

const getSetupAssistantEffectiveImportMode = (type) => {
    const resolvedType = normalizeManagedType(type);
    if (setupAssistantState.experienceMode !== 'expert') {
        return 'merge';
    }
    return normalizeImportMode(setupAssistantState.importPlans?.[resolvedType]?.mode);
};

const summarizeSetupAssistantImportPlan = (type) => {
    const resolvedType = normalizeManagedType(type);
    const plan = setupAssistantState.importPlans?.[resolvedType];
    if (!plan || !plan.parsed) {
        return null;
    }
    const folders = getFolderMap(resolvedType);
    const mode = getSetupAssistantEffectiveImportMode(resolvedType);
    const summary = utils.summarizeImport(folders, plan.parsed, mode);
    const operations = utils.buildImportOperations(folders, plan.parsed, mode);
    const diffRows = utils.buildImportDiffRows(folders, plan.parsed, mode);
    plan.summary = summary;
    plan.operations = operations;
    plan.diffRows = diffRows;
    plan.warnings = [];
    if (plan.parsed.legacy === true) {
        plan.warnings.push('Legacy export detected. Verify icon/settings fields before apply.');
    }
    const deletesCount = summary?.deletes?.length || 0;
    if (mode === 'replace' && deletesCount > 0) {
        plan.warnings.push(`Replace mode will delete ${deletesCount} existing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders.`);
    }
    const totalOps = countImportOperations(operations || { creates: [], upserts: [], deletes: [] });
    if (totalOps <= 0) {
        plan.warnings.push('No folder operations detected from this file.');
    }
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
    register('health profile', current?.health?.profile || 'balanced', next?.health?.profile || 'balanced');
    register('health updates mode', current?.health?.updatesMode || 'maintenance', next?.health?.updatesMode || 'maintenance');
    register('health all stopped mode', current?.health?.allStoppedMode || 'critical', next?.health?.allStoppedMode || 'critical');
    register('health critical %', Number(current?.health?.criticalStoppedPercent ?? 90), Number(next?.health?.criticalStoppedPercent ?? 90));
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

const getSetupAssistantImpactDelta = (currentImpact, baselineImpact = null) => {
    const current = currentImpact && typeof currentImpact === 'object'
        ? currentImpact
        : buildSetupAssistantImpactSummary();
    const baseline = baselineImpact && typeof baselineImpact === 'object'
        ? baselineImpact
        : (setupAssistantState.impactBaseline || {
            imports: { totals: { totalOps: 0, creates: 0, updates: 0, deletes: 0 } },
            prefs: { totalChanges: 0 },
            rules: { creatable: 0 },
            totalPlannedChanges: 0
        });
    const currentImports = Number(current.imports?.totals?.totalOps) || 0;
    const currentPrefs = Number(current.prefs?.totalChanges) || 0;
    const currentRules = Number(current.rules?.creatable) || 0;
    const currentTotal = Number(current.totalPlannedChanges) || 0;
    const baselineImports = Number(baseline.imports?.totals?.totalOps) || 0;
    const baselinePrefs = Number(baseline.prefs?.totalChanges) || 0;
    const baselineRules = Number(baseline.rules?.creatable) || 0;
    const baselineTotal = Number(baseline.totalPlannedChanges) || 0;

    return {
        imports: currentImports - baselineImports,
        prefs: currentPrefs - baselinePrefs,
        rules: currentRules - baselineRules,
        total: currentTotal - baselineTotal
    };
};

const getSetupAssistantStepDeltaSummary = (stepKey, deltaSummary = null) => {
    const delta = deltaSummary && typeof deltaSummary === 'object'
        ? deltaSummary
        : getSetupAssistantImpactDelta(buildSetupAssistantImpactSummary());
    const chips = [];
    const addChip = (label, value, className = '') => {
        const amount = Number(value) || 0;
        if (amount === 0) {
            return;
        }
        const prefix = amount > 0 ? '+' : '-';
        chips.push(`<span class="fv-setup-chip ${className}">${escapeHtml(label)} ${prefix}${Math.abs(amount)}</span>`);
    };

    if (stepKey === 'profile' || stepKey === 'behavior') {
        addChip('Settings', delta.prefs, 'is-update');
    } else if (stepKey === 'import') {
        addChip('Import ops', delta.imports, delta.imports < 0 ? 'is-delete' : 'is-update');
    } else if (stepKey === 'rules') {
        addChip('Starter rules', delta.rules, delta.rules < 0 ? 'is-delete' : 'is-create');
    } else if (stepKey === 'review' || stepKey === 'welcome') {
        addChip('Net impact', delta.total, delta.total < 0 ? 'is-delete' : 'is-update');
    }

    if (!chips.length) {
        return '<span class="fv-setup-chip">No delta on this step yet</span>';
    }
    return chips.join('');
};

const buildSetupAssistantStepStatusMap = () => {
    const sequence = getSetupAssistantStepSequence();
    return sequence.map((stepKey, index) => {
        const isCurrent = index === setupAssistantState.step;
        const isPast = index < setupAssistantState.step;
        const validation = isCurrent
            ? getSetupAssistantStepValidation(stepKey)
            : { blockers: [], warnings: [] };
        let status = 'ok';
        if (isPast) {
            status = 'complete';
        } else if (!isCurrent) {
            status = 'pending';
        } else if (validation.blockers.length > 0) {
            status = 'blocked';
        } else if (validation.warnings.length > 0) {
            status = 'warn';
        }
        return {
            key: stepKey,
            index,
            status,
            blockers: validation.blockers,
            warnings: validation.warnings
        };
    });
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
                if (plan.parsed?.legacy === true) {
                    warnings.push(`${type.toUpperCase()} import uses legacy format. Review diff before apply.`);
                }
                const planWarnings = Array.isArray(plan.warnings) ? plan.warnings : [];
                warnings.push(...planWarnings.map((message) => `${type.toUpperCase()}: ${message}`));
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

const buildSetupAssistantFixHints = (stepKey, validation) => {
    const step = String(stepKey || '').trim();
    const blockers = Array.isArray(validation?.blockers) ? validation.blockers : [];
    const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];
    const hints = [];
    const addHint = (text) => {
        const value = String(text || '').trim();
        if (!value || hints.includes(value)) {
            return;
        }
        hints.push(value);
    };

    blockers.forEach((message) => {
        if (/no file is selected/i.test(message)) {
            addHint('Use "Select Docker/VM export" and keep Include enabled only for files you want to apply.');
            return;
        }
        if (/requires at least one enabled import/i.test(message)) {
            addHint('For migrate flow, enable at least one Docker or VM import plan before continuing.');
            return;
        }
        if (/between 0 and 100/i.test(message)) {
            addHint('Set status warn threshold to a value from 0 to 100 (recommended: 60).');
            return;
        }
        if (/valid profile preset/i.test(message)) {
            addHint('Pick one of the available profile presets or disable "Apply profile defaults".');
            return;
        }
        if (/valid environment preset/i.test(message)) {
            addHint('Choose a listed environment preset or disable "Apply environment defaults".');
            return;
        }
        addHint(`Resolve: ${message}`);
    });

    warnings.forEach((message) => {
        if (/legacy format/i.test(message)) {
            addHint('Legacy imports are supported, but inspect the diff and icon/settings fields before applying.');
            return;
        }
        if (/replace mode will delete/i.test(message)) {
            addHint('Switch import mode to Merge for a safer pass, or keep Replace only if cleanup is intentional.');
            return;
        }
        if (/no changes are currently planned/i.test(message)) {
            addHint('Enable imports/rules or adjust behavior to produce at least one planned change.');
            return;
        }
        if (/dry run mode is on/i.test(message)) {
            addHint('Turn off Dry run only when you are ready to persist changes.');
            return;
        }
    });

    if (!hints.length && (step === 'welcome' || step === 'review')) {
        addHint('Use Focus mode for guided scanning and switch Contrast mode if text appears low-contrast.');
    }

    return hints.slice(0, 4);
};

const renderSetupAssistantInlineGuidance = (stepKey, validation) => {
    const hints = buildSetupAssistantFixHints(stepKey, validation);
    if (!hints.length) {
        return '';
    }
    const isBlocking = Array.isArray(validation?.blockers) && validation.blockers.length > 0;
    const toneClass = isBlocking ? 'is-blocking' : 'is-warning';
    const title = isBlocking ? 'How to fix before continuing' : 'Suggested improvements';
    return `
        <section class="fv-setup-inline-guidance ${toneClass}" role="status" aria-live="polite" aria-atomic="true">
            <div class="fv-setup-inline-guidance-title"><i class="fa fa-lightbulb-o"></i> ${escapeHtml(title)}</div>
            <ul>
                ${hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join('')}
            </ul>
        </section>
    `;
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
    const seen = new Set();
    const pushUnique = (text) => {
        const normalized = String(text || '').trim();
        if (!normalized || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        notes.push(normalized);
    };
    const reviewValidation = getSetupAssistantStepValidation('review');
    if (reviewValidation.blockers.length) {
        reviewValidation.blockers.forEach(pushUnique);
    }
    if (reviewValidation.warnings.length) {
        reviewValidation.warnings.forEach(pushUnique);
    }
    for (const type of ['docker', 'vm']) {
        const plan = setupAssistantState.importPlans[type];
        if (!plan?.include || !plan?.parsed) {
            continue;
        }
        const operationCount = countImportOperations(plan.operations || { creates: [], upserts: [], deletes: [] });
        if (operationCount === 0) {
            pushUnique(`${type.toUpperCase()} import file is loaded, but no folder changes were detected.`);
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

const setupAssistantStepStatusLabel = (status) => {
    if (status === 'pending') {
        return 'Next';
    }
    if (status === 'blocked') {
        return 'Blocked';
    }
    if (status === 'warn') {
        return 'Needs review';
    }
    if (status === 'complete') {
        return 'Done';
    }
    return 'Ready';
};

const setupAssistantStepStatusClass = (status) => {
    if (status === 'pending') {
        return 'is-pending';
    }
    if (status === 'blocked') {
        return 'is-blocked';
    }
    if (status === 'warn') {
        return 'is-warn';
    }
    if (status === 'complete') {
        return 'is-done';
    }
    return 'is-ready';
};

const renderSetupAssistantSidebarSummary = (impactSummary) => {
    const impact = impactSummary && typeof impactSummary === 'object'
        ? impactSummary
        : buildSetupAssistantImpactSummary();
    const importTotals = impact.imports?.totals || { totalOps: 0, creates: 0, updates: 0, deletes: 0 };
    const prefsTotal = Number(impact.prefs?.totalChanges) || 0;
    const rulesTotal = Number(impact.rules?.creatable) || 0;
    const hasDeletes = Number(importTotals.deletes) > 0;
    const routeLabel = setupAssistantState.route === 'migrate'
        ? 'Migration flow'
        : (setupAssistantState.route === 'advanced' ? 'Advanced flow' : 'New install flow');
    return `
        <section id="fv-setup-sidebar-summary" class="fv-setup-sidebar-summary">
            <h4>What will change</h4>
            <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="4" data-fv-chip-key="sidebar-summary">
                <span class="fv-setup-chip">${escapeHtml(routeLabel)}</span>
                <span class="fv-setup-chip">Mode: ${escapeHtml(setupAssistantState.mode)}</span>
                <span class="fv-setup-chip">Detail: ${escapeHtml(normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode))}</span>
                <span class="fv-setup-chip">Preset: ${escapeHtml(normalizeSetupAssistantQuickPresetState(setupAssistantState.quickPreset))}</span>
                <span class="fv-setup-chip">Safety: ${escapeHtml(normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode))}</span>
                <span class="fv-setup-chip ${setupAssistantState.dryRunOnly ? 'is-update' : ''}">Dry run: ${setupAssistantState.dryRunOnly ? 'ON' : 'OFF'}</span>
            </div>
            <div class="fv-setup-sidebar-stats">
                <div><strong>${importTotals.totalOps}</strong><span>Import ops</span></div>
                <div><strong>${prefsTotal}</strong><span>Setting changes</span></div>
                <div><strong>${rulesTotal}</strong><span>Starter rules</span></div>
            </div>
            ${hasDeletes ? '<p class="fv-setup-sidebar-alert"><i class="fa fa-exclamation-triangle"></i> Delete operations detected.</p>' : ''}
        </section>
    `;
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
    const routeLabelByKey = {
        new: 'New install',
        migrate: 'Migrate',
        advanced: 'Advanced'
    };
    const selectedQuickPreset = normalizeSetupAssistantQuickPresetState(setupAssistantState.quickPreset);
    const experienceMode = normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode);
    const detectedRoute = ['new', 'migrate', 'advanced'].includes(setupAssistantState.suggestedRoute)
        ? setupAssistantState.suggestedRoute
        : 'new';
    const detectedMode = setupAssistantState.suggestedMode === 'advanced' ? 'advanced' : 'basic';
    const detectedPreset = normalizeQuickProfilePresetId(setupAssistantState.suggestedQuickPreset, 'balanced');
    const savedPresets = readSetupAssistantPresetStore();
    const availablePresetIds = new Set(savedPresets.map((entry) => String(entry.id || '')));
    if (!availablePresetIds.has(String(setupAssistantState.selectedPresetId || ''))) {
        setupAssistantState.selectedPresetId = savedPresets.length ? String(savedPresets[0].id || '') : '';
    }
    const selectedPresetId = String(setupAssistantState.selectedPresetId || '');
    const detectedSummary = `Auto-detected: ${routeLabelByKey[detectedRoute]} route, ${detectedMode} mode, ${detectedPreset} bundle.`;
    const quickPresetHtml = Object.entries(QUICK_PROFILE_PRESETS).map(([presetKey, preset]) => `
        <button type="button"
            class="fv-setup-quick-preset ${selectedQuickPreset === presetKey ? 'is-active' : ''}"
            data-fv-setup-quick-preset="${escapeHtml(presetKey)}">
            <span class="fv-setup-quick-preset-title">${escapeHtml(preset.label)}</span>
            <span class="fv-setup-quick-preset-help">${escapeHtml(preset.description)}</span>
        </button>
    `).join('');
    return `
        <div class="fv-setup-step-grid">
            <section class="fv-setup-card" data-fv-card-tone="env">
                <h4>Detected environment</h4>
                <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="welcome-environment">
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
                <div class="fv-setup-detected-row">
                    <span class="fv-setup-muted">${escapeHtml(detectedSummary)} ${setupAssistantState.suggestedReason ? `(${escapeHtml(setupAssistantState.suggestedReason)})` : ''}</span>
                    <button type="button" id="fv-setup-apply-detected"><i class="fa fa-magic"></i> Use detected setup</button>
                </div>
            </section>
            <section class="fv-setup-card" data-fv-card-tone="mode">
                <h4>Default settings mode</h4>
                <p class="fv-setup-muted">You can change this any time in the top bar.</p>
                <div class="fv-setup-mode-toggle">
                    <button type="button" class="${setupAssistantState.mode === 'basic' ? 'is-active' : ''}" data-fv-setup-mode="basic">Basic</button>
                    <button type="button" class="${setupAssistantState.mode === 'advanced' ? 'is-active' : ''}" data-fv-setup-mode="advanced">Advanced</button>
                </div>
                <p class="fv-setup-muted">Basic keeps day-to-day settings visible. Advanced unlocks all sections.</p>
                <h4>Wizard detail level</h4>
                <p class="fv-setup-muted">Guided keeps setup simple. Expert exposes every control.</p>
                <div class="fv-setup-mode-toggle">
                    <button type="button" class="${experienceMode === 'guided' ? 'is-active' : ''}" data-fv-setup-experience="guided">Guided</button>
                    <button type="button" class="${experienceMode === 'expert' ? 'is-active' : ''}" data-fv-setup-experience="expert">Expert</button>
                </div>
            </section>
            <section class="fv-setup-card" data-fv-card-tone="bundle">
                <h4>Quick start bundle</h4>
                <p class="fv-setup-muted">Pick a ready-made bundle. You can still fine tune profile and behavior in later steps.</p>
                <div class="fv-setup-quick-preset-grid">
                    ${quickPresetHtml}
                </div>
                <p class="fv-setup-muted">Current bundle: <strong>${escapeHtml(selectedQuickPreset)}</strong></p>
            </section>
            <section class="fv-setup-card" data-fv-card-tone="preset">
                <h4>Saved wizard presets</h4>
                <p class="fv-setup-muted">Save your preferred setup path and reuse it later.</p>
                <div class="fv-setup-field-grid">
                    <label class="fv-setup-field">
                        <span>Preset name</span>
                        <input type="text" id="fv-setup-preset-name" value="${escapeHtml(setupAssistantState.presetDraftName || '')}" maxlength="60" placeholder="Example: media-stack-fast">
                    </label>
                    <label class="fv-setup-field">
                        <span>Saved presets</span>
                        <select id="fv-setup-preset-select">
                            <option value="">Select preset</option>
                            ${savedPresets.map((entry) => `
                                <option value="${escapeHtml(entry.id)}" ${selectedPresetId === String(entry.id || '') ? 'selected' : ''}>
                                    ${escapeHtml(entry.name)} (${escapeHtml(formatSetupAssistantSavedAt(entry.savedAt))})
                                </option>
                            `).join('')}
                        </select>
                    </label>
                </div>
                <div class="fv-setup-import-actions">
                    <button type="button" id="fv-setup-preset-save"><i class="fa fa-save"></i> Save current</button>
                    <button type="button" id="fv-setup-preset-load" ${selectedPresetId ? '' : 'disabled'}><i class="fa fa-download"></i> Load</button>
                    <button type="button" id="fv-setup-preset-delete" ${selectedPresetId ? '' : 'disabled'}><i class="fa fa-trash"></i> Delete</button>
                </div>
            </section>
        </div>
    `;
};

const renderSetupAssistantProfileStep = () => {
    return `
        <div class="fv-setup-card" data-fv-card-tone="profile">
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
    const isExpert = normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode) === 'expert';
    const hasFile = Boolean(plan?.parsed);
    const effectiveMode = getSetupAssistantEffectiveImportMode(resolvedType);
    const operationCount = hasFile
        ? countImportOperations(plan.operations || { creates: [], upserts: [], deletes: [] })
        : 0;
    const summary = plan?.summary;
    const formatText = hasFile
        ? getSetupAssistantImportFormatLabel(plan.parsed)
        : 'No file selected';
    const fileSizeText = hasFile ? formatBytesShort(plan?.fileSizeBytes || 0) : '';
    const fileDateText = hasFile ? formatTimestamp(plan?.fileLastModified || '') : '';
    const warnings = Array.isArray(plan?.warnings) ? plan.warnings : [];

    return `
        <section class="fv-setup-card fv-setup-import-card" data-fv-card-tone="import-${resolvedType}">
            <div class="fv-setup-import-header">
                <h4>${title} import</h4>
                <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="import-${resolvedType}-meta">
                    <span class="fv-setup-chip ${hasFile && plan?.parsed?.legacy === true ? 'is-delete' : 'is-update'}">${escapeHtml(formatText)}</span>
                    <span class="fv-setup-chip">${hasFile ? escapeHtml(plan.parsed.mode === 'single' ? 'Single folder' : 'Full export') : 'Waiting for file'}</span>
                    <span class="fv-setup-chip">Operations: ${operationCount}</span>
                </div>
            </div>
            <div class="fv-setup-import-actions">
                <button type="button" data-fv-setup-import-select="${resolvedType}"><i class="fa fa-upload"></i> Select ${title} export</button>
                <button type="button" data-fv-setup-import-clear="${resolvedType}" ${hasFile ? '' : 'disabled'}><i class="fa fa-trash"></i> Clear</button>
            </div>
            <div class="fv-setup-muted">${hasFile ? escapeHtml(plan.fileName || 'Selected file') : `Choose a ${title} export JSON to preview changes.`}</div>
            ${hasFile && (fileSizeText || fileDateText) ? `
                <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="import-${resolvedType}-summary">
                    ${fileSizeText ? `<span class="fv-setup-chip">Size: ${escapeHtml(fileSizeText)}</span>` : ''}
                    ${fileDateText ? `<span class="fv-setup-chip">Modified: ${escapeHtml(fileDateText)}</span>` : ''}
                </div>
            ` : ''}
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" data-fv-setup-import-include="${resolvedType}" ${plan.include ? 'checked' : ''} ${hasFile ? '' : 'disabled'}>
                Include this ${title} import in Apply
            </label>
            ${isExpert ? `
                <label class="fv-setup-field">
                    <span>Import mode</span>
                    <select data-fv-setup-import-mode="${resolvedType}" ${hasFile ? '' : 'disabled'}>
                        <option value="merge" ${effectiveMode === 'merge' ? 'selected' : ''}>Merge (add + update)</option>
                        <option value="replace" ${effectiveMode === 'replace' ? 'selected' : ''}>Replace (delete missing)</option>
                        <option value="skip" ${effectiveMode === 'skip' ? 'selected' : ''}>Skip existing (add new only)</option>
                    </select>
                </label>
            ` : `
                <div class="fv-setup-muted">Guided mode uses <strong>Merge</strong> for safer imports.</div>
            `}
            ${hasFile ? `
                <div class="fv-setup-chip-row">
                    <span class="fv-setup-chip is-create">Create: ${summary?.creates?.length || 0}</span>
                    <span class="fv-setup-chip is-update">Update: ${summary?.updates?.length || 0}</span>
                    <span class="fv-setup-chip is-delete">Delete: ${summary?.deletes?.length || 0}</span>
                    <span class="fv-setup-chip">Unchanged: ${summary?.unchanged?.length || 0}</span>
                </div>
            ` : ''}
            ${warnings.length ? `
                <ul class="fv-setup-import-warnings">
                    ${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}
                </ul>
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
        <section class="fv-setup-card" data-fv-card-tone="rules-${resolvedType}">
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
    const isExpert = normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode) === 'expert';
    return `
        <section class="fv-setup-card" data-fv-card-tone="behavior-${resolvedType}">
            <h4>${title} behavior</h4>
            <div class="fv-setup-field-grid ${isExpert ? '' : 'is-guided'}">
                <label class="fv-setup-field">
                    <span>Sort mode</span>
                    <select data-fv-setup-behavior-sort="${resolvedType}">
                        <option value="created" ${behavior.sortMode === 'created' ? 'selected' : ''}>Created order</option>
                        <option value="manual" ${behavior.sortMode === 'manual' ? 'selected' : ''}>Manual</option>
                        <option value="alpha" ${behavior.sortMode === 'alpha' ? 'selected' : ''}>Name (A-Z)</option>
                    </select>
                </label>
                ${isExpert ? `
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
                ` : ''}
            </div>
            <div class="fv-setup-inline-grid">
                <label class="fv-setup-inline-toggle"><input type="checkbox" data-fv-setup-behavior-hide-empty="${resolvedType}" ${behavior.hideEmptyFolders ? 'checked' : ''}> Hide empty folders</label>
                <label class="fv-setup-inline-toggle"><input type="checkbox" data-fv-setup-behavior-health-cards="${resolvedType}" ${behavior.healthCardsEnabled ? 'checked' : ''}> Health cards</label>
                <label class="fv-setup-inline-toggle"><input type="checkbox" data-fv-setup-behavior-runtime-badge="${resolvedType}" ${behavior.runtimeBadgeEnabled ? 'checked' : ''}> Runtime summary badge</label>
            </div>
            ${isExpert ? '' : '<p class="fv-setup-muted">Switch to Expert mode for status-mode and threshold controls.</p>'}
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
        <div class="fv-setup-card" data-fv-card-tone="review">
            <h4>Review planned changes</h4>
            <div class="fv-setup-review-grid fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="4" data-fv-chip-key="review-summary">
                <span class="fv-setup-chip">Mode: ${escapeHtml(setupAssistantState.mode)}</span>
                <span class="fv-setup-chip">Route: ${escapeHtml(setupAssistantState.route)}</span>
                <span class="fv-setup-chip">Quick preset: ${escapeHtml(normalizeSetupAssistantQuickPresetState(setupAssistantState.quickPreset))}</span>
                <span class="fv-setup-chip">Profile: ${escapeHtml(setupAssistantState.profile)}</span>
                <span class="fv-setup-chip">Environment: ${escapeHtml(SETUP_ASSISTANT_ENV_PRESETS[setupAssistantState.environmentPreset]?.label || 'Home Lab')}</span>
                <span class="fv-setup-chip">Dry run: ${setupAssistantState.dryRunOnly ? 'ON' : 'OFF'}</span>
            </div>
            <div class="fv-setup-impact-grid">
                <article class="fv-setup-impact-card" data-fv-card-tone="impact-prefs">
                    <h5>Preferences</h5>
                    <p>${impact.prefs.totalChanges} changes planned</p>
                    <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="review-impact-prefs">
                        <span class="fv-setup-chip">Docker: ${impact.prefs.byType.docker.count}</span>
                        <span class="fv-setup-chip">VM: ${impact.prefs.byType.vm.count}</span>
                    </div>
                </article>
                <article class="fv-setup-impact-card" data-fv-card-tone="impact-imports">
                    <h5>Imports</h5>
                    <p>${impact.imports.totals.totalOps} operations planned</p>
                    <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="review-impact-imports">
                        <span class="fv-setup-chip is-create">Create: ${impact.imports.totals.creates}</span>
                        <span class="fv-setup-chip is-update">Update: ${impact.imports.totals.updates}</span>
                        <span class="fv-setup-chip is-delete">Delete: ${impact.imports.totals.deletes}</span>
                    </div>
                </article>
                <article class="fv-setup-impact-card" data-fv-card-tone="impact-rules">
                    <h5>Starter rules</h5>
                    <p>${impact.rules.creatable} new rules planned</p>
                    <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="review-impact-rules">
                        <span class="fv-setup-chip">Selected: ${impact.rules.selected}</span>
                        <span class="fv-setup-chip">Duplicates: ${impact.rules.duplicates}</span>
                        <span class="fv-setup-chip">Missing folder: ${impact.rules.unresolvedFolder}</span>
                    </div>
                </article>
                <article class="fv-setup-impact-card" data-fv-card-tone="impact-total">
                    <h5>Total impact</h5>
                    <p>${impact.totalPlannedChanges} net changes estimated</p>
                    <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="2" data-fv-chip-key="review-impact-total">
                        <span class="fv-setup-chip">${setupAssistantState.route === 'migrate' ? 'Migration' : 'Configuration'} flow</span>
                    </div>
                </article>
            </div>
            <label class="fv-setup-inline-toggle">
                <input type="checkbox" id="fv-setup-dry-run" ${setupAssistantState.dryRunOnly ? 'checked' : ''}>
                Dry run only (preview changes, do not modify folders or settings)
            </label>
            <div class="fv-setup-safety-grid">
                <span class="fv-setup-muted">Apply safety mode</span>
                <label class="fv-setup-inline-toggle"><input type="radio" name="fv-setup-safety-mode" value="auto" ${normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode) === 'auto' ? 'checked' : ''}> Auto (recommended)</label>
                <label class="fv-setup-inline-toggle"><input type="radio" name="fv-setup-safety-mode" value="strict" ${normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode) === 'strict' ? 'checked' : ''}> Strict (block on warnings)</label>
                <label class="fv-setup-inline-toggle"><input type="radio" name="fv-setup-safety-mode" value="fast" ${normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode) === 'fast' ? 'checked' : ''}> Fast (skip rollback checkpoint)</label>
            </div>
            <div class="fv-setup-import-actions">
                <button type="button" id="fv-setup-copy-summary"><i class="fa fa-clipboard"></i> Copy summary</button>
                <span class="fv-setup-muted">Tip: <kbd>Alt</kbd> + <kbd>Left/Right</kbd> moves steps, <kbd>Ctrl</kbd> + <kbd>Enter</kbd> applies, <kbd>Alt</kbd> + <kbd>F</kbd> toggles focus mode, <kbd>Alt</kbd> + <kbd>C</kbd> cycles contrast.</span>
            </div>
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
        <div class="fv-setup-validation-box ${validation.blockers?.length ? 'is-blocking' : 'is-warning'}" role="status" aria-live="polite" aria-atomic="true">
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

const jumpSetupAssistantToStep = (targetIndex) => {
    if (setupAssistantState.busy || setupAssistantState.applying) {
        return false;
    }
    const sequence = getSetupAssistantStepSequence();
    const maxIndex = Math.max(0, sequence.length - 1);
    const nextIndex = Math.max(0, Math.min(maxIndex, Number(targetIndex) || 0));
    const currentIndex = Math.max(0, Math.min(maxIndex, Number(setupAssistantState.step) || 0));
    if (nextIndex === currentIndex) {
        return true;
    }
    if (nextIndex > currentIndex) {
        for (let index = currentIndex; index < nextIndex; index += 1) {
            const validation = getSetupAssistantStepValidation(sequence[index]);
            if (validation.blockers.length > 0) {
                setupAssistantState.step = index;
                return false;
            }
        }
    }
    setupAssistantState.step = nextIndex;
    return true;
};

const buildSetupAssistantClipboardSummary = () => {
    const impact = buildSetupAssistantImpactSummary();
    const validation = getSetupAssistantStepValidation('review');
    const notes = buildSetupAssistantReviewNotes();
    const imports = impact?.imports?.totals || { totalOps: 0, creates: 0, updates: 0, deletes: 0 };
    const prefs = impact?.prefs || { totalChanges: 0, byType: { docker: { count: 0 }, vm: { count: 0 } } };
    const rules = impact?.rules || { creatable: 0, selected: 0, duplicates: 0, unresolvedFolder: 0, invalidPattern: 0 };

    const lines = [
        'FolderView Plus - Setup Assistant Plan',
        `Generated: ${new Date().toISOString()}`,
        `Route: ${setupAssistantState.route}`,
        `Mode: ${setupAssistantState.mode}`,
        `Wizard detail: ${normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode)}`,
        `Safety mode: ${normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode)}`,
        `Quick preset: ${normalizeSetupAssistantQuickPresetState(setupAssistantState.quickPreset)}`,
        `Profile: ${setupAssistantState.profile} (${setupAssistantState.applyProfileDefaults ? 'apply defaults' : 'do not apply defaults'})`,
        `Environment: ${setupAssistantState.environmentPreset} (${setupAssistantState.applyEnvironmentDefaults ? 'apply defaults' : 'do not apply defaults'})`,
        `Dry run: ${setupAssistantState.dryRunOnly ? 'ON' : 'OFF'}`,
        '',
        `Import operations: ${imports.totalOps} (create ${imports.creates}, update ${imports.updates}, delete ${imports.deletes})`,
        `Preference changes: ${prefs.totalChanges} (docker ${prefs.byType?.docker?.count || 0}, vm ${prefs.byType?.vm?.count || 0})`,
        `Starter rules: ${rules.creatable} (selected ${rules.selected}, duplicates ${rules.duplicates}, missing folder ${rules.unresolvedFolder}, invalid pattern ${rules.invalidPattern})`,
        `Total planned changes: ${impact.totalPlannedChanges}`,
        ''
    ];

    if (validation.blockers.length > 0) {
        lines.push('Blockers:');
        validation.blockers.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
    }
    if (validation.warnings.length > 0 || notes.length > 0) {
        lines.push('Warnings/notes:');
        [...validation.warnings, ...notes].forEach((item) => lines.push(`- ${item}`));
    }

    return lines.join('\n');
};

const copySetupAssistantSummaryToClipboard = async () => {
    try {
        const text = buildSetupAssistantClipboardSummary();
        await copyTextToClipboard(text);
        showToastMessage({
            title: 'Wizard summary copied',
            message: 'Setup assistant summary was copied to clipboard.',
            level: 'success',
            durationMs: 2800
        });
    } catch (error) {
        showError('Copy summary failed', error);
    }
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
    const stepSequence = getSetupAssistantStepSequence();
    const atLastStep = setupAssistantState.step >= Math.max(0, stepSequence.length - 1);
    if (event.key === 'Escape') {
        if (!setupAssistantState.busy && !setupAssistantState.applying) {
            event.preventDefault();
            closeSetupAssistant();
        }
        return;
    }
    if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        if (jumpSetupAssistantToStep(setupAssistantState.step - 1)) {
            renderSetupAssistant();
        } else {
            renderSetupAssistant();
        }
        return;
    }
    if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        if (jumpSetupAssistantToStep(setupAssistantState.step + 1)) {
            renderSetupAssistant();
        } else {
            renderSetupAssistant();
        }
        return;
    }
    if (event.altKey && String(event.key || '').toLowerCase() === 'f') {
        event.preventDefault();
        if (!setupAssistantState.busy && !setupAssistantState.applying) {
            setupAssistantState.focusModeEnabled = setupAssistantState.focusModeEnabled === false;
            renderSetupAssistant();
        }
        return;
    }
    if (event.altKey && String(event.key || '').toLowerCase() === 'c') {
        event.preventDefault();
        if (!setupAssistantState.busy && !setupAssistantState.applying) {
            cycleSetupAssistantContrastPreference();
        }
        return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && atLastStep) {
        event.preventDefault();
        if (!setupAssistantState.busy && !setupAssistantState.applying) {
            void applySetupAssistantPlan();
        }
        return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || '').toLowerCase() === 'c' && atLastStep) {
        event.preventDefault();
        void copySetupAssistantSummaryToClipboard();
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
    const stepSequence = getSetupAssistantStepSequence();
    const step = currentSetupAssistantStepKey();
    const atFirstStep = setupAssistantState.step === 0;
    const atLastStep = setupAssistantState.step >= stepSequence.length - 1;
    const canMove = !setupAssistantState.busy && !setupAssistantState.applying;
    const stepValidation = getSetupAssistantStepValidation(step);
    const impactSummary = buildSetupAssistantImpactSummary();
    const impactDelta = getSetupAssistantImpactDelta(impactSummary);
    const stepDeltaHtml = getSetupAssistantStepDeltaSummary(step, impactDelta);
    const stepStatusMap = buildSetupAssistantStepStatusMap();
    const hasBlockers = stepValidation.blockers.length > 0;
    const canNext = !atLastStep && canMove && !hasBlockers;
    const canApply = atLastStep && canMove && !hasBlockers;
    const primaryBlocker = hasBlockers ? String(stepValidation.blockers[0] || '').trim() : '';
    const blockerHintId = primaryBlocker ? 'fv-setup-blocker-hint' : '';
    const mobileSidebarSummaryOpen = setupAssistantState.mobileSidebarSummaryOpen === true;
    const focusModeEnabled = setupAssistantState.focusModeEnabled !== false;
    const contrastPreference = normalizeSetupAssistantContrastPreference(setupAssistantState.contrastPreference);
    const inlineGuidanceHtml = renderSetupAssistantInlineGuidance(step, stepValidation);
    const restoredBanner = setupAssistantState.draftRestored
        ? `
            <div class="fv-setup-draft-banner">
                <span><i class="fa fa-history"></i> Restored draft from ${escapeHtml(formatSetupAssistantSavedAt(setupAssistantState.restoredDraftSavedAt))}.</span>
                <button type="button" id="fv-setup-discard-draft"><i class="fa fa-trash"></i> Start fresh</button>
            </div>
        `
        : '';

    content.html(`
        <div class="fv-setup-assistant-shell"
            data-fv-mobile-summary-open="${mobileSidebarSummaryOpen ? '1' : '0'}"
            data-fv-focus-mode="${focusModeEnabled ? '1' : '0'}"
            data-fv-active-step="${escapeHtml(step)}">
            <aside class="fv-setup-assistant-sidebar">
                <h3 id="fv-setup-assistant-title">Setup Assistant</h3>
                <p class="fv-setup-muted">Step ${setupAssistantState.step + 1} of ${stepSequence.length}</p>
                <ol class="fv-setup-step-list">
                    ${stepSequence.map((stepKey, index) => {
                        const statusEntry = stepStatusMap[index] || { status: 'ok', blockers: [], warnings: [] };
                        const itemStatus = String(statusEntry.status || 'ok');
                        const statusLabel = setupAssistantStepStatusLabel(itemStatus);
                        const statusChipClass = setupAssistantStepStatusClass(itemStatus);
                        const hasStatusHint = statusEntry.blockers.length > 0 || statusEntry.warnings.length > 0;
                        const statusHint = statusEntry.blockers.length > 0
                            ? statusEntry.blockers[0]
                            : (statusEntry.warnings[0] || '');
                        return `
                        <li class="${index === setupAssistantState.step ? 'is-active' : (index < setupAssistantState.step ? 'is-complete' : '')} status-${escapeHtml(itemStatus)}">
                            <button type="button"
                                class="fv-setup-step-jump"
                                data-fv-setup-step-jump="${index}"
                                aria-label="Go to ${escapeHtml(setupAssistantStepLabel(stepKey))}"
                                ${hasStatusHint ? `title="${escapeHtml(statusHint)}"` : ''}
                                ${canMove ? '' : 'disabled'}>
                                <span class="fv-setup-step-index">${index + 1}</span>
                                <span class="fv-setup-step-label">${escapeHtml(setupAssistantStepLabel(stepKey))}</span>
                                <span class="fv-setup-step-state ${statusChipClass}">${escapeHtml(statusLabel)}</span>
                            </button>
                        </li>
                    `;
                    }).join('')}
                </ol>
                <button type="button"
                    id="fv-setup-sidebar-toggle"
                    class="fv-setup-sidebar-toggle"
                    aria-expanded="${mobileSidebarSummaryOpen ? 'true' : 'false'}"
                    aria-controls="fv-setup-sidebar-summary"
                    ${canMove ? '' : 'disabled'}>
                    <i class="fa fa-sliders"></i> ${mobileSidebarSummaryOpen ? 'Hide details' : 'Show details'}
                </button>
                ${renderSetupAssistantSidebarSummary(impactSummary)}
            </aside>
            <section class="fv-setup-assistant-main">
                <header class="fv-setup-assistant-head">
                    <h4>${escapeHtml(setupAssistantStepLabel(step))}</h4>
                    <div class="fv-setup-head-actions">
                        <button type="button"
                            id="fv-setup-focus-mode"
                            class="${focusModeEnabled ? 'is-active' : ''}"
                            title="Toggle focus mode (Alt+F)"
                            aria-pressed="${focusModeEnabled ? 'true' : 'false'}"
                            aria-keyshortcuts="Alt+F"
                            ${canMove ? '' : 'disabled'}>
                            <i class="fa fa-bullseye"></i> Focus
                        </button>
                        <label class="fv-setup-contrast-field" for="fv-setup-contrast-mode">
                            <span>Contrast</span>
                            <select id="fv-setup-contrast-mode" aria-label="Wizard contrast mode (Alt+C)" aria-keyshortcuts="Alt+C" ${canMove ? '' : 'disabled'}>
                                <option value="auto" ${contrastPreference === 'auto' ? 'selected' : ''}>Auto</option>
                                <option value="normal" ${contrastPreference === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="high" ${contrastPreference === 'high' ? 'selected' : ''}>High</option>
                                <option value="max" ${contrastPreference === 'max' ? 'selected' : ''}>Max</option>
                            </select>
                        </label>
                        <button type="button" id="fv-setup-close" aria-keyshortcuts="Escape" ${canMove ? '' : 'disabled'}><i class="fa fa-times"></i> Close</button>
                    </div>
                </header>
                <div class="fv-setup-assistant-body">
                    ${restoredBanner}
                    ${inlineGuidanceHtml}
                    ${renderSetupAssistantStepBody()}
                    ${renderSetupAssistantValidationBox(stepValidation)}
                </div>
                <div class="fv-setup-step-delta" aria-live="polite" aria-atomic="true">
                    <span class="fv-setup-muted">Live impact for this step</span>
                    <div class="fv-setup-chip-row" data-fv-chip-collapsible="1" data-fv-chip-max="3" data-fv-chip-key="step-delta">
                        ${stepDeltaHtml}
                    </div>
                </div>
                <footer class="fv-setup-assistant-foot">
                    <div class="fv-setup-foot-left">
                        <button type="button" id="fv-setup-prev" aria-keyshortcuts="Alt+ArrowLeft" ${(!canMove || atFirstStep) ? 'disabled' : ''}><i class="fa fa-arrow-left"></i> Back</button>
                        <button type="button" id="fv-setup-next" aria-keyshortcuts="Alt+ArrowRight" ${canNext ? '' : 'disabled'} ${blockerHintId ? `aria-describedby="${blockerHintId}"` : ''}>Next <i class="fa fa-arrow-right"></i></button>
                        <button type="button" id="fv-setup-skip-review" ${(!canMove || atLastStep) ? 'disabled' : ''}><i class="fa fa-step-forward"></i> Review</button>
                    </div>
                    <div class="fv-setup-foot-right">
                        <button type="button" id="fv-setup-apply" aria-keyshortcuts="Control+Enter Meta+Enter" ${canApply ? '' : 'disabled'} ${blockerHintId ? `aria-describedby="${blockerHintId}"` : ''}><i class="fa fa-check"></i> Apply setup</button>
                    </div>
                </footer>
                <div class="fv-setup-nav-note" ${blockerHintId ? `id="${blockerHintId}"` : ''} role="status" aria-live="polite">
                    ${primaryBlocker
        ? `<i class="fa fa-exclamation-triangle"></i> Resolve to continue: ${escapeHtml(primaryBlocker)}`
        : '<i class="fa fa-check-circle"></i> No blockers on this step.'}
                </div>
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
    bindSetupAssistantViewportAccessibilityHandlers();
    decorateSetupAssistantChipRows();
    applySetupAssistantContrastTier();
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
    setupAssistantState.impactBaseline = buildSetupAssistantImpactSummary();
    renderSetupAssistant();
};

const confirmSetupAssistantApply = async (impactSummary, reviewValidation) => (
    new Promise((resolve) => {
        const totals = impactSummary?.imports?.totals || { creates: 0, updates: 0, deletes: 0, totalOps: 0 };
        const prefsTotal = Number(impactSummary?.prefs?.totalChanges) || 0;
        const rulesTotal = Number(impactSummary?.rules?.creatable) || 0;
        const hasDeletes = Number(totals.deletes) > 0;
        const lines = [
            `Route: ${setupAssistantState.route}`,
            `Mode: ${setupAssistantState.mode}`,
            `Wizard detail: ${normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode)}`,
            `Safety mode: ${normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode)}`,
            `Imports: ${totals.totalOps} ops (create ${totals.creates}, update ${totals.updates}, delete ${totals.deletes})`,
            `Settings: ${prefsTotal} changes`,
            `Starter rules: ${rulesTotal}`,
            `Dry run: ${setupAssistantState.dryRunOnly ? 'ON' : 'OFF'}`
        ];
        if (reviewValidation?.warnings?.length) {
            lines.push(`Warnings: ${reviewValidation.warnings.length}`);
        }
        swal({
            title: setupAssistantState.dryRunOnly ? 'Run setup dry run?' : 'Apply setup assistant changes?',
            text: lines.join('\n'),
            type: hasDeletes && setupAssistantState.dryRunOnly !== true ? 'warning' : 'info',
            showCancelButton: true,
            confirmButtonText: setupAssistantState.dryRunOnly ? 'Run dry run' : 'Apply now',
            cancelButtonText: 'Keep editing',
            closeOnConfirm: true
        }, (isConfirm) => resolve(isConfirm === true));
    })
);

const retrySetupAssistantFailures = async (failures = []) => {
    const queue = Array.isArray(failures) ? failures : [];
    const remaining = [];
    let resolved = 0;
    for (let index = 0; index < queue.length; index += 1) {
        const entry = queue[index] || {};
        const phase = String(entry.phase || '').trim();
        const type = normalizeManagedType(entry.type || 'docker');
        const progressBase = Math.round((index / Math.max(1, queue.length)) * 100);
        try {
            if (phase === 'import') {
                const plan = setupAssistantState.importPlans[type];
                if (plan?.include && plan?.parsed) {
                    summarizeSetupAssistantImportPlan(type);
                    const operations = plan.operations || { creates: [], upserts: [], deletes: [] };
                    const operationCount = countImportOperations(operations);
                    if (operationCount > 0) {
                        setSetupAssistantProgress(`Retrying ${type.toUpperCase()} import...`, progressBase);
                        renderSetupAssistant();
                        await applyImportOperations(type, operations, ({ completed, total, label }) => {
                            const safeTotal = Math.max(1, Number(total) || 1);
                            const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
                            const progress = progressBase + Math.round((safeCompleted / safeTotal) * Math.round(100 / Math.max(1, queue.length)));
                            setSetupAssistantProgress(label || `Retrying ${type} import...`, progress);
                            renderSetupAssistant();
                        });
                        await Promise.all([refreshType(type), refreshBackups(type)]);
                    }
                }
                resolved += 1;
            } else if (phase === 'rules') {
                setSetupAssistantProgress(`Retrying ${type.toUpperCase()} starter rules...`, progressBase);
                renderSetupAssistant();
                await applySetupAssistantRulesForType(type);
                resolved += 1;
            } else {
                remaining.push(entry);
            }
        } catch (error) {
            remaining.push({
                ...entry,
                message: String(error?.message || error)
            });
        }
    }
    await refreshAll();
    refreshSettingsUx();
    captureSettingsBaseline();
    return {
        retried: queue.length,
        resolved,
        remaining
    };
};

const confirmSetupAssistantUndo = async (summaryText, canUndo = true) => (
    new Promise((resolve) => {
        swal({
            title: 'Setup assistant complete',
            text: canUndo ? `${summaryText}\n\nUndo this setup now?` : summaryText,
            type: 'success',
            showCancelButton: canUndo === true,
            confirmButtonText: canUndo ? 'Undo setup' : 'Done',
            cancelButtonText: 'Done',
            showLoaderOnConfirm: canUndo === true,
            closeOnConfirm: canUndo !== true
        }, (undoNow) => resolve(undoNow === true));
    })
);

const applySetupAssistantPlan = async () => {
    if (setupAssistantState.applying) {
        return;
    }
    const reviewValidation = getSetupAssistantStepValidation('review');
    if (reviewValidation.blockers.length) {
        setupAssistantState.step = getSetupAssistantStepSequence().length - 1;
        renderSetupAssistant();
        return;
    }
    const impactSummary = buildSetupAssistantImpactSummary();
    const safetyMode = normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode);
    if (safetyMode === 'strict' && reviewValidation.warnings.length > 0 && setupAssistantState.dryRunOnly !== true) {
        showError('Strict mode blocked apply', new Error('Resolve all review warnings or switch safety mode to Auto/Fast.'));
        setupAssistantState.step = getSetupAssistantStepSequence().length - 1;
        renderSetupAssistant();
        return;
    }
    if (safetyMode === 'strict' && impactSummary.totalPlannedChanges <= 0 && setupAssistantState.dryRunOnly !== true) {
        showError('Strict mode blocked apply', new Error('No planned changes detected in strict mode.'));
        return;
    }

    const confirmed = await confirmSetupAssistantApply(impactSummary, reviewValidation);
    if (!confirmed) {
        return;
    }

    setupAssistantState.applying = true;
    setupAssistantState.busy = true;
    const applyStartedAt = Date.now();
    setSetupAssistantProgress(setupAssistantState.dryRunOnly ? 'Running dry run checks...' : 'Preparing apply...', 5);
    renderSetupAssistant();

    let rollbackCreated = false;
    const applyFailures = [];
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
                `Wizard detail: ${normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode)}`,
                `Safety mode: ${safetyMode}`,
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

        if (safetyMode !== 'fast') {
            setSetupAssistantProgress('Creating rollback checkpoint...', 10);
            renderSetupAssistant();
            const rollback = await createGlobalRollbackCheckpointApi('setup_assistant_apply');
            rollbackCreated = true;
            setupAssistantState.rollbackCheckpointName = rollback?.name || rollback?.checkpoint || '';
        } else {
            setupAssistantState.rollbackCheckpointName = '';
        }

        setSetupAssistantProgress('Applying settings profile...', 20);
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

        setSetupAssistantProgress('Applying imports...', 36);
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
            const startPercent = type === 'docker' ? 42 : 56;
            const span = 12;
            try {
                await applyImportOperations(type, operations, ({ completed, total, label }) => {
                    const safeTotal = Math.max(1, Number(total) || 1);
                    const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
                    const progress = startPercent + Math.round((safeCompleted / safeTotal) * span);
                    setSetupAssistantProgress(label || `Applying ${type} import...`, progress);
                    renderSetupAssistant();
                });
                await Promise.all([refreshType(type), refreshBackups(type)]);
            } catch (error) {
                applyFailures.push({
                    phase: 'import',
                    type,
                    message: String(error?.message || error)
                });
            }
        }

        setSetupAssistantProgress('Applying starter rules...', 72);
        renderSetupAssistant();
        for (const type of ['docker', 'vm']) {
            try {
                ruleOutcomes[type] = await applySetupAssistantRulesForType(type);
            } catch (error) {
                applyFailures.push({
                    phase: 'rules',
                    type,
                    message: String(error?.message || error)
                });
            }
        }

        setSetupAssistantProgress('Refreshing settings...', 86);
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
        if (safetyMode === 'strict' && (validationWarnings.length > 0 || applyFailures.length > 0 || verification.passed < verification.total)) {
            throw new Error('Strict safety checks failed after apply. Rolling back to previous checkpoint.');
        }

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

        const checkpointText = rollbackCreated
            ? `Rollback checkpoint: ${setupAssistantState.rollbackCheckpointName || 'created'}`
            : 'Rollback checkpoint skipped (Fast mode).';
        const durationMs = Math.max(0, Date.now() - applyStartedAt);
        const durationSeconds = (durationMs / 1000).toFixed(1);
        const summaryLines = [
            `Mode: ${setupAssistantState.mode}`,
            `Route: ${setupAssistantState.route}`,
            `Wizard detail: ${normalizeSetupAssistantExperienceMode(setupAssistantState.experienceMode)}`,
            `Safety mode: ${safetyMode}`,
            `Profile defaults: ${setupAssistantState.applyProfileDefaults ? setupAssistantState.profile : 'not applied'}`,
            `Environment defaults: ${setupAssistantState.applyEnvironmentDefaults ? (SETUP_ASSISTANT_ENV_PRESETS[setupAssistantState.environmentPreset]?.label || 'Home Lab') : 'not applied'}`,
            `Docker import operations: ${importOutcomes.docker}`,
            `VM import operations: ${importOutcomes.vm}`,
            `Docker starter rules added: ${ruleOutcomes.docker.created}`,
            `VM starter rules added: ${ruleOutcomes.vm.created}`,
            `Estimated preference changes: ${impactSummary.prefs.totalChanges}`,
            `Verification: ${verification.passed}/${verification.total} checks passed`,
            checkpointText,
            `Duration: ${durationSeconds}s`
        ];
        if (validationWarnings.length) {
            summaryLines.push(`Validation warnings: ${validationWarnings.join(' | ')}`);
        }
        if (applyFailures.length) {
            summaryLines.push(`Retryable failures: ${applyFailures.length}`);
            summaryLines.push(...applyFailures.map((entry) => `${entry.phase.toUpperCase()} ${entry.type.toUpperCase()}: ${entry.message}`));
        }

        setupAssistantState.lastApplyReport = {
            completedAt: new Date().toISOString(),
            mode: setupAssistantState.mode,
            route: setupAssistantState.route,
            safetyMode,
            summaryLines,
            validationWarnings,
            failures: applyFailures,
            verification
        };

        if (applyFailures.length > 0) {
            const retryNow = await new Promise((resolve) => {
                swal({
                    title: 'Setup applied with partial failures',
                    text: `${summaryLines.join('\n')}\n\nRetry failed tasks now?`,
                    type: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Retry failures',
                    cancelButtonText: 'Done',
                    showLoaderOnConfirm: true,
                    closeOnConfirm: false
                }, (isConfirm) => resolve(isConfirm === true));
            });

            if (retryNow) {
                try {
                    const retryReport = await retrySetupAssistantFailures(applyFailures);
                    const retryLines = [
                        `Retried tasks: ${retryReport.retried}`,
                        `Resolved: ${retryReport.resolved}`,
                        `Remaining: ${retryReport.remaining.length}`
                    ];
                    swal({
                        title: retryReport.remaining.length ? 'Retry completed with remaining issues' : 'Retry completed',
                        text: retryLines.join('\n'),
                        type: retryReport.remaining.length ? 'warning' : 'success'
                    });
                } catch (error) {
                    showError('Retry failed', error);
                }
            }
            return;
        }

        const undoNow = await confirmSetupAssistantUndo(summaryLines.join('\n'), rollbackCreated);
        if (!undoNow || !rollbackCreated) {
            return;
        }
        try {
            if (typeof swal.close === 'function') {
                swal.close();
            }
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
    root.find('#fv-setup-focus-mode').off('click.fvsetup').on('click.fvsetup', () => {
        setupAssistantState.focusModeEnabled = setupAssistantState.focusModeEnabled === false;
        rerender();
    });
    root.find('#fv-setup-contrast-mode').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.contrastPreference = normalizeSetupAssistantContrastPreference($(event.currentTarget).val());
        rerender();
    });
    root.find('[data-fv-chip-toggle]').off('click.fvsetup').on('click.fvsetup', (event) => {
        const rowKey = String($(event.currentTarget).attr('data-fv-chip-toggle') || '').trim();
        if (!rowKey) {
            return;
        }
        if (!setupAssistantState.collapsedChipRows || typeof setupAssistantState.collapsedChipRows !== 'object') {
            setupAssistantState.collapsedChipRows = {};
        }
        setupAssistantState.collapsedChipRows[rowKey] = !(setupAssistantState.collapsedChipRows[rowKey] !== false);
        decorateSetupAssistantChipRows();
        persistSetupAssistantDraft();
    });
    root.find('#fv-setup-discard-draft').off('click.fvsetup').on('click.fvsetup', () => {
        clearSetupAssistantDraft();
        resetSetupAssistantState(true);
        summarizeSetupAssistantImportPlan('docker');
        summarizeSetupAssistantImportPlan('vm');
        refreshSetupAssistantRuleSuggestions();
        renderSetupAssistant();
    });
    root.find('#fv-setup-sidebar-toggle').off('click.fvsetup').on('click.fvsetup', () => {
        setupAssistantState.mobileSidebarSummaryOpen = !setupAssistantState.mobileSidebarSummaryOpen;
        rerender();
    });
    root.find('#fv-setup-prev').off('click.fvsetup').on('click.fvsetup', () => {
        jumpSetupAssistantToStep(setupAssistantState.step - 1);
        rerender();
    });
    root.find('#fv-setup-next').off('click.fvsetup').on('click.fvsetup', () => {
        jumpSetupAssistantToStep(setupAssistantState.step + 1);
        rerender();
    });
    root.find('#fv-setup-skip-review').off('click.fvsetup').on('click.fvsetup', () => {
        const lastIndex = Math.max(0, getSetupAssistantStepSequence().length - 1);
        jumpSetupAssistantToStep(lastIndex);
        rerender();
    });
    root.find('#fv-setup-apply').off('click.fvsetup').on('click.fvsetup', () => {
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        void applySetupAssistantPlan();
    });
    root.find('[data-fv-setup-step-jump]').off('click.fvsetup').on('click.fvsetup', (event) => {
        const target = Number($(event.currentTarget).attr('data-fv-setup-step-jump'));
        jumpSetupAssistantToStep(target);
        rerender();
    });
    root.find('input[name="fv-setup-route"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.route = String($(event.currentTarget).val() || 'new');
        if (setupAssistantState.route === 'new') {
            setupAssistantState.applyProfileDefaults = true;
            setupAssistantState.applyEnvironmentDefaults = true;
        }
        clampSetupAssistantStep();
        rerender();
    });
    root.find('#fv-setup-apply-detected').off('click.fvsetup').on('click.fvsetup', () => {
        applyDetectedSetupAssistantDefaults();
        rerender();
    });
    root.find('[data-fv-setup-mode]').off('click.fvsetup').on('click.fvsetup', (event) => {
        setupAssistantState.mode = String($(event.currentTarget).attr('data-fv-setup-mode') || 'basic') === 'advanced' ? 'advanced' : 'basic';
        rerender();
    });
    root.find('[data-fv-setup-experience]').off('click.fvsetup').on('click.fvsetup', (event) => {
        setupAssistantState.experienceMode = normalizeSetupAssistantExperienceMode($(event.currentTarget).attr('data-fv-setup-experience'));
        if (setupAssistantState.experienceMode === 'guided') {
            setupAssistantState.applySafetyMode = normalizeSetupAssistantSafetyMode(setupAssistantState.applySafetyMode);
            for (const type of ['docker', 'vm']) {
                setupAssistantState.importPlans[type].mode = 'merge';
                summarizeSetupAssistantImportPlan(type);
            }
        }
        rerender();
    });
    root.find('[data-fv-setup-quick-preset]').off('click.fvsetup').on('click.fvsetup', (event) => {
        const presetId = String($(event.currentTarget).attr('data-fv-setup-quick-preset') || 'balanced');
        applySetupAssistantQuickPresetToState(presetId);
        setupAssistantState.presetDraftName = `${presetId}-profile`;
        rerender();
    });
    root.find('input[name="fv-setup-profile"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const value = String($(event.currentTarget).val() || 'balanced');
        setupAssistantState.profile = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, value) ? value : 'balanced';
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('#fv-setup-apply-profile').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.applyProfileDefaults = $(event.currentTarget).prop('checked') === true;
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('input[name="fv-setup-environment"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.environmentPreset = normalizeSetupAssistantEnvironmentPreset($(event.currentTarget).val());
        if (setupAssistantState.applyEnvironmentDefaults) {
            applySetupAssistantEnvironmentPresetToState();
        }
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('#fv-setup-apply-environment').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.applyEnvironmentDefaults = $(event.currentTarget).prop('checked') === true;
        if (setupAssistantState.applyEnvironmentDefaults) {
            applySetupAssistantEnvironmentPresetToState();
        }
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('#fv-setup-dry-run').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.dryRunOnly = $(event.currentTarget).prop('checked') === true;
        rerender();
    });
    root.find('#fv-setup-copy-summary').off('click.fvsetup').on('click.fvsetup', () => {
        void copySetupAssistantSummaryToClipboard();
    });
    root.find('input[name="fv-setup-safety-mode"]').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.applySafetyMode = normalizeSetupAssistantSafetyMode($(event.currentTarget).val());
        rerender();
    });
    root.find('#fv-setup-preset-name').off('input.fvsetup').on('input.fvsetup', (event) => {
        setupAssistantState.presetDraftName = String($(event.currentTarget).val() || '').slice(0, 60);
    });
    root.find('#fv-setup-preset-select').off('change.fvsetup').on('change.fvsetup', (event) => {
        setupAssistantState.selectedPresetId = String($(event.currentTarget).val() || '');
        rerender();
    });
    root.find('#fv-setup-preset-save').off('click.fvsetup').on('click.fvsetup', () => {
        const result = saveCurrentSetupAssistantPreset(setupAssistantState.presetDraftName);
        if (!result.ok) {
            showError('Save preset failed', new Error(result.error || 'Unable to save preset.'));
            return;
        }
        setupAssistantState.selectedPresetId = result.id;
        showToastMessage({
            title: 'Preset saved',
            message: `Saved "${result.name}".`,
            level: 'success',
            durationMs: 2200
        });
        rerender();
    });
    root.find('#fv-setup-preset-load').off('click.fvsetup').on('click.fvsetup', () => {
        const selectedId = String(setupAssistantState.selectedPresetId || '').trim();
        if (!selectedId) {
            return;
        }
        if (!loadSetupAssistantPresetById(selectedId)) {
            showError('Load preset failed', new Error('Preset could not be loaded.'));
            return;
        }
        const selected = readSetupAssistantPresetStore().find((entry) => String(entry.id || '') === selectedId);
        setupAssistantState.presetDraftName = String(selected?.name || setupAssistantState.presetDraftName || '');
        showToastMessage({
            title: 'Preset loaded',
            message: selected?.name ? `Loaded "${selected.name}".` : 'Preset loaded.',
            level: 'success',
            durationMs: 2200
        });
        rerender();
    });
    root.find('#fv-setup-preset-delete').off('click.fvsetup').on('click.fvsetup', () => {
        const selectedId = String(setupAssistantState.selectedPresetId || '').trim();
        if (!selectedId) {
            return;
        }
        const selected = readSetupAssistantPresetStore().find((entry) => String(entry.id || '') === selectedId);
        if (!deleteSetupAssistantPresetById(selectedId)) {
            showError('Delete preset failed', new Error('Preset could not be removed.'));
            return;
        }
        setupAssistantState.selectedPresetId = '';
        showToastMessage({
            title: 'Preset deleted',
            message: selected?.name ? `Deleted "${selected.name}".` : 'Preset deleted.',
            level: 'info',
            durationMs: 2200
        });
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
            setupAssistantState.importPlans[type].fileSizeBytes = Math.max(0, Number(selected.size) || 0);
            setupAssistantState.importPlans[type].fileLastModified = Number(selected.lastModified) > 0
                ? new Date(Number(selected.lastModified)).toISOString()
                : '';
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
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('[data-fv-setup-behavior-status]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-status'));
        setupAssistantState.behavior[type].statusMode = normalizeStatusMode($(event.currentTarget).val());
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('[data-fv-setup-behavior-status-warn]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-status-warn'));
        const value = Number($(event.currentTarget).val());
        setupAssistantState.behavior[type].statusWarnStoppedPercent = Number.isFinite(value)
            ? Math.max(0, Math.min(100, Math.round(value)))
            : 60;
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('[data-fv-setup-behavior-hide-empty]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-hide-empty'));
        setupAssistantState.behavior[type].hideEmptyFolders = $(event.currentTarget).prop('checked') === true;
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('[data-fv-setup-behavior-health-cards]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-health-cards'));
        setupAssistantState.behavior[type].healthCardsEnabled = $(event.currentTarget).prop('checked') === true;
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    root.find('[data-fv-setup-behavior-runtime-badge]').off('change.fvsetup').on('change.fvsetup', (event) => {
        const type = normalizeManagedType($(event.currentTarget).attr('data-fv-setup-behavior-runtime-badge'));
        setupAssistantState.behavior[type].runtimeBadgeEnabled = $(event.currentTarget).prop('checked') === true;
        setupAssistantState.quickPreset = 'custom';
        rerender();
    });
    $('#fv-setup-assistant-overlay').off('click.fvsetup').on('click.fvsetup', () => {
        if (setupAssistantState.busy || setupAssistantState.applying) {
            return;
        }
        closeSetupAssistant();
    });
};

window.FolderViewPlusWizardModuleLoaded = true;
