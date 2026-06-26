(function folderEditorChromeBootstrap(root) {
    const editorPageMode = String(root.FolderViewPlusFolderEditorPageMode || 'modern').trim().toLowerCase();
    if (editorPageMode !== 'modern') {
        return;
    }
    root.FolderViewPlusFolderEditorRuntimeBootStage = 'chrome-bootstrap';
    const sharedModernSchemaFactory = root.FolderViewPlusFolderEditorSchema?.createModernSchema;
    const sharedSectionMeta = typeof sharedModernSchemaFactory === 'function'
        ? sharedModernSchemaFactory().SECTION_META
        : null;
    const FALLBACK_SECTION_META = {
        general: { title: 'General', icon: 'fa-folder-open-o', advanced: false, description: 'Name, parent, icon, and folder-level WebUI behavior.' },
        members: { title: 'Members', icon: 'fa-th-large', advanced: false, description: 'Search, filter, bulk-manage, and order the containers or VMs shown in this folder.' },
        preview: { title: 'Preview', icon: 'fa-eye', advanced: false, description: 'Control preview layout, context, borders, dividers, and inline preview actions.' },
        chevron: { title: 'Chevron', icon: 'fa-chevron-down', advanced: false, description: 'Pick the dropdown style and the primary / hover colors used in folder rows.' },
        status: { title: 'Status', icon: 'fa-heartbeat', advanced: false, description: 'Adjust status colors and optional health or warning thresholds for the folder.' },
        rules: { title: 'Rules', icon: 'fa-code', advanced: true, description: 'Optional automation rules for auto-including matching containers or VMs.' },
        actions: { title: 'Actions', icon: 'fa-bolt', advanced: true, description: 'Optional custom actions that appear in this folder’s context menu.' },
        advanced: { title: 'Advanced', icon: 'fa-sliders', advanced: true, description: 'Tune Docker / VM / Dashboard specific behavior and other advanced defaults.' }
    };
    const SECTION_META = sharedSectionMeta && typeof sharedSectionMeta === 'object'
        ? sharedSectionMeta
        : FALLBACK_SECTION_META;
    const SECTION_PANEL_META = {
        general: [
            { key: 'identity', title: 'Identity', description: 'Name and optional folder WebUI behavior.', fields: ['name', 'folder_webui', 'folder_webui_url'] },
            { key: 'parent', title: 'Parent Folder', description: 'Choose where this folder lives in the hierarchy.', fields: ['parent_folder_id'] },
            { key: 'icon', title: 'Icon', description: 'Preview and change the folder icon.', match: (row) => Boolean(row?.querySelector?.('.fv-icon-dd')) }
        ],
        members: [
            { key: 'member-manager', title: 'Member Manager', description: 'Choose visible members, filter the list, and set folder order.', match: (row) => row?.classList?.contains('order-section') === true }
        ],
        preview: [
            { key: 'layout', title: 'Layout', description: 'Control what the collapsed row shows and how much room it uses.', fields: ['preview', 'preview_hover', 'preview_text_width', 'preview_rows', 'preview_status'] },
            { key: 'child-folders', title: 'Child Folders', description: 'Show nested folder chips and choose how deep the preview can look.', fields: ['preview_hide_nested_items', 'preview_child_folder_depth'] },
            { key: 'appearance', title: 'Appearance', description: 'Tune borders, divider bars, grayscale, and update highlighting.', fields: ['preview_grayscale', 'preview_update', 'preview_vertical_bars', 'preview_vertical_bars_color', 'preview_border', 'preview_border_color'] },
            { key: 'quick-actions', title: 'Quick Actions', description: 'Add optional actions directly inside Docker previews.', fields: ['preview_logs', 'preview_webui', 'preview_console'] },
            { key: 'context', title: 'Preview Context', description: 'Configure advanced preview behavior and graph settings.', fields: ['context', 'context_trigger', 'context_graph', 'context_graph_time'] }
        ],
        chevron: [
            { key: 'style', title: 'Chevron Style', description: 'Choose the row expand/collapse affordance.', fields: ['dropdown_style'] },
            { key: 'color', title: 'Chevron Color', description: 'Override the folder row chevron color.', fields: ['dropdown_color'] }
        ],
        status: [
            { key: 'status-colors', title: 'Status Colors', description: 'Set the started, paused, and stopped colors used by folder rows.', fields: ['status_color_started', 'status_color_paused', 'status_color_stopped'], match: (row) => Boolean(row?.querySelector?.('.folder-status-colors-dd')) },
            { key: 'accent', title: 'Accent Bar', description: 'Enable and color the optional folder accent bar.', fields: ['folder_accent_enabled', 'folder_accent_color'] },
            { key: 'thresholds', title: 'Status Thresholds', description: 'Override warning levels for this folder only.', advancedOnly: true, fields: ['status_warn_stopped_percent'] },
            { key: 'health', title: 'Docker Health', description: 'Tune Docker-specific folder health scoring.', advancedOnly: true, fields: ['health_warn_stopped_percent', 'health_critical_stopped_percent', 'health_profile', 'health_updates_mode', 'health_all_stopped_mode'] }
        ],
        rules: [
            { key: 'regex', title: 'Legacy Regex', description: 'Keep the folder populated with the saved name-matching regex rule.', fields: ['regex'] },
            { key: 'auto-rules', title: 'Advanced Auto-Rules', description: 'Create plugin-wide include or exclude rules that target this folder.', keepEmpty: true, match: (row) => row?.id === 'fvFolderAutoRulesPanel' }
        ],
        actions: [
            { key: 'folder-actions', title: 'Folder Actions', description: 'Manage the custom actions shown in this folder’s context menu.', match: (row) => row?.classList?.contains('custom-action-wrapper-parent') === true }
        ],
        advanced: [
            { key: 'action-behavior', title: 'Action Behavior', description: 'Override default action behavior for this folder.', fields: ['override_default_actions', 'default_action'] },
            { key: 'expansion', title: 'Expansion', description: 'Control whether this folder opens automatically on Docker and Dashboard views.', fields: ['expand_tab', 'expand_dashboard'] },
            { key: 'dashboard', title: 'Dashboard', description: 'Tune Dashboard-specific display behavior.', fields: ['dashboard_overflow'] },
            { key: 'docker', title: 'Docker', description: 'Control Docker-specific advanced behavior.', fields: ['update_column'] }
        ]
    };
    const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
    const pageType = String(root.FolderViewPlusFolderEditorPageType || '').trim().toLowerCase();
    const ADVANCED_MODE = 'advanced';
    const pageReportFolderEditorBootstrap = typeof root.FolderViewPlusReportFolderEditorBootstrap === 'function'
        ? root.FolderViewPlusReportFolderEditorBootstrap.bind(root)
        : null;
    let currentMode = ADVANCED_MODE;
    let currentSection = 'general';
    let bootstrapWatchdogArmed = false;
    let folderEditorTypeApi = null;

    const resolveFolderEditorTypeModule = () => {
        if (pageType === 'docker') {
            return root.FolderViewPlusFolderEditorTypeDocker || null;
        }
        if (pageType === 'vm') {
            return root.FolderViewPlusFolderEditorTypeVm || null;
        }
        return null;
    };

    const getFolderEditorTypeApi = () => {
        if (folderEditorTypeApi) {
            return folderEditorTypeApi;
        }
        const typeModule = resolveFolderEditorTypeModule();
        if (!typeModule || typeof typeModule.createApi !== 'function') {
            return null;
        }
        try {
            folderEditorTypeApi = typeModule.createApi({});
        } catch (_error) {
            folderEditorTypeApi = null;
        }
        return folderEditorTypeApi;
    };

    const mergeSectionRows = (baseRows, extraRows) => {
        const merged = { ...baseRows };
        const source = extraRows && typeof extraRows === 'object' ? extraRows : {};
        Object.entries(source).forEach(([sectionKey, rows]) => {
            const nextRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
            if (!nextRows.length) {
                return;
            }
            merged[sectionKey] = [...(merged[sectionKey] || []), ...nextRows];
        });
        return merged;
    };

    const setBootstrapSurfaceState = ({
        summary = '',
        details = '',
        debug = '',
        tone = 'warning'
    } = {}) => {
        const summaryNode = root.document.getElementById('fvValidationSummary');
        const detailsNode = root.document.getElementById('fvValidationDetails');
        const debugNode = root.document.getElementById('fvEditorBootstrapDebug');
        const className = tone === 'ready' ? 'ready' : tone === 'info' ? 'info' : tone === 'invalid' ? 'invalid' : 'warning';
        [summaryNode, detailsNode].forEach((node) => {
            if (!node) {
                return;
            }
            node.classList.remove('invalid', 'warning', 'info', 'ready');
            node.classList.add(className);
        });
        if (summaryNode && summary) {
            summaryNode.textContent = summary;
        }
        if (detailsNode && details) {
            detailsNode.textContent = details;
        }
        if (debugNode && debug) {
            debugNode.textContent = debug;
        }
        if (tone === 'invalid') {
            const form = root.document.querySelector('div.canvas > form.folder-editor-form');
            if (form instanceof root.HTMLElement) {
                revealModernStage(form, { preservePlaceholder: false });
            }
        }
    };

    root.FolderViewPlusReportFolderEditorBootstrap = ({
        summary = '',
        details = '',
        debug = '',
        tone = 'warning',
        stage = ''
    } = {}) => {
        if (stage) {
            root.FolderViewPlusFolderEditorRuntimeBootStage = String(stage);
        }
        setBootstrapSurfaceState({ summary, details, debug, tone });
        if (typeof pageReportFolderEditorBootstrap === 'function') {
            pageReportFolderEditorBootstrap({
                summary,
                details,
                debug,
                tone,
                stage: String(root.FolderViewPlusFolderEditorRuntimeBootStage || '')
            });
        }
    };

    const armBootstrapWatchdog = () => {
        if (bootstrapWatchdogArmed) {
            return;
        }
        bootstrapWatchdogArmed = true;
        root.setTimeout(() => {
            const stage = String(root.FolderViewPlusFolderEditorRuntimeBootStage || '').trim();
            if ([
                'shell-ready',
                'folders-loaded',
                'members-loaded',
                'runtime-ready',
                'missing-modules',
                'runtime-error',
                'runtime-rejection',
                'watchdog-timeout'
            ].includes(stage)) {
                return;
            }
            root.FolderViewPlusReportFolderEditorBootstrap({
                summary: 'Folder editor runtime stalled during bootstrap.',
                details: 'The modern editor shell rendered, but the runtime never reached its first ready checkpoint.',
                debug: [
                    `pageMode=${editorPageMode}`,
                    `stage=${stage || '(empty)'}`,
                    `scriptLoaded=${root.FolderViewPlusFolderEditorRuntimeLoaded === true ? 'yes' : 'no'}`,
                    `lastError=${String(root.FolderViewPlusFolderEditorRuntimeLastError || '(none)')}`
                ].join('\n'),
                tone: 'invalid',
                stage: 'watchdog-timeout'
            });
        }, 1500);
    };

    root.addEventListener('error', (event) => {
        const message = String(event?.error?.message || event?.message || '(unknown error)').trim();
        root.FolderViewPlusFolderEditorRuntimeLastError = message;
        root.FolderViewPlusReportFolderEditorBootstrap({
            summary: 'Folder editor runtime crashed before hydration.',
            details: 'A script error occurred before the editor could finish booting.',
            debug: [
                `pageMode=${editorPageMode}`,
                `stage=${String(root.FolderViewPlusFolderEditorRuntimeBootStage || '(empty)')}`,
                `error=${message}`,
                `source=${String(event?.filename || '(unknown)')}`,
                `line=${String(event?.lineno || 0)}`,
                `column=${String(event?.colno || 0)}`
            ].join('\n'),
            tone: 'invalid',
            stage: 'runtime-error'
        });
    });

    root.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        const message = String(reason?.message || reason || '(unknown rejection)').trim();
        root.FolderViewPlusFolderEditorRuntimeLastError = message;
        root.FolderViewPlusReportFolderEditorBootstrap({
            summary: 'Folder editor runtime rejected during bootstrap.',
            details: 'An async error occurred before the editor could finish loading saved folder data.',
            debug: [
                `pageMode=${editorPageMode}`,
                `stage=${String(root.FolderViewPlusFolderEditorRuntimeBootStage || '(empty)')}`,
                `rejection=${message}`
            ].join('\n'),
            tone: 'invalid',
            stage: 'runtime-rejection'
        });
    });

    const findBasicByFieldName = (form, fieldName) => Array.from(form.querySelectorAll('.basic'))
        .find((entry) => entry.querySelector(`[name="${fieldName}"]`));

    const collectInheritedConstraintTokens = (row, boundary) => {
        const tokens = [];
        let cursor = row;
        while (cursor && cursor instanceof root.HTMLElement && cursor !== boundary) {
            const rawConstraint = String(cursor.getAttribute('constraint') || '').trim();
            if (rawConstraint) {
                rawConstraint.split(/\s+/).forEach((token) => {
                    if (token && !tokens.includes(token)) {
                        tokens.push(token);
                    }
                });
            }
            cursor = cursor.parentElement;
        }
        return tokens.join(' ');
    };

    const primeModernSectionRow = (form, row) => {
        if (!(row instanceof root.HTMLElement)) {
            return row;
        }
        if (!row.hasAttribute('data-fv-row-constraint')) {
            const inheritedConstraint = collectInheritedConstraintTokens(row, form);
            if (inheritedConstraint) {
                row.setAttribute('data-fv-row-constraint', inheritedConstraint);
            }
        }
        const cachedConstraint = String(row.getAttribute('data-fv-row-constraint') || '').trim();
        if (cachedConstraint) {
            row.setAttribute('constraint', cachedConstraint);
        } else {
            row.removeAttribute('constraint');
        }
        return row;
    };

    const findActionLaunchRow = (form) => {
        const cachedRow = form.querySelector('.basic[data-fv-actions-launch-source="1"]');
        if (cachedRow) {
            return cachedRow;
        }
        const sourceRow = Array.from(form.querySelectorAll('.basic')).find((entry) => entry.querySelector('a.custom-action'));
        if (sourceRow) {
            sourceRow.setAttribute('data-fv-actions-launch-source', '1');
        }
        return sourceRow;
    };

    const getVisibleSectionKeys = () => Object.keys(SECTION_META);

    const normalizeSectionKey = (sectionKey, mode = currentMode) => {
        const visible = getVisibleSectionKeys(mode);
        const preferred = String(sectionKey || '').trim();
        if (visible.includes(preferred)) {
            return preferred;
        }
        return visible[0] || 'general';
    };

    const buildTopChrome = () => `
        <div id="fvEditorChrome" class="fv-editor-chrome">
            <div class="fv-editor-hero">
                <div class="fv-editor-hero-main">
                    <div class="fv-editor-hero-icon">
                        <img id="fvHeroIcon" src="${DEFAULT_FOLDER_ICON_PATH}" alt="">
                    </div>
                    <div class="fv-editor-hero-copy">
                        <span class="fv-editor-kicker" style="color: var(--fv-editor-title-accent, var(--fv-editor-accent));">Folder editor</span>
                        <h2 id="fvHeroTitle">Configure folder</h2>
                        <p id="fvHeroSubtitle">A fully grouped folder editor with tabbed sections, live preview, and a dedicated action bar.</p>
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
                <span id="fvValidationSummary" class="fv-validation-summary ready">Folder editor shell loaded.</span>
                <pre id="fvValidationDetails" class="fv-validation-details ready">Core layout is ready. Runtime data and live controls will continue hydrating.</pre>
                <details id="fvEditorBootstrapDetails" class="fv-editor-bootstrap-disclosure">
                    <summary id="fvEditorBootstrapSummary" class="fv-editor-bootstrap-summary">Bootstrap diagnostics</summary>
                    <pre id="fvEditorBootstrapDebug" class="fv-editor-bootstrap-debug">Bootstrap: waiting for folder editor runtime.</pre>
                </details>
            </div>
        </div>
        <div id="fvLivePanel" class="fv-live-panel">
            <div class="fv-live-panel-grid">
                <div class="fv-live-preview-card">
                    <div class="fv-live-preview-card-head">
                        <div class="fv-live-preview-copy">
                            <strong>Live folder preview</strong>
                            <p>The editor runtime will keep this preview in sync as settings change.</p>
                        </div>
                        <span id="fvLivePreviewMeta" class="fv-live-preview-meta-chip">Loading preview</span>
                    </div>
                    <div id="fvLivePreviewCanvas" class="fv-live-preview-canvas">
                        <div class="fv-live-preview-surface">
                            <div class="fv-live-preview-row">
                                <div class="fv-live-folder-head">
                                    <div class="fv-live-folder-anchor">
                                        <img class="fv-live-folder-icon" src="${DEFAULT_FOLDER_ICON_PATH}" alt="">
                                        <div class="fv-live-folder-copy">
                                            <strong>Folder preview</strong>
                                            <span>Waiting for folder data</span>
                                        </div>
                                    </div>
                                    <span class="fv-live-chevron fv-live-chevron-minimal" aria-hidden="true">
                                        <i class="fa fa-chevron-down" aria-hidden="true"></i>
                                    </span>
                                </div>
                                <div class="fv-live-member-lane">
                                    <div class="fv-live-preview-empty">Preview data will appear here once the folder runtime finishes loading.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="fv-live-insights">
                    <div class="fv-live-grid">
                        <div class="fv-live-stat-card">
                            <span class="fv-live-stat-label">Name</span>
                            <strong id="fvLiveName" class="fv-live-stat-value">-</strong>
                        </div>
                        <div class="fv-live-stat-card">
                            <span class="fv-live-stat-label">Preview</span>
                            <strong id="fvLivePreview" class="fv-live-stat-value">-</strong>
                        </div>
                        <div class="fv-live-stat-card">
                            <span class="fv-live-stat-label">Context</span>
                            <strong id="fvLiveContext" class="fv-live-stat-value">-</strong>
                        </div>
                        <div class="fv-live-stat-card">
                            <span class="fv-live-stat-label">Members</span>
                            <strong id="fvLiveMembers" class="fv-live-stat-value">0/0 included</strong>
                        </div>
                    </div>
                    <div class="fv-live-chip-panel">
                        <div class="fv-live-chip-panel-head">Status colors</div>
                        <div class="fv-live-swatches">
                            <span class="fv-swatch-item"><em>Started</em><i id="fvSwatchStarted"></i></span>
                            <span class="fv-swatch-item"><em>Paused</em><i id="fvSwatchPaused"></i></span>
                            <span class="fv-swatch-item"><em>Stopped</em><i id="fvSwatchStopped"></i></span>
                            <span id="fvAccentSwatchItem" class="fv-swatch-item" style="display:none;"><em>Accent</em><i id="fvSwatchAccent"></i></span>
                        </div>
                    </div>
                    <div id="fvDockerSignalsShell" class="fv-live-chip-panel" style="display:none;">
                        <div class="fv-live-chip-panel-head">Docker signals</div>
                        <div id="fvDockerSignals" class="fv-docker-signals">
                        <span id="fvDockerComposeSummary" class="fv-docker-signal-chip">Compose: loading…</span>
                        <span id="fvDockerUpdateSummary" class="fv-docker-signal-chip">Updates: loading…</span>
                    </div>
                        </div>
                </div>
            </div>
        </div>
        <div id="fvEditorNavDock" class="fv-editor-nav-dock">
            <div class="fv-editor-nav-row">
                <div class="fv-section-nav">
                    ${Object.entries(SECTION_META).map(([key, meta], index) => `
                        <button type="button" data-target="${key}"${index === 0 ? ' class="is-active"' : ''}>
                            <i class="fa ${meta.icon}" aria-hidden="true"></i>
                            <span>${meta.title}</span>
                            <em class="fv-nav-count" style="display:none;"></em>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    const getModernStage = (form) => {
        if (!(form instanceof root.HTMLElement)) {
            return null;
        }
        let stage = form.querySelector('#fvModernEditorStage');
        if (!stage) {
            stage = root.document.createElement('div');
            stage.id = 'fvModernEditorStage';
            stage.className = 'fv-modern-editor-stage';
            form.insertBefore(stage, form.firstChild);
        }
        return stage;
    };

    const revealModernStage = (form, { preservePlaceholder = false } = {}) => {
        const stage = getModernStage(form);
        if (!stage) {
            return;
        }
        if (preservePlaceholder !== true) {
            const bootPlaceholder = stage.querySelector('#fvEditorBootPlaceholder');
            if (bootPlaceholder) {
                bootPlaceholder.remove();
            }
        }
        stage.classList.remove('is-pending');
        stage.classList.add('is-ready');
        form.classList.remove('fv-modern-editor-booting');
        form.classList.add('fv-modern-editor-ready');
    };

    const ensureTopChrome = (form) => {
        const stage = getModernStage(form);
        if (!stage) {
            return;
        }
        if (stage.querySelector('#fvEditorChrome') && stage.querySelector('#fvLivePanel') && stage.querySelector('#fvEditorNavDock')) {
            return;
        }
        stage.insertAdjacentHTML('afterbegin', buildTopChrome());
        armBootstrapWatchdog();
    };

    const ensureActionBar = (form) => {
        const stage = getModernStage(form);
        if (!stage) {
            return;
        }
        let actionBar = stage.querySelector('#fvEditorActionBar');
        if (!actionBar) {
            actionBar = root.document.createElement('div');
            actionBar.id = 'fvEditorActionBar';
            actionBar.className = 'fv-editor-actionbar';
            actionBar.innerHTML = `
                <div class="fv-editor-actionbar-main"></div>
                <div class="fv-editor-actionbar-meta">
                    <span id="fvActionBarDirty" class="fv-actionbar-dirty">No pending changes</span>
                    <span id="fvActionBarHint" class="fv-actionbar-hint">Save, copy, reset, or cancel from here.</span>
                </div>
            `;
            stage.appendChild(actionBar);
        }
        const actionBarMain = actionBar.querySelector('.fv-editor-actionbar-main');
        if (!actionBarMain) {
            return;
        }
        Array.from(form.querySelectorAll('.folder-btn-submit, .folder-btn-apply-settings, .folder-btn-copy, .folder-btn-reset, .folder-btn-cancel, #unsavedIndicator')).forEach((entry) => {
            actionBarMain.appendChild(entry);
        });
    };

    const collectSectionRows = (form) => {
        const baseRows = {
        general: [
            findBasicByFieldName(form, 'name'),
            findBasicByFieldName(form, 'parent_folder_id'),
            findBasicByFieldName(form, 'folder_webui'),
            findBasicByFieldName(form, 'icon'),
            findBasicByFieldName(form, 'folder_webui_url')
        ],
        members: [
            form.querySelector('.basic.order-section')
        ],
        preview: [
            findBasicByFieldName(form, 'preview'),
            findBasicByFieldName(form, 'preview_hover'),
            findBasicByFieldName(form, 'preview_text_width'),
            findBasicByFieldName(form, 'preview_rows'),
            findBasicByFieldName(form, 'preview_grayscale'),
            findBasicByFieldName(form, 'preview_hide_nested_items'),
            findBasicByFieldName(form, 'preview_child_folder_depth'),
            findBasicByFieldName(form, 'preview_logs'),
            findBasicByFieldName(form, 'preview_vertical_bars'),
            findBasicByFieldName(form, 'preview_vertical_bars_color'),
            findBasicByFieldName(form, 'preview_border'),
            findBasicByFieldName(form, 'preview_border_color')
        ],
        chevron: [
            findBasicByFieldName(form, 'dropdown_style'),
            findBasicByFieldName(form, 'dropdown_color')
        ],
        status: [
            findBasicByFieldName(form, 'folder_accent_enabled'),
            findBasicByFieldName(form, 'folder_accent_color'),
            findBasicByFieldName(form, 'status_color_started'),
            findBasicByFieldName(form, 'status_warn_stopped_percent')
        ],
        rules: [
            findBasicByFieldName(form, 'regex'),
            root.document.getElementById('fvFolderAutoRulesPanel')
        ],
        actions: [
            form.querySelector('.basic.custom-action-wrapper-parent')
        ],
        advanced: [
            findBasicByFieldName(form, 'override_default_actions'),
            findBasicByFieldName(form, 'default_action'),
            findBasicByFieldName(form, 'expand_tab'),
            findBasicByFieldName(form, 'expand_dashboard'),
            findBasicByFieldName(form, 'dashboard_overflow')
        ]
        };
        return mergeSectionRows(
            baseRows,
            getFolderEditorTypeApi()?.collectSectionRows?.({ form, findBasicByFieldName }) || null
        );
    };

    const syncActionLaunchPlacement = (form) => {
        const actionsRow = form.querySelector('.basic.custom-action-wrapper-parent');
        const actionsList = actionsRow?.querySelector('.custom-action-wrapper');
        const actionsValueCell = actionsRow?.querySelector('dl > dd');
        const launchRow = findActionLaunchRow(form);
        const launchLink = launchRow?.querySelector('a.custom-action')
            || actionsRow?.querySelector('.fv-custom-action-launch > a.custom-action');
        if (!actionsRow || !actionsList || !actionsValueCell || !launchLink) {
            return;
        }
        let launchHost = actionsRow.querySelector('.fv-custom-action-launch');
        if (!launchHost) {
            launchHost = root.document.createElement('div');
            launchHost.className = 'fv-custom-action-launch';
            actionsValueCell.appendChild(launchHost);
        }
        launchLink.classList.add('fv-custom-action-link');
        launchHost.appendChild(launchLink);
    };

    const rowHasAnyField = (row, fields = []) => {
        if (!(row instanceof root.HTMLElement) || !Array.isArray(fields) || !fields.length) {
            return false;
        }
        return fields.some((fieldName) => row.querySelector(`[name="${fieldName}"]`));
    };

    const ensureEditorPanel = (body, sectionKey, panelDef) => {
        if (!(body instanceof root.HTMLElement)) {
            return null;
        }
        const panelKey = String(panelDef?.key || '').trim();
        if (!panelKey) {
            return null;
        }
        const selector = `:scope > .fv-editor-panel[data-editor-panel="${panelKey}"]`;
        let panel = body.querySelector(selector);
        if (!(panel instanceof root.HTMLElement)) {
            const iconPreviewMarkup = panelKey === 'icon'
                ? `
                    <span class="fv-editor-panel-icon-preview" title="Selected icon preview" aria-label="Selected icon preview">
                        <img id="fvIconPanelPreview" src="${DEFAULT_FOLDER_ICON_PATH}" alt="" onerror="this.src='${DEFAULT_FOLDER_ICON_PATH}';">
                    </span>
                `
                : '';
            panel = root.document.createElement('section');
            panel.className = 'fv-editor-panel';
            panel.setAttribute('data-editor-panel', panelKey);
            panel.setAttribute('data-editor-panel-section', sectionKey);
            panel.innerHTML = `
                <div class="fv-editor-panel-head">
                    <h4>${panelDef.title}</h4>
                    ${panelDef.description ? `<p>${panelDef.description}</p>` : ''}
                    ${iconPreviewMarkup}
                </div>
                <div class="fv-editor-panel-body"></div>
            `;
            body.appendChild(panel);
        }
        return panel;
    };

    const ensureEditorPanels = (body, sectionKey) => {
        if (!(body instanceof root.HTMLElement)) {
            return null;
        }
        const panelDefs = SECTION_PANEL_META[sectionKey] || [];
        if (!panelDefs.length) {
            return null;
        }
        const activePanelKeys = new Set(panelDefs.map((panelDef) => String(panelDef?.key || '').trim()).filter(Boolean));
        Array.from(body.querySelectorAll(':scope > .fv-editor-panel')).forEach((panel) => {
            const panelKey = String(panel.getAttribute('data-editor-panel') || '').trim();
            if (!activePanelKeys.has(panelKey)) {
                panel.remove();
            }
        });
        const panels = {};
        panelDefs.forEach((panelDef) => {
            const panel = ensureEditorPanel(body, sectionKey, panelDef);
            if (panel) {
                panels[panelDef.key] = { panel, panelDef };
            }
        });
        return Object.keys(panels).length ? panels : null;
    };

    const findPanelForRow = (sectionKey, row, panels) => {
        const entries = panels && typeof panels === 'object' ? Object.values(panels) : [];
        if (!entries.length) {
            return null;
        }
        const matched = entries.find(({ panelDef }) => {
            if (typeof panelDef.match === 'function' && panelDef.match(row)) {
                return true;
            }
            return rowHasAnyField(row, panelDef.fields);
        });
        if (matched) {
            return matched.panel.querySelector('.fv-editor-panel-body') || matched.panel;
        }
        if (entries.length === 1) {
            return entries[0].panel.querySelector('.fv-editor-panel-body') || entries[0].panel;
        }
        return null;
    };

    const ensureSectionShells = (form) => {
        const stage = getModernStage(form);
        if (!stage) {
            return;
        }
        const sectionRows = collectSectionRows(form);
        const actionBar = stage.querySelector('#fvEditorActionBar');
        Object.entries(SECTION_META).forEach(([sectionKey, meta]) => {
            const rows = (sectionRows[sectionKey] || [])
                .filter(Boolean)
                .map((row) => primeModernSectionRow(form, row));
            if (!rows.length) {
                return;
            }
            let shell = stage.querySelector(`.fv-section-shell[data-section-shell="${sectionKey}"]`);
            if (!shell) {
                shell = root.document.createElement('section');
                shell.className = `fv-section-shell${meta.advanced ? ' is-advanced-shell' : ''}`;
                shell.setAttribute('data-section-shell', sectionKey);
                shell.innerHTML = `
                    <div class="fv-section-heading" id="fv-section-${sectionKey}" data-section-key="${sectionKey}">
                        <div class="fv-section-heading-title-row">
                            <div class="fv-section-heading-copy">
                                <div class="fv-section-heading-kicker">
                                    <i class="fa ${meta.icon}" aria-hidden="true"></i>
                                    <span>${meta.advanced ? 'Advanced section' : 'Core section'}</span>
                                </div>
                                <h3 style="color: var(--fv-editor-title-accent, var(--fv-editor-accent));">${meta.title}${meta.advanced ? ' <span class="fv-section-badge">advanced</span>' : ''}</h3>
                                <p>${meta.description}</p>
                            </div>
                            <div class="fv-section-heading-tools">
                                <span id="fvSectionState-${sectionKey}" class="fv-section-state-badge is-clean">Saved</span>
                                ${meta.supportsRevert ? `<button type="button" class="fv-section-tool" data-section-action="revert" data-section="${sectionKey}"><i class="fa fa-history" aria-hidden="true"></i> Restore saved</button>` : ''}
                                ${meta.supportsDefaults ? `<button type="button" class="fv-section-tool" data-section-action="defaults" data-section="${sectionKey}"><i class="fa fa-repeat" aria-hidden="true"></i> Plugin defaults</button>` : ''}
                                ${meta.advanced ? `<button type="button" class="fv-section-collapse" data-section="${sectionKey}" aria-pressed="false"><i class="fa fa-minus-square-o" aria-hidden="true"></i> Collapse</button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="fv-section-shell-body"></div>
                `;
                if (actionBar) {
                    stage.insertBefore(shell, actionBar);
                } else {
                    stage.appendChild(shell);
                }
            }
            const body = shell.querySelector('.fv-section-shell-body');
            if (!body) {
                return;
            }
            shell.classList.toggle('is-compact-shell', sectionKey === 'rules' || sectionKey === 'actions');
            shell.classList.toggle('is-members-shell', sectionKey === 'members');
            body.classList.add('fv-modern-section-grid');
            const editorPanels = ensureEditorPanels(body, sectionKey);
            body.classList.toggle('fv-section-panel-grid', Boolean(editorPanels));
            rows.forEach((row) => {
                if (!row) {
                    return;
                }
                let targetParent = body;
                const panelTarget = findPanelForRow(sectionKey, row, editorPanels);
                if (panelTarget) {
                    targetParent = panelTarget;
                }
                if (row.parentElement !== targetParent) {
                    targetParent.appendChild(row);
                }
            });
            if (editorPanels) {
                Object.values(editorPanels).forEach(({ panel, panelDef }) => {
                    const panelBody = panel.querySelector('.fv-editor-panel-body');
                    const isEmpty = !(panelBody instanceof root.HTMLElement) || !panelBody.children.length;
                    const keepEmpty = panelDef?.keepEmpty === true;
                    if (isEmpty && !keepEmpty && panel.parentElement === body) {
                        panel.remove();
                    }
                });
            }
            Array.from(body.querySelectorAll(':scope > .fv-editor-panel')).forEach((panel) => {
                if (panel.getAttribute('data-editor-panel-section') !== sectionKey) {
                    panel.remove();
                }
            });
        });
        syncActionLaunchPlacement(form);
    };

    const decorateSectionRows = (form) => {
        Array.from(form.querySelectorAll('.fv-section-shell .basic')).forEach((row) => {
            row.classList.add('fv-modern-field-row');
            row.classList.remove('fv-orphan-editor-row');
            row.classList.remove('fv-modern-order-row', 'is-wide-row', 'is-icon-row', 'is-status-row', 'is-actions-row', 'is-toggle-row', 'is-color-row', 'is-name-row', 'is-parent-row', 'is-url-row', 'is-webui-url-row', 'is-compact-text-row', 'is-webui-row', 'is-members-row', 'is-rules-row', 'is-actions-list-row', 'is-actions-launch-row');
            if (row.classList.contains('order-section')) {
                row.classList.add('fv-modern-order-row', 'is-wide-row', 'is-members-row');
                return;
            }
            if (row.querySelector('.fv-icon-dd')) {
                row.classList.add('is-icon-row', 'is-wide-row');
            }
            if (row.querySelector('.folder-status-colors-dd')) {
                row.classList.add('is-status-row');
            }
            if (row.querySelector('.custom-action-wrapper') || row.querySelector('a.custom-action')) {
                row.classList.add('is-actions-row');
            }
            if (row.querySelector('[name="regex"]')) {
                row.classList.add('is-compact-text-row', 'is-rules-row');
            }
            if (row.querySelector('.custom-action-wrapper')) {
                row.classList.add('is-actions-list-row', 'is-wide-row');
            }
            if (row.querySelector('a.custom-action') && !row.querySelector('.custom-action-wrapper')) {
                row.classList.add('is-actions-launch-row');
            }
            if (row.querySelector('[name="name"]')) {
                row.classList.add('is-name-row');
            }
            if (row.querySelector('[name="parent_folder_id"]')) {
                row.classList.add('is-parent-row');
            }
            if (row.querySelector('[name="folder_webui"]')) {
                row.classList.add('is-webui-row');
            }
            if (row.querySelector('[name="folder_webui_url"]')) {
                row.classList.add('is-wide-row');
                row.classList.add('is-url-row', 'is-webui-url-row');
            }
            if (row.querySelector('[name="preview_text_width"]')) {
                row.classList.add('is-compact-text-row');
            }
            if (row.querySelector('input.basic-switch, .switch-button')) {
                row.classList.add('is-toggle-row');
            }
            if (row.querySelector('input[type="color"]')) {
                row.classList.add('is-color-row');
            }
        });

        Array.from(form.querySelectorAll('.fv-section-shell ul')).forEach((list) => {
            list.classList.add('fv-modern-group-list');
            if (list.querySelector('.folder-status-colors-dd')) {
                list.classList.add('is-status-list');
            }
            if (list.querySelector('.fv-inline-control-row')) {
                list.classList.add('is-inline-control-list');
            }
            Array.from(list.children).forEach((item) => {
                if (item instanceof root.HTMLElement) {
                    item.classList.add('fv-modern-group-item');
                }
            });
        });
    };

    const hideOrphanRows = (form) => {
        Array.from(form.children).forEach((child) => {
            if (!(child instanceof root.HTMLElement)) {
                return;
            }
            if (child.id === 'fvModernEditorStage') {
                return;
            }
            if (child.matches('.fv-section-shell')) {
                return;
            }
            if (child.matches('.folder-btn-submit, .folder-btn-apply-settings, .folder-btn-copy, .folder-btn-reset, .folder-btn-cancel, #unsavedIndicator')) {
                child.style.display = 'none';
                return;
            }
            if (child.matches('.basic, ul')) {
                child.classList.add('fv-orphan-editor-row');
                child.style.display = 'none';
            }
        });
    };

    const applySectionVisibility = (form) => {
        currentSection = normalizeSectionKey(currentSection, currentMode);
        const heroMode = form.querySelector('#fvHeroMode');
        if (heroMode) {
            heroMode.textContent = 'All sections';
        }

        Object.entries(SECTION_META).forEach(([sectionKey, meta]) => {
            const navButton = form.querySelector(`.fv-section-nav > button[data-target="${sectionKey}"]`);
            const shell = form.querySelector(`.fv-section-shell[data-section-shell="${sectionKey}"]`);
            if (!shell || !navButton) {
                return;
            }
            const isActive = currentSection === sectionKey;
            navButton.style.display = '';
            navButton.classList.toggle('is-active', isActive);
            shell.style.display = isActive ? '' : 'none';
        });
    };

    const bindTopButtons = (form) => {
        const runIfAvailable = (fnName, fallbackSelector = '') => {
            const fn = root[fnName];
            if (typeof fn === 'function') {
                fn();
                return;
            }
            const fallback = fallbackSelector ? form.querySelector(fallbackSelector) : null;
            if (fallback) {
                fallback.click();
            }
        };

        const bindButton = (selector, fnName, fallbackSelector = '') => {
            const button = form.querySelector(selector);
            if (!button) {
                return;
            }
            button.addEventListener('click', () => {
                runIfAvailable(fnName, fallbackSelector);
            });
        };

        bindButton('#fvRestoreSavedValues', 'resetUnsavedChanges', '.folder-btn-reset');
        bindButton('#fvApplyPluginDefaults', 'applyEditorPluginDefaults');
        bindButton('#fvSuggestDefaults', 'suggestDefaultsFromMembers');
    };

    const bindSectionControls = (form) => {
        Array.from(form.querySelectorAll('.fv-section-nav > button[data-target]')).forEach((button) => {
            button.addEventListener('click', () => {
                currentSection = normalizeSectionKey(button.getAttribute('data-target'), currentMode);
                applySectionVisibility(form);
            });
        });
    };

    const refreshModernEditorChromeLayout = () => {
        const form = root.document && root.document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }
        ensureTopChrome(form);
        ensureActionBar(form);
        ensureSectionShells(form);
        decorateSectionRows(form);
        hideOrphanRows(form);
        applySectionVisibility(form);
    };

    root.FolderViewPlusRefreshModernEditorChromeLayout = refreshModernEditorChromeLayout;
    root.FolderViewPlusRevealModernEditorStage = (options = {}) => {
        const form = root.document && root.document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }
        revealModernStage(form, options);
    };

    const init = () => {
        const form = root.document && root.document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }
        currentMode = ADVANCED_MODE;
        currentSection = 'general';
        refreshModernEditorChromeLayout();
        bindTopButtons(form);
        bindSectionControls(form);
    };

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
