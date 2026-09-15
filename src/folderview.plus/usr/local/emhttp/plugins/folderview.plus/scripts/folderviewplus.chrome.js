(() => {
    const getTopbarHtml = () => `
        <div class="fv-settings-inline">
            <div class="fv-settings-left" aria-label="Plugin settings title">
                <h2 class="fv-settings-title">FolderView Plus</h2>
                <div class="fv-settings-meta">
                    <span class="fv-settings-subtitle" data-i18n="settings.header.plugin-settings">Plugin settings</span>
                    <a id="fv-plugin-update-link" class="fv-plugin-update-link" href="/Plugins" hidden data-i18n="[aria-label]settings.update.open-plugins;[title]settings.update.open-plugins" aria-label="Update available. Open Plugins to install it." title="Update available. Open Plugins to install it.">
                        <svg class="fv-plugin-update-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                        <span data-i18n="settings.update.available">Update Available</span>
                    </a>
                </div>
            </div>
            <div class="fv-settings-right">
                <div class="fv-settings-search-block">
                    <div class="fv-settings-search-wrap">
                        <i class="fa fa-search fv-settings-search-icon" aria-hidden="true"></i>
                        <input type="search" id="fv-settings-search" placeholder="Search settings" aria-label="Search settings" data-i18n="[placeholder]settings.search.placeholder;[aria-label]settings.search.label" aria-controls="fv-settings-root" aria-describedby="fv-settings-search-status" autocomplete="off" spellcheck="false" enterkeyhint="search">
                        <button type="button" id="fv-settings-clear-search" class="fv-settings-clear-search" aria-label="Clear settings search" title="Clear search" data-i18n="[aria-label]settings.search.clear-label;[title]settings.search.clear-title" hidden><i class="fa fa-times" aria-hidden="true"></i></button>
                    </div>
                    <div class="fv-settings-search-meta">
                        <span id="fv-settings-search-status" class="fv-settings-search-status" role="status" aria-live="polite" aria-atomic="true"></span>
                        <label class="fv-search-scope" for="fv-settings-search-scope" title="Choose whether Advanced search covers this tab or every Advanced tab" data-i18n="[title]settings.search.scope-help">
                            <span data-i18n="settings.search.scope">Scope</span>
                            <select id="fv-settings-search-scope" aria-label="Advanced settings search scope" data-i18n="[aria-label]settings.search.scope-label">
                                <option value="current" data-i18n="settings.search.scope-current">Current tab</option>
                                <option value="all" data-i18n="settings.search.scope-all">All advanced</option>
                            </select>
                        </label>
                    </div>
                </div>
                <span class="fv-mode-toggle" title="Settings mode" data-i18n="[title]settings.mode.title">
                    <button type="button" class="fv-mode-btn" data-mode="basic" aria-label="Use basic settings mode" data-i18n="settings.tabs.basic;[aria-label]settings.mode.basic-label">Basic</button>
                    <button type="button" class="fv-mode-btn" data-mode="advanced" aria-label="Use advanced settings mode" data-i18n="settings.tabs.advanced;[aria-label]settings.mode.advanced-label">Advanced</button>
                </span>
                <button type="button" id="fv-run-wizard" title="Run setup assistant" data-i18n="[title]settings.wizard.title"><i class="fa fa-magic"></i> <span data-i18n="settings.tabs.wizard">Wizard</span></button>
            </div>
        </div>
    `;

    window.FolderViewPlusSettingsChrome = Object.freeze({
        getTopbarHtml
    });
})();
