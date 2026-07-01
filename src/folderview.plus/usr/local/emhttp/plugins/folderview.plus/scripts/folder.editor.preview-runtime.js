// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorPreviewRuntime = factory();
    root.FolderViewPlusFolderEditorPreviewRuntimeModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const $ = deps.$ || win?.jQuery || win?.$;
        const previewModule = deps.previewModule && typeof deps.previewModule.createApi === 'function'
            ? deps.previewModule
            : null;
        const type = String(deps.type || '').trim();
        const modernEditorEnabled = deps.modernEditorEnabled === true;
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : (() => null);
        const getIncludedMemberNames = typeof deps.getIncludedMemberNames === 'function' ? deps.getIncludedMemberNames : (() => []);
        const getMemberMapByName = typeof deps.getMemberMapByName === 'function' ? deps.getMemberMapByName : (() => new Map());
        const getAllMembers = typeof deps.getAllMembers === 'function' ? deps.getAllMembers : (() => []);
        const normalizePreviewRowLimit = typeof deps.normalizePreviewRowLimit === 'function' ? deps.normalizePreviewRowLimit : (() => 1);
        const normalizeDropdownStyle = typeof deps.normalizeDropdownStyle === 'function' ? deps.normalizeDropdownStyle : (() => 'minimal');
        const normalizeHexColor = typeof deps.normalizeHexColor === 'function' ? deps.normalizeHexColor : ((value, fallback) => String(value || fallback || ''));
        const normalizePositiveInt = typeof deps.normalizePositiveInt === 'function' ? deps.normalizePositiveInt : ((value, fallback) => Number(value) || fallback || 1);
        const getDropdownStyleTokens = typeof deps.getDropdownStyleTokens === 'function'
            ? deps.getDropdownStyleTokens
            : (() => ({
                minWidth: '12px',
                height: '16px',
                padding: '0 2px',
                radius: '0px',
                border: 'transparent',
                hoverBorder: 'transparent',
                background: 'transparent',
                hoverBackground: 'transparent',
                shadow: 'none',
                hoverShadow: 'none'
            }));
        const buildSampleMemberState = typeof deps.buildSampleMemberState === 'function'
            ? deps.buildSampleMemberState
            : ((_member, index = 0) => {
                const labels = [
                    { label: 'started', color: '#7bd88f' },
                    { label: 'paused', color: '#f3c969' },
                    { label: 'stopped', color: '#ff6b6b' }
                ];
                return labels[index % labels.length];
            });
        const normalizeParentFolderId = typeof deps.normalizeParentFolderId === 'function'
            ? deps.normalizeParentFolderId
            : ((value) => String(value || '').trim());
        const getPreviewSignals = typeof deps.getPreviewSignals === 'function'
            ? deps.getPreviewSignals
            : (() => null);
        const getNestedPreviewSample = typeof deps.getNestedPreviewSample === 'function'
            ? deps.getNestedPreviewSample
            : (() => null);
        const getNestedPreviewSamples = typeof deps.getNestedPreviewSamples === 'function'
            ? deps.getNestedPreviewSamples
            : (() => {
                const sample = getNestedPreviewSample();
                return sample ? [sample] : [];
            });
        const applyTypePreviewConstraints = typeof deps.applyTypePreviewConstraints === 'function'
            ? deps.applyTypePreviewConstraints
            : (() => {});
        const isFolderAccentEnabled = typeof deps.isFolderAccentEnabled === 'function'
            ? deps.isFolderAccentEnabled
            : ((settings) => settings?.folder_accent_enabled === true);
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const updateMemberStats = typeof deps.updateMemberStats === 'function' ? deps.updateMemberStats : (() => {});
        const updateInheritedFieldIndicators = typeof deps.updateInheritedFieldIndicators === 'function'
            ? deps.updateInheritedFieldIndicators
            : (() => {});
        const updateChangeSummaryPanel = typeof deps.updateChangeSummaryPanel === 'function'
            ? deps.updateChangeSummaryPanel
            : (() => {});
        const updateSectionStateIndicators = typeof deps.updateSectionStateIndicators === 'function'
            ? deps.updateSectionStateIndicators
            : (() => {});
        const enforceLeftAlignedSettingsLayout = typeof deps.enforceLeftAlignedSettingsLayout === 'function'
            ? deps.enforceLeftAlignedSettingsLayout
            : (() => {});

        let previewApi = null;
        let previewRenderTimer = null;

        const getPreviewApi = () => {
            if (previewApi || !previewModule) {
                return previewApi;
            }
            previewApi = previewModule.createApi({
                $,
                type,
                shouldRender: () => modernEditorEnabled,
                shouldUpdate: () => modernEditorEnabled,
                getForm,
                getIncludedMemberNames,
                getMemberMapByName,
                getAllMembers,
                normalizePreviewRowLimit,
                normalizeDropdownStyle,
                normalizeHexColor,
                normalizePositiveInt,
                getDropdownStyleTokens,
                buildSampleMemberState,
                normalizeParentFolderId,
                getPreviewSignals,
                getNestedPreviewSample,
                getNestedPreviewSamples,
                previewModelModule: deps.previewModelModule,
                escapeHtml,
                updateMemberStats,
                onAfterSummaryUpdate: () => {
                    updateInheritedFieldIndicators();
                    updateChangeSummaryPanel();
                    updateSectionStateIndicators();
                },
                defaultBorderColor: deps.defaultBorderColor,
                defaultPreviewBorderWidth: deps.defaultPreviewBorderWidth,
                defaultPreviewVerticalBarsWidth: deps.defaultPreviewVerticalBarsWidth,
                defaultDropdownColor: deps.defaultDropdownColor,
                defaultDropdownHoverColor: deps.defaultDropdownHoverColor,
                defaultFolderAccentColor: deps.defaultFolderAccentColor,
                defaultFolderIconPath: deps.defaultFolderIconPath,
                defaultFolderStatusColors: deps.defaultFolderStatusColors,
                iconFallbackPath: deps.iconFallbackPath,
                previewModeLabels: deps.previewModeLabels,
                contextModeLabels: deps.contextModeLabels,
                supportedDropdownStyles: deps.supportedDropdownStyles,
                defaultDividerColor: deps.defaultDividerColor,
                isFolderAccentEnabled
            });
            return previewApi;
        };

        const renderLivePreviewCanvas = () => {
            getPreviewApi()?.renderLivePreviewCanvas();
        };

        const updateLiveSummary = () => {
            getPreviewApi()?.updateLiveSummary();
        };

        const schedulePreviewRender = () => {
            const run = () => {
                previewRenderTimer = null;
                renderLivePreviewCanvas();
            };
            if (previewRenderTimer !== null) {
                if (typeof win?.cancelAnimationFrame === 'function') {
                    win.cancelAnimationFrame(previewRenderTimer);
                } else {
                    clearTimeout(previewRenderTimer);
                }
                previewRenderTimer = null;
            }
            if (typeof win?.requestAnimationFrame === 'function') {
                previewRenderTimer = win.requestAnimationFrame(run);
                return;
            }
            previewRenderTimer = setTimeout(run, 16);
        };

        const updatePreviewConstraints = () => {
            if (!$) {
                return;
            }
            const form = getForm();
            if (!form) {
                return;
            }

            $('[constraint*="preview-"]').hide();
            $(`[constraint*="preview-${form.preview?.value}"]`).show();
            $('[constraint*="context-"]').hide();
            $(`[constraint*="context-${form.context?.value}"]`).show();
            $('[constraint*="context_graph-"]').hide();
            $('[constraint*="border-color"]').hide();
            $('[constraint*="bars-color"]').hide();
            $('[constraint*="accent-color"]').hide();

            if (String(form.context?.value) === '2') {
                $(`[constraint*="context_graph-${form.context_graph?.value}"]`).show();
            }
            if (String(form.preview?.value) !== '0' && form.preview_border?.checked === true) {
                $('[constraint*="border-color"]').show();
            }
            if (form.preview_vertical_bars?.checked === true) {
                $('[constraint*="bars-color"]').show();
            }
            if (form.folder_accent_enabled?.checked === true) {
                $('[constraint*="accent-color"]').show();
            }
            $('[constraint*="folder-webui"]').hide();
            if (form.folder_webui?.checked === true) {
                $('[constraint*="folder-webui"]').show();
            }
            applyTypePreviewConstraints({ $, form });

            $('div.canvas > form.folder-editor-form')
                .toggleClass('fv-preview-disabled', String(form.preview?.value) === '0')
                .toggleClass('fv-preview-border-enabled', form.preview_border?.checked === true)
                .toggleClass('fv-preview-bars-enabled', form.preview_vertical_bars?.checked === true)
                .toggleClass('fv-chevron-boxed', normalizeDropdownStyle(form.dropdown_style?.value) === 'boxed');
            $('.fv-section-shell[data-section-shell="preview"]').toggleClass('is-preview-disabled', String(form.preview?.value) === '0');
            $('.fv-section-shell[data-section-shell="chevron"]').toggleClass('is-boxed', normalizeDropdownStyle(form.dropdown_style?.value) === 'boxed');

            enforceLeftAlignedSettingsLayout();
            updateInheritedFieldIndicators();
            renderLivePreviewCanvas();
        };

        return Object.freeze({
            renderLivePreviewCanvas,
            updateLiveSummary,
            schedulePreviewRender,
            updatePreviewConstraints
        });
    };

    return Object.freeze({
        createApi
    });
}));
