(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.theme-profiles.js'));
        return;
    }
    root.FolderViewPlusThemeWorkspace = factory(root.FolderViewPlusFoundationModules?.themeProfiles);
    root.FolderViewPlusThemeWorkspaceModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(themeProfiles) {
    if (!themeProfiles || typeof themeProfiles.normalizeState !== 'function') {
        throw new Error('FolderView Plus theme profiles are unavailable.');
    }
    const TOKEN_DEFINITIONS = Object.freeze([
        Object.freeze({ token: '--fvplus-theme-accent', label: 'Accent', fallback: '#f0a030' }),
        Object.freeze({ token: '--fvplus-theme-surface-panel', label: 'Surface panel', fallback: '#1b1d20' }),
        Object.freeze({ token: '--fvplus-theme-border-subtle', label: 'Border subtle', fallback: '#444444' }),
        Object.freeze({ token: '--fvplus-status-started', label: 'Status started', fallback: '#ffffff' }),
        Object.freeze({ token: '--fvplus-status-paused', label: 'Status paused', fallback: '#b8860b' }),
        Object.freeze({ token: '--fvplus-status-stopped', label: 'Status stopped', fallback: '#ff4d4d' }),
        Object.freeze({ token: '--fvplus-graph-cpu', label: 'Graph CPU', fallback: '#5aa4ff' }),
        Object.freeze({ token: '--fvplus-graph-mem', label: 'Graph memory', fallback: '#6bd676' })
    ]);

    const normalizeWorkspace = (value) => {
        const source = value && typeof value === 'object' ? value : {};
        const rawThemes = Array.isArray(source.themes) ? source.themes : [];
        const themes = rawThemes
            .filter((theme) => theme && typeof theme === 'object')
            .map((theme) => ({
                id: String(theme.id || '').trim(),
                name: String(theme.name || '').trim(),
                importedAt: String(theme.importedAt || '').trim(),
                lastCheckedAt: String(theme.lastCheckedAt || '').trim(),
                updateAvailable: theme.updateAvailable === true,
                warnings: Array.isArray(theme.warnings) ? theme.warnings.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
                source: theme.source && typeof theme.source === 'object' ? { ...theme.source } : {},
                files: Array.isArray(theme.files) ? theme.files : []
            }))
            .filter((theme) => theme.id);
        const profileState = themeProfiles.normalizeState(source);
        const activeProfile = themeProfiles.getActiveProfile(profileState);
        const globalLayer = themeProfiles.normalizeLayer(activeProfile.layers.global);
        return {
            schemaVersion: Number(source.schemaVersion || 2),
            activeThemeId: String(source.activeThemeId || '').trim(),
            themes,
            ...profileState,
            variables: globalLayer.variables,
            customCss: globalLayer.customCss,
            lastCheckedAt: String(source.lastCheckedAt || '').trim()
        };
    };

    const createApi = (deps = {}) => {
        const documentRef = deps.document || null;
        const $ = deps.$ || null;
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value || ''));
        const apiGetJson = typeof deps.apiGetJson === 'function' ? deps.apiGetJson : (async () => ({}));
        const apiPostJson = typeof deps.apiPostJson === 'function' ? deps.apiPostJson : (async () => ({}));
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});

        let workspace = normalizeWorkspace({});
        let pendingScan = null;
        let activeScope = 'global';

        const getActiveProfile = () => themeProfiles.getActiveProfile(workspace);
        const getEditingLayer = () => themeProfiles.normalizeLayer(getActiveProfile().layers?.[activeScope]);
        const syncEditingAliases = () => {
            const layer = getEditingLayer();
            workspace = { ...workspace, variables: layer.variables, customCss: layer.customCss };
            return layer;
        };
        const updateEditingLayer = (patch = {}) => {
            const profileId = workspace.activeProfileId;
            workspace = {
                ...workspace,
                profiles: workspace.profiles.map((profile) => profile.id !== profileId ? profile : {
                    ...profile,
                    layers: { ...profile.layers, [activeScope]: { ...themeProfiles.normalizeLayer(profile.layers?.[activeScope]), ...patch } }
                })
            };
            return syncEditingAliases();
        };

        const setStatus = (message) => {
            if (!documentRef) {
                return;
            }
            const node = documentRef.getElementById('fv-theme-workspace-status');
            if (node) {
                node.textContent = String(message || '').trim() || 'Theme workspace idle.';
            }
        };

        const applyPreviewCss = () => {
            if (!documentRef) {
                return;
            }
            const node = documentRef.getElementById('fv-theme-preview-sample');
            if (!node) {
                return;
            }
            const resolvedLayer = themeProfiles.resolveLayer(workspace, activeScope);
            TOKEN_DEFINITIONS.forEach((definition) => {
                const token = definition.token;
                const value = String(
                    Object.prototype.hasOwnProperty.call(resolvedLayer.variables || {}, token)
                        ? resolvedLayer.variables[token]
                        : (definition.fallback || '')
                ).trim();
                if (value) {
                    node.style.setProperty(token, value);
                } else {
                    node.style.removeProperty(token);
                }
            });
        };

        const formatBytes = (value) => {
            const bytes = Math.max(0, Number(value) || 0);
            if (bytes >= 1024) {
                return `${Math.round(bytes / 102.4) / 10} KB`;
            }
            return `${bytes} bytes`;
        };

        const formatDateShort = (value) => {
            const raw = String(value || '').trim();
            if (!raw) {
                return 'Never';
            }
            const date = new Date(raw);
            if (Number.isNaN(date.getTime())) {
                return raw;
            }
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        };

        const getActiveTheme = () => workspace.themes.find((theme) => theme.id === workspace.activeThemeId) || null;

        const renderProfileControls = () => {
            if (!documentRef) return;
            const toolbar = documentRef.getElementById('fv-theme-profile-toolbar');
            if (toolbar && !documentRef.getElementById('fv-theme-profile-select')) {
                toolbar.innerHTML = '<label><span>Profile</span><select id="fv-theme-profile-select"></select></label><label><span>Scope</span><select id="fv-theme-profile-scope"><option value="global">All pages</option><option value="docker">Docker</option><option value="vm">VMs</option><option value="dashboard">Dashboard</option></select></label><label><span>New profile name</span><input id="fv-theme-profile-name" type="text" maxlength="96" placeholder="Example: OLED dark"></label><button id="fv-theme-profile-create" type="button"><i class="fa fa-plus"></i> Add profile</button><button id="fv-theme-profile-delete" type="button"><i class="fa fa-trash"></i> Delete profile</button><span id="fv-theme-profile-plan" class="rules-help" aria-live="polite"></span>';
            }
            const profileSelect = documentRef.getElementById('fv-theme-profile-select');
            const scopeSelect = documentRef.getElementById('fv-theme-profile-scope');
            if (profileSelect) {
                profileSelect.innerHTML = workspace.profiles.map((profile) => `<option value="${escapeHtml(profile.id)}" ${profile.id === workspace.activeProfileId ? 'selected' : ''}>${escapeHtml(profile.name)}</option>`).join('');
            }
            if (scopeSelect) scopeSelect.value = activeScope;
        };

        const renderSummary = () => {
            if (!documentRef) {
                return;
            }
            const host = documentRef.getElementById('fv-theme-workspace-summary');
            if (!host) {
                return;
            }
            const activeTheme = getActiveTheme();
            const customCssBytes = String(workspace.customCss || '').length;
            const overrideCount = Object.keys(workspace.variables || {}).length;
            const activeFiles = Array.isArray(activeTheme?.files) ? activeTheme.files : [];
            const targets = ['docker', 'vm', 'dashboard'].filter((target) => activeFiles.some((file) => Array.isArray(file.tabs) && file.tabs.includes(target)));
            host.innerHTML = [
                ['Active theme', activeTheme ? (activeTheme.name || activeTheme.id) : 'None'],
                ['Profile / scope', `${getActiveProfile().name} / ${activeScope}`],
                ['Managed themes', String(workspace.themes.length)],
                ['Last checked', formatDateShort(workspace.lastCheckedAt)],
                ['Customization', `${overrideCount} tokens, ${formatBytes(customCssBytes)} CSS`],
                ['Output targets', targets.length ? targets.join(', ') : 'Token/custom layer only']
            ].map(([label, value]) => `
                <div class="fv-theme-summary-card">
                    <span>${escapeHtml(label)}</span>
                    <strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong>
                </div>
            `).join('');
        };

        const renderScanResult = (scanResult = null) => {
            if (!documentRef) {
                return;
            }
            const host = documentRef.getElementById('fv-theme-scan-result');
            if (!host) {
                return;
            }
            if (!scanResult || !scanResult.theme) {
                host.hidden = true;
                host.innerHTML = '';
                host.classList.remove('is-warning');
                return;
            }
            const theme = scanResult.theme;
            const files = Array.isArray(theme.files) ? theme.files : [];
            const warnings = Array.isArray(scanResult.warnings) ? scanResult.warnings : [];
            host.hidden = false;
            host.classList.toggle('is-warning', warnings.length > 0 || scanResult.exists === true);
            host.innerHTML = `
                <div class="fv-theme-scan-title">
                    <span>${escapeHtml(theme.name || theme.id || 'Scanned theme')}</span>
                    <span class="fv-rules-status-chip ${scanResult.exists ? 'is-warning' : 'is-healthy'}">${escapeHtml(scanResult.exists ? 'Will replace existing' : 'Ready to import')}</span>
                </div>
                <div class="fv-theme-scan-meta">${escapeHtml(`${files.length} compatible CSS file${files.length === 1 ? '' : 's'} found`)}</div>
                ${warnings.map((warning) => `<div class="fv-theme-workspace-entry-warning">${escapeHtml(warning)}</div>`).join('')}
                <ul class="fv-theme-file-list">
                    ${files.map((file) => {
                        const tabs = Array.isArray(file.tabs) ? file.tabs.join(', ') : '';
                        return `
                            <li>
                                <strong>${escapeHtml(file.path || file.name || 'theme.css')}</strong>
                                <span class="fv-theme-file-meta">${escapeHtml(tabs ? `Targets: ${tabs}` : 'No target tabs detected')}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            `;
        };

        const renderVariableGrid = () => {
            if (!documentRef) {
                return;
            }
            const host = documentRef.getElementById('fv-theme-variable-grid');
            if (!host) {
                return;
            }
            host.innerHTML = TOKEN_DEFINITIONS.map((definition) => {
                const hasOverride = Object.prototype.hasOwnProperty.call(workspace.variables || {}, definition.token);
                const value = String(hasOverride ? workspace.variables?.[definition.token] : (definition.fallback || '')).trim();
                return `
                    <label class="fv-theme-variable-row${hasOverride ? ' has-override' : ''}">
                        <span class="fv-theme-variable-copy">
                            <span>${escapeHtml(definition.label)}</span>
                            <code>${escapeHtml(definition.token)}${hasOverride ? ' · override' : ' · default'}</code>
                        </span>
                        <input type="color" data-fv-theme-token="${escapeHtml(definition.token)}" data-fv-theme-fallback="${escapeHtml(definition.fallback || '')}" value="${escapeHtml(value)}">
                        <button type="button" class="fv-theme-token-reset" data-fv-theme-token-reset="${escapeHtml(definition.token)}" title="Reset ${escapeHtml(definition.label)}"><i class="fa fa-undo"></i></button>
                    </label>
                `;
            }).join('');
        };

        const renderThemeList = () => {
            if (!documentRef) {
                return;
            }
            const host = documentRef.getElementById('fv-theme-workspace-list');
            if (!host) {
                return;
            }
            if (!workspace.themes.length) {
                host.innerHTML = `
                    <div class="fv-theme-empty-state">
                        <strong>No managed themes imported yet.</strong>
                        <span>Scan a GitHub CSS theme first, then import it after reviewing the detected files.</span>
                    </div>
                `;
                return;
            }
            host.innerHTML = workspace.themes.map((theme) => {
                const isActive = theme.id === workspace.activeThemeId;
                const filesSummary = `${theme.files.length} file${theme.files.length === 1 ? '' : 's'}`;
                const sourceSummary = String(theme.source?.owner || '').trim() && String(theme.source?.repo || '').trim()
                    ? `${theme.source.owner}/${theme.source.repo}${theme.source.branch ? ` @ ${theme.source.branch}` : ''}`
                    : (theme.source?.input || 'Imported theme');
                return `
                    <div class="fv-theme-workspace-entry${isActive ? ' is-active' : ''}">
                        <div class="fv-theme-workspace-entry-head">
                            <div>
                                <div class="fv-theme-workspace-entry-title">${escapeHtml(theme.name || theme.id)}</div>
                                <div class="fv-theme-workspace-entry-meta">${escapeHtml(sourceSummary)} · ${escapeHtml(filesSummary)}${theme.updateAvailable ? ' · update available' : ''}</div>
                            </div>
                            <span class="fv-rules-status-chip ${isActive ? 'is-healthy' : 'is-idle'}">${escapeHtml(isActive ? 'Active' : 'Inactive')}</span>
                        </div>
                        ${theme.warnings.map((warning) => `<div class="fv-theme-workspace-entry-warning">${escapeHtml(warning)}</div>`).join('')}
                        <div class="fv-theme-workspace-entry-actions">
                            <button type="button" data-fv-onclick="activateThemeWorkspaceTheme('${escapeHtml(theme.id)}')"><i class="fa fa-paint-brush"></i> Activate</button>
                            <button type="button" data-fv-onclick="updateThemeWorkspaceTheme('${escapeHtml(theme.id)}')"><i class="fa fa-refresh"></i> Update</button>
                            <button type="button" data-fv-onclick="deleteThemeWorkspaceTheme('${escapeHtml(theme.id)}')"><i class="fa fa-trash"></i> Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        const syncCustomizeFields = () => {
            if (!documentRef) {
                return;
            }
            const cssField = documentRef.getElementById('fv-theme-custom-css');
            if (cssField && cssField.value !== String(workspace.customCss || '')) {
                cssField.value = String(workspace.customCss || '');
            }
            TOKEN_DEFINITIONS.forEach((definition) => {
                const input = documentRef.querySelector(`[data-fv-theme-token="${definition.token}"]`);
                if (input) {
                    input.value = String(
                        Object.prototype.hasOwnProperty.call(workspace.variables || {}, definition.token)
                            ? workspace.variables?.[definition.token]
                            : (definition.fallback || '')
                    );
                }
            });
        };

        const renderWorkspace = () => {
            syncEditingAliases();
            renderProfileControls();
            renderSummary();
            renderThemeList();
            renderVariableGrid();
            syncCustomizeFields();
            applyPreviewCss();
            const activeTheme = getActiveTheme();
            setStatus(activeTheme
                ? `Managed theme active: ${activeTheme.name || activeTheme.id}.`
                : 'No managed theme is currently active.');
        };

        const setWorkspace = (nextWorkspace) => {
            workspace = normalizeWorkspace(nextWorkspace);
            renderWorkspace();
            return workspace;
        };

        const readWorkspace = async () => {
            const response = await apiGetJson('/plugins/folderview.plus/server/theme_workspace.php', {
                data: { action: 'read' }
            });
            return setWorkspace(response.workspace || {});
        };

        const importGithub = async (source) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'import_github',
                source
            });
            pendingScan = null;
            renderScanResult(null);
            return setWorkspace(response.workspace || {});
        };

        const scanGithub = async (source) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'scan_github',
                source
            });
            pendingScan = {
                source: String(source || '').trim(),
                ...(response || {})
            };
            renderScanResult(pendingScan);
            setStatus('Theme scan complete. Review the detected files, then import when ready.');
            return pendingScan;
        };

        const activateTheme = async (themeId) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'activate',
                themeId
            });
            return setWorkspace(response.workspace || {});
        };

        const deactivateTheme = async () => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'deactivate'
            });
            return setWorkspace(response.workspace || {});
        };

        const deleteTheme = async (themeId) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'delete',
                themeId
            });
            return setWorkspace(response.workspace || {});
        };

        const collectVariablesFromUi = () => {
            return { ...(workspace.variables || {}) };
        };

        const saveCustomize = async () => {
            const customCss = String(documentRef?.getElementById('fv-theme-custom-css')?.value || '');
            const payload = {
                profileId: workspace.activeProfileId,
                scope: activeScope,
                variables: JSON.stringify(collectVariablesFromUi()),
                customCss
            };
            const preview = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'preview_profile', ...payload });
            const planNode = documentRef?.getElementById('fv-theme-profile-plan');
            if (planNode) planNode.textContent = preview?.plan?.changed ? `Updating: ${(preview.plan.changedScopes || []).join(', ') || activeScope}` : 'No generated output changes.';
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'save_profile', ...payload });
            return setWorkspace(response.workspace || {});
        };

        const createProfile = async (name) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'create_profile', name });
            activeScope = 'global';
            return setWorkspace(response.workspace || {});
        };

        const activateProfile = async (profileId) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'activate_profile', profileId });
            return setWorkspace(response.workspace || {});
        };

        const deleteProfile = async (profileId) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'delete_profile', profileId });
            return setWorkspace(response.workspace || {});
        };

        const checkUpdates = async () => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'check_updates'
            });
            setWorkspace(response.workspace || {});
            return response;
        };

        const updateTheme = async (themeId) => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'update_theme',
                themeId
            });
            return setWorkspace(response.workspace || {});
        };

        const updateAvailableThemes = async () => {
            const themeIds = workspace.themes.filter((theme) => theme.updateAvailable).map((theme) => theme.id);
            const payload = { themeIds: JSON.stringify(themeIds) };
            const preview = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'preview_theme_updates', ...payload });
            setStatus(`Updating ${Number(preview?.plan?.updateCount) || 0} managed theme(s) atomically...`);
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', { action: 'update_themes', ...payload });
            return setWorkspace(response.workspace || {});
        };

        const resetTokens = () => {
            updateEditingLayer({ variables: {} });
            renderWorkspace();
            setStatus('Token overrides reset. Save the customization layer to apply this change.');
            return workspace;
        };

        const bindEvents = () => {
            if (!$ || !documentRef) {
                return;
            }
            $(documentRef).off('input.fvthemeworkspace', '[data-fv-theme-token]').on('input.fvthemeworkspace', '[data-fv-theme-token]', (event) => {
                const token = String(event?.target?.getAttribute('data-fv-theme-token') || '').trim();
                const value = String(event?.target?.value || '').trim();
                if (!token || !value) {
                    return;
                }
                updateEditingLayer({ variables: { ...(workspace.variables || {}), [token]: value } });
                renderVariableGrid();
                applyPreviewCss();
                renderSummary();
            });
            $(documentRef).off('click.fvthemetokenreset', '[data-fv-theme-token-reset]').on('click.fvthemetokenreset', '[data-fv-theme-token-reset]', (event) => {
                const token = String(event?.currentTarget?.getAttribute('data-fv-theme-token-reset') || '').trim();
                if (!token) {
                    return;
                }
                const nextVariables = { ...(workspace.variables || {}) };
                delete nextVariables[token];
                updateEditingLayer({ variables: nextVariables });
                renderWorkspace();
                setStatus('Token override reset. Save the customization layer to apply this change.');
            });
            $(documentRef).off('input.fvthemecustomcss', '#fv-theme-custom-css').on('input.fvthemecustomcss', '#fv-theme-custom-css', () => {
                updateEditingLayer({ customCss: String(documentRef.getElementById('fv-theme-custom-css')?.value || '') });
                renderSummary();
            });
            $(documentRef).off('change.fvthemeprofile', '#fv-theme-profile-select').on('change.fvthemeprofile', '#fv-theme-profile-select', (event) => {
                safeAction('Profile activation', () => activateProfile(String(event?.target?.value || '')), 'Appearance profile activated.').catch(() => {});
            });
            $(documentRef).off('change.fvthemescope', '#fv-theme-profile-scope').on('change.fvthemescope', '#fv-theme-profile-scope', (event) => {
                const scope = String(event?.target?.value || 'global');
                activeScope = themeProfiles.SCOPES.includes(scope) ? scope : 'global';
                renderWorkspace();
            });
            $(documentRef).off('click.fvthemeprofilecreate', '#fv-theme-profile-create').on('click.fvthemeprofilecreate', '#fv-theme-profile-create', () => {
                const input = documentRef.getElementById('fv-theme-profile-name');
                const name = String(input?.value || '').trim();
                safeAction('Profile creation', () => createProfile(name), 'Appearance profile created.').then(() => { if (input) input.value = ''; }).catch(() => {});
            });
            $(documentRef).off('click.fvthemeprofiledelete', '#fv-theme-profile-delete').on('click.fvthemeprofiledelete', '#fv-theme-profile-delete', () => {
                safeAction('Profile deletion', () => deleteProfile(workspace.activeProfileId), 'Appearance profile deleted.').catch(() => {});
            });
            $(documentRef).off('click.fvthemeupdateavailable', '#fv-theme-update-available').on('click.fvthemeupdateavailable', '#fv-theme-update-available', () => {
                safeAction('Managed theme batch update', updateAvailableThemes, 'Available managed themes updated.').catch(() => {});
            });
        };

        const safeAction = async (title, action, successMessage) => {
            try {
                setStatus(`${title}...`);
                const result = await action();
                if (successMessage) {
                    setStatus(successMessage);
                }
                return result;
            } catch (error) {
                setStatus(`${title} failed.`);
                showError(`${title} failed`, error);
                throw error;
            }
        };

        return Object.freeze({
            TOKEN_DEFINITIONS,
            getWorkspace: () => workspace,
            renderWorkspace,
            setWorkspace,
            bindEvents,
            readWorkspace: () => safeAction('Theme workspace load', readWorkspace, ''),
            scanGithub: (source) => safeAction('Theme scan', () => scanGithub(source), ''),
            importGithub: (source) => safeAction('Theme import', () => importGithub(source), 'Theme imported.'),
            activateTheme: (themeId) => safeAction('Theme activation', () => activateTheme(themeId), 'Managed theme activated.'),
            deactivateTheme: () => safeAction('Theme deactivation', deactivateTheme, 'Managed theme disabled.'),
            deleteTheme: (themeId) => safeAction('Theme deletion', () => deleteTheme(themeId), 'Managed theme deleted.'),
            updateTheme: (themeId) => safeAction('Theme update', () => updateTheme(themeId), 'Managed theme updated.'),
            saveCustomize: () => safeAction('Theme customization save', saveCustomize, 'Customization layer saved.'),
            checkUpdates: () => safeAction('Theme update check', checkUpdates, 'Theme update check complete.'),
            resetTokens,
            getPendingScan: () => pendingScan
        });
    };

    return Object.freeze({
        createApi,
        TOKEN_DEFINITIONS
    });
}));
