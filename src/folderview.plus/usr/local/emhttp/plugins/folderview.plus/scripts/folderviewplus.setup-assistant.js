/* Setup assistant presets and quick-profile helpers extracted from folderviewplus.js. */
const WIZARD_DONE_STORAGE_KEY = 'fv.settings.wizard.v1.done';
const SETUP_ASSISTANT_DONE_STORAGE_KEY = 'fv.settings.setupAssistant.v2.done';
const SETUP_ASSISTANT_DRAFT_STORAGE_KEY = 'fv.settings.setupAssistant.v2.draft';
const SETUP_ASSISTANT_PRESETS_STORAGE_KEY = 'fv.settings.setupAssistant.v2.presets';
const SETUP_ASSISTANT_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const SETUP_ASSISTANT_PRESETS_MAX = 20;
const SETUP_ASSISTANT_VERSION = 2;

const SETUP_ASSISTANT_STEPS = ['welcome', 'profile', 'import', 'rules', 'behavior', 'review'];
const SETUP_ASSISTANT_STEPS_BY_ROUTE = {
    new: ['welcome', 'profile', 'templates', 'rules', 'behavior', 'review'],
    migrate: [...SETUP_ASSISTANT_STEPS],
    advanced: [...SETUP_ASSISTANT_STEPS]
};
const SETUP_ASSISTANT_EXPERIENCE_MODES = new Set(['guided', 'expert']);
const SETUP_ASSISTANT_APPLY_SAFETY_MODES = new Set(['auto', 'strict', 'fast']);
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
const QUICK_PROFILE_PRESETS = {
    balanced: {
        label: 'Balanced',
        description: 'Recommended defaults for daily use.',
        profile: 'balanced',
        environment: 'home_lab'
    },
    minimal: {
        label: 'Minimal',
        description: 'Lower-noise layout with fewer visual badges and cards.',
        profile: 'safe',
        environment: 'home_lab',
        overridesByType: {
            docker: {
                hideEmptyFolders: true,
                health: {
                    cardsEnabled: false,
                    runtimeBadgeEnabled: false
                },
                badges: {
                    running: true,
                    stopped: false,
                    updates: true
                }
            },
            vm: {
                hideEmptyFolders: true,
                health: {
                    cardsEnabled: false,
                    runtimeBadgeEnabled: false
                },
                badges: {
                    running: true,
                    stopped: false
                }
            }
        }
    },
    power: {
        label: 'Power',
        description: 'Higher visibility and faster telemetry refresh for large installs.',
        profile: 'power',
        environment: 'production'
    },
    media_stack: {
        label: 'Media Stack',
        description: 'Balanced runtime defaults with media-focused sort and thresholds.',
        profile: 'balanced',
        environment: 'media_stack'
    }
};

const normalizeQuickProfilePresetId = (value, fallback = 'balanced') => {
    const presetId = String(value || '').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(QUICK_PROFILE_PRESETS, presetId)) {
        return presetId;
    }
    const fallbackId = String(fallback || '').trim().toLowerCase();
    if (!fallbackId) {
        return '';
    }
    return Object.prototype.hasOwnProperty.call(QUICK_PROFILE_PRESETS, fallbackId)
        ? fallbackId
        : 'balanced';
};

const validateSetupAssistantImportPlans = (importPlans = {}) => {
    const blockers = [];
    const warnings = [];
    const includeTypes = [];
    for (const type of ['docker', 'vm']) {
        const plan = importPlans && typeof importPlans === 'object' ? importPlans[type] : null;
        if (!plan || plan.include !== true) continue;
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
    return { blockers, warnings, includeTypes };
};

Object.assign(window, {
    WIZARD_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_STORAGE_KEY,
    SETUP_ASSISTANT_PRESETS_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_MAX_AGE_MS,
    SETUP_ASSISTANT_PRESETS_MAX,
    SETUP_ASSISTANT_VERSION,
    SETUP_ASSISTANT_STEPS,
    SETUP_ASSISTANT_STEPS_BY_ROUTE,
    SETUP_ASSISTANT_EXPERIENCE_MODES,
    SETUP_ASSISTANT_APPLY_SAFETY_MODES,
    SETUP_ASSISTANT_ENV_PRESETS,
    SETUP_ASSISTANT_PROFILE_PRESETS,
    QUICK_PROFILE_PRESETS,
    normalizeQuickProfilePresetId,
    validateSetupAssistantImportPlans
});

window.FolderViewPlusSetupAssistantSupport = Object.freeze({
    WIZARD_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_STORAGE_KEY,
    SETUP_ASSISTANT_PRESETS_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_MAX_AGE_MS,
    SETUP_ASSISTANT_PRESETS_MAX,
    SETUP_ASSISTANT_VERSION,
    SETUP_ASSISTANT_STEPS,
    SETUP_ASSISTANT_STEPS_BY_ROUTE,
    SETUP_ASSISTANT_EXPERIENCE_MODES,
    SETUP_ASSISTANT_APPLY_SAFETY_MODES,
    SETUP_ASSISTANT_ENV_PRESETS,
    SETUP_ASSISTANT_PROFILE_PRESETS,
    QUICK_PROFILE_PRESETS,
    normalizeQuickProfilePresetId,
    validateSetupAssistantImportPlans
});
window.FolderViewPlusSetupAssistantSupportModuleLoaded = true;
