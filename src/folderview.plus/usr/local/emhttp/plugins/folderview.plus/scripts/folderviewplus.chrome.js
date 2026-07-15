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
                        <i class="fa fa-search fv-settings-search-icon" aria-hidden="true"></i>
                        <input type="search" id="fv-settings-search" placeholder="Search settings" aria-label="Search settings" aria-controls="fv-settings-root" aria-describedby="fv-settings-search-status" autocomplete="off" spellcheck="false" enterkeyhint="search">
                        <button type="button" id="fv-settings-clear-search" class="fv-settings-clear-search" aria-label="Clear settings search" title="Clear search" hidden><i class="fa fa-times" aria-hidden="true"></i></button>
                    </div>
                    <div class="fv-settings-search-meta">
                        <span id="fv-settings-search-status" class="fv-settings-search-status" role="status" aria-live="polite" aria-atomic="true"></span>
                        <label class="fv-search-scope" for="fv-settings-search-scope" title="Choose whether Advanced search covers this tab or every Advanced tab">
                            <span>Scope</span>
                            <select id="fv-settings-search-scope" aria-label="Advanced settings search scope">
                                <option value="current">Current tab</option>
                                <option value="all">All advanced</option>
                            </select>
                        </label>
                    </div>
                </div>
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
