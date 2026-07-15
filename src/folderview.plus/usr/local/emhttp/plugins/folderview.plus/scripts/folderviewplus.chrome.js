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
                    </div>
                    <label class="fv-search-scope" title="Limit search to currently selected advanced tab">
                        <input type="checkbox" id="fv-search-all-advanced">
                        Search all advanced
                    </label>
                </div>
                <span id="fv-prefs-save-status" class="fv-prefs-save-status is-saved" data-state="saved" role="status" aria-live="polite">
                    <i class="fa fa-check" aria-hidden="true"></i>
                    <span>Saved</span>
                </span>
                <span class="fv-mode-toggle" title="Settings mode">
                    <button type="button" class="fv-mode-btn" data-mode="basic" aria-label="Use basic settings mode">Basic</button>
                    <button type="button" class="fv-mode-btn" data-mode="advanced" aria-label="Use advanced settings mode">Advanced</button>
                </span>
                <button type="button" id="fv-run-wizard" title="Run setup assistant"><i class="fa fa-magic"></i> Wizard</button>
            </div>
        </div>
    `;

    window.FolderViewPlusSettingsChrome = Object.freeze({
        getTopbarHtml
    });
})();
