// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorTypeDocker = factory();
    root.FolderViewPlusFolderEditorTypeDockerModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SYNC_ORDER_PATH = '/plugins/folderview.plus/server/sync_order.php';
    const EMPTY_SECTION_ROWS = Object.freeze({});

    const createApi = (deps = {}) => {
        const normalizeFolderRecordForEditor = typeof deps.normalizeFolderRecordForEditor === 'function'
            ? deps.normalizeFolderRecordForEditor
            : ((folder) => (folder && typeof folder === 'object' ? folder : {}));
        const queueBackgroundMutationPost = typeof deps.queueBackgroundMutationPost === 'function'
            ? deps.queueBackgroundMutationPost
            : (() => false);
        const securePost = typeof deps.securePost === 'function'
            ? deps.securePost
            : (async () => {});
        const syncType = String(deps.syncType || 'docker').trim() || 'docker';
        const getFolderLabelValue = typeof deps.getFolderLabelValue === 'function'
            ? deps.getFolderLabelValue
            : (() => '');
        const getComposeProjectFromLabels = typeof deps.getComposeProjectFromLabels === 'function'
            ? deps.getComposeProjectFromLabels
            : (() => '');
        const isDockerUpdateAvailableInEditor = typeof deps.isDockerUpdateAvailableInEditor === 'function'
            ? deps.isDockerUpdateAvailableInEditor
            : ((member) => member?.UpdateAvailable === true || member?.update === true);
        const DOCKER_RULES_CONFIG = Object.freeze({
            regexKinds: Object.freeze(['name_regex', 'image_regex', 'compose_project_regex']),
            subjectLabel: 'container',
            nameRegexExample: '^media-',
            patternPlaceholders: Object.freeze({
                image_regex: 'Regex pattern (example: linuxserver/)',
                compose_project_regex: 'Regex pattern (example: ^media$)'
            })
        });

        const buildComparableFolder = (folderRecord) => {
            const normalized = normalizeFolderRecordForEditor(folderRecord || {});
            const containers = Array.from(new Set(
                (Array.isArray(normalized.containers) ? normalized.containers : [])
                    .map((entry) => String(entry || '').trim())
                    .filter(Boolean)
            )).sort();
            return {
                name: String(normalized.name || '').trim(),
                regex: String(normalized.regex || ''),
                containers
            };
        };

        const shouldSyncAfterSave = (nextFolder, options = {}) => {
            if (options.force === true) {
                return true;
            }
            const currentFolderId = String(options.folderId || '').trim();
            if (!currentFolderId) {
                return true;
            }
            const previousFolderRecord = options.previousFolder && typeof options.previousFolder === 'object'
                ? options.previousFolder
                : null;
            if (!previousFolderRecord) {
                return true;
            }
            const previousComparable = buildComparableFolder(previousFolderRecord);
            const nextComparable = buildComparableFolder(nextFolder || {});
            return previousComparable.name !== nextComparable.name
                || previousComparable.regex !== nextComparable.regex
                || JSON.stringify(previousComparable.containers) !== JSON.stringify(nextComparable.containers);
        };

        const flushPostSaveSync = async (options = {}) => {
            if (!shouldSyncAfterSave(options.folder, options)) {
                return;
            }
            const scheduled = queueBackgroundMutationPost(SYNC_ORDER_PATH, { type: syncType });
            if (scheduled) {
                return;
            }
            await securePost(SYNC_ORDER_PATH, { type: syncType });
        };

        const mapRuntimeMember = (entry = {}) => {
            const labels = entry?.info?.Config?.Labels || entry?.Labels || {};
            const sourceState = entry?.info?.State || entry?.State || {};
            const stateKind = String(entry?.state || sourceState?.Status || entry?.status || '').trim().toLowerCase();
            const hasExplicitPaused = typeof sourceState?.Paused === 'boolean' || typeof entry?.paused === 'boolean';
            const hasExplicitRunning = typeof sourceState?.Running === 'boolean' || typeof entry?.running === 'boolean';
            const paused = hasExplicitPaused
                ? (sourceState?.Paused === true || entry?.paused === true)
                : (stateKind === 'paused' || stateKind === 'pause');
            const running = hasExplicitRunning
                ? (sourceState?.Running === true || entry?.running === true || paused)
                : (stateKind === 'running' || stateKind === 'started' || stateKind === 'start' || paused);
            const status = paused
                ? 'paused'
                : (running ? 'running' : 'stopped');
            const state = {
                ...sourceState,
                Running: running,
                Paused: paused,
                Status: status,
                Autostart: typeof sourceState?.Autostart === 'boolean' ? sourceState.Autostart : entry?.autostart === true,
                manager: sourceState?.manager || entry?.manager,
                Updated: typeof sourceState?.Updated === 'boolean' ? sourceState.Updated : entry?.Updated
            };
            const memberName = String(entry?.info?.Name || entry?.Name || entry?.name || '').trim();
            if (!memberName) {
                return null;
            }
            const manager = state?.manager || entry?.manager || '';
            const updated = state?.Updated ?? entry?.Updated;
            return {
                Name: memberName,
                Icon: labels['net.unraid.docker.icon'],
                Label: getFolderLabelValue(labels),
                ComposeProject: getComposeProjectFromLabels(labels),
                State: state,
                RawState: state,
                UpdateAvailable: manager === 'dockerman' && updated === false,
                Identity: {
                    kind: 'docker',
                    containerId: String(entry?.shortId || entry?.id || entry?.Id || '').replace(/^sha256:/i, '').slice(0, 64),
                    image: String(entry?.info?.Config?.Image || entry?.Image || '').trim(),
                    imageId: String(entry?.shortImageId || entry?.ImageID || '').replace(/^sha256:/i, '').slice(0, 64),
                    composeProject: String(entry?.composeProject || labels['com.docker.compose.project'] || '').trim(),
                    template: String(labels['net.unraid.docker.template'] || labels['net.unraid.docker.xml'] || '').trim(),
                    mountDestinations: (Array.isArray(entry?.Mounts) ? entry.Mounts : [])
                        .map((mount) => String(mount?.Destination || mount?.destination || '').trim())
                        .filter(Boolean)
                        .sort()
                }
            };
        };

        const collectSectionRows = ({ form, findBasicByFieldName } = {}) => {
            if (!form || typeof findBasicByFieldName !== 'function') {
                return EMPTY_SECTION_ROWS;
            }
            return {
                preview: [
                    findBasicByFieldName(form, 'preview_update'),
                    findBasicByFieldName(form, 'preview_status'),
                    findBasicByFieldName(form, 'preview_hide_nested_items'),
                    findBasicByFieldName(form, 'preview_child_folder_depth'),
                    findBasicByFieldName(form, 'preview_webui'),
                    findBasicByFieldName(form, 'preview_console'),
                    findBasicByFieldName(form, 'context'),
                    findBasicByFieldName(form, 'context_trigger'),
                    findBasicByFieldName(form, 'context_graph'),
                    findBasicByFieldName(form, 'context_graph_time')
                ],
                status: [
                    findBasicByFieldName(form, 'health_warn_stopped_percent'),
                    findBasicByFieldName(form, 'health_critical_stopped_percent'),
                    findBasicByFieldName(form, 'health_profile'),
                    findBasicByFieldName(form, 'health_updates_mode'),
                    findBasicByFieldName(form, 'health_all_stopped_mode')
                ],
                advanced: [
                    findBasicByFieldName(form, 'update_column')
                ]
            };
        };

        const applySectionTags = ({ markSection, markAdvanced } = {}) => {
            if (typeof markSection !== 'function' || typeof markAdvanced !== 'function') {
                return;
            }
            markSection('div.basic:has([name="preview_update"])', 'preview');
            markSection('div.basic:has([name="preview_status"])', 'preview');
            markSection('div.basic:has([name="preview_hide_nested_items"])', 'preview');
            markSection('div.basic:has([name="preview_child_folder_depth"])', 'preview');
            markSection('div.basic:has([name="preview_webui"])', 'preview');
            markSection('div.basic:has([name="preview_console"])', 'preview');
            markSection('div.basic:has([name="context"])', 'preview');
            markSection('ul[constraint*="context-2"]', 'preview');
            markSection('div.basic:has([name="context_trigger"])', 'preview');
            markSection('div.basic:has([name="context_graph"])', 'preview');
            markSection('div.basic:has([name="context_graph_time"])', 'preview');
            markSection('div.basic:has([name="health_warn_stopped_percent"])', 'status');
            markSection('div.basic:has([name="health_critical_stopped_percent"])', 'status');
            markSection('div.basic:has([name="health_profile"])', 'status');
            markSection('div.basic:has([name="health_updates_mode"])', 'status');
            markSection('div.basic:has([name="health_all_stopped_mode"])', 'status');
            markSection('div.basic:has([name="update_column"])', 'advanced');

            markAdvanced('div.basic:has([name="preview_update"])');
            markAdvanced('div.basic:has([name="health_warn_stopped_percent"])');
            markAdvanced('div.basic:has([name="health_critical_stopped_percent"])');
            markAdvanced('div.basic:has([name="health_profile"])');
            markAdvanced('div.basic:has([name="health_updates_mode"])');
            markAdvanced('div.basic:has([name="health_all_stopped_mode"])');
            markAdvanced('div.basic:has([name="update_column"])');
        };

        const getPreviewSignals = ({ selectedMembers = [] } = {}) => {
            const members = Array.isArray(selectedMembers) ? selectedMembers : [];
            const composeProjects = Array.from(new Set(
                members
                    .map((member) => String(member?.ComposeProject || '').trim())
                    .filter(Boolean)
            ));
            const updateCount = members.filter((member) => isDockerUpdateAvailableInEditor(member)).length;
            return {
                title: 'Docker signals',
                items: [
                    composeProjects.length === 0
                        ? 'Compose: none detected'
                        : (composeProjects.length === 1 ? `Compose: ${composeProjects[0]}` : `Compose: ${composeProjects.length} projects`),
                    `Updates: ${updateCount}/${members.length || 0}`
                ]
            };
        };

        const getRulesConfig = () => DOCKER_RULES_CONFIG;

        const buildSmartDefaultSuggestions = ({ selectedMembers = [], form } = {}) => {
            const members = Array.isArray(selectedMembers) ? selectedMembers : [];
            const suggestions = [];
            const composeProjects = Array.from(new Set(
                members
                    .map((member) => String(member?.ComposeProject || '').trim())
                    .filter((value) => value !== '')
            ));
            if (composeProjects.length === 1) {
                suggestions.push({
                    key: 'compose',
                    label: 'Compose project',
                    value: composeProjects[0],
                    apply: () => {}
                });
            }
            const updateCount = members.filter((member) => isDockerUpdateAvailableInEditor(member)).length;
            suggestions.push({
                key: 'updates',
                label: 'Update-aware preview',
                value: `${updateCount}/${members.length} with updates`,
                apply: () => {
                    if (form?.preview_update) {
                        form.preview_update.checked = updateCount > 0;
                    }
                }
            });
            return suggestions;
        };

        const applyPreviewConstraints = () => {};

        return Object.freeze({
            buildComparableFolder,
            shouldSyncAfterSave,
            flushPostSaveSync,
            mapRuntimeMember,
            collectSectionRows,
            applySectionTags,
            getPreviewSignals,
            getRulesConfig,
            buildSmartDefaultSuggestions,
            applyPreviewConstraints
        });
    };

    return Object.freeze({
        createApi
    });
}));
