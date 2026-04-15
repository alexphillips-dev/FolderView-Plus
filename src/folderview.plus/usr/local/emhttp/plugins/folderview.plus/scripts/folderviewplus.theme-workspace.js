(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusThemeWorkspace = factory();
    root.FolderViewPlusThemeWorkspaceModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
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
        const variables = source.variables && typeof source.variables === 'object' ? { ...source.variables } : {};
        return {
            schemaVersion: Number(source.schemaVersion || 1),
            activeThemeId: String(source.activeThemeId || '').trim(),
            themes,
            variables,
            customCss: String(source.customCss || ''),
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
        let previewStyleNode = null;

        const setStatus = (message) => {
            if (!documentRef) {
                return;
            }
            const node = documentRef.getElementById('fv-theme-workspace-status');
            if (node) {
                node.textContent = String(message || '').trim() || 'Theme workspace idle.';
            }
        };

        const ensurePreviewStyleNode = () => {
            if (!documentRef) {
                return null;
            }
            if (previewStyleNode && previewStyleNode.id === 'fv-theme-workspace-preview-style') {
                return previewStyleNode;
            }
            previewStyleNode = documentRef.getElementById('fv-theme-workspace-preview-style');
            if (previewStyleNode) {
                return previewStyleNode;
            }
            previewStyleNode = documentRef.createElement('style');
            previewStyleNode.id = 'fv-theme-workspace-preview-style';
            documentRef.head.appendChild(previewStyleNode);
            return previewStyleNode;
        };

        const buildPreviewCss = () => {
            const variableLines = Object.entries(workspace.variables || {})
                .filter(([token, value]) => String(token || '').trim() && String(value || '').trim())
                .map(([token, value]) => `  ${token}: ${String(value).trim()};`);
            const parts = [];
            if (variableLines.length > 0) {
                parts.push(`#fv-settings-root {\n${variableLines.join('\n')}\n}`);
            }
            const customCss = String(workspace.customCss || '').trim();
            if (customCss) {
                parts.push(customCss);
            }
            return parts.join('\n\n');
        };

        const applyPreviewCss = () => {
            const node = ensurePreviewStyleNode();
            if (!node) {
                return;
            }
            node.textContent = buildPreviewCss();
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
                const value = String(workspace.variables?.[definition.token] || definition.fallback || '').trim();
                return `
                    <label class="fv-theme-variable-row">
                        <span class="fv-theme-variable-copy">
                            <span>${escapeHtml(definition.label)}</span>
                            <code>${escapeHtml(definition.token)}</code>
                        </span>
                        <input type="color" data-fv-theme-token="${escapeHtml(definition.token)}" value="${escapeHtml(value)}">
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
                        <span>Import a GitHub CSS theme and it will be written into the existing custom asset pipeline.</span>
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
                            <button type="button" onclick="activateThemeWorkspaceTheme('${escapeHtml(theme.id)}')"><i class="fa fa-paint-brush"></i> Activate</button>
                            <button type="button" onclick="deleteThemeWorkspaceTheme('${escapeHtml(theme.id)}')"><i class="fa fa-trash"></i> Delete</button>
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
                    input.value = String(workspace.variables?.[definition.token] || definition.fallback || '');
                }
            });
        };

        const renderWorkspace = () => {
            renderThemeList();
            renderVariableGrid();
            syncCustomizeFields();
            applyPreviewCss();
            const activeTheme = workspace.themes.find((theme) => theme.id === workspace.activeThemeId);
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
            return setWorkspace(response.workspace || {});
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
            const output = {};
            if (!documentRef) {
                return output;
            }
            TOKEN_DEFINITIONS.forEach((definition) => {
                const input = documentRef.querySelector(`[data-fv-theme-token="${definition.token}"]`);
                const value = String(input?.value || '').trim();
                if (value) {
                    output[definition.token] = value;
                }
            });
            return output;
        };

        const saveCustomize = async () => {
            const customCss = String(documentRef?.getElementById('fv-theme-custom-css')?.value || '');
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'save_customize',
                variables: JSON.stringify(collectVariablesFromUi()),
                customCss
            });
            return setWorkspace(response.workspace || {});
        };

        const checkUpdates = async () => {
            const response = await apiPostJson('/plugins/folderview.plus/server/theme_workspace.php', {
                action: 'check_updates'
            });
            setWorkspace(response.workspace || {});
            return response;
        };

        const bindEvents = () => {
            if (!$ || !documentRef) {
                return;
            }
            $(documentRef).off('input.fvthemeworkspace', '[data-fv-theme-token]').on('input.fvthemeworkspace', '[data-fv-theme-token]', () => {
                workspace = {
                    ...workspace,
                    variables: collectVariablesFromUi()
                };
                applyPreviewCss();
            });
            $(documentRef).off('input.fvthemecustomcss', '#fv-theme-custom-css').on('input.fvthemecustomcss', '#fv-theme-custom-css', () => {
                workspace = {
                    ...workspace,
                    customCss: String(documentRef.getElementById('fv-theme-custom-css')?.value || '')
                };
                applyPreviewCss();
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
            importGithub: (source) => safeAction('Theme import', () => importGithub(source), 'Theme imported.'),
            activateTheme: (themeId) => safeAction('Theme activation', () => activateTheme(themeId), 'Managed theme activated.'),
            deactivateTheme: () => safeAction('Theme deactivation', deactivateTheme, 'Managed theme disabled.'),
            deleteTheme: (themeId) => safeAction('Theme deletion', () => deleteTheme(themeId), 'Managed theme deleted.'),
            saveCustomize: () => safeAction('Theme customization save', saveCustomize, 'Customization layer saved.'),
            checkUpdates: () => safeAction('Theme update check', checkUpdates, 'Theme update check complete.')
        });
    };

    return Object.freeze({
        createApi,
        TOKEN_DEFINITIONS
    });
}));
