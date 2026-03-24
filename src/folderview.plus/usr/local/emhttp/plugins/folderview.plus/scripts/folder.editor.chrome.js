(function folderEditorChromeBootstrap(root) {
    const SECTION_META = {
        general: { title: 'General', icon: 'fa-folder-open-o' },
        members: { title: 'Members', icon: 'fa-th-large' },
        preview: { title: 'Preview', icon: 'fa-eye' },
        chevron: { title: 'Chevron', icon: 'fa-chevron-down' },
        status: { title: 'Status', icon: 'fa-heartbeat' },
        rules: { title: 'Rules', icon: 'fa-code' },
        actions: { title: 'Actions', icon: 'fa-bolt' },
        advanced: { title: 'Advanced', icon: 'fa-sliders' }
    };
    const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';

    const buildNavButtons = () => Object.entries(SECTION_META)
        .map(([key, section], index) => `
            <button type="button" data-target="${key}"${index === 0 ? ' class="is-active"' : ''}>
                <i class="fa ${section.icon}" aria-hidden="true"></i>
                <span>${section.title}</span>
                <em class="fv-nav-count" style="display:none;"></em>
            </button>
        `)
        .join('');

    const buildChromeMarkup = () => `
        <div id="fvEditorChrome" class="fv-editor-chrome">
            <div class="fv-editor-hero">
                <div class="fv-editor-hero-main">
                    <div class="fv-editor-hero-icon">
                        <img id="fvHeroIcon" src="${DEFAULT_FOLDER_ICON_PATH}" alt="">
                    </div>
                    <div class="fv-editor-hero-copy">
                        <span class="fv-editor-kicker">Folder editor</span>
                        <h2 id="fvHeroTitle">Configure folder</h2>
                        <p id="fvHeroSubtitle">Grouped controls, live preview, and tabbed sections are loading.</p>
                        <div class="fv-hero-meta">
                            <span id="fvHeroScope">Top-level folder</span>
                            <span id="fvHeroMembers">0/0 included</span>
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
                <div class="fv-section-nav">${buildNavButtons()}</div>
                <div class="fv-editor-mode" role="group" aria-label="Editor mode">
                    <button type="button" data-mode="basic" class="is-active">Basic</button>
                    <button type="button" data-mode="advanced">Advanced</button>
                </div>
            </div>
            <div class="fv-editor-status-row">
                <span id="fvValidationSummary" class="fv-validation-summary ready">Folder editor chrome loaded.</span>
                <pre id="fvValidationDetails" class="fv-validation-details ready">The main editor runtime is attaching the live controls now.</pre>
            </div>
        </div>
        <div id="fvLivePanel" class="fv-live-panel">
            <div class="fv-live-panel-grid">
                <div class="fv-live-preview-card">
                    <div class="fv-live-preview-card-head">
                        <div>
                            <strong>Live folder preview</strong>
                            <p>The runtime editor will keep this preview updated as you change settings.</p>
                        </div>
                        <span id="fvLivePreviewMeta" class="fv-live-preview-meta-chip">Loading preview</span>
                    </div>
                    <div id="fvLivePreviewCanvas" class="fv-live-preview-canvas">
                        <div class="fv-live-preview-row">
                            <div class="fv-live-folder-anchor">
                                <img class="fv-live-folder-icon" src="${DEFAULT_FOLDER_ICON_PATH}" alt="">
                                <div class="fv-live-folder-copy">
                                    <strong>Folder preview</strong>
                                    <span>Waiting for folder data</span>
                                </div>
                            </div>
                            <div class="fv-live-member-lane">
                                <div class="fv-live-preview-empty">Preview data will appear here when the editor finishes loading.</div>
                            </div>
                            <button type="button" class="fv-live-chevron" aria-label="Chevron preview">
                                <i class="fa fa-chevron-down" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="fv-live-insights">
                    <div class="fv-live-grid">
                        <span><strong>Name:</strong> <span id="fvLiveName">-</span></span>
                        <span><strong>Preview:</strong> <span id="fvLivePreview">-</span></span>
                        <span><strong>Context:</strong> <span id="fvLiveContext">-</span></span>
                        <span><strong>Members:</strong> <span id="fvLiveMembers">0/0 included</span></span>
                    </div>
                    <div class="fv-live-swatches">
                        <span class="fv-swatch-item"><em>Started</em><i id="fvSwatchStarted"></i></span>
                        <span class="fv-swatch-item"><em>Paused</em><i id="fvSwatchPaused"></i></span>
                        <span class="fv-swatch-item"><em>Stopped</em><i id="fvSwatchStopped"></i></span>
                    </div>
                    <div id="fvDockerSignals" class="fv-docker-signals" style="display:none;">
                        <span id="fvDockerComposeSummary" class="fv-docker-signal-chip">Compose: loading…</span>
                        <span id="fvDockerUpdateSummary" class="fv-docker-signal-chip">Updates: loading…</span>
                    </div>
                    <div class="fv-change-summary-panel">
                        <div class="fv-change-summary-head">
                            <strong id="fvChangeSummaryLabel">No pending changes</strong>
                            <span id="fvLiveInheritance" class="fv-live-preview-meta-chip">Review saved vs default behavior before you save.</span>
                        </div>
                        <p id="fvChangeSummaryText">This folder currently matches the saved values.</p>
                        <ul id="fvChangeSummaryList" class="fv-change-summary-list"></ul>
                        <span id="fvChangeSummaryOverflow" class="fv-change-summary-overflow"></span>
                    </div>
                    <div class="fv-regex-simulator">
                        <label for="fvRegexSimulatorInput"><strong>Regex simulator</strong></label>
                        <input type="text" id="fvRegexSimulatorInput" placeholder="Test a container or VM name">
                        <span id="fvRegexSimulatorResult" class="fv-regex-result">No regex configured.</span>
                        <div id="fvRegexSimulatorMeta" class="fv-regex-meta"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const ensureTopChrome = (form) => {
        if (form.querySelector('#fvEditorChrome') && form.querySelector('#fvLivePanel')) {
            return;
        }
        form.insertAdjacentHTML('afterbegin', buildChromeMarkup());
    };

    const ensureActionBar = (form) => {
        if (form.querySelector('#fvEditorActionBar')) {
            return;
        }
        const actionBar = root.document.createElement('div');
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
    };

    const init = () => {
        const form = root.document && root.document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }
        ensureTopChrome(form);
        ensureActionBar(form);
    };

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
