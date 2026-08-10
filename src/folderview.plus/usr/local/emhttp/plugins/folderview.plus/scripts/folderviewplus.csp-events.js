(() => {
    const win = typeof window !== 'undefined' ? window : globalThis;
    const doc = win?.document;
    const allowedHandlers = new Set((
        'activateThemeWorkspaceTheme addAutoRule addDockerFolderContext addDockerStartOrderBatch addDockerStartOrderItem ' +
        'addVMFolderContext applyFolderRuntimeAction applyFolderSettingsToFolders applyRuleSimulatorAssignments ' +
        'applyRuleTestSample applySavedFolderDefaultsToAll applySettingsTablePreset applyTemplateToFolder applyTreeMoveRedo ' +
        'applyTreeMoveUndo assignSelectedItems bulkItemSelectionAction bulkRuleAction cancelBtn changeActiveBackupSchedulePref ' +
        'changeBadgePref changeColumnVisibility changeDashboardPref changeHealthPref changeRuntimePref ' +
        'changeSettingsTableColumnWidthPreset changeSortMode changeStatusPref changeVisibilityPref checkThemeWorkspaceUpdates ' +
        'clearActivityFeed clearDocker clearFolderDefaults clearFolderTableFilters clearVm collapseAllFolderTrees ' +
        'compareActiveRecoverySnapshots createActiveRecoveryBackup createFolderBtn createTemplateFromFolder customAction ' +
        'deactivateThemeWorkspaceTheme deleteAllActiveRecoveryBackups deleteAutoRule deleteBackupEntry ' +
        'deleteSelectedActiveRecoveryBackup deleteTemplateEntry deleteThemeWorkspaceTheme downloadBackupEntry downloadDocker ' +
        'downloadSelectedActiveRecoveryBackup downloadVm dropDownButton editFolder expandAllFolderTrees exportEnvironmentSnapshot ' +
        'exportTemplateEntry filterBulkItems forceUpdateFolder handleFolderRowKeydown hideAllTips importDocker ' +
        'importEnvironmentSnapshot importThemeWorkspaceGithub importVm moveAutoRule moveDockerStartOrderBatch ' +
        'moveDockerStartOrderItem moveFolderRow moveFolderToRootQuick openFolderTreeMoveDialog openSettingsFolderEditor openTerminal ' +
        'previewFolderRuntimeAction quickCreateStarterFolder rCcustomAction refreshChangeHistory refreshDockerStartOrderPreview ' +
        'removeDockerStartOrderBatch removeDockerStartOrderItem resetDropdownColorDefaults resetFolderAccentDefaults ' +
        'resetPreviewBarDefaults resetPreviewBorderDefaults resetSettingsTableColumns resetStatusColorDefaults ' +
        'resetThemeWorkspaceTokens resetUnsavedChanges restoreBackupEntry restoreLatestActiveRecoveryBackup restoreLatestBackup ' +
        'restoreSelectedActiveRecoveryBackup retryFailedBulkItems runActiveRecoveryScheduler runConflictInspector runRuleSimulator ' +
        'runTreeIntegrityCheck saveCurrentFolderOrderAsManual saveFolderDefaultsFromSelection saveSelectedSmartRuleSuggestions ' +
        'saveThemeWorkspaceCustomize scanSmartRuleSuggestions scanThemeWorkspaceGithub selectActiveRecoveryBackup ' +
        'selectOperationsTemplate setFilterQuery setIconAsContainer setOperationsWorkspaceType setQuickFolderFilter ' +
        'setRecoveryWorkspaceType setRulesWorkspaceType showFolderHealthBreakdown submitForm syncDockerStartOrderNow testAutoRule ' +
        'toggleActivityCenterHistory toggleAllRuleSelections toggleAutoRule toggleBasicSettingsPanel toggleDockerUpdatesFilter ' +
        'toggleFolderPin toggleFolderTreeCollapse toggleHealthSeverityFilter toggleMobileTreeReorderMode toggleRuleKindFields ' +
        'toggleRuleSelection toggleStatusFilter undoActiveRecoveryChange updateBulkSelectedCount updateContainer ' +
        'updateDockerStartOrderBatch updateDockerStartOrderMode updateDockerStartOrderRemaining updateFolder updateForm updateIcon ' +
        'updateRegex updateThemeWorkspaceTheme'
    ).split(/\s+/).filter(Boolean));
    const supportedEvents = ['click', 'change', 'input', 'keydown', 'submit', 'error'];

    const splitTopLevel = (source, delimiter) => {
        const output = [];
        let quote = '';
        let escaped = false;
        let depth = 0;
        let start = 0;
        for (let index = 0; index < source.length; index += 1) {
            const char = source[index];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (quote) {
                if (char === '\\') {
                    escaped = true;
                } else if (char === quote) {
                    quote = '';
                }
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }
            if (char === '(' || char === '{' || char === '[') {
                depth += 1;
                continue;
            }
            if (char === ')' || char === '}' || char === ']') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (char === delimiter && depth === 0) {
                output.push(source.slice(start, index).trim());
                start = index + 1;
            }
        }
        output.push(source.slice(start).trim());
        return output.filter(Boolean);
    };

    const parseQuoted = (token) => {
        const quote = token[0];
        if ((quote !== '"' && quote !== "'") || token[token.length - 1] !== quote) {
            throw new Error('Unsupported quoted argument.');
        }
        let value = '';
        for (let index = 1; index < token.length - 1; index += 1) {
            const char = token[index];
            if (char !== '\\') {
                value += char;
                continue;
            }
            index += 1;
            const escaped = token[index] || '';
            const decoded = {
                n: '\n',
                r: '\r',
                t: '\t',
                '\\': '\\',
                "'": "'",
                '"': '"'
            }[escaped];
            value += decoded === undefined ? escaped : decoded;
        }
        return value;
    };

    const parseArgument = (token, element, event) => {
        const value = token.trim();
        if (value === 'this') return element;
        if (value === 'this.value') return element?.value;
        if (value === 'this.checked') return element?.checked === true;
        if (value === 'this.form') return element?.form || null;
        if (value === 'event') return event;
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
        if (/^\{\s*repair\s*:\s*true\s*\}$/.test(value)) return { repair: true };
        if (value.startsWith('"') || value.startsWith("'")) return parseQuoted(value);
        throw new Error('Unsupported declarative event argument.');
    };

    const invokeStatement = (statement, element, event) => {
        let source = statement.trim();
        let returns = false;
        if (source.startsWith('return ')) {
            returns = true;
            source = source.slice(7).trim();
        }
        if (source === 'false') {
            return { returned: true, value: false };
        }
        if (source === 'event.preventDefault()') {
            event.preventDefault();
            return { returned: false, value: undefined };
        }
        const locationMatch = source.match(/^window\.location\.href\s*=\s*(['"])(\/Plugins)\1$/);
        if (locationMatch) {
            win.location.assign(locationMatch[2]);
            return { returned: false, value: undefined };
        }
        const sourceMatch = source.match(/^this\.src\s*=\s*(['"])([\s\S]*)\1$/);
        if (sourceMatch) {
            const fallback = sourceMatch[2];
            if (!fallback.startsWith('/') || fallback.startsWith('//')) {
                throw new Error('Unsafe image fallback path.');
            }
            if (element?.dataset?.fvplusFallbackApplied === 'true' || element?.getAttribute?.('src') === fallback) {
                return { returned: false, value: undefined };
            }
            if (element?.dataset) {
                element.dataset.fvplusFallbackApplied = 'true';
            }
            element?.setAttribute?.('src', fallback);
            return { returned: false, value: undefined };
        }
        const callMatch = source.match(/^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/);
        if (!callMatch || !allowedHandlers.has(callMatch[1])) {
            throw new Error('Declarative event handler is not allowlisted.');
        }
        const handler = win[callMatch[1]];
        if (typeof handler !== 'function') {
            throw new Error('Declarative event handler is unavailable.');
        }
        const argsSource = callMatch[2].trim();
        const args = argsSource === ''
            ? []
            : splitTopLevel(argsSource, ',').map((token) => parseArgument(token, element, event));
        return {
            returned: returns,
            value: handler.apply(element, args)
        };
    };

    const execute = (source, element, event) => {
        let result;
        for (const statement of splitTopLevel(String(source || ''), ';')) {
            result = invokeStatement(statement, element, event);
            if (result.returned) {
                if (result.value === false) {
                    event.preventDefault();
                }
                return result.value;
            }
        }
        return result?.value;
    };

    const findHandlerElement = (event, attribute) => {
        const target = event?.target;
        if (!target || typeof target.getAttribute !== 'function') {
            return null;
        }
        if (target.hasAttribute(attribute)) {
            return target;
        }
        return typeof target.closest === 'function' ? target.closest(`[${attribute}]`) : null;
    };

    const install = () => {
        if (!doc || win.FolderViewPlusCspEventsInstalled === true) {
            return;
        }
        win.FolderViewPlusCspEventsInstalled = true;
        for (const eventName of supportedEvents) {
            const attribute = `data-fv-on${eventName}`;
            doc.addEventListener(eventName, (event) => {
                const element = findHandlerElement(event, attribute);
                if (!element) {
                    return;
                }
                const source = element.getAttribute(attribute);
                if (!source) {
                    return;
                }
                try {
                    execute(source, element, event);
                } catch (_error) {
                    win.console?.warn?.(`FolderView Plus blocked an invalid ${eventName} event binding.`);
                }
            }, eventName === 'error');
        }
    };

    const api = Object.freeze({
        allowedHandlers,
        execute,
        install,
        parseArgument,
        splitTopLevel,
        supportedEvents: Object.freeze([...supportedEvents])
    });
    win.FolderViewPlusCspEvents = api;
    install();
})();
