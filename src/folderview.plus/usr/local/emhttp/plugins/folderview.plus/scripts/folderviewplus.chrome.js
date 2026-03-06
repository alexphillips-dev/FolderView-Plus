(() => {
    const getTopbarHtml = () => `
        <div class="fv-settings-inline">
            <div class="fv-settings-left" aria-label="Plugin settings title">
                <h2 class="fv-settings-title">FolderView Plus</h2>
                <span class="fv-settings-subtitle">Plugin settings</span>
            </div>
            <div class="fv-settings-right">
                <input type="text" id="fv-settings-search" placeholder="Search settings" aria-label="Search settings">
                <button type="button" id="fv-settings-clear-search" title="Clear search" aria-label="Clear search"><i class="fa fa-times"></i></button>
                <label class="fv-search-scope" title="Limit search to currently selected advanced tab">
                    <input type="checkbox" id="fv-search-all-advanced">
                    Search all advanced
                </label>
                <span class="fv-mode-toggle" title="Settings mode">
                    <button type="button" class="fv-mode-btn" data-mode="basic" aria-label="Use basic settings mode">Basic</button>
                    <button type="button" class="fv-mode-btn" data-mode="advanced" aria-label="Use advanced settings mode">Advanced</button>
                </span>
                <button type="button" id="fv-run-wizard" title="Run quick setup wizard"><i class="fa fa-magic"></i> Wizard</button>
            </div>
        </div>
    `;

    const getActionBarHtml = () => `
        <div class="fv-action-buttons">
            <button type="button" id="fv-action-save"><i class="fa fa-save"></i> Save</button>
            <button type="button" id="fv-action-save-close"><i class="fa fa-check"></i> Save &amp; Close</button>
            <button type="button" id="fv-action-cancel"><i class="fa fa-undo"></i> Cancel</button>
            <button type="button" id="fv-action-reset-section"><i class="fa fa-refresh"></i> Reset section</button>
        </div>
        <span id="fv-action-status" class="fv-action-status">All changes are saved.</span>
    `;

    window.FolderViewPlusSettingsChrome = Object.freeze({
        getTopbarHtml,
        getActionBarHtml
    });
})();
