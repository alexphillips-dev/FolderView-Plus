/* Setup assistant presets and quick-profile helpers extracted from folderviewplus.js. */
const WIZARD_DONE_STORAGE_KEY = 'fv.settings.wizard.v1.done';
const SETUP_ASSISTANT_DONE_STORAGE_KEY = 'fv.settings.setupAssistant.v2.done';
const SETUP_ASSISTANT_DRAFT_STORAGE_KEY = 'fv.settings.setupAssistant.v2.draft';
const SETUP_ASSISTANT_PRESETS_STORAGE_KEY = 'fv.settings.setupAssistant.v2.presets';
const SETUP_ASSISTANT_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const SETUP_ASSISTANT_PRESETS_MAX = 20;
const SETUP_ASSISTANT_VERSION = 2;

const QUICK_PRESET_ACTIVE_STORAGE_KEY = 'fv.settings.quickPresetActive.v1';

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

const getActiveQuickPresetUi = () => {
    try {
        return normalizeQuickProfilePresetId(localStorage.getItem(QUICK_PRESET_ACTIVE_STORAGE_KEY) || '', '');
    } catch (_error) {
        return '';
    }
};

const setActiveQuickPresetUi = (presetId) => {
    const key = normalizeQuickProfilePresetId(presetId, '');
    try {
        if (!key) {
            removeSettingsStorage(QUICK_PRESET_ACTIVE_STORAGE_KEY, { delayMs: 40, idle: true });
            return;
        }
        writeSettingsStorage(QUICK_PRESET_ACTIVE_STORAGE_KEY, key, { delayMs: 60, idle: true });
    } catch (_error) {
        // Ignore storage failures; runtime still works.
    }
};

const renderQuickProfilePresetButtons = () => {
    const active = getActiveQuickPresetUi();
    $('.fv-quick-presets [data-fv-quick-preset]').each((_, button) => {
        const key = normalizeQuickProfilePresetId($(button).attr('data-fv-quick-preset') || '', '');
        $(button).toggleClass('is-active', Boolean(active) && key === active);
    });
};

const applyQuickProfileOverrides = (prefs, overrides = null) => {
    const source = overrides && typeof overrides === 'object' ? overrides : {};
    const normalized = utils.normalizePrefs({
        ...prefs,
        ...source,
        badges: {
            ...(prefs?.badges || {}),
            ...(source?.badges || {})
        },
        health: {
            ...(prefs?.health || {}),
            ...(source?.health || {})
        },
        status: {
            ...(prefs?.status || {}),
            ...(source?.status || {})
        },
        dashboard: {
            ...(prefs?.dashboard || {}),
            ...(source?.dashboard || {})
        }
    });
    return normalized;
};

const applyQuickProfilePreset = async (presetId) => {
    const key = normalizeQuickProfilePresetId(presetId, 'balanced');
    const preset = QUICK_PROFILE_PRESETS[key] || QUICK_PROFILE_PRESETS.balanced;
    const profileKey = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_PROFILE_PRESETS, preset.profile)
        ? preset.profile
        : 'balanced';
    const envKey = Object.prototype.hasOwnProperty.call(SETUP_ASSISTANT_ENV_PRESETS, preset.environment)
        ? preset.environment
        : 'home_lab';
    const envBehavior = SETUP_ASSISTANT_ENV_PRESETS[envKey]?.behavior || {};
    const applyToTypes = ['docker', 'vm'];

    swal({
        title: `Apply ${preset.label} preset?`,
        text: `${preset.description}\n\nThis updates Docker and VM behavior/runtime defaults in one step.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply preset',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            for (const type of applyToTypes) {
                const current = utils.normalizePrefs(prefsByType[type] || {});
                const withProfile = applySetupAssistantProfileToPrefs(current, profileKey);
                const withEnvironment = applySetupAssistantBehaviorToPrefs(
                    withProfile,
                    normalizeSetupAssistantBehaviorFromValue(type, envBehavior[type] || {})
                );
                const overrides = preset?.overridesByType?.[type] || null;
                const next = applyQuickProfileOverrides(withEnvironment, overrides);
                prefsByType[type] = await postPrefs(type, next);
            }
            await Promise.all([refreshType('docker'), refreshType('vm')]);
            setActiveQuickPresetUi(key);
            renderQuickProfilePresetButtons();
            addActivityEntry(`Quick profile preset applied: ${preset.label}.`, 'success');
            showToastMessage({
                title: 'Preset applied',
                message: `${preset.label} preset was applied to Docker and VMs.`,
                level: 'success',
                durationMs: 3800
            });
        } catch (error) {
            showError('Preset apply failed', error);
        }
    });
};

Object.assign(window, {
    WIZARD_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_STORAGE_KEY,
    SETUP_ASSISTANT_PRESETS_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_MAX_AGE_MS,
    SETUP_ASSISTANT_PRESETS_MAX,
    SETUP_ASSISTANT_VERSION,
    QUICK_PRESET_ACTIVE_STORAGE_KEY,
    SETUP_ASSISTANT_STEPS,
    SETUP_ASSISTANT_STEPS_BY_ROUTE,
    SETUP_ASSISTANT_EXPERIENCE_MODES,
    SETUP_ASSISTANT_APPLY_SAFETY_MODES,
    SETUP_ASSISTANT_ENV_PRESETS,
    SETUP_ASSISTANT_PROFILE_PRESETS,
    QUICK_PROFILE_PRESETS,
    normalizeQuickProfilePresetId,
    getActiveQuickPresetUi,
    setActiveQuickPresetUi,
    renderQuickProfilePresetButtons,
    applyQuickProfileOverrides,
    applyQuickProfilePreset
});

window.FolderViewPlusSetupAssistantSupport = Object.freeze({
    WIZARD_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DONE_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_STORAGE_KEY,
    SETUP_ASSISTANT_PRESETS_STORAGE_KEY,
    SETUP_ASSISTANT_DRAFT_MAX_AGE_MS,
    SETUP_ASSISTANT_PRESETS_MAX,
    SETUP_ASSISTANT_VERSION,
    QUICK_PRESET_ACTIVE_STORAGE_KEY,
    SETUP_ASSISTANT_STEPS,
    SETUP_ASSISTANT_STEPS_BY_ROUTE,
    SETUP_ASSISTANT_EXPERIENCE_MODES,
    SETUP_ASSISTANT_APPLY_SAFETY_MODES,
    SETUP_ASSISTANT_ENV_PRESETS,
    SETUP_ASSISTANT_PROFILE_PRESETS,
    QUICK_PROFILE_PRESETS,
    normalizeQuickProfilePresetId,
    getActiveQuickPresetUi,
    setActiveQuickPresetUi,
    renderQuickProfilePresetButtons,
    applyQuickProfileOverrides,
    applyQuickProfilePreset
});
window.FolderViewPlusSetupAssistantSupportModuleLoaded = true;
