(function folderEditorChromeBootstrap(root) {
    const editorPageMode = String(root.FolderViewPlusFolderEditorPageMode || 'legacy').trim().toLowerCase();
    if (editorPageMode !== 'modern') {
        return;
    }
    const SECTION_META = {
        general: { title: 'General', icon: 'fa-folder-open-o', advanced: false, description: 'Name, parent, icon, and folder-level WebUI behavior.' },
        members: { title: 'Members', icon: 'fa-th-large', advanced: false, description: 'Choose which containers or VMs belong in this folder and tune the visible order.' },
        preview: { title: 'Preview', icon: 'fa-eye', advanced: false, description: 'Control preview layout, context, borders, dividers, and inline preview actions.' },
        chevron: { title: 'Chevron', icon: 'fa-chevron-down', advanced: false, description: 'Pick the dropdown style and the primary / hover colors used in folder rows.' },
        status: { title: 'Status', icon: 'fa-heartbeat', advanced: false, description: 'Adjust status colors and optional health or warning thresholds for the folder.' },
        rules: { title: 'Rules', icon: 'fa-code', advanced: true, description: 'Use regex matching and related automation rules to keep this folder populated.' },
        actions: { title: 'Actions', icon: 'fa-bolt', advanced: true, description: 'Configure custom folder actions and menu behavior for the folder context menu.' },
        advanced: { title: 'Advanced', icon: 'fa-sliders', advanced: true, description: 'Tune Docker / VM / Dashboard specific behavior and other advanced defaults.' }
    };
    const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
    const BASIC_MODE = 'basic';
    const ADVANCED_MODE = 'advanced';
    let currentMode = BASIC_MODE;
    let currentSection = 'general';

    const findBasicByFieldName = (form, fieldName) => Array.from(form.querySelectorAll('.basic'))
        .find((entry) => entry.querySelector(`[name="${fieldName}"]`));

    const getVisibleSectionKeys = (mode = currentMode) => Object.entries(SECTION_META)
        .filter(([, meta]) => mode === ADVANCED_MODE || meta.advanced !== true)
        .map(([key]) => key);

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
                        <span class="fv-editor-kicker">Folder editor</span>
                        <h2 id="fvHeroTitle">Configure folder</h2>
                        <p id="fvHeroSubtitle">A fully grouped folder editor with tabbed sections, live preview, and a dedicated action bar.</p>
                        <div class="fv-hero-meta">
                            <span id="fvHeroScope">Top-level folder</span>
                            <span id="fvHeroMembers">0/0 included</span>
                            <span id="fvHeroDefaults">Checking inherited defaults</span>
                            <span id="fvHeroMode">Basic editor</span>
                        </div>
                    </div>
                </div>
                <div class="fv-editor-hero-actions">
                    <button type="button" id="fvRestoreSavedValues"><i class="fa fa-history" aria-hidden="true"></i> Restore saved values</button>
                    <button type="button" id="fvApplyPluginDefaults"><i class="fa fa-repeat" aria-hidden="true"></i> Apply plugin defaults</button>
                    <button type="button" id="fvSuggestDefaults"><i class="fa fa-magic" aria-hidden="true"></i> Suggest defaults</button>
                </div>
            </div>
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
                <div class="fv-editor-mode" role="group" aria-label="Editor mode">
                    <button type="button" data-mode="basic" class="is-active">Basic</button>
                    <button type="button" data-mode="advanced">Advanced</button>
                </div>
            </div>
            <div class="fv-editor-status-row">
                <span id="fvValidationSummary" class="fv-validation-summary ready">Folder editor shell loaded.</span>
                <pre id="fvValidationDetails" class="fv-validation-details ready">Core layout is ready. Runtime data and live controls will continue hydrating.</pre>
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
    `;

    const ensureTopChrome = (form) => {
        if (form.querySelector('#fvEditorChrome') && form.querySelector('#fvLivePanel')) {
            return;
        }
        form.insertAdjacentHTML('afterbegin', buildTopChrome());
    };

    const ensureActionBar = (form) => {
        let actionBar = form.querySelector('#fvEditorActionBar');
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
            form.appendChild(actionBar);
        }
        const actionBarMain = actionBar.querySelector('.fv-editor-actionbar-main');
        if (!actionBarMain) {
            return;
        }
        Array.from(form.querySelectorAll('.folder-btn-submit, .folder-btn-copy, .folder-btn-reset, .folder-btn-cancel, #unsavedIndicator')).forEach((entry) => {
            actionBarMain.appendChild(entry);
        });
    };

    const collectSectionRows = (form) => ({
        general: [
            findBasicByFieldName(form, 'name'),
            findBasicByFieldName(form, 'parent_folder_id'),
            findBasicByFieldName(form, 'folder_webui'),
            findBasicByFieldName(form, 'icon'),
            form.querySelector('ul[constraint*="folder-webui"]')
        ],
        members: [
            form.querySelector('.basic.order-section')
        ],
        preview: [
            findBasicByFieldName(form, 'preview'),
            findBasicByFieldName(form, 'preview_hover'),
            findBasicByFieldName(form, 'preview_update'),
            findBasicByFieldName(form, 'preview_text_width'),
            findBasicByFieldName(form, 'preview_rows'),
            findBasicByFieldName(form, 'preview_grayscale'),
            findBasicByFieldName(form, 'preview_webui'),
            findBasicByFieldName(form, 'preview_logs'),
            findBasicByFieldName(form, 'preview_console'),
            findBasicByFieldName(form, 'preview_vertical_bars'),
            form.querySelector('ul[constraint*="bars-color"]'),
            findBasicByFieldName(form, 'preview_border'),
            form.querySelector('ul[constraint*="border-color"]'),
            findBasicByFieldName(form, 'context'),
            form.querySelector('ul[constraint*="context-2"]')
        ],
        chevron: [
            findBasicByFieldName(form, 'dropdown_style'),
            findBasicByFieldName(form, 'dropdown_color')
        ],
        status: [
            findBasicByFieldName(form, 'status_color_started'),
            findBasicByFieldName(form, 'health_warn_stopped_percent'),
            findBasicByFieldName(form, 'health_critical_stopped_percent'),
            findBasicByFieldName(form, 'health_profile'),
            findBasicByFieldName(form, 'health_updates_mode'),
            findBasicByFieldName(form, 'health_all_stopped_mode'),
            findBasicByFieldName(form, 'status_warn_stopped_percent')
        ],
        rules: [
            findBasicByFieldName(form, 'regex')
        ],
        actions: [
            form.querySelector('.basic.custom-action-wrapper-parent'),
            Array.from(form.querySelectorAll('.basic')).find((entry) => entry.querySelector('a.custom-action'))
        ],
        advanced: [
            findBasicByFieldName(form, 'update_column'),
            findBasicByFieldName(form, 'override_default_actions'),
            findBasicByFieldName(form, 'default_action'),
            findBasicByFieldName(form, 'expand_tab'),
            findBasicByFieldName(form, 'expand_dashboard'),
            findBasicByFieldName(form, 'dashboard_overflow')
        ]
    });

    const ensureSectionShells = (form) => {
        const sectionRows = collectSectionRows(form);
        const actionBar = form.querySelector('#fvEditorActionBar');
        Object.entries(SECTION_META).forEach(([sectionKey, meta]) => {
            const rows = (sectionRows[sectionKey] || []).filter(Boolean);
            if (!rows.length) {
                return;
            }
            let shell = form.querySelector(`.fv-section-shell[data-section-shell="${sectionKey}"]`);
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
                                <h3>${meta.title}${meta.advanced ? ' <span class="fv-section-badge">advanced</span>' : ''}</h3>
                                <p>${meta.description}</p>
                            </div>
                        </div>
                    </div>
                    <div class="fv-section-shell-body"></div>
                `;
                if (actionBar) {
                    form.insertBefore(shell, actionBar);
                } else {
                    form.appendChild(shell);
                }
            }
            const body = shell.querySelector('.fv-section-shell-body');
            if (!body) {
                return;
            }
            body.classList.add('fv-modern-section-grid');
            rows.forEach((row) => {
                if (row && row.parentElement !== body) {
                    body.appendChild(row);
                }
            });
        });
    };

    const decorateSectionRows = (form) => {
        Array.from(form.querySelectorAll('.fv-section-shell .basic')).forEach((row) => {
            row.classList.add('fv-modern-field-row');
            row.classList.remove('fv-orphan-editor-row');
            row.classList.remove('fv-modern-order-row', 'is-wide-row', 'is-icon-row', 'is-status-row', 'is-actions-row', 'is-toggle-row', 'is-color-row', 'is-name-row', 'is-url-row', 'is-compact-text-row', 'is-webui-row');
            if (row.classList.contains('order-section')) {
                row.classList.add('fv-modern-order-row', 'is-wide-row');
                return;
            }
            if (row.querySelector('.fv-icon-dd')) {
                row.classList.add('is-icon-row', 'is-wide-row');
            }
            if (row.querySelector('.folder-status-colors-dd')) {
                row.classList.add('is-status-row');
            }
            if (row.querySelector('.custom-action-wrapper') || row.querySelector('a.custom-action')) {
                row.classList.add('is-actions-row', 'is-wide-row');
            }
            if (row.querySelector('[name="regex"]')) {
                row.classList.add('is-wide-row');
            }
            if (row.querySelector('[name="name"]')) {
                row.classList.add('is-name-row');
            }
            if (row.querySelector('[name="folder_webui"]')) {
                row.classList.add('is-webui-row');
            }
            if (row.querySelector('[name="folder_webui_url"]')) {
                row.classList.add('is-wide-row');
                row.classList.add('is-url-row');
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
            if (child.id === 'fvEditorChrome' || child.id === 'fvLivePanel' || child.id === 'fvEditorActionBar') {
                return;
            }
            if (child.matches('.fv-section-shell')) {
                return;
            }
            if (child.matches('.folder-btn-submit, .folder-btn-copy, .folder-btn-reset, .folder-btn-cancel, #unsavedIndicator')) {
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
        const showAdvanced = currentMode === ADVANCED_MODE;
        const modeButtons = Array.from(form.querySelectorAll('.fv-editor-mode > button[data-mode]'));
        modeButtons.forEach((button) => {
            button.classList.toggle('is-active', button.getAttribute('data-mode') === currentMode);
        });
        const heroMode = form.querySelector('#fvHeroMode');
        if (heroMode) {
            heroMode.textContent = showAdvanced ? 'Advanced editor' : 'Basic editor';
        }

        Object.entries(SECTION_META).forEach(([sectionKey, meta]) => {
            const navButton = form.querySelector(`.fv-section-nav > button[data-target="${sectionKey}"]`);
            const shell = form.querySelector(`.fv-section-shell[data-section-shell="${sectionKey}"]`);
            if (!shell || !navButton) {
                return;
            }
            if (!showAdvanced && meta.advanced === true) {
                navButton.style.display = 'none';
                shell.style.display = 'none';
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
        Array.from(form.querySelectorAll('.fv-editor-mode > button[data-mode]')).forEach((button) => {
            button.addEventListener('click', () => {
                currentMode = button.getAttribute('data-mode') === ADVANCED_MODE ? ADVANCED_MODE : BASIC_MODE;
                currentSection = normalizeSectionKey(currentSection, currentMode);
                applySectionVisibility(form);
            });
        });
    };

    const init = () => {
        const form = root.document && root.document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }
        currentMode = BASIC_MODE;
        currentSection = 'general';
        ensureTopChrome(form);
        ensureActionBar(form);
        ensureSectionShells(form);
        decorateSectionRows(form);
        hideOrphanRows(form);
        bindTopButtons(form);
        bindSectionControls(form);
        applySectionVisibility(form);
    };

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
