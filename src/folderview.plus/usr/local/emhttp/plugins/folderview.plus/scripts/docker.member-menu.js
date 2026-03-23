(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewDockerPreviewMemberMenu = factory();
    root.FolderViewDockerPreviewMemberMenuModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createController = (deps = {}) => {
        const jq = deps.$;
        const win = deps.window || fallbackWindow;
        const eventUrl = String(deps.eventURL || win.eventURL || '').trim();
        const loadlistFn = typeof deps.loadlist === 'function' ? deps.loadlist : (() => win.loadlist?.());
        const openTerminalFn = typeof deps.openTerminal === 'function' ? deps.openTerminal : win.openTerminal;
        const updateContainerFn = typeof deps.updateContainer === 'function' ? deps.updateContainer : win.updateContainer;
        let menuRegistry = new Map();
        let bound = false;

        const clearMenuRegistry = () => {
            menuRegistry = new Map();
            jq?.(document).off('click.fvDockerMemberMenuAction');
        };

        const resolvePreviewMemberEntry = (triggerEl) => {
            const $trigger = jq(triggerEl || []);
            if (!$trigger.length) {
                return null;
            }
            const folderId = String($trigger.attr('data-folder-id') || '').trim();
            const containerName = String($trigger.attr('data-container-name') || '').trim();
            if (!folderId || !containerName) {
                return null;
            }
            const folderMap = typeof deps.getGlobalFolders === 'function' ? deps.getGlobalFolders() : deps.globalFolders;
            const folder = folderMap?.[folderId];
            if (!folder || typeof folder !== 'object') {
                return null;
            }
            const sourceMeta = folder?.containers?.[containerName] || folder?.runtimeContainers?.[containerName] || null;
            const entry = deps.buildRuntimeContainerEntry?.(containerName, sourceMeta);
            return entry && entry.name ? { ...entry, folderId } : null;
        };

        const runContainerMenuAction = async (entry, action) => {
            if (!entry?.id || !action) {
                return;
            }
            jq?.('div.spinner.fixed').show('slow');
            try {
                const response = await jq.post(eventUrl, { action, container: entry.id }, null, 'json').promise();
                if (response?.success !== true) {
                    throw new Error(String(response?.text || `Failed to ${action} container.`));
                }
                loadlistFn?.();
            } catch (error) {
                deps.swal?.({
                    title: jq.i18n('exec-error'),
                    text: deps.escapeHtml(String(error?.message || `Failed to ${action} container.`)),
                    type: 'error',
                    html: true,
                    confirmButtonText: 'Ok'
                });
            } finally {
                jq?.('div.spinner.fixed').hide('slow');
            }
        };

        const buildMenuActions = (entry) => {
            const actions = [];
            if (!entry) {
                return actions;
            }
            if (!entry.state) {
                actions.push({ key: 'start', icon: 'fa-play', label: jq.i18n('start'), run: () => runContainerMenuAction(entry, 'start') });
            } else if (entry.pause) {
                actions.push({ key: 'resume', icon: 'fa-play-circle', label: jq.i18n('resume'), run: () => runContainerMenuAction(entry, 'resume') });
            } else {
                actions.push({ key: 'stop', icon: 'fa-stop', label: jq.i18n('stop'), run: () => runContainerMenuAction(entry, 'stop') });
                actions.push({ key: 'pause', icon: 'fa-pause', label: jq.i18n('pause'), run: () => runContainerMenuAction(entry, 'pause') });
            }
            if (entry.state) {
                actions.push({ key: 'restart', icon: 'fa-refresh', label: jq.i18n('restart'), run: () => runContainerMenuAction(entry, 'restart') });
            }
            if (entry.webui) {
                actions.push({
                    key: 'webui',
                    icon: 'fa-globe',
                    label: jq.i18n('webui'),
                    run: () => {
                        const popup = win.open(entry.webui, '_blank', 'noopener,noreferrer');
                        if (popup) {
                            popup.opener = null;
                        }
                    }
                });
            }
            actions.push({ key: 'console', icon: 'fa-terminal', label: jq.i18n('console'), run: () => openTerminalFn?.('docker', entry.name, entry.shell || '/bin/sh') });
            actions.push({ key: 'logs', icon: 'fa-bars', label: jq.i18n('logs'), run: () => openTerminalFn?.('docker', entry.name, '.log') });
            if (entry.managed) {
                actions.push({
                    key: 'update',
                    icon: 'fa-cloud-download',
                    label: entry.update ? jq.i18n('apply-update') : jq.i18n('force-update'),
                    run: () => updateContainerFn?.(entry.name)
                });
            }
            return actions;
        };

        const showMenu = (entry) => {
            if (!entry?.name) {
                return;
            }
            const actions = buildMenuActions(entry);
            if (!actions.length) {
                return;
            }
            clearMenuRegistry();
            menuRegistry = new Map(actions.map((action) => [action.key, action.run]));
            const statusMeta = deps.getPreviewContainerStatusMeta(entry);
            const statusLabel = deps.escapeHtml(jq.i18n(statusMeta.key));
            const safeName = deps.escapeHtml(entry.name);
            const safeIcon = deps.sanitizeImageSrc(entry.icon || '/plugins/dynamix.docker.manager/images/question.png');
            const actionsHtml = actions.map((action) => `
                <button type="button" class="fv-docker-member-menu-action" data-action-key="${deps.escapeHtml(action.key)}">
                    <i class="fa ${deps.escapeHtml(action.icon)}" aria-hidden="true"></i>
                    <span>${deps.escapeHtml(action.label)}</span>
                </button>
            `).join('');
            deps.swal?.({
                title: '',
                text: `
                    <div class="fv-docker-member-menu-sheet">
                        <div class="fv-docker-member-menu-header">
                            <img src="${safeIcon}" class="fv-docker-member-menu-icon" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png'">
                            <div class="fv-docker-member-menu-meta">
                                <div class="fv-docker-member-menu-name">${safeName}</div>
                                <div class="fv-docker-member-menu-status ${deps.escapeHtml(statusMeta.className)}"><i class="fa ${deps.escapeHtml(statusMeta.icon)}" aria-hidden="true"></i> ${statusLabel}</div>
                            </div>
                        </div>
                        <div class="fv-docker-member-menu-actions">${actionsHtml}</div>
                    </div>
                `,
                html: true,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: 'Close',
                customClass: 'fv-docker-member-menu-swal'
            }, () => {
                clearMenuRegistry();
            });
            win.setTimeout(() => {
                jq(document)
                    .off('click.fvDockerMemberMenuAction')
                    .on('click.fvDockerMemberMenuAction', '.fv-docker-member-menu-action', async function onDockerMemberMenuAction(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const key = String(jq(this).attr('data-action-key') || '').trim();
                        const handler = menuRegistry.get(key);
                        if (typeof handler !== 'function') {
                            return;
                        }
                        clearMenuRegistry();
                        deps.swal?.close();
                        await handler();
                    });
            }, 0);
        };

        const bindMenu = () => {
            if (bound) {
                return;
            }
            bound = true;
            jq(document)
                .off('click.fvDockerMemberMenuTrigger')
                .on('click.fvDockerMemberMenuTrigger', '.fv-docker-member-menu-trigger', function onDockerMemberMenuTrigger(event) {
                    if (jq(event.target).closest('.folder-element-custom-btn').length) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    const entry = resolvePreviewMemberEntry(this);
                    if (!entry) {
                        return;
                    }
                    showMenu(entry);
                })
                .off('click.fvDockerMemberQuickAction')
                .on('click.fvDockerMemberQuickAction', '.folder-element-custom-btn a', (event) => {
                    event.stopPropagation();
                });
        };

        return Object.freeze({
            resolvePreviewMemberEntry,
            clearMenuRegistry,
            buildMenuActions,
            showMenu,
            bindMenu
        });
    };

    return Object.freeze({
        createController
    });
}));
