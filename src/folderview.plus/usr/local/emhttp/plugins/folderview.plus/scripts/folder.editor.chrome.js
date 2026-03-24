(function folderEditorChromeBootstrap(root) {
    const SECTION_META = {
        general: { title: 'General', icon: 'fa-folder-open-o', advanced: false },
        members: { title: 'Members', icon: 'fa-th-large', advanced: false },
        preview: { title: 'Preview', icon: 'fa-eye', advanced: false },
        chevron: { title: 'Chevron', icon: 'fa-chevron-down', advanced: false },
        status: { title: 'Status', icon: 'fa-heartbeat', advanced: false },
        rules: { title: 'Rules', icon: 'fa-code', advanced: true },
        actions: { title: 'Actions', icon: 'fa-bolt', advanced: true },
        advanced: { title: 'Advanced', icon: 'fa-sliders', advanced: true }
    };

    const findBasicByFieldName = (form, fieldName) => Array.from(form.querySelectorAll('.basic'))
        .find((entry) => entry.querySelector(`[name="${fieldName}"]`));

    const ensureTopChrome = (form) => {
        if (form.querySelector('#fvEditorChrome')) {
            return;
        }
        form.insertAdjacentHTML('afterbegin', `
            <div id="fvEditorChrome" class="fv-editor-chrome">
                <div class="fv-editor-hero">
                    <div class="fv-editor-hero-main">
                        <div class="fv-editor-hero-icon">
                            <img src="/plugins/folderview.plus/images/folder-icon.png" alt="">
                        </div>
                        <div class="fv-editor-hero-copy">
                            <span class="fv-editor-kicker">Folder editor</span>
                            <h2>Configure folder</h2>
                            <p>Edit the folder with grouped controls, a cleaner layout, and a dedicated preview surface.</p>
                            <div class="fv-hero-meta">
                                <span>Grouped editor</span>
                                <span>Live preview</span>
                                <span>Sticky action bar</span>
                            </div>
                        </div>
                    </div>
                    <div class="fv-editor-hero-actions">
                        <button type="button">Restore saved values</button>
                        <button type="button">Apply plugin defaults</button>
                        <button type="button">Suggest defaults</button>
                    </div>
                </div>
                <div class="fv-editor-nav-row">
                    <div class="fv-section-nav"></div>
                    <div class="fv-editor-mode">
                        <button type="button" class="is-active">Basic</button>
                        <button type="button">Advanced</button>
                    </div>
                </div>
                <div class="fv-editor-status-row">
                    <span class="fv-validation-summary ready">Editor shell loaded.</span>
                    <pre class="fv-validation-details ready">Live folder summary and section cards are active on this page.</pre>
                </div>
            </div>
            <div id="fvLivePanel" class="fv-live-panel">
                <div class="fv-live-panel-grid">
                    <div class="fv-live-preview-card">
                        <div class="fv-live-preview-card-head">
                            <div>
                                <strong>Live folder preview</strong>
                                <p>The runtime editor will keep this panel updated as settings change.</p>
                            </div>
                            <span class="fv-live-preview-meta-chip">Editor preview</span>
                        </div>
                        <div class="fv-live-preview-canvas">
                            <div class="fv-live-preview-row">
                                <div class="fv-live-folder-anchor">
                                    <img class="fv-live-folder-icon" src="/plugins/folderview.plus/images/folder-icon.png" alt="">
                                    <div class="fv-live-folder-copy">
                                        <strong>Folder preview</strong>
                                        <span>Waiting for runtime data</span>
                                    </div>
                                </div>
                                <div class="fv-live-member-lane">
                                    <div class="fv-live-preview-empty">The enhanced preview surface is loaded. Runtime data will fill in after the editor initializes.</div>
                                </div>
                                <button type="button" class="fv-live-chevron"><i class="fa fa-chevron-down" aria-hidden="true"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="fv-live-insights">
                        <div class="fv-change-summary-panel">
                            <div class="fv-change-summary-head">
                                <strong>No pending changes</strong>
                                <span class="fv-live-preview-meta-chip">Chrome bootstrap active</span>
                            </div>
                            <p id="fvChromeBootstrapNotice">This page is using the redesigned folder editor shell.</p>
                        </div>
                    </div>
                </div>
            </div>
        `);
    };

    const ensureActionBar = (form) => {
        let actionBar = form.querySelector('#fvEditorActionBar');
        if (!actionBar) {
            actionBar = document.createElement('div');
            actionBar.id = 'fvEditorActionBar';
            actionBar.className = 'fv-editor-actionbar';
            actionBar.innerHTML = `
                <div class="fv-editor-actionbar-main"></div>
                <div class="fv-editor-actionbar-meta">
                    <span class="fv-actionbar-dirty">Use the buttons below to save, copy, reset, or cancel.</span>
                </div>
            `;
            form.appendChild(actionBar);
        }
        const actionBarMain = actionBar.querySelector('.fv-editor-actionbar-main');
        Array.from(form.querySelectorAll('.folder-btn-submit, .folder-btn-copy, .folder-btn-reset, .folder-btn-cancel, #unsavedIndicator')).forEach((entry) => {
            actionBarMain.appendChild(entry);
        });
    };

    const collectSectionRows = (form) => ({
        general: [
            findBasicByFieldName(form, 'name'),
            findBasicByFieldName(form, 'parent_folder_id'),
            findBasicByFieldName(form, 'icon'),
            findBasicByFieldName(form, 'folder_webui'),
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
        if (form.querySelector('.fv-section-shell')) {
            return;
        }
        const sectionRows = collectSectionRows(form);
        const actionBar = form.querySelector('#fvEditorActionBar');
        Object.entries(SECTION_META).forEach(([sectionKey, meta]) => {
            const rows = (sectionRows[sectionKey] || []).filter(Boolean);
            if (!rows.length) {
                return;
            }
            const shell = document.createElement('section');
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
                        </div>
                    </div>
                </div>
                <div class="fv-section-shell-body"></div>
            `;
            const body = shell.querySelector('.fv-section-shell-body');
            rows.forEach((row) => body.appendChild(row));
            if (actionBar) {
                form.insertBefore(shell, actionBar);
            } else {
                form.appendChild(shell);
            }
        });
    };

    const ensureSectionNav = (form) => {
        const nav = form.querySelector('#fvEditorChrome .fv-section-nav');
        if (!nav || nav.children.length > 0) {
            return;
        }
        Object.entries(SECTION_META).forEach(([sectionKey, meta]) => {
            if (!form.querySelector(`.fv-section-shell[data-section-shell="${sectionKey}"]`)) {
                return;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('data-target', sectionKey);
            button.innerHTML = `<i class="fa ${meta.icon}" aria-hidden="true"></i><span>${meta.title}</span>`;
            button.addEventListener('click', () => {
                const target = form.querySelector(`#fv-section-${sectionKey}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            nav.appendChild(button);
        });
    };

    const init = () => {
        const form = root.document && root.document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }
        ensureTopChrome(form);
        ensureActionBar(form);
        ensureSectionShells(form);
        ensureSectionNav(form);
    };

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
