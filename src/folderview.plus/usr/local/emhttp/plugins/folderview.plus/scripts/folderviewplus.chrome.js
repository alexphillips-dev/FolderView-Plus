(() => {
    const getTopbarHtml = () => `
        <div class="fv-settings-inline">
            <div class="fv-settings-left" aria-label="Plugin settings title">
                <h2 class="fv-settings-title">FolderView Plus</h2>
                <span class="fv-settings-subtitle">Plugin settings</span>
            </div>
            <div class="fv-settings-right">
                <div class="fv-settings-search-block">
                    <div class="fv-settings-search-wrap">
                        <input type="text" id="fv-settings-search" placeholder="Search settings" aria-label="Search settings">
                        <button type="button" id="fv-settings-clear-search" title="Clear search" aria-label="Clear search"><i class="fa fa-times"></i></button>
                    </div>
                    <label class="fv-search-scope" title="Limit search to currently selected advanced tab">
                        <input type="checkbox" id="fv-search-all-advanced">
                        Search all advanced
                    </label>
                </div>
                <span class="fv-mode-toggle" title="Settings mode">
                    <button type="button" class="fv-mode-btn" data-mode="basic" aria-label="Use basic settings mode">Basic</button>
                    <button type="button" class="fv-mode-btn" data-mode="advanced" aria-label="Use advanced settings mode">Advanced</button>
                </span>
                <button type="button" id="fv-run-wizard" title="Run setup assistant"><i class="fa fa-magic"></i> Wizard</button>
            </div>
        </div>
    `;

    const getActionBarHtml = () => `
        <div id="fv-save-dock" class="fv-save-dock" data-dirty="0" data-expanded="0" data-more-open="0">
            <div class="fv-save-dock-head">
                <button type="button" id="fv-save-dock-chip" class="fv-save-dock-chip" aria-expanded="false" aria-label="Open save actions">
                    <i class="fa fa-circle"></i>
                    <span id="fv-save-dock-chip-text">Unsaved (0)</span>
                    <i class="fa fa-chevron-up fv-save-dock-chevron"></i>
                </button>
                <button type="button" id="fv-save-dock-handle" class="fv-save-dock-handle" title="Drag to move save dock" aria-label="Drag to move save dock">
                    <i class="fa fa-arrows"></i>
                </button>
            </div>
            <div class="fv-save-dock-panel">
                <div class="fv-action-buttons fv-action-buttons-primary">
                    <button type="button" id="fv-action-save"><i class="fa fa-save"></i> Save</button>
                    <button type="button" id="fv-action-cancel"><i class="fa fa-undo"></i> Cancel</button>
                </div>
                <button type="button" id="fv-action-more" class="fv-action-more" aria-expanded="false"><i class="fa fa-ellipsis-h"></i> More</button>
                <div class="fv-action-buttons fv-action-buttons-secondary">
                    <button type="button" id="fv-action-save-close"><i class="fa fa-check"></i> Save &amp; Close</button>
                    <button type="button" id="fv-action-reset-section"><i class="fa fa-refresh"></i> Reset section</button>
                </div>
                <span id="fv-action-status" class="fv-action-status" aria-live="polite"></span>
            </div>
        </div>
    `;

    window.FolderViewPlusSettingsChrome = Object.freeze({
        getTopbarHtml,
        getActionBarHtml
    });
})();
