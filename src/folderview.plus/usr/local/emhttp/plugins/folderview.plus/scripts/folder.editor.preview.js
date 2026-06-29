// @ts-check
(function fvplusFolderEditorPreviewScope(window) {
    'use strict';

    const createApi = (deps = {}) => {
        const $ = deps.$;
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : (() => null);
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const shouldRender = typeof deps.shouldRender === 'function' ? deps.shouldRender : (() => true);
        const shouldUpdate = typeof deps.shouldUpdate === 'function' ? deps.shouldUpdate : (() => true);
        const onAfterSummaryUpdate = typeof deps.onAfterSummaryUpdate === 'function' ? deps.onAfterSummaryUpdate : (() => {});
        const updateMemberStats = typeof deps.updateMemberStats === 'function' ? deps.updateMemberStats : (() => {});
        const getIncludedMemberNames = typeof deps.getIncludedMemberNames === 'function' ? deps.getIncludedMemberNames : (() => []);
        const getMemberMapByName = typeof deps.getMemberMapByName === 'function' ? deps.getMemberMapByName : (() => new Map());
        const getAllMembers = typeof deps.getAllMembers === 'function' ? deps.getAllMembers : (() => []);
        const normalizePreviewRowLimit = typeof deps.normalizePreviewRowLimit === 'function' ? deps.normalizePreviewRowLimit : (() => 1);
        const normalizeDropdownStyle = typeof deps.normalizeDropdownStyle === 'function' ? deps.normalizeDropdownStyle : (() => 'minimal');
        const normalizeHexColor = typeof deps.normalizeHexColor === 'function' ? deps.normalizeHexColor : ((value, fallback) => String(value || fallback || ''));
        const normalizePositiveInt = typeof deps.normalizePositiveInt === 'function' ? deps.normalizePositiveInt : ((value, fallback) => Number(value) || fallback || 1);
        const isFolderAccentEnabled = typeof deps.isFolderAccentEnabled === 'function'
            ? deps.isFolderAccentEnabled
            : ((settings) => settings?.folder_accent_enabled === true);
        const getDropdownStyleTokens = typeof deps.getDropdownStyleTokens === 'function' ? deps.getDropdownStyleTokens : (() => ({
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
        const previewModelModule = deps.previewModelModule
            && typeof deps.previewModelModule.createChildFolderPreviewModel === 'function'
            ? deps.previewModelModule
            : {
                createChildFolderPreviewModel: (input = {}) => Object.freeze({
                    id: String(input.id || input.childId || '').trim(),
                    childId: String(input.id || input.childId || '').trim(),
                    sourceId: String(input.sourceId || '').trim(),
                    name: String(input.name || input.childFolder?.name || 'Child folder').trim() || 'Child folder',
                    icon: String(input.icon || input.childFolder?.icon || '').trim(),
                    memberCount: Number.isFinite(Number(input.memberCount)) ? Math.max(0, Number(input.memberCount)) : 0,
                    statusLabel: `${Number.isFinite(Number(input.memberCount)) ? Math.max(0, Number(input.memberCount)) : 0} items`
                })
            };

        const renderLivePreviewCanvas = () => {
            if (!$ || !shouldRender()) {
                return;
            }
            const form = getForm();
            const canvas = $('#fvLivePreviewCanvas');
            if (!form || !canvas.length) {
                return;
            }

            const memberNames = getIncludedMemberNames();
            const memberMap = getMemberMapByName();
            const selectedMembers = memberNames.map((name) => memberMap.get(name)).filter(Boolean);
            const previewMode = Number(form.preview?.value || 0);
            const rawPreviewStatusMode = String(form.preview_status?.value || '').trim().toLowerCase();
            const previewStatusMode = ['none', 'hide', 'hidden', 'off', 'false', '0', 'no'].includes(rawPreviewStatusMode)
                ? 'none'
                : (['symbol', 'grayscale'].includes(rawPreviewStatusMode) ? rawPreviewStatusMode : 'symbol');
            const rowsLimit = normalizePreviewRowLimit(form.preview_rows?.value);
            const renderLimit = rowsLimit === 0 ? 10 : Math.max(4, Math.min(10, rowsLimit * 4));
            const sampleMembers = selectedMembers.slice(0, renderLimit);
            const dropdownStyle = normalizeDropdownStyle(form.dropdown_style?.value);
            const borderEnabled = previewMode !== 0 && form.preview_border?.checked === true;
            const borderColor = normalizeHexColor(form.preview_border_color?.value, deps.defaultBorderColor || '#afa89e');
            const borderWidth = String(normalizePositiveInt(form.preview_border_width?.value, deps.defaultPreviewBorderWidth || 1, 1, 4));
            const dividerEnabled = previewMode !== 0 && form.preview_vertical_bars?.checked === true;
            const dividerColor = normalizeHexColor(form.preview_vertical_bars_color?.value || deps.defaultDividerColor || '', deps.defaultDividerColor || '#afa89e');
            const dividerWidth = String(normalizePositiveInt(form.preview_vertical_bars_width?.value, deps.defaultPreviewVerticalBarsWidth || 1, 1, 4));
            const dropdownColor = normalizeHexColor(form.dropdown_color?.value, deps.defaultDropdownColor || '#ff9a3c');
            const dropdownHoverColor = normalizeHexColor(form.dropdown_hover_color?.value, deps.defaultDropdownHoverColor || '#111111');
            const accentEnabled = isFolderAccentEnabled({ folder_accent_enabled: form.folder_accent_enabled?.checked === true });
            const accentColor = normalizeHexColor(form.folder_accent_color?.value, deps.defaultFolderAccentColor || '#ffca63');
            const icon = String(form.icon?.value || '').trim() || deps.defaultFolderIconPath || '';
            const name = String(form.name?.value || '').trim() || 'Unnamed folder';
            const hideNestedPreviewItems = form.preview_hide_nested_items?.checked === true;

            const memberPreviewItems = sampleMembers.map((member, index) => {
                const memberName = escapeHtml(member?.Name || `Member ${index + 1}`);
                const memberIcon = escapeHtml(member?.Icon || deps.iconFallbackPath || '');
                const state = buildSampleMemberState(member, index);
                const stateLabel = escapeHtml(state.label);
                const stateColor = escapeHtml(state.color);
                const imageStyle = form.preview_grayscale?.checked === true || (previewMode === 2 && previewStatusMode === 'grayscale' && state.label !== 'Started') ? ' style="filter: grayscale(100%);"' : '';
                return `
                    <span class="fv-live-member fv-live-member-preview-${previewMode}" style="${dividerEnabled && index < sampleMembers.length - 1 ? `--fv-divider-color:${dividerColor};--fv-divider-width:${dividerWidth}px;` : ''}">
                        <img src="${memberIcon}" alt="" onerror="this.src='${deps.iconFallbackPath || ''}';"${imageStyle}>
                        ${previewMode === 2 ? '' : `<span class="fv-live-member-name">${memberName}</span>`}
                        ${previewMode === 2
                            ? (previewStatusMode === 'symbol' ? `<span class="fv-live-member-status is-symbol" style="color:${stateColor};" title="${stateLabel}"><i class="fa fa-circle" aria-hidden="true"></i></span>` : '')
                            : `<span class="fv-live-member-status" style="color:${stateColor};">${stateLabel}</span>`}
                    </span>
                `;
            });
            if (hideNestedPreviewItems && previewMode !== 0) {
                const nestedPreviewSamples = getNestedPreviewSamples();
                const samples = Array.isArray(nestedPreviewSamples) && nestedPreviewSamples.length
                    ? nestedPreviewSamples
                    : [getNestedPreviewSample()].filter(Boolean);
                samples.forEach((nestedPreviewSample) => {
                    const nestedPreviewModel = previewModelModule.createChildFolderPreviewModel({
                        ...nestedPreviewSample,
                        childId: nestedPreviewSample.childId || nestedPreviewSample.id,
                        childFolder: nestedPreviewSample,
                        icon: nestedPreviewSample.icon || icon || deps.defaultFolderIconPath || ''
                    });
                    const nestedPreviewName = escapeHtml(nestedPreviewModel.name || 'Child folder');
                    const nestedPreviewIcon = escapeHtml(nestedPreviewModel.icon || icon || deps.defaultFolderIconPath || '');
                    const nestedPreviewChildId = escapeHtml(nestedPreviewModel.childId || '');
                    const nestedPreviewSourceId = escapeHtml(nestedPreviewModel.sourceId || '');
                    memberPreviewItems.push(`
                        <span class="fv-live-member fv-live-member-preview-${previewMode} fv-live-member-child-folder" data-nested-preview-source="${nestedPreviewSourceId}" data-nested-preview-child="${nestedPreviewChildId}">
                            <img src="${nestedPreviewIcon}" alt="" onerror="this.src='${deps.defaultFolderIconPath || ''}';">
                            ${previewMode === 2 ? '' : `<span class="fv-live-member-name">${nestedPreviewName}</span>`}
                            ${previewMode === 2
                                ? (previewStatusMode === 'symbol' ? '<span class="fv-live-member-status is-symbol" title="Nested folder"><i class="fa fa-folder" aria-hidden="true"></i></span>' : '')
                                : `<span class="fv-live-member-status">${escapeHtml(nestedPreviewModel.statusLabel)}</span>`}
                        </span>
                    `);
                });
            }

            const membersHtml = previewMode === 0
                ? '<div class="fv-live-preview-empty">Preview is currently disabled. The folder row will show the title and chevron only.</div>'
                : (memberPreviewItems.length > 0
                    ? memberPreviewItems.join('')
                    : '<div class="fv-live-preview-empty">Select or match at least one member to see how the row preview will render.</div>');

            const dropdownTokens = getDropdownStyleTokens(dropdownStyle, dropdownColor, dropdownHoverColor);
            const rowClass = `fv-live-preview-row preview-${previewMode}${borderEnabled ? ' has-border' : ''}${accentEnabled ? ' has-accent' : ''} is-${dropdownStyle}${rowsLimit !== 1 ? ' is-multi-row' : ' is-single-row'}`;
            const surfaceClass = deps.wrapPreviewSurface === false ? '' : 'fv-live-preview-surface';
            canvas.html(`
                ${surfaceClass ? `<div class="${surfaceClass}">` : ''}
                    <div class="${rowClass}" style="--fv-preview-border-color:${borderColor};--fv-preview-border-width:${borderWidth}px;--fv-folder-accent-color:${accentColor};--fv-chevron-color:${dropdownColor};--fv-chevron-hover:${dropdownHoverColor};--fv-live-chevron-min-width:${dropdownTokens.minWidth};--fv-live-chevron-height:${dropdownTokens.height};--fv-live-chevron-padding:${dropdownTokens.padding};--fv-live-chevron-radius:${dropdownTokens.radius};--fv-live-chevron-border:${dropdownTokens.border};--fv-live-chevron-hover-border:${dropdownTokens.hoverBorder};--fv-live-chevron-bg:${dropdownTokens.background};--fv-live-chevron-hover-bg:${dropdownTokens.hoverBackground};--fv-live-chevron-shadow:${dropdownTokens.shadow};--fv-live-chevron-hover-shadow:${dropdownTokens.hoverShadow};">
                        <div class="fv-live-folder-head">
                            <div class="fv-live-folder-anchor">
                                <img class="fv-live-folder-icon" src="${escapeHtml(icon)}" alt="" onerror="this.src='${deps.defaultFolderIconPath || ''}';">
                                <div class="fv-live-folder-copy">
                                    <strong>${escapeHtml(name)}</strong>
                                    <span>${deps.previewModeLabels?.[previewMode] || 'Unknown'} preview</span>
                                </div>
                            </div>
                            <span class="fv-live-chevron fv-live-chevron-${dropdownStyle}" aria-hidden="true">
                                <i class="fa fa-chevron-down" aria-hidden="true"></i>
                            </span>
                        </div>
                        <div class="fv-live-member-lane">${membersHtml}</div>
                    </div>
                ${surfaceClass ? '</div>' : ''}
            `);
            const livePreviewRow = canvas.find('.fv-live-preview-row').get(0);
            const liveChevron = canvas.find('.fv-live-chevron').get(0);
            if (livePreviewRow && liveChevron && Array.isArray(deps.supportedDropdownStyles)) {
                deps.supportedDropdownStyles.forEach((styleName) => livePreviewRow.classList.remove(`is-${styleName}`));
                livePreviewRow.classList.add(`is-${dropdownStyle}`);
                livePreviewRow.style.setProperty('--fv-live-chevron-color', dropdownColor);
                livePreviewRow.style.setProperty('--fv-live-chevron-hover', dropdownHoverColor);
                livePreviewRow.style.setProperty('--fv-live-chevron-border', dropdownTokens.border);
                livePreviewRow.style.setProperty('--fv-live-chevron-hover-border', dropdownTokens.hoverBorder);
                livePreviewRow.style.setProperty('--fv-live-chevron-bg', dropdownTokens.background);
                livePreviewRow.style.setProperty('--fv-live-chevron-hover-bg', dropdownTokens.hoverBackground);
                livePreviewRow.style.setProperty('--fv-live-chevron-min-width', dropdownTokens.minWidth);
                livePreviewRow.style.setProperty('--fv-live-chevron-height', dropdownTokens.height);
                livePreviewRow.style.setProperty('--fv-live-chevron-padding', dropdownTokens.padding);
                livePreviewRow.style.setProperty('--fv-live-chevron-radius', dropdownTokens.radius);
                livePreviewRow.style.setProperty('--fv-live-chevron-shadow', dropdownTokens.shadow);
                livePreviewRow.style.setProperty('--fv-live-chevron-hover-shadow', dropdownTokens.hoverShadow);
                liveChevron.style.setProperty('--fv-live-chevron-color', dropdownColor);
                liveChevron.style.setProperty('--fv-live-chevron-hover', dropdownHoverColor);
                liveChevron.style.setProperty('--fv-live-chevron-border', dropdownTokens.border);
                liveChevron.style.setProperty('--fv-live-chevron-hover-border', dropdownTokens.hoverBorder);
                liveChevron.style.setProperty('--fv-live-chevron-bg', dropdownTokens.background);
                liveChevron.style.setProperty('--fv-live-chevron-hover-bg', dropdownTokens.hoverBackground);
                liveChevron.style.setProperty('--fv-live-chevron-shadow', dropdownTokens.shadow);
                liveChevron.style.setProperty('--fv-live-chevron-hover-shadow', dropdownTokens.hoverShadow);
            }
        };

        const updateLiveSummary = () => {
            if (!$ || !shouldUpdate()) {
                return;
            }
            const form = getForm();
            if (!form) {
                return;
            }
            const memberNames = getIncludedMemberNames();
            const memberMap = getMemberMapByName();
            const selectedMembers = memberNames.map((name) => memberMap.get(name)).filter(Boolean);
            const folderName = String(form.name?.value || '').trim() || '(unnamed)';
            const previewLabel = deps.previewModeLabels?.[Number(form.preview?.value)] || 'Unknown';
            const contextLabel = deps.type === 'docker'
                ? (deps.contextModeLabels?.[Number(form.context?.value)] || 'Unknown')
                : 'Not used for VMs';
            const accentEnabled = isFolderAccentEnabled({ folder_accent_enabled: form.folder_accent_enabled?.checked === true });
            const accentColor = normalizeHexColor(form.folder_accent_color?.value, deps.defaultFolderAccentColor || '#ffca63');

            $('#fvLiveName').text(folderName);
            $('#fvLivePreview').text(previewLabel);
            $('#fvLiveContext').text(contextLabel);
            $('#fvHeroTitle').text(folderName);
            const selectedIconPath = String(form.icon?.value || '').trim() || deps.defaultFolderIconPath || '';
            $('#fvHeroIcon').attr('src', selectedIconPath);
            $('#fvIconPanelPreview')
                .attr('src', selectedIconPath)
                .attr('title', selectedIconPath ? `Selected icon: ${selectedIconPath}` : 'Selected icon preview');
            $('#fvHeroScope').text(
                normalizeParentFolderId(form.parent_folder_id?.value || '')
                    ? `Nested under ${$('select[name="parent_folder_id"] option:selected').text() || 'parent folder'}`
                    : 'Top-level folder'
            );
            $('#fvHeroMembers').text(`${memberNames.length}/${getAllMembers().length} included`);
            if ($('#fvHeroDefaults').length) {
                $('#fvHeroDefaults').text($('#fvHeroDefaults').text() || 'Checking inherited defaults');
            }
            $('#fvLivePreviewMeta').text(
                Number(form.preview?.value) === 0
                    ? 'Preview disabled'
                    : `${previewLabel} - ${normalizePreviewRowLimit(form.preview_rows?.value) === 0 ? 'Unlimited rows' : `${normalizePreviewRowLimit(form.preview_rows?.value)} row${normalizePreviewRowLimit(form.preview_rows?.value) === 1 ? '' : 's'}`}`
            );
            $('#fvSwatchStarted').css('background-color', normalizeHexColor(form.status_color_started?.value, deps.defaultFolderStatusColors?.started || '#ffffff'));
            $('#fvSwatchPaused').css('background-color', normalizeHexColor(form.status_color_paused?.value, deps.defaultFolderStatusColors?.paused || '#b8860b'));
            $('#fvSwatchStopped').css('background-color', normalizeHexColor(form.status_color_stopped?.value, deps.defaultFolderStatusColors?.stopped || '#ff4d4d'));
            $('#fvSwatchAccent').css('background-color', accentColor);
            $('#fvAccentSwatchItem').toggle(accentEnabled);

            const dockerSignalsShell = $('#fvDockerSignalsShell');
            const dockerSignals = $('#fvDockerSignals');
            const previewSignals = getPreviewSignals({ form, memberNames, selectedMembers });
            if (dockerSignals.length && previewSignals && Array.isArray(previewSignals.items) && previewSignals.items.length) {
                dockerSignalsShell.find('.fv-live-chip-panel-head').text(String(previewSignals.title || 'Signals'));
                dockerSignals.html(previewSignals.items.map((label) => (
                    `<span class="fv-docker-signal-chip">${escapeHtml(label)}</span>`
                )).join(''));
                if (dockerSignalsShell.length) {
                    dockerSignalsShell.show();
                } else {
                    dockerSignals.show();
                }
            } else if (dockerSignalsShell.length) {
                dockerSignalsShell.hide();
            } else if (dockerSignals.length) {
                dockerSignals.hide();
            }

            updateMemberStats();
            onAfterSummaryUpdate({ form, folderName, memberNames, selectedMembers });
            renderLivePreviewCanvas();
        };

        return Object.freeze({
            renderLivePreviewCanvas,
            updateLiveSummary
        });
    };

    window.FolderViewPlusFolderEditorPreview = Object.freeze({
        createApi
    });
    window.FolderViewPlusFolderEditorPreviewModuleLoaded = true;
})(window);
