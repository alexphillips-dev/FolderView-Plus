// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorState = factory();
    root.FolderViewPlusFolderEditorStateModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const $ = deps.$ || win?.jQuery || win?.$;
        const modernEditorEnabled = deps.modernEditorEnabled === true;
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : (() => null);
        const getInitialSnapshot = typeof deps.getInitialSnapshot === 'function' ? deps.getInitialSnapshot : (() => '');
        const setInitialSnapshot = typeof deps.setInitialSnapshot === 'function' ? deps.setInitialSnapshot : (() => {});
        const computeFormSnapshot = typeof deps.computeFormSnapshot === 'function' ? deps.computeFormSnapshot : (() => '');
        const getAllChangedItems = typeof deps.getAllChangedItems === 'function' ? deps.getAllChangedItems : (() => []);
        const getSectionChangeItems = typeof deps.getSectionChangeItems === 'function' ? deps.getSectionChangeItems : (() => []);
        const parseSnapshotState = typeof deps.parseSnapshotState === 'function'
            ? deps.parseSnapshotState
            : (() => ({ fields: {}, members: [], actions: [] }));
        const sectionMeta = deps.sectionMeta && typeof deps.sectionMeta === 'object' ? deps.sectionMeta : {};
        const sectionFieldNames = deps.sectionFieldNames && typeof deps.sectionFieldNames === 'object' ? deps.sectionFieldNames : {};
        const sectionDefaultValues = deps.sectionDefaultValues && typeof deps.sectionDefaultValues === 'object' ? deps.sectionDefaultValues : {};
        const inheritedFieldHints = deps.inheritedFieldHints && typeof deps.inheritedFieldHints === 'object' ? deps.inheritedFieldHints : {};
        const setFormControlValue = typeof deps.setFormControlValue === 'function' ? deps.setFormControlValue : (() => {});
        const updateForm = typeof deps.updateForm === 'function' ? deps.updateForm : (() => {});
        const scheduleEditorRecalculation = typeof deps.scheduleEditorRecalculation === 'function' ? deps.scheduleEditorRecalculation : (() => {});
        const getPreviewVerticalBarsDefaultColor = typeof deps.getPreviewVerticalBarsDefaultColor === 'function'
            ? deps.getPreviewVerticalBarsDefaultColor
            : (() => '');
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));

        const updateUnsavedIndicator = () => {
            if (!$) {
                return false;
            }
            const initialSnapshot = String(getInitialSnapshot() || '');
            const current = computeFormSnapshot();
            const dirty = Boolean(initialSnapshot) && current !== initialSnapshot;
            const changedCount = dirty ? getAllChangedItems().length : 0;
            $('#unsavedIndicator').toggle(dirty);
            $('#fvActionBarDirty')
                .toggleClass('is-dirty', dirty)
                .text(dirty ? `${changedCount || 1} unsaved change${changedCount === 1 ? '' : 's'}` : 'All changes saved');
            $('#fvActionBarHint')
                .toggleClass('is-dirty', dirty)
                .text(
                    dirty
                        ? 'Save or copy this folder when you are ready.'
                        : 'Changes apply live in the preview while saved values stay in sync below.'
                );
            return dirty;
        };

        const updateSectionStateIndicators = () => {
            if (!$) {
                return;
            }
            const initialSnapshot = String(getInitialSnapshot() || '');
            if (!initialSnapshot) {
                Object.keys(sectionMeta).forEach((sectionKey) => {
                    const shell = $(`.fv-section-shell[data-section-shell="${sectionKey}"]`);
                    const badge = $(`#fvSectionState-${sectionKey}`);
                    const navButton = $(`.fv-section-nav > button[data-target="${sectionKey}"]`);
                    shell.removeClass('is-dirty').addClass('is-clean');
                    navButton.removeClass('is-dirty');
                    badge.removeClass('is-dirty').addClass('is-clean').text('Saved');
                    navButton.find('.fv-nav-count').text('').hide();
                });
                return;
            }

            const baselineSnapshot = parseSnapshotState(initialSnapshot);
            const currentSnapshot = parseSnapshotState(computeFormSnapshot());
            Object.keys(sectionMeta).forEach((sectionKey) => {
                const changes = getSectionChangeItems(sectionKey, baselineSnapshot, currentSnapshot);
                const changedCount = changes.length;
                const shell = $(`.fv-section-shell[data-section-shell="${sectionKey}"]`);
                const badge = $(`#fvSectionState-${sectionKey}`);
                const navButton = $(`.fv-section-nav > button[data-target="${sectionKey}"]`);
                const navBadge = navButton.find('.fv-nav-count');

                shell.toggleClass('is-dirty', changedCount > 0);
                shell.toggleClass('is-clean', changedCount === 0);
                navButton.toggleClass('is-dirty', changedCount > 0);

                if (badge.length) {
                    badge
                        .removeClass('is-dirty is-clean')
                        .addClass(changedCount > 0 ? 'is-dirty' : 'is-clean')
                        .text(changedCount > 0 ? `${changedCount} change${changedCount === 1 ? '' : 's'}` : 'Saved');
                }

                if (navBadge.length) {
                    navBadge.text(changedCount > 0 ? String(changedCount) : '');
                    navBadge.toggle(changedCount > 0);
                }
            });
        };

        const updateChangeSummaryPanel = () => {
            if (!$) {
                return;
            }
            const initialSnapshot = String(getInitialSnapshot() || '');
            if (!initialSnapshot) {
                $('#fvChangeSummaryLabel').removeClass('is-dirty').text('No pending changes');
                $('#fvChangeSummaryText').text('This folder currently matches the saved values.');
                $('#fvChangeSummaryList').empty();
                $('#fvChangeSummaryOverflow').text('');
                return;
            }

            const changedItems = getAllChangedItems();
            const dirty = changedItems.length > 0;
            $('#fvChangeSummaryLabel')
                .toggleClass('is-dirty', dirty)
                .text(dirty ? `${changedItems.length} unsaved change${changedItems.length === 1 ? '' : 's'}` : 'No pending changes');
            $('#fvChangeSummaryText').text(
                dirty
                    ? 'These folder settings are different from the currently saved version.'
                    : 'This folder currently matches the saved values.'
            );

            const list = $('#fvChangeSummaryList');
            if (!list.length) {
                return;
            }
            list.empty();
            changedItems.slice(0, 6).forEach((label) => {
                list.append(`<li>${escapeHtml(label)}</li>`);
            });
            $('#fvChangeSummaryOverflow').text(
                changedItems.length > 6
                    ? `+${changedItems.length - 6} more change${changedItems.length - 6 === 1 ? '' : 's'}`
                    : ''
            );
        };

        const updateInheritedFieldIndicators = () => {
            if (!$) {
                return;
            }
            const form = getForm();
            if (!form) {
                return;
            }
            let inheritedCount = 0;
            Object.entries(inheritedFieldHints).forEach(([fieldName, hint]) => {
                const field = form.elements?.[fieldName];
                const row = $(form).find(`.basic:has([name="${fieldName}"])`).first();
                if (!field || !row.length) {
                    return;
                }
                const isInherited = field.type === 'checkbox'
                    ? field.checked !== true
                    : String($(field).val() || '').trim() === '';
                row.toggleClass('fv-using-inherited', isInherited);
                if (isInherited) {
                    inheritedCount += 1;
                }
                let marker = row.find('.fv-inherited-badge').first();
                if (!marker.length) {
                    marker = $('<span class="fv-inherited-badge"></span>');
                    const dt = row.find('dt').first();
                    if (dt.length) {
                        dt.append(marker);
                    } else {
                        row.prepend(marker);
                    }
                }
                marker
                    .toggle(isInherited)
                    .text(isInherited ? 'inherits global default' : '')
                    .attr('title', isInherited ? hint : '');
                const button = row.find(`.fv-inherit-btn[data-field="${fieldName}"]`).first();
                if (button.length) {
                    const actions = button.closest('.fv-field-inherit-tools');
                    if (actions.length) {
                        actions.prop('hidden', isInherited);
                    }
                    button.prop('disabled', false);
                    button.removeClass('is-inherited');
                    button.text('Use global');
                    button.attr('title', 'Clear this override and use the global default again.');
                }
            });
            $('#fvHeroDefaults').text(
                inheritedCount > 0
                    ? `${inheritedCount} inherited default${inheritedCount === 1 ? '' : 's'}`
                    : 'All key fields overridden locally'
            );
        };

        const restoreSectionSavedValues = (sectionKey) => {
            const initialSnapshot = String(getInitialSnapshot() || '');
            const baselineSnapshot = parseSnapshotState(initialSnapshot);
            const fieldNames = sectionFieldNames[sectionKey] || [];
            fieldNames.forEach((fieldName) => {
                setFormControlValue(fieldName, baselineSnapshot.fields[fieldName]);
            });
            updateForm();
            scheduleEditorRecalculation(0);
        };

        const applySectionDefaults = (sectionKey) => {
            const defaults = sectionDefaultValues[sectionKey];
            if (!defaults) {
                return;
            }
            Object.entries(defaults).forEach(([fieldName, value]) => {
                if (fieldName === 'preview_vertical_bars_color' && value === '') {
                    setFormControlValue(fieldName, getPreviewVerticalBarsDefaultColor());
                    return;
                }
                setFormControlValue(fieldName, value);
            });
            updateForm();
            scheduleEditorRecalculation(0);
        };

        const applyEditorPluginDefaults = () => {
            ['preview', 'chevron', 'status', 'rules', 'advanced'].forEach((sectionKey) => applySectionDefaults(sectionKey));
            updateForm();
            scheduleEditorRecalculation(0);
        };

        const buildEditorActionBar = () => {
            if (!$ || !modernEditorEnabled) {
                return;
            }
            const form = $('div.canvas > form');
            if (!form.length) {
                return;
            }
            if (!$('#fvEditorActionBar').length) {
                form.append(`
                    <div id="fvEditorActionBar" class="fv-editor-actionbar">
                        <div class="fv-editor-actionbar-main"></div>
                        <div class="fv-editor-actionbar-meta">
                            <span id="fvActionBarDirty" class="fv-actionbar-dirty">No pending changes</span>
                            <span id="fvActionBarHint" class="fv-actionbar-hint">Use Restore saved values to discard local edits or Apply plugin defaults to quickly reset display tuning.</span>
                        </div>
                    </div>
                `);
            }
            const shell = $('#fvEditorActionBar .fv-editor-actionbar-main');
            if (!shell.length) {
                return;
            }
            const controls = $('.folder-btn-submit, .folder-btn-copy, .folder-btn-reset, .folder-btn-cancel, #unsavedIndicator');
            controls.each((_, element) => {
                shell.append(element);
            });
        };

        const markCleanState = () => {
            setInitialSnapshot(computeFormSnapshot());
            updateUnsavedIndicator();
            updateSectionStateIndicators();
            updateChangeSummaryPanel();
        };

        return Object.freeze({
            updateUnsavedIndicator,
            markCleanState,
            updateSectionStateIndicators,
            updateChangeSummaryPanel,
            updateInheritedFieldIndicators,
            restoreSectionSavedValues,
            applySectionDefaults,
            applyEditorPluginDefaults,
            buildEditorActionBar
        });
    };

    return Object.freeze({
        createApi
    });
}));
