// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorIcons = factory();
    root.FolderViewPlusFolderEditorIconsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const fallbackAsArray = (value) => (Array.isArray(value) ? value : []);
    const fallbackEscapeHtml = (value) => String(value ?? '');
    const fallbackPaginateItems = (items, page, pageSize) => {
        const source = Array.isArray(items) ? items : [];
        const safePageSize = Math.max(1, Number(pageSize) || 1);
        const totalPages = Math.max(1, Math.ceil(source.length / safePageSize));
        const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
        const startIndex = (safePage - 1) * safePageSize;
        const endIndex = Math.min(source.length, startIndex + safePageSize);
        return {
            page: safePage,
            totalPages,
            startIndex,
            endIndex,
            items: source.slice(startIndex, endIndex)
        };
    };
    const fallbackFilterIconItems = (icons, query) => {
        const source = Array.isArray(icons) ? icons : [];
        const needle = String(query || '').trim().toLowerCase();
        if (!needle) {
            return [...source];
        }
        return source.filter((icon) => {
            const name = String(icon?.name || '').toLowerCase();
            if (name.includes(needle)) {
                return true;
            }
            const tags = Array.isArray(icon?.tags) ? icon.tags : [];
            return tags.some((tag) => String(tag || '').toLowerCase().includes(needle));
        });
    };

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || null;
        const $ = deps.$ || win?.jQuery || win?.$;
        const swal = typeof deps.swal === 'function'
            ? deps.swal
            : (typeof win?.swal === 'function' ? win.swal.bind(win) : (() => {}));
        const folderIconApi = deps.folderIconApi && typeof deps.folderIconApi === 'object' ? deps.folderIconApi : null;
        const asArray = typeof deps.asArray === 'function' ? deps.asArray : fallbackAsArray;
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : fallbackEscapeHtml;
        const parseJsonPayload = typeof deps.parseJsonPayload === 'function'
            ? deps.parseJsonPayload
            : ((value) => {
                try {
                    return typeof value === 'string' ? JSON.parse(value.replace(/^\uFEFF/, '')) : value;
                } catch (_error) {
                    return null;
                }
            });
        const paginateItems = typeof deps.paginateItems === 'function' ? deps.paginateItems : fallbackPaginateItems;
        const filterIconItems = typeof deps.filterIconItems === 'function' ? deps.filterIconItems : fallbackFilterIconItems;
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : (() => null);
        const getIconInput = typeof deps.getIconInput === 'function' ? deps.getIconInput : (() => ($ ? $() : null));
        const getCurrentIconValue = typeof deps.getCurrentIconValue === 'function' ? deps.getCurrentIconValue : (() => '');
        const setIconInputValue = typeof deps.setIconInputValue === 'function' ? deps.setIconInputValue : (() => {});

        const defaultFolderIconPath = String(deps.defaultFolderIconPath || '/plugins/folderview.plus/images/folder-icon.png');
        const builtInIconManifestPath = String(deps.builtInIconManifestPath || '/plugins/folderview.plus/images/icons/icons.json');
        const thirdPartyIconApiPath = String(deps.thirdPartyIconApiPath || '/plugins/folderview.plus/server/third_party_icons.php');
        const iconFallbackPath = String(deps.iconFallbackPath || '/plugins/dynamix.docker.manager/images/question.png');
        const iconPickerPageSize = Math.max(1, Number(deps.iconPickerPageSize || 120));
        const customIconPageSize = Math.max(1, Number(deps.customIconPageSize || 60));
        const iconPickerSearchDebounceMs = Math.max(0, Number(deps.iconPickerSearchDebounceMs || 120));
        const customIconSearchDebounceMs = Math.max(0, Number(deps.customIconSearchDebounceMs || 150));
        const thirdPartyIconSearchDebounceMs = Math.max(0, Number(deps.thirdPartyIconSearchDebounceMs || 140));
        const thirdPartyRecentLimit = Math.max(1, Number(deps.thirdPartyRecentLimit || 36));
        const thirdPartyLongPressPreviewMs = Math.max(1, Number(deps.thirdPartyLongPressPreviewMs || 460));
        const thirdPartyGridChunkSize = Math.max(1, Number(deps.thirdPartyGridChunkSize || 36));
        const thirdPartyMinTagCount = Math.max(1, Number(deps.thirdPartyMinTagCount || 2));
        const thirdPartyPlaceholderIcon = String(deps.thirdPartyPlaceholderIcon || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
        const thirdPartyFavoritesStorageKey = String(deps.thirdPartyFavoritesStorageKey || 'fv.folder.icon.thirdparty.favorites.v1');
        const thirdPartyRecentStorageKey = String(deps.thirdPartyRecentStorageKey || 'fv.folder.icon.thirdparty.recent.v1');
        const thirdPartyPinnedStorageKey = String(deps.thirdPartyPinnedStorageKey || 'fv.folder.icon.thirdparty.pinnedFolders.v1');
        const thirdPartyHiddenStorageKey = String(deps.thirdPartyHiddenStorageKey || 'fv.folder.icon.thirdparty.hiddenFolders.v1');
        const thirdPartyUsageStorageKey = String(deps.thirdPartyUsageStorageKey || 'fv.folder.icon.thirdparty.folderUsage.v1');
        const thirdPartyLastUsedStorageKey = String(deps.thirdPartyLastUsedStorageKey || 'fv.folder.icon.thirdparty.lastUsedByIcon.v1');
        const builtInIconFallback = asArray(deps.builtInIconFallback).length > 0
            ? asArray(deps.builtInIconFallback)
            : [{
                id: 'default-folder',
                name: 'Default Folder',
                path: defaultFolderIconPath,
                tags: ['default', 'folder']
            }];

        let builtInIcons = [...builtInIconFallback];
        let builtInIconManifestLoaded = false;
        let builtInIconSearchQuery = '';
        let builtInIconPage = 1;
        let builtInIconSearchTimer = null;
        let thirdPartyIconFolders = [];
        let thirdPartyIconIndex = [];
        let thirdPartySelectedFolder = '';
        let thirdPartyIcons = [];
        let thirdPartyIconPage = 1;
        let thirdPartyIconSearchQuery = '';
        let thirdPartyIconSearchTimer = null;
        let thirdPartySelectedTags = new Set();
        let thirdPartyTagSearchQuery = '';
        let thirdPartyQuickMode = 'folder';
        let thirdPartySortMode = 'usage';
        let thirdPartyPackSearchQuery = '';
        let thirdPartyPackKind = 'all';
        let thirdPartyFavorites = new Set();
        let thirdPartyRecent = [];
        let thirdPartyPinnedFolders = new Set();
        let thirdPartyHiddenFolders = new Set();
        let thirdPartyFolderUsage = {};
        let thirdPartyIconLastUsedByUrl = {};
        let thirdPartyBrokenIconUrls = new Set();
        let thirdPartyLongPressTimer = null;
        let thirdPartyPreferencesLoaded = false;
        let thirdPartyRenderedIconMap = new Map();
        let thirdPartyShowHiddenFolders = false;
        let thirdPartyGridRenderToken = 0;
        let thirdPartyPreviewIconUrl = '';
        let thirdPartyIndexCacheReady = false;
        let thirdPartyFilterSheetOpen = false;
        let thirdPartyAdvancedMode = false;
        let thirdPartyPackActionsOpen = false;
        let customIconEntries = [];
        let customIconStats = null;
        let customIconHealth = null;
        let customIconSearchQuery = '';
        let customIconPage = 1;
        let customIconSearchTimer = null;
        let customIconUploadRequest = null;

        const setIconUploadStatus = (message, isError = false) => {
            if (!$) {
                return;
            }
            const status = $('#fv-icon-upload-status');
            if (!status.length) {
                return;
            }
            const text = String(message || '').trim();
            status.removeClass('is-error is-success').text(text);
            if (!text) {
                return;
            }
            status.addClass(isError ? 'is-error' : 'is-success');
        };

        const formatByteCount = (bytes) => {
            if (folderIconApi && typeof folderIconApi.formatByteCount === 'function') {
                return folderIconApi.formatByteCount(bytes);
            }
            const safeBytes = Math.max(0, Number(bytes || 0));
            if (safeBytes >= 1024 * 1024) {
                return `${(safeBytes / (1024 * 1024)).toFixed(1)} MiB`;
            }
            if (safeBytes >= 1024) {
                return `${(safeBytes / 1024).toFixed(1)} KiB`;
            }
            return `${Math.round(safeBytes)} B`;
        };

        const setIconUploadProgressVisible = (visible) => {
            if (!$) {
                return;
            }
            const box = $('#fv-icon-upload-progress');
            if (!box.length) {
                return;
            }
            box.prop('hidden', !visible);
        };

        const updateIconUploadProgress = (loaded, total, text = '') => {
            if (!$) {
                return;
            }
            const safeTotal = Math.max(0, Number(total || 0));
            const safeLoaded = Math.max(0, Number(loaded || 0));
            const ratio = safeTotal > 0 ? Math.max(0, Math.min(1, safeLoaded / safeTotal)) : 0;
            const percent = Math.round(ratio * 100);
            const fill = $('#fv-icon-upload-progress-fill');
            const label = $('#fv-icon-upload-progress-text');
            if (fill.length) {
                fill.css('width', `${percent}%`);
            }
            if (label.length) {
                const fallback = safeTotal > 0
                    ? `Uploading ${formatByteCount(safeLoaded)} of ${formatByteCount(safeTotal)} (${percent}%)`
                    : 'Preparing upload...';
                label.text(String(text || fallback));
            }
        };

        const resetIconUploadProgress = () => {
            updateIconUploadProgress(0, 0, 'Preparing upload...');
            setIconUploadProgressVisible(false);
        };

        const validateCustomIconFileBeforeUpload = (file) => {
            if (!folderIconApi || typeof folderIconApi.validateCustomIconFileBeforeUpload !== 'function') {
                return;
            }
            folderIconApi.validateCustomIconFileBeforeUpload(file);
        };

        const uploadCustomIconFile = async (file, options = {}) => {
            if (!folderIconApi || typeof folderIconApi.uploadCustomIconFile !== 'function') {
                throw new Error('Custom icon upload API is unavailable.');
            }
            return folderIconApi.uploadCustomIconFile(file, {
                ...options,
                setActiveRequest: (request) => {
                    customIconUploadRequest = request;
                }
            });
        };

        const setBuiltInIconPickerOpen = (open) => {
            if (!$) {
                return;
            }
            const panel = $('#fv-icon-picker-panel');
            const toggle = $('#fv-icon-picker-toggle');
            if (!panel.length || !toggle.length) {
                return;
            }
            panel.prop('hidden', !open);
            toggle.attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-open', open);
        };

        const setThirdPartyIconPickerOpen = (open) => {
            if (!$) {
                return;
            }
            const panel = $('#fv-third-party-icon-panel');
            const toggle = $('#fv-icon-third-party-toggle');
            if (!panel.length || !toggle.length) {
                return;
            }
            panel.prop('hidden', !open);
            toggle.attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-open', open);
        };

        const setCustomIconPickerOpen = (open) => {
            if (!$) {
                return;
            }
            const panel = $('#fv-custom-icon-panel');
            const toggle = $('#fv-icon-custom-manager-toggle');
            if (!panel.length || !toggle.length) {
                return;
            }
            panel.prop('hidden', !open);
            toggle.attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-open', open);
        };

        const setCustomIconStatus = (message, isError = false) => {
            if (!$) {
                return;
            }
            const el = $('#fv-custom-icon-status');
            if (!el.length) {
                return;
            }
            const text = String(message || '').trim();
            el.removeClass('is-error is-success').text(text);
            if (!text) {
                return;
            }
            el.addClass(isError ? 'is-error' : 'is-success');
        };

        const formatDateTimeShort = (isoString) => {
            const value = String(isoString || '').trim();
            if (!value) {
                return '';
            }
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return '';
            }
            return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        };

        const requestCustomIconApi = async (action, payload = {}, method = 'GET') => {
            if (!folderIconApi || typeof folderIconApi.requestCustomIconApi !== 'function') {
                throw new Error('Custom icon manager API is unavailable.');
            }
            return folderIconApi.requestCustomIconApi(action, payload, method);
        };

        const parseJsonStorage = (key, fallback) => {
            try {
                const storage = win?.localStorage;
                if (!storage || typeof storage.getItem !== 'function') {
                    return fallback;
                }
                const raw = storage.getItem(key);
                if (!raw) {
                    return fallback;
                }
                const parsed = JSON.parse(raw);
                return parsed === undefined || parsed === null ? fallback : parsed;
            } catch (_error) {
                return fallback;
            }
        };

        const writeJsonStorage = (key, value) => {
            try {
                const storage = win?.localStorage;
                if (!storage || typeof storage.setItem !== 'function') {
                    return;
                }
                storage.setItem(key, JSON.stringify(value));
            } catch (_error) {
                // Ignore storage write failures.
            }
        };

        const renderCustomIconStats = () => {
            if (!$) {
                return;
            }
            const el = $('#fv-custom-icon-stats');
            if (!el.length) {
                return;
            }
            const stats = customIconStats && typeof customIconStats === 'object' ? customIconStats : null;
            const health = customIconHealth && typeof customIconHealth === 'object' ? customIconHealth : null;
            if (!stats) {
                el.text('No custom icon stats available.');
                return;
            }
            const count = Number(stats.count || 0);
            const maxFiles = Number(stats.maxFiles || 0);
            const totalBytes = Number(stats.totalBytes || 0);
            const maxBytes = Number(stats.maxTotalBytes || 0);
            const inUse = Number(stats.inUseIconCount || 0);
            const warnings = asArray(stats.warnings).map((entry) => String(entry || '').trim()).filter((entry) => entry !== '');
            const summary = `${count.toLocaleString()} / ${Math.max(0, maxFiles).toLocaleString()} files | ${formatByteCount(totalBytes)} / ${formatByteCount(maxBytes)} | in use ${inUse.toLocaleString()}`;
            const healthText = health ? (health.writable === true ? 'Writable' : 'Read-only') : 'Directory status unknown';
            const healthHint = (health && health.writable !== true && String(health.repairHint || '').trim() !== '')
                ? ` | fix: ${String(health.repairHint || '').trim()}`
                : '';
            if (!warnings.length) {
                el.text(`Quota: ${summary} | ${healthText}${healthHint}`);
                return;
            }
            el.text(`Quota: ${summary} | ${healthText}${healthHint} | ${warnings.join(' ')}`);
        };

        const refreshCustomIconManager = async () => {
            try {
                const payload = await requestCustomIconApi('list', { query: customIconSearchQuery, sort: 'newest' }, 'GET');
                customIconEntries = asArray(payload?.icons);
                const usageSummary = payload?.usage && typeof payload.usage === 'object' ? payload.usage : {};
                customIconStats = {
                    ...(payload?.stats && typeof payload.stats === 'object' ? payload.stats : {}),
                    inUseIconCount: Math.max(0, Number(usageSummary.inUseIconCount || 0)),
                    totalReferences: Math.max(0, Number(usageSummary.totalReferences || 0))
                };
                customIconHealth = payload?.health && typeof payload.health === 'object' ? payload.health : null;
                renderCustomIconStats();
                renderCustomIconList();
                setCustomIconStatus('');
            } catch (error) {
                customIconEntries = [];
                customIconStats = null;
                customIconHealth = null;
                renderCustomIconStats();
                renderCustomIconList();
                setCustomIconStatus(String(error?.message || 'Failed to load custom icons.'), true);
            }
        };

        const scheduleInitialCustomIconManagerRefresh = () => {
            const refresh = () => {
                void refreshCustomIconManager();
            };
            if (win && typeof win.requestIdleCallback === 'function') {
                win.requestIdleCallback(refresh, { timeout: 700 });
                return;
            }
            if (win && typeof win.setTimeout === 'function') {
                win.setTimeout(refresh, 160);
                return;
            }
            setTimeout(refresh, 160);
        };

        const renderCustomIconList = () => {
            if (!$) {
                return;
            }
            const list = $('#fv-custom-icon-list');
            const prevButton = $('#fv-custom-icon-prev');
            const nextButton = $('#fv-custom-icon-next');
            const pageLabel = $('#fv-custom-icon-page-label');
            if (!list.length) {
                return;
            }

            if (!customIconEntries.length) {
                list.html('<div class="fv-icon-picker-empty">No custom icons found. Upload an icon to get started.</div>');
                if (prevButton.length && nextButton.length && pageLabel.length) {
                    prevButton.prop('disabled', true);
                    nextButton.prop('disabled', true);
                    pageLabel.text('Page 1 / 1');
                }
                return;
            }

            const paged = paginateItems(customIconEntries, customIconPage, customIconPageSize);
            customIconPage = paged.page;
            if (prevButton.length && nextButton.length && pageLabel.length) {
                prevButton.prop('disabled', paged.page <= 1);
                nextButton.prop('disabled', paged.page >= paged.totalPages);
                pageLabel.text(`Page ${paged.page} / ${paged.totalPages}`);
                prevButton.off('click.fvcustompager').on('click.fvcustompager', (event) => {
                    event.preventDefault();
                    if (customIconPage <= 1) {
                        return;
                    }
                    customIconPage -= 1;
                    renderCustomIconList();
                });
                nextButton.off('click.fvcustompager').on('click.fvcustompager', (event) => {
                    event.preventDefault();
                    if (customIconPage >= paged.totalPages) {
                        return;
                    }
                    customIconPage += 1;
                    renderCustomIconList();
                });
            }

            const rows = paged.items.map((icon) => {
                const name = escapeHtml(String(icon?.name || ''));
                const url = escapeHtml(String(icon?.url || ''));
                const size = formatByteCount(Number(icon?.size || 0));
                const dims = `${Math.max(0, Number(icon?.width || 0))}x${Math.max(0, Number(icon?.height || 0))}`;
                const updated = formatDateTimeShort(icon?.updatedAt);
                const usageCount = Math.max(0, Number(icon?.usageCount || 0));
                const usageMeta = usageCount > 0 ? `${usageCount} refs` : 'unused';
                const meta = [size, dims, updated, usageMeta].filter((entry) => String(entry || '').trim() !== '').join(' | ');
                return `
                    <div class="fv-custom-icon-row" data-custom-icon="${name}">
                        <img src="${url}" alt="${name}" onerror="this.src='${iconFallbackPath}';">
                        <div class="fv-custom-icon-meta">
                            <div class="fv-custom-icon-name" title="${name}">${name}</div>
                            <div class="fv-custom-icon-extra">${escapeHtml(meta || 'No metadata')}</div>
                        </div>
                        <div class="fv-custom-icon-actions">
                            <button type="button" data-action="use" title="Use icon"><i class="fa fa-check" aria-hidden="true"></i></button>
                            <button type="button" data-action="refs" title="Show folder references"><i class="fa fa-sitemap" aria-hidden="true"></i></button>
                            <button type="button" data-action="rename" title="Rename icon"><i class="fa fa-pencil" aria-hidden="true"></i></button>
                            <button type="button" data-action="delete" title="Delete icon"><i class="fa fa-trash" aria-hidden="true"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            list.html(rows);
            list.find('button[data-action]').off('click.fvcustomicons').on('click.fvcustomicons', async (event) => {
                event.preventDefault();
                const button = $(event.currentTarget);
                const action = String(button.attr('data-action') || '').trim();
                const row = button.closest('.fv-custom-icon-row');
                const name = String(row.attr('data-custom-icon') || '').trim();
                const icon = customIconEntries.find((entry) => String(entry?.name || '').trim() === name);
                if (!icon) {
                    return;
                }

                if (action === 'use') {
                    setIconInputValue(String(icon.url || ''));
                    setCustomIconStatus(`Selected "${name}".`);
                    return;
                }

                if (action === 'refs') {
                    try {
                        let refs = asArray(icon?.usage);
                        if (!refs.length) {
                            const payload = await requestCustomIconApi('usage', { name }, 'GET');
                            refs = asArray(payload?.usage);
                        }
                        if (!refs.length) {
                            swal({ title: 'No references', text: `"${name}" is not used by any folder.`, type: 'info' });
                            return;
                        }
                        const rowsHtml = refs
                            .slice(0, 80)
                            .map((entry) => `<li>${escapeHtml(String(entry?.type || '').toUpperCase())} | ${escapeHtml(String(entry?.folderName || entry?.folderId || 'Unknown'))}</li>`)
                            .join('');
                        const html = `<div class="fv-custom-icon-ref-list"><ul>${rowsHtml}</ul></div>`;
                        swal({ title: `In use by ${refs.length} folder${refs.length === 1 ? '' : 's'}`, text: html, html: true, confirmButtonText: 'Close' });
                    } catch (error) {
                        setCustomIconStatus(String(error?.message || 'Failed to load references.'), true);
                    }
                    return;
                }

                if (action === 'rename') {
                    const proposal = win && typeof win.prompt === 'function' ? win.prompt('Rename custom icon', String(name || '')) : '';
                    const nextName = String(proposal || '').trim();
                    if (!nextName || nextName === name) {
                        return;
                    }
                    try {
                        await requestCustomIconApi('rename', { from: name, to: nextName }, 'POST');
                        await refreshCustomIconManager();
                        setCustomIconStatus(`Renamed "${name}" to "${nextName}".`);
                    } catch (error) {
                        setCustomIconStatus(String(error?.message || 'Rename failed.'), true);
                    }
                    return;
                }

                if (action === 'delete') {
                    const usageCount = Math.max(0, Number(icon?.usageCount || 0));
                    if (usageCount > 0) {
                        setCustomIconStatus(`"${name}" is in use by ${usageCount} folder${usageCount === 1 ? '' : 's'}. Remove references before deleting.`, true);
                        return;
                    }
                    swal({
                        title: 'Delete custom icon?',
                        text: `Remove "${name}" from custom icon storage?`,
                        type: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Delete',
                        cancelButtonText: 'Cancel'
                    }, async (confirmed) => {
                        if (!confirmed) {
                            return;
                        }
                        try {
                            await requestCustomIconApi('delete', { name }, 'POST');
                            await refreshCustomIconManager();
                            setCustomIconStatus(`Deleted "${name}".`);
                        } catch (error) {
                            setCustomIconStatus(String(error?.message || 'Delete failed.'), true);
                        }
                    });
                }
            });
        };

        const renderBuiltInIconPicker = () => {
            if (!$) {
                return;
            }
            const panel = $('#fv-icon-picker-panel');
            const grid = $('#fv-icon-picker-grid');
            const status = $('#fv-icon-picker-status');
            const prevButton = $('#fv-icon-picker-prev');
            const nextButton = $('#fv-icon-picker-next');
            const pageLabel = $('#fv-icon-picker-page-label');
            if (!panel.length || !grid.length || !status.length) {
                return;
            }

            const currentValue = getCurrentIconValue();
            const filtered = filterIconItems(
                builtInIcons.map((icon) => ({
                    ...icon,
                    tags: Array.isArray(icon?.tags) ? [...icon.tags, icon.id] : [icon.id]
                })),
                builtInIconSearchQuery
            );
            const paged = paginateItems(filtered, builtInIconPage, iconPickerPageSize);
            builtInIconPage = paged.page;

            if (prevButton.length && nextButton.length && pageLabel.length) {
                prevButton.prop('disabled', paged.page <= 1);
                nextButton.prop('disabled', paged.page >= paged.totalPages);
                pageLabel.text(`Page ${paged.page} / ${paged.totalPages}`);
                prevButton.off('click.fviconpager').on('click.fviconpager', (event) => {
                    event.preventDefault();
                    if (builtInIconPage <= 1) {
                        return;
                    }
                    builtInIconPage -= 1;
                    renderBuiltInIconPicker();
                });
                nextButton.off('click.fviconpager').on('click.fviconpager', (event) => {
                    event.preventDefault();
                    if (builtInIconPage >= paged.totalPages) {
                        return;
                    }
                    builtInIconPage += 1;
                    renderBuiltInIconPicker();
                });
            }

            if (filtered.length === 0) {
                grid.html('<div class="fv-icon-picker-empty">No built-in icons match this search.</div>');
                status.text(`Showing 0 of ${builtInIcons.length} icons`);
                return;
            }

            const rows = paged.items.map((icon) => {
                const selected = currentValue === icon.path;
                const safePath = escapeHtml(icon.path);
                const safeName = escapeHtml(icon.name);
                return `
                    <button type="button" class="fv-icon-picker-item${selected ? ' is-selected' : ''}" data-icon-value="${safePath}" title="${safeName}">
                        <img src="${safePath}" alt="${safeName}" onerror="this.src='${iconFallbackPath}';">
                        <span class="fv-icon-picker-item-name">${safeName}</span>
                    </button>
                `;
            }).join('');

            grid.html(rows);
            status.text(`Showing ${paged.startIndex + 1}-${paged.endIndex} of ${filtered.length} matches (${builtInIcons.length} total icons)`);
            grid.find('.fv-icon-picker-item').off('click').on('click', (event) => {
                event.preventDefault();
                const value = String($(event.currentTarget).attr('data-icon-value') || '').trim();
                if (!value) {
                    return;
                }
                setIconInputValue(value);
            });
        };

        const normalizeThirdPartyToken = (value) => String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const tokenizeThirdPartySearch = (value) => String(value || '')
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .map((token) => token.trim())
            .filter((token) => token.length > 1);

        const normalizeThirdPartySet = (value) => new Set(
            asArray(value)
                .map((entry) => String(entry || '').trim())
                .filter((entry) => entry !== '')
        );

        const normalizeThirdPartyRecent = (value) => asArray(value)
            .map((entry) => String(entry || '').trim())
            .filter((entry) => entry !== '')
            .slice(0, thirdPartyRecentLimit);

        const normalizeThirdPartyUsageMap = (value) => {
            const source = value && typeof value === 'object' ? value : {};
            const next = {};
            Object.entries(source).forEach(([key, amount]) => {
                const folder = String(key || '').trim();
                if (!folder) {
                    return;
                }
                const score = Math.max(0, Math.round(Number(amount || 0)));
                if (score > 0) {
                    next[folder] = score;
                }
            });
            return next;
        };

        const normalizeThirdPartyLastUsedMap = (value) => {
            const source = value && typeof value === 'object' ? value : {};
            const next = {};
            Object.entries(source).forEach(([key, stamp]) => {
                const iconUrl = String(key || '').trim();
                if (!iconUrl) {
                    return;
                }
                const timestamp = Math.max(0, Number(stamp || 0));
                if (Number.isFinite(timestamp) && timestamp > 0) {
                    next[iconUrl] = timestamp;
                }
            });
            return next;
        };

        const persistThirdPartyPreferences = () => {
            writeJsonStorage(thirdPartyFavoritesStorageKey, [...thirdPartyFavorites]);
            writeJsonStorage(thirdPartyRecentStorageKey, [...thirdPartyRecent]);
            writeJsonStorage(thirdPartyPinnedStorageKey, [...thirdPartyPinnedFolders]);
            writeJsonStorage(thirdPartyHiddenStorageKey, [...thirdPartyHiddenFolders]);
            writeJsonStorage(thirdPartyUsageStorageKey, { ...thirdPartyFolderUsage });
            writeJsonStorage(thirdPartyLastUsedStorageKey, { ...thirdPartyIconLastUsedByUrl });
        };

        const ensureThirdPartyPreferencesLoaded = () => {
            if (thirdPartyPreferencesLoaded) {
                return;
            }
            thirdPartyFavorites = normalizeThirdPartySet(parseJsonStorage(thirdPartyFavoritesStorageKey, []));
            thirdPartyRecent = normalizeThirdPartyRecent(parseJsonStorage(thirdPartyRecentStorageKey, []));
            thirdPartyPinnedFolders = normalizeThirdPartySet(parseJsonStorage(thirdPartyPinnedStorageKey, []));
            thirdPartyHiddenFolders = normalizeThirdPartySet(parseJsonStorage(thirdPartyHiddenStorageKey, []));
            thirdPartyFolderUsage = normalizeThirdPartyUsageMap(parseJsonStorage(thirdPartyUsageStorageKey, {}));
            thirdPartyIconLastUsedByUrl = normalizeThirdPartyLastUsedMap(parseJsonStorage(thirdPartyLastUsedStorageKey, {}));
            thirdPartyPreferencesLoaded = true;
        };

        const deriveThirdPartyTags = (entry, fallbackFolder = '') => {
            const tags = new Set();
            asArray(entry?.tags).forEach((tag) => {
                const normalized = normalizeThirdPartyToken(tag);
                if (normalized) {
                    tags.add(normalized);
                }
            });
            const folder = String(entry?.folder || fallbackFolder || '').trim();
            folder.split('/').forEach((segment) => {
                const normalized = normalizeThirdPartyToken(segment);
                if (normalized) {
                    tags.add(normalized);
                }
                tokenizeThirdPartySearch(segment).forEach((token) => {
                    const tokenTag = normalizeThirdPartyToken(token);
                    if (tokenTag) {
                        tags.add(tokenTag);
                    }
                });
            });
            const fileName = String(entry?.name || '').trim();
            tokenizeThirdPartySearch(fileName).forEach((token) => {
                const normalized = normalizeThirdPartyToken(token);
                if (normalized) {
                    tags.add(normalized);
                }
            });
            const ext = normalizeThirdPartyToken(entry?.ext || String(fileName.split('.').pop() || ''));
            if (ext) {
                tags.add(ext);
            }
            return [...tags];
        };

        const normalizeThirdPartyIconEntry = (entry, fallbackFolder = '') => {
            const name = String(entry?.name || '').trim();
            const url = String(entry?.url || '').trim();
            const folder = String(entry?.folder || fallbackFolder || '').trim();
            if (!name || !url || !folder) {
                return null;
            }
            const ext = String(entry?.ext || name.split('.').pop() || '').trim().toLowerCase();
            const size = Math.max(0, Number(entry?.size || 0));
            const width = Math.max(0, Number(entry?.width || 0));
            const height = Math.max(0, Number(entry?.height || 0));
            const updatedAt = String(entry?.updatedAt || '').trim();
            const hash = String(entry?.hash || '').trim().toLowerCase();
            const relativePath = String(entry?.relativePath || `${folder}/${name}`).trim();
            const validation = String(entry?.validation || '').trim().toLowerCase();
            return {
                name,
                url,
                folder,
                ext,
                size,
                width,
                height,
                updatedAt,
                hash,
                relativePath,
                validation,
                tags: deriveThirdPartyTags(entry, folder)
            };
        };

        const setThirdPartyStatus = (message, isError = false) => {
            if (!$) {
                return;
            }
            const status = $('#fv-third-party-icon-status');
            if (!status.length) {
                return;
            }
            const text = String(message || '').trim();
            status.removeClass('is-error is-success').text(text);
            if (!text) {
                return;
            }
            status.addClass(isError ? 'is-error' : 'is-success');
        };

        const getThirdPartyIconByUrl = (url) => {
            const needle = String(url || '').trim();
            if (!needle) {
                return null;
            }
            return [...thirdPartyIcons, ...thirdPartyIconIndex].find((icon) => String(icon?.url || '').trim() === needle) || null;
        };

        const buildThirdPartyIconLookup = () => {
            const map = new Map();
            [...thirdPartyIconIndex, ...thirdPartyIcons].forEach((icon) => {
                const url = String(icon?.url || '').trim();
                if (!url || map.has(url)) {
                    return;
                }
                map.set(url, icon);
            });
            return map;
        };

        const getThirdPartyDuplicateGroups = () => {
            const groups = new Map();
            thirdPartyIconIndex.forEach((icon) => {
                const hash = String(icon?.hash || '').trim();
                const key = hash ? `hash:${hash}` : `name:${String(icon?.name || '').trim().toLowerCase()}`;
                if (!key || key.endsWith(':')) {
                    return;
                }
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(icon);
            });
            return [...groups.entries()]
                .map(([key, icons]) => ({ key, icons: asArray(icons) }))
                .filter((entry) => entry.icons.length > 1)
                .sort((a, b) => b.icons.length - a.icons.length);
        };

        const collectThirdPartySuggestionTokens = () => {
            const form = getForm();
            const folderName = String(form?.name?.value || '').trim();
            const regexText = String(form?.regex?.value || '').trim();
            const tokens = [
                ...tokenizeThirdPartySearch(folderName),
                ...tokenizeThirdPartySearch(regexText),
                ...tokenizeThirdPartySearch(thirdPartySelectedFolder)
            ];
            return [...new Set(tokens)].slice(0, 10);
        };

        const getThirdPartySuggestedIcons = () => {
            const tokens = collectThirdPartySuggestionTokens();
            if (!tokens.length) {
                return [];
            }
            return thirdPartyIconIndex
                .map((icon) => {
                    const corpus = `${String(icon?.name || '').toLowerCase()} ${String(icon?.folder || '').toLowerCase()} ${asArray(icon?.tags).join(' ')}`;
                    let score = 0;
                    tokens.forEach((token) => {
                        if (corpus.includes(token)) {
                            score += String(icon?.name || '').toLowerCase().includes(token) ? 3 : 1;
                        }
                    });
                    return { icon, score };
                })
                .filter((row) => row.score > 0)
                .sort((a, b) => b.score - a.score || String(a.icon.name).localeCompare(String(b.icon.name)))
                .slice(0, iconPickerPageSize * 4)
                .map((row) => row.icon);
        };

        const getThirdPartyActiveBaseIcons = () => {
            const lookup = buildThirdPartyIconLookup();
            if (thirdPartyQuickMode === 'all') {
                return [...thirdPartyIconIndex];
            }
            if (thirdPartyQuickMode === 'favorites') {
                return thirdPartyIconIndex.filter((icon) => thirdPartyFavorites.has(String(icon?.url || '')));
            }
            if (thirdPartyQuickMode === 'recent') {
                return thirdPartyRecent.map((url) => lookup.get(url)).filter(Boolean);
            }
            if (thirdPartyQuickMode === 'suggested') {
                return getThirdPartySuggestedIcons();
            }
            if (thirdPartyQuickMode === 'duplicates') {
                return getThirdPartyDuplicateGroups().flatMap((group) => group.icons);
            }
            if (!thirdPartySelectedFolder) {
                return [];
            }
            if (thirdPartyIconIndex.length > 0) {
                return thirdPartyIconIndex.filter((icon) => String(icon?.folder || '') === thirdPartySelectedFolder);
            }
            return [...thirdPartyIcons];
        };

        const getThirdPartyFolderKind = (folderName) => {
            const value = String(folderName || '').trim().toLowerCase();
            if (value.startsWith('folders/')) {
                return 'folders';
            }
            if (value.startsWith('icons/')) {
                return 'icons';
            }
            return 'all';
        };

        const applyThirdPartySearchAndTagFilters = (icons) => {
            const queryTokens = tokenizeThirdPartySearch(thirdPartyIconSearchQuery);
            return asArray(icons).filter((icon) => {
                const tags = asArray(icon?.tags).map((tag) => String(tag || '').trim().toLowerCase());
                if (thirdPartySelectedTags.size > 0) {
                    const matchesTag = [...thirdPartySelectedTags].some((tag) => tags.includes(tag));
                    if (!matchesTag) {
                        return false;
                    }
                }
                if (thirdPartyPackKind === 'folders' || thirdPartyPackKind === 'icons') {
                    const kind = getThirdPartyFolderKind(String(icon?.folder || ''));
                    if (kind !== thirdPartyPackKind) {
                        return false;
                    }
                }
                if (thirdPartyPackSearchQuery) {
                    const packName = String(icon?.folder || '').toLowerCase();
                    if (!packName.includes(thirdPartyPackSearchQuery.toLowerCase())) {
                        return false;
                    }
                }
                if (thirdPartyQuickMode === 'folder' && thirdPartySelectedFolder && String(icon?.folder || '') !== thirdPartySelectedFolder) {
                    return false;
                }
                if (!queryTokens.length) {
                    return true;
                }
                const searchable = `${String(icon?.name || '').toLowerCase()} ${String(icon?.folder || '').toLowerCase()} ${String(icon?.ext || '').toLowerCase()} ${tags.join(' ')}`;
                return queryTokens.every((token) => searchable.includes(token));
            });
        };

        const sortThirdPartyIcons = (icons) => {
            const source = asArray(icons);
            if (thirdPartyQuickMode === 'recent') {
                return source;
            }
            const sorter = (a, b) => {
                if (thirdPartySortMode === 'name') {
                    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
                }
                if (thirdPartySortMode === 'newest') {
                    const aStamp = Number(new Date(String(a?.updatedAt || '')).getTime() || 0);
                    const bStamp = Number(new Date(String(b?.updatedAt || '')).getTime() || 0);
                    return bStamp - aStamp || String(a?.name || '').localeCompare(String(b?.name || ''));
                }
                const aUse = Number(thirdPartyIconLastUsedByUrl[String(a?.url || '')] || 0);
                const bUse = Number(thirdPartyIconLastUsedByUrl[String(b?.url || '')] || 0);
                if (aUse !== bUse) {
                    return bUse - aUse;
                }
                const aFav = thirdPartyFavorites.has(String(a?.url || '')) ? 1 : 0;
                const bFav = thirdPartyFavorites.has(String(b?.url || '')) ? 1 : 0;
                if (aFav !== bFav) {
                    return bFav - aFav;
                }
                return String(a?.name || '').localeCompare(String(b?.name || ''));
            };
            return [...source].sort(sorter);
        };

        const getThirdPartyVisibleIcons = () => {
            const base = getThirdPartyActiveBaseIcons();
            const filtered = applyThirdPartySearchAndTagFilters(base);
            const deduped = [];
            const seen = new Set();
            filtered.forEach((icon) => {
                const url = String(icon?.url || '').trim();
                if (!url || seen.has(url)) {
                    return;
                }
                seen.add(url);
                deduped.push(icon);
            });
            return sortThirdPartyIcons(deduped);
        };

        const buildThirdPartyTagList = (icons) => {
            const tagNeedle = String(thirdPartyTagSearchQuery || '').trim().toLowerCase();
            const counts = new Map();
            asArray(icons).forEach((icon) => {
                asArray(icon?.tags).forEach((tag) => {
                    const normalized = normalizeThirdPartyToken(tag);
                    if (!normalized) {
                        return;
                    }
                    counts.set(normalized, (counts.get(normalized) || 0) + 1);
                });
            });
            return [...counts.entries()]
                .filter(([, count]) => count >= thirdPartyMinTagCount)
                .filter(([tag]) => (!tagNeedle || tag.includes(tagNeedle)))
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, 48)
                .map(([tag, count]) => ({ tag, count }));
        };

        const renderThirdPartyTagFilters = (icons) => {
            if (!$) {
                return;
            }
            const box = $('#fv-third-party-tag-filters');
            if (!box.length) {
                return;
            }
            const tags = buildThirdPartyTagList(icons);
            if (!tags.length) {
                box.html('<div class="fv-icon-picker-empty">No tags for current results.</div>');
                return;
            }
            box.html(tags.map((entry) => {
                const tagValue = String(entry.tag || '').trim().toLowerCase();
                const tag = escapeHtml(tagValue);
                const count = Math.max(0, Number(entry.count || 0));
                const active = thirdPartySelectedTags.has(tagValue) ? ' is-active' : '';
                return `
                    <label class="fv-third-party-tag${active}">
                        <input type="checkbox" data-third-party-tag="${tag}" ${active ? 'checked' : ''}>
                        <span>${tag} ${count}</span>
                    </label>
                `;
            }).join(''));
        };

        const getThirdPartyFolderNewestStamp = (folderName) => {
            const folder = String(folderName || '').trim();
            if (!folder) {
                return 0;
            }
            let newest = 0;
            thirdPartyIconIndex.forEach((icon) => {
                if (String(icon?.folder || '') !== folder) {
                    return;
                }
                const stamp = Number(new Date(String(icon?.updatedAt || '')).getTime() || 0);
                if (stamp > newest) {
                    newest = stamp;
                }
            });
            return newest;
        };

        const getThirdPartyVisibleFolders = () => {
            const rows = asArray(thirdPartyIconFolders).filter((folder) => {
                const name = String(folder?.name || '').trim();
                if (!name) {
                    return false;
                }
                if (thirdPartyShowHiddenFolders) {
                    // keep flowing
                } else if (thirdPartyHiddenFolders.has(name)) {
                    return false;
                }
                if (thirdPartyPackKind === 'folders' || thirdPartyPackKind === 'icons') {
                    if (getThirdPartyFolderKind(name) !== thirdPartyPackKind) {
                        return false;
                    }
                }
                if (thirdPartyPackSearchQuery) {
                    return name.toLowerCase().includes(thirdPartyPackSearchQuery.toLowerCase());
                }
                return true;
            });
            return rows.sort((a, b) => {
                const aName = String(a?.name || '');
                const bName = String(b?.name || '');
                const aPinned = thirdPartyPinnedFolders.has(aName) ? 1 : 0;
                const bPinned = thirdPartyPinnedFolders.has(bName) ? 1 : 0;
                if (aPinned !== bPinned) {
                    return bPinned - aPinned;
                }
                if (thirdPartySortMode === 'name') {
                    return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
                }
                if (thirdPartySortMode === 'count') {
                    const aCount = Number(a?.iconCount || 0);
                    const bCount = Number(b?.iconCount || 0);
                    return bCount - aCount || aName.localeCompare(bName);
                }
                if (thirdPartySortMode === 'newest') {
                    const aStamp = getThirdPartyFolderNewestStamp(aName);
                    const bStamp = getThirdPartyFolderNewestStamp(bName);
                    return bStamp - aStamp || aName.localeCompare(bName);
                }
                const aUsage = Number(thirdPartyFolderUsage[aName] || 0);
                const bUsage = Number(thirdPartyFolderUsage[bName] || 0);
                return bUsage - aUsage || aName.localeCompare(bName);
            });
        };

        const reconcileThirdPartySelectedFolder = () => {
            const visible = getThirdPartyVisibleFolders();
            const visibleNames = new Set(visible.map((entry) => String(entry?.name || '').trim()).filter(Boolean));
            if (thirdPartySelectedFolder && visibleNames.has(thirdPartySelectedFolder)) {
                return;
            }
            const firstPinned = visible.find((entry) => thirdPartyPinnedFolders.has(String(entry?.name || '').trim()));
            thirdPartySelectedFolder = String(firstPinned?.name || visible[0]?.name || '').trim();
        };

        const recordThirdPartyRecentIcon = (iconUrl) => {
            const url = String(iconUrl || '').trim();
            if (!url) {
                return;
            }
            thirdPartyRecent = [url, ...thirdPartyRecent.filter((entry) => entry !== url)].slice(0, thirdPartyRecentLimit);
        };

        const recordThirdPartyIconUsage = (icon) => {
            const folder = String(icon?.folder || thirdPartySelectedFolder || '').trim();
            const url = String(icon?.url || '').trim();
            if (!url) {
                return;
            }
            if (folder) {
                thirdPartyFolderUsage[folder] = Math.max(0, Number(thirdPartyFolderUsage[folder] || 0)) + 1;
            }
            thirdPartyIconLastUsedByUrl[url] = Date.now();
            recordThirdPartyRecentIcon(url);
            persistThirdPartyPreferences();
        };

        const renderThirdPartyPreview = (icon = null) => {
            if (!$) {
                return;
            }
            const preview = $('#fv-third-party-preview');
            if (!preview.length) {
                return;
            }
            const source = icon && typeof icon === 'object' ? icon : null;
            if (!source) {
                thirdPartyPreviewIconUrl = '';
                preview.html('Preview an icon to inspect details.');
                return;
            }
            thirdPartyPreviewIconUrl = String(source.url || '').trim();
            const name = escapeHtml(String(source.name || 'Unknown icon'));
            const folder = escapeHtml(String(source.folder || 'Unknown folder'));
            const url = escapeHtml(String(source.url || ''));
            const size = Number(source.size || 0) > 0 ? formatByteCount(Number(source.size || 0)) : '';
            const dim = Number(source.width || 0) > 0 && Number(source.height || 0) > 0
                ? `${Math.max(0, Number(source.width || 0))}x${Math.max(0, Number(source.height || 0))}`
                : '';
            const when = formatDateTimeShort(String(source.updatedAt || ''));
            const ext = String(source.ext || '').trim().toUpperCase();
            const extra = [folder, size, dim, ext, when].filter((entry) => String(entry || '').trim() !== '').join(' | ');
            const isFavorite = thirdPartyFavorites.has(String(source.url || '').trim());
            preview.html(`
                <div class="fv-third-party-preview-card">
                    <img src="${url}" alt="${name}" loading="lazy" onerror="this.src='${iconFallbackPath}';">
                    <div class="fv-third-party-preview-meta">
                        <div class="fv-third-party-preview-title" title="${name}">${name}</div>
                        <div class="fv-third-party-preview-sub">${escapeHtml(extra || 'No metadata')}</div>
                    </div>
                    <button type="button" class="fv-third-party-preview-action${isFavorite ? ' is-active' : ''}" data-third-party-preview-favorite="${url}" title="${isFavorite ? 'Remove favorite' : 'Favorite icon'}">
                        <i class="fa ${isFavorite ? 'fa-star' : 'fa-star-o'}" aria-hidden="true"></i>
                    </button>
                </div>
            `);
        };

        const toggleThirdPartyFavorite = (iconUrl) => {
            const url = String(iconUrl || '').trim();
            if (!url) {
                return;
            }
            if (thirdPartyFavorites.has(url)) {
                thirdPartyFavorites.delete(url);
            } else {
                thirdPartyFavorites.add(url);
            }
            persistThirdPartyPreferences();
        };

        const buildThirdPartyDuplicateCleanupScript = () => {
            const basePath = '/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons';
            const quotePath = (value) => `'${String(value || '').replace(/'/g, "'\\''")}'`;
            const groups = getThirdPartyDuplicateGroups();
            if (!groups.length) {
                return '# No duplicate icons detected.';
            }
            const lines = [
                '#!/bin/bash',
                '# FolderView Plus duplicate third-party icon cleanup',
                '# Review before running. Keeps the first icon in each duplicate set.',
                ''
            ];
            groups.forEach((group) => {
                const sorted = [...asArray(group.icons)].sort((a, b) => {
                    const aFav = thirdPartyFavorites.has(String(a?.url || '')) ? 1 : 0;
                    const bFav = thirdPartyFavorites.has(String(b?.url || '')) ? 1 : 0;
                    if (aFav !== bFav) {
                        return bFav - aFav;
                    }
                    const aUse = Number(thirdPartyIconLastUsedByUrl[String(a?.url || '')] || 0);
                    const bUse = Number(thirdPartyIconLastUsedByUrl[String(b?.url || '')] || 0);
                    return bUse - aUse;
                });
                const keep = sorted[0];
                lines.push(`# Group ${group.key} (${sorted.length} files)`);
                lines.push(`# Keep: ${String(keep?.relativePath || `${keep?.folder || ''}/${keep?.name || ''}`)}`);
                sorted.slice(1).forEach((icon) => {
                    const rel = String(icon?.relativePath || `${icon?.folder || ''}/${icon?.name || ''}`).trim();
                    if (!rel) {
                        return;
                    }
                    const fullPath = `${basePath}/${rel}`.replace(/\/+/g, '/');
                    lines.push(`rm -f ${quotePath(fullPath)}`);
                });
                lines.push('');
            });
            return lines.join('\n');
        };

        const selectThirdPartyIconByKey = (iconKey, { apply = true } = {}) => {
            const key = String(iconKey || '').trim();
            if (!key || !thirdPartyRenderedIconMap.has(key)) {
                return;
            }
            const icon = thirdPartyRenderedIconMap.get(key);
            if (!icon) {
                return;
            }
            renderThirdPartyPreview(icon);
            if (!apply) {
                return;
            }
            setIconInputValue(String(icon.url || ''));
            recordThirdPartyIconUsage(icon);
            if (thirdPartyQuickMode === 'recent' || thirdPartySortMode === 'usage') {
                renderThirdPartyIconGrid();
            }
        };

        const bindThirdPartyIconGridEvents = () => {
            if (!$) {
                return;
            }
            const grid = $('#fv-third-party-icon-grid');
            const preview = $('#fv-third-party-preview');
            if (!grid.length) {
                return;
            }
            grid
                .off('click.fvthirdparty keydown.fvthirdparty pointerdown.fvthirdparty pointerup.fvthirdparty pointercancel.fvthirdparty pointerleave.fvthirdparty mouseenter.fvthirdparty')
                .on('click.fvthirdparty', '.fv-third-party-icon-fav', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const url = String($(event.currentTarget).attr('data-third-party-favorite') || '').trim();
                    if (!url) {
                        return;
                    }
                    toggleThirdPartyFavorite(url);
                    const icon = getThirdPartyIconByUrl(url);
                    if (icon && thirdPartyPreviewIconUrl === url) {
                        renderThirdPartyPreview(icon);
                    }
                    renderThirdPartyIconGrid();
                })
                .on('click.fvthirdparty', '.fv-third-party-icon-item', (event) => {
                    event.preventDefault();
                    const key = String($(event.currentTarget).attr('data-third-party-key') || '').trim();
                    selectThirdPartyIconByKey(key, { apply: true });
                })
                .on('mouseenter.fvthirdparty', '.fv-third-party-icon-item', (event) => {
                    const key = String($(event.currentTarget).attr('data-third-party-key') || '').trim();
                    selectThirdPartyIconByKey(key, { apply: false });
                })
                .on('keydown.fvthirdparty', '.fv-third-party-icon-item', (event) => {
                    const item = $(event.currentTarget);
                    const key = String(item.attr('data-third-party-key') || '').trim();
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectThirdPartyIconByKey(key, { apply: true });
                        return;
                    }
                    if (String(event.key || '').toLowerCase() === 'f') {
                        const icon = thirdPartyRenderedIconMap.get(key);
                        if (icon) {
                            toggleThirdPartyFavorite(String(icon.url || ''));
                            renderThirdPartyIconGrid();
                        }
                        return;
                    }
                    const items = grid.find('.fv-third-party-icon-item');
                    const currentIndex = items.index(item);
                    if (currentIndex < 0) {
                        return;
                    }
                    let nextIndex = currentIndex;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                        nextIndex = Math.min(items.length - 1, currentIndex + 1);
                    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                        nextIndex = Math.max(0, currentIndex - 1);
                    } else {
                        return;
                    }
                    event.preventDefault();
                    items.eq(nextIndex).trigger('focus');
                })
                .on('pointerdown.fvthirdparty', '.fv-third-party-icon-item', (event) => {
                    const pointerType = String(event.originalEvent?.pointerType || event.pointerType || '').toLowerCase();
                    if (pointerType !== 'touch') {
                        return;
                    }
                    const key = String($(event.currentTarget).attr('data-third-party-key') || '').trim();
                    if (!key) {
                        return;
                    }
                    if (thirdPartyLongPressTimer) {
                        clearTimeout(thirdPartyLongPressTimer);
                    }
                    thirdPartyLongPressTimer = setTimeout(() => {
                        thirdPartyLongPressTimer = null;
                        selectThirdPartyIconByKey(key, { apply: false });
                    }, thirdPartyLongPressPreviewMs);
                })
                .on('pointerup.fvthirdparty pointercancel.fvthirdparty pointerleave.fvthirdparty', '.fv-third-party-icon-item', () => {
                    if (thirdPartyLongPressTimer) {
                        clearTimeout(thirdPartyLongPressTimer);
                        thirdPartyLongPressTimer = null;
                    }
                });

            preview
                .off('click.fvthirdparty')
                .on('click.fvthirdparty', '[data-third-party-preview-favorite]', (event) => {
                    event.preventDefault();
                    const url = String($(event.currentTarget).attr('data-third-party-preview-favorite') || '').trim();
                    if (!url) {
                        return;
                    }
                    toggleThirdPartyFavorite(url);
                    const icon = getThirdPartyIconByUrl(url);
                    renderThirdPartyPreview(icon);
                    renderThirdPartyIconGrid();
                });
        };

        const getThirdPartyActiveFilterCount = () => {
            let count = 0;
            if (String(thirdPartyIconSearchQuery || '').trim() !== '') {
                count += 1;
            }
            if (String(thirdPartyPackSearchQuery || '').trim() !== '') {
                count += 1;
            }
            if (String(thirdPartyPackKind || 'all').trim().toLowerCase() !== 'all') {
                count += 1;
            }
            if (thirdPartySelectedTags.size > 0) {
                count += thirdPartySelectedTags.size;
            }
            if (thirdPartyShowHiddenFolders) {
                count += 1;
            }
            return count;
        };

        const renderThirdPartyContextLine = (totalMatches = null) => {
            if (!$) {
                return;
            }
            const line = $('#fv-third-party-context-line');
            if (!line.length) {
                return;
            }
            const modeLabelMap = {
                folder: 'selected pack',
                all: 'all packs',
                favorites: 'favorites',
                recent: 'recent',
                suggested: 'suggested',
                duplicates: 'duplicates'
            };
            const scopeText = modeLabelMap[String(thirdPartyQuickMode || 'folder').trim()] || 'selected pack';
            const filterCount = getThirdPartyActiveFilterCount();
            const filterText = filterCount > 0 ? `${filterCount} active` : 'none';
            const packText = thirdPartySelectedFolder || 'none';
            const resultText = Number.isFinite(Number(totalMatches)) ? ` | Results: ${Math.max(0, Number(totalMatches || 0))}` : '';
            line.text(`Pack: ${packText} | Scope: ${scopeText} | Filters: ${filterText}${resultText}`);
        };

        const setThirdPartyFilterSheetOpen = (open) => {
            if (!$) {
                return;
            }
            thirdPartyFilterSheetOpen = Boolean(open);
            $('#fv-third-party-filter-sheet').prop('hidden', !thirdPartyFilterSheetOpen);
            const toggle = $('#fv-third-party-filter-toggle');
            toggle.toggleClass('is-active', thirdPartyFilterSheetOpen);
        };

        const setThirdPartyPackActionsOpen = (open) => {
            if (!$) {
                return;
            }
            thirdPartyPackActionsOpen = Boolean(open);
            $('#fv-third-party-pack-actions-panel').prop('hidden', !thirdPartyPackActionsOpen);
            const toggle = $('#fv-third-party-pack-actions-toggle');
            const icon = thirdPartyPackActionsOpen ? 'fa-caret-up' : 'fa-caret-down';
            toggle
                .toggleClass('is-active', thirdPartyPackActionsOpen)
                .html(`<i class="fa ${icon}" aria-hidden="true"></i> Pack actions`);
        };

        const renderThirdPartyFilterUiState = () => {
            if (!$) {
                return;
            }
            const activeCount = getThirdPartyActiveFilterCount();
            const filterLabel = activeCount > 0 ? `Filters (${activeCount})` : 'Filters';
            $('#fv-third-party-filter-toggle').html(`<i class="fa fa-sliders" aria-hidden="true"></i> ${filterLabel}`);
            $('#fv-third-party-filter-clear-all').prop('disabled', activeCount === 0);
        };

        const setThirdPartyAdvancedMode = (open) => {
            if (!$) {
                return;
            }
            thirdPartyAdvancedMode = Boolean(open);
            const panel = $('#fv-third-party-icon-panel');
            panel.toggleClass('is-advanced', thirdPartyAdvancedMode);
            $('#fv-third-party-mode-basic').toggleClass('is-active', !thirdPartyAdvancedMode);
            $('#fv-third-party-mode-advanced').toggleClass('is-active', thirdPartyAdvancedMode);
            if (!thirdPartyAdvancedMode) {
                setThirdPartyFilterSheetOpen(false);
                setThirdPartyPackActionsOpen(false);
            }
            renderThirdPartyFilterUiState();
        };

        const renderThirdPartyPackMenu = () => {
            if (!$) {
                return;
            }
            const folder = String(thirdPartySelectedFolder || '').trim();
            const pinButton = $('#fv-third-party-pack-pin-toggle');
            const hideButton = $('#fv-third-party-pack-hide-toggle');
            if (!folder) {
                pinButton.prop('disabled', true).html('<i class="fa fa-star-o" aria-hidden="true"></i> Pin pack');
                hideButton.prop('disabled', true).html('<i class="fa fa-eye-slash" aria-hidden="true"></i> Hide pack');
                renderThirdPartyFilterUiState();
                return;
            }
            const pinned = thirdPartyPinnedFolders.has(folder);
            const hidden = thirdPartyHiddenFolders.has(folder);
            pinButton.prop('disabled', false).html(`<i class="fa ${pinned ? 'fa-star' : 'fa-star-o'}" aria-hidden="true"></i> ${pinned ? 'Unpin pack' : 'Pin pack'}`);
            hideButton.prop('disabled', false).html(`<i class="fa fa-eye-slash" aria-hidden="true"></i> ${hidden ? 'Unhide pack' : 'Hide pack'}`);
            renderThirdPartyFilterUiState();
        };

        const renderThirdPartyFolderList = () => {
            if (!$) {
                return;
            }
            const packSelect = $('#fv-third-party-pack-select');
            if (!packSelect.length) {
                return;
            }
            const folders = getThirdPartyVisibleFolders();
            if (!folders.length) {
                packSelect.html('<option value="">No packs available</option>').prop('disabled', true);
                setThirdPartyStatus('No packs available. Try clearing filters or enabling hidden packs in Pack actions.');
                renderThirdPartyPackMenu();
                renderThirdPartyContextLine(0);
                return;
            }
            const options = folders.map((folder) => {
                const folderName = String(folder?.name || '').trim();
                const count = Math.max(0, Number(folder?.iconCount || 0));
                const pinned = thirdPartyPinnedFolders.has(folderName) ? ' [pinned]' : '';
                const kind = getThirdPartyFolderKind(folderName);
                const kindLabel = kind === 'folders' ? 'folder' : (kind === 'icons' ? 'icon' : 'pack');
                return `<option value="${escapeHtml(folderName)}">${escapeHtml(folderName)} (${count}) - ${kindLabel}${pinned}</option>`;
            }).join('');
            packSelect.html(options).prop('disabled', false);
            if (!folders.some((entry) => String(entry?.name || '').trim() === thirdPartySelectedFolder)) {
                thirdPartySelectedFolder = String(folders[0]?.name || '').trim();
            }
            packSelect.val(thirdPartySelectedFolder);
            renderThirdPartyPackMenu();
            $('#fv-third-party-show-hidden')
                .toggleClass('is-active', thirdPartyShowHiddenFolders)
                .text(thirdPartyShowHiddenFolders ? 'Hide hidden' : 'Show hidden');
            renderThirdPartyFilterUiState();
        };

        const renderThirdPartyIconGrid = () => {
            if (!$) {
                return;
            }
            const grid = $('#fv-third-party-icon-grid');
            const header = $('#fv-third-party-current-folder');
            const prevButton = $('#fv-third-party-icon-prev');
            const nextButton = $('#fv-third-party-icon-next');
            const pageLabel = $('#fv-third-party-icon-page-label');
            if (!grid.length || !header.length) {
                return;
            }

            renderThirdPartyTagFilters(getThirdPartyActiveBaseIcons());

            const setPager = (page, totalPages) => {
                if (!prevButton.length || !nextButton.length || !pageLabel.length) {
                    return;
                }
                prevButton.prop('disabled', page <= 1);
                nextButton.prop('disabled', page >= totalPages);
                pageLabel.text(`Page ${page} / ${totalPages}`);
            };

            header.text(thirdPartySelectedFolder
                ? `Step 1 complete: pack "${thirdPartySelectedFolder}" selected. Step 2: choose an icon.`
                : 'Step 1: pick a pack. Step 2: choose an icon.');

            const filteredIcons = getThirdPartyVisibleIcons();
            const paged = paginateItems(filteredIcons, thirdPartyIconPage, iconPickerPageSize);
            thirdPartyIconPage = paged.page;
            setPager(paged.page, paged.totalPages);
            renderThirdPartyContextLine(filteredIcons.length);

            prevButton.off('click.fvthirdpartypager').on('click.fvthirdpartypager', (event) => {
                event.preventDefault();
                if (thirdPartyIconPage <= 1) {
                    return;
                }
                thirdPartyIconPage -= 1;
                renderThirdPartyIconGrid();
            });
            nextButton.off('click.fvthirdpartypager').on('click.fvthirdpartypager', (event) => {
                event.preventDefault();
                if (thirdPartyIconPage >= paged.totalPages) {
                    return;
                }
                thirdPartyIconPage += 1;
                renderThirdPartyIconGrid();
            });

            if (!filteredIcons.length) {
                thirdPartyRenderedIconMap = new Map();
                grid.html('<div class="fv-icon-picker-empty">No icons matched. Try "Clear all filters", switch Scope, or pick a different pack.</div>');
                setThirdPartyStatus('No matching icons. Try clearing filters or switching scope.');
                renderThirdPartyPreview();
                renderThirdPartyContextLine(0);
                return;
            }

            const duplicateSet = new Set(
                getThirdPartyDuplicateGroups()
                    .flatMap((group) => group.icons)
                    .map((icon) => String(icon?.url || '').trim())
                    .filter(Boolean)
            );
            thirdPartyRenderedIconMap = new Map();
            grid.empty();
            const currentValue = getCurrentIconValue();
            const token = ++thirdPartyGridRenderToken;
            let offset = 0;

            const appendChunk = () => {
                if (token !== thirdPartyGridRenderToken) {
                    return;
                }
                const chunk = paged.items.slice(offset, offset + thirdPartyGridChunkSize);
                if (!chunk.length) {
                    setThirdPartyStatus(`Showing ${paged.startIndex + 1}-${paged.endIndex} of ${filteredIcons.length} icon${filteredIcons.length === 1 ? '' : 's'}.`);
                    if (!thirdPartyPreviewIconUrl) {
                        renderThirdPartyPreview(paged.items[0] || null);
                    }
                    return;
                }
                const rows = chunk.map((icon, idx) => {
                    const key = `${paged.startIndex + offset + idx}:${String(icon?.url || '')}`;
                    thirdPartyRenderedIconMap.set(key, icon);
                    const safeKey = escapeHtml(key);
                    const safeName = escapeHtml(String(icon?.name || ''));
                    const safeUrl = escapeHtml(String(icon?.url || ''));
                    const safeFolder = escapeHtml(String(icon?.folder || ''));
                    const selected = String(icon?.url || '') === currentValue ? ' is-selected' : '';
                    const isFavorite = thirdPartyFavorites.has(String(icon?.url || '')) ? ' is-active' : '';
                    const badges = [];
                    if (duplicateSet.has(String(icon?.url || ''))) {
                        badges.push('<span class="fv-third-party-badge is-warning">dup</span>');
                    }
                    if (String(icon?.validation || '') === 'warn' || String(icon?.validation || '') === 'error' || thirdPartyBrokenIconUrls.has(String(icon?.url || ''))) {
                        badges.push('<span class="fv-third-party-badge is-error">check</span>');
                    }
                    return `
                        <div class="fv-third-party-icon-item${selected}" data-third-party-key="${safeKey}" tabindex="0" role="button" title="${safeName}">
                            <img src="${thirdPartyPlaceholderIcon}" data-src="${safeUrl}" alt="${safeName}" loading="lazy" onerror="this.src='${iconFallbackPath}';">
                            <div class="fv-third-party-icon-main">
                                <span class="fv-icon-picker-item-name">${safeName}</span>
                                <span class="fv-third-party-icon-folder">${safeFolder}</span>
                            </div>
                            <div>
                                <button type="button" class="fv-third-party-icon-fav${isFavorite}" data-third-party-favorite="${safeUrl}" title="Toggle favorite">
                                    <i class="fa ${isFavorite ? 'fa-star' : 'fa-star-o'}" aria-hidden="true"></i>
                                </button>
                                <span class="fv-third-party-icon-badges">${badges.join('')}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                grid.append(rows);
                grid.find('img[data-src]').each((_, element) => {
                    const image = element;
                    const source = String(image.getAttribute('data-src') || '').trim();
                    if (!source || image.getAttribute('src') === source) {
                        return;
                    }
                    image.addEventListener('error', () => {
                        thirdPartyBrokenIconUrls.add(source);
                    }, { once: true });
                    image.setAttribute('src', source);
                });
                offset += chunk.length;
                if (offset < paged.items.length) {
                    if (win && typeof win.requestAnimationFrame === 'function') {
                        win.requestAnimationFrame(appendChunk);
                    } else {
                        setTimeout(appendChunk, 16);
                    }
                } else {
                    setThirdPartyStatus(`Showing ${paged.startIndex + 1}-${paged.endIndex} of ${filteredIcons.length} icon${filteredIcons.length === 1 ? '' : 's'}.`);
                }
            };
            appendChunk();
            bindThirdPartyIconGridEvents();
        };

        const loadThirdPartyFolders = async () => {
            const response = await $.get(thirdPartyIconApiPath, { action: 'list_folders' }).promise();
            const payload = parseJsonPayload(response);
            if (!payload || payload.ok !== true) {
                throw new Error(String(payload?.error || 'Failed to load third-party icon folders.'));
            }
            thirdPartyIconFolders = asArray(payload.folders).map((entry) => ({
                name: String(entry?.name || '').trim(),
                iconCount: Math.max(0, Number(entry?.iconCount || 0))
            })).filter((entry) => entry.name !== '');
            if (thirdPartySelectedFolder && !thirdPartyIconFolders.some((entry) => entry.name === thirdPartySelectedFolder)) {
                thirdPartySelectedFolder = '';
                thirdPartyIcons = [];
            }
        };

        const loadThirdPartyIconIndex = async () => {
            const response = await $.get(thirdPartyIconApiPath, { action: 'list_index' }).promise();
            const payload = parseJsonPayload(response);
            if (!payload || payload.ok !== true) {
                throw new Error(String(payload?.error || 'Failed to build icon index.'));
            }
            thirdPartyIconIndex = asArray(payload.icons)
                .map((entry) => normalizeThirdPartyIconEntry(entry))
                .filter(Boolean);
            thirdPartyIndexCacheReady = true;
        };

        const loadThirdPartyIcons = async (folderName) => {
            const folder = String(folderName || '').trim();
            if (!folder) {
                return;
            }
            if (thirdPartyIndexCacheReady && thirdPartyIconIndex.length > 0) {
                thirdPartySelectedFolder = folder;
                thirdPartyIcons = thirdPartyIconIndex.filter((entry) => String(entry?.folder || '') === folder);
                thirdPartyIconPage = 1;
                renderThirdPartyFolderList();
                renderThirdPartyIconGrid();
                return;
            }
            const response = await $.get(thirdPartyIconApiPath, { action: 'list_icons', folder }).promise();
            const payload = parseJsonPayload(response);
            if (!payload || payload.ok !== true) {
                throw new Error(String(payload?.error || 'Failed to load icons for selected folder.'));
            }
            thirdPartySelectedFolder = String(payload.folder || folder).trim();
            thirdPartyIcons = asArray(payload.icons)
                .map((entry) => normalizeThirdPartyIconEntry(entry, thirdPartySelectedFolder))
                .filter(Boolean);
            thirdPartyIconPage = 1;
            renderThirdPartyFolderList();
            renderThirdPartyIconGrid();
        };

        const refreshThirdPartyIconPicker = async () => {
            ensureThirdPartyPreferencesLoaded();
            setThirdPartyStatus('Refreshing third-party icon folders...');
            try {
                await loadThirdPartyFolders();
                try {
                    await loadThirdPartyIconIndex();
                } catch (_error) {
                    thirdPartyIconIndex = [];
                    thirdPartyIndexCacheReady = false;
                }
                reconcileThirdPartySelectedFolder();
                renderThirdPartyFolderList();
                if (thirdPartySelectedFolder) {
                    await loadThirdPartyIcons(thirdPartySelectedFolder);
                } else {
                    renderThirdPartyIconGrid();
                }
            } catch (error) {
                setThirdPartyStatus(`Error: ${String(error?.message || 'Failed to refresh third-party icon packs.')}`, true);
            }
        };

        const loadBuiltInIcons = async () => {
            try {
                const response = await $.get(builtInIconManifestPath).promise();
                const payload = (typeof response === 'string')
                    ? JSON.parse(response.replace(/^\uFEFF/, ''))
                    : response;
                builtInIcons = folderIconApi && typeof folderIconApi.normalizeBuiltInIconManifest === 'function'
                    ? folderIconApi.normalizeBuiltInIconManifest(payload)
                    : asArray(payload);
            } catch (_error) {
                builtInIcons = [...builtInIconFallback];
            }
            builtInIconManifestLoaded = true;
            builtInIconPage = 1;
        };

        const bindIconPickerEvents = async () => {
            if (!$ || !doc) {
                return;
            }
            const panel = $('#fv-icon-picker-panel');
            if (!panel.length) {
                return;
            }

            $('#fv-icon-picker-toggle').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                const isOpen = !panel.prop('hidden');
                setThirdPartyIconPickerOpen(false);
                setCustomIconPickerOpen(false);
                setBuiltInIconPickerOpen(!isOpen);
                if (!isOpen) {
                    if (!builtInIconManifestLoaded) {
                        await loadBuiltInIcons();
                    }
                    builtInIconPage = 1;
                    renderBuiltInIconPicker();
                    $('#fv-icon-picker-search').trigger('focus');
                }
            });

            $('#fv-icon-third-party-toggle').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                const thirdPartyPanel = $('#fv-third-party-icon-panel');
                const isOpen = !thirdPartyPanel.prop('hidden');
                setBuiltInIconPickerOpen(false);
                setCustomIconPickerOpen(false);
                setThirdPartyIconPickerOpen(!isOpen);
                if (!isOpen) {
                    await refreshThirdPartyIconPicker();
                    $('#fv-third-party-search').trigger('focus');
                }
            });

            $('#fv-icon-custom-manager-toggle').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                const customPanel = $('#fv-custom-icon-panel');
                const isOpen = !customPanel.prop('hidden');
                setBuiltInIconPickerOpen(false);
                setThirdPartyIconPickerOpen(false);
                setCustomIconPickerOpen(!isOpen);
                if (!isOpen) {
                    await refreshCustomIconManager();
                    $('#fv-custom-icon-search').trigger('focus');
                }
            });

            $('#fv-icon-picker-default').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                setIconInputValue(defaultFolderIconPath);
                setIconUploadStatus('');
            });

            $('#fv-icon-upload').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                const fileInput = $('#fv-icon-upload-file');
                if (!fileInput.length) {
                    return;
                }
                fileInput.val('');
                fileInput.trigger('click');
            });

            $('#fv-icon-upload-file').off('change.fviconpicker').on('change.fviconpicker', async (event) => {
                const input = event.currentTarget;
                const file = (input && input.files && input.files.length > 0) ? input.files[0] : null;
                if (!file) {
                    return;
                }

                try {
                    validateCustomIconFileBeforeUpload(file);
                } catch (error) {
                    setIconUploadStatus(`Upload failed: ${error.message || 'Invalid file.'}`, true);
                    $(input).val('');
                    return;
                }

                const uploadButton = $('#fv-icon-upload');
                const cancelButton = $('#fv-icon-upload-cancel');
                const replace = $('#fv-icon-upload-replace').is(':checked');
                const dedupe = $('#fv-icon-upload-dedupe').is(':checked');
                const safeName = String(file.name || 'icon').trim() || 'icon';
                uploadButton.prop('disabled', true);
                cancelButton.prop('disabled', false);
                setIconUploadProgressVisible(true);
                updateIconUploadProgress(0, Number(file.size || 0), `Uploading "${safeName}"...`);
                setIconUploadStatus(`Uploading "${safeName}"...`);
                cancelButton.off('click.fviconpicker').on('click.fviconpicker', (cancelEvent) => {
                    cancelEvent.preventDefault();
                    if (customIconUploadRequest && typeof customIconUploadRequest.abort === 'function') {
                        customIconUploadRequest.abort();
                    }
                });

                try {
                    const result = await uploadCustomIconFile(file, {
                        replace,
                        dedupe,
                        onProgress: (loaded, total) => updateIconUploadProgress(loaded, total)
                    });
                    updateIconUploadProgress(Number(file.size || 0), Number(file.size || 0), `Uploaded "${result.name}".`);
                    setIconInputValue(result.url);
                    const message = String(result.message || '').trim() || `Uploaded "${result.name}" and set as icon.`;
                    setIconUploadStatus(message);
                    await refreshCustomIconManager();
                } catch (error) {
                    setIconUploadStatus(`Upload failed: ${error.message || 'Unknown error.'}`, true);
                } finally {
                    cancelButton.off('click.fviconpicker').prop('disabled', true);
                    uploadButton.prop('disabled', false);
                    $(input).val('');
                    setTimeout(() => {
                        resetIconUploadProgress();
                    }, 220);
                }
            });

            $('#fv-third-party-refresh').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                await refreshThirdPartyIconPicker();
            });

            const reflowThirdPartyPackSelection = async () => {
                reconcileThirdPartySelectedFolder();
                renderThirdPartyFolderList();
                if (thirdPartyQuickMode === 'folder' && thirdPartySelectedFolder) {
                    await loadThirdPartyIcons(thirdPartySelectedFolder);
                } else {
                    renderThirdPartyIconGrid();
                }
            };

            const applyThirdPartyQuickMode = async (mode) => {
                const normalized = String(mode || 'folder').trim();
                const allowed = new Set(['folder', 'all', 'favorites', 'recent', 'suggested', 'duplicates']);
                if (!allowed.has(normalized)) {
                    return;
                }
                thirdPartyQuickMode = normalized;
                $('#fv-third-party-view').val(normalized);
                thirdPartyIconPage = 1;
                if (normalized === 'folder') {
                    await reflowThirdPartyPackSelection();
                    return;
                }
                renderThirdPartyIconGrid();
            };

            $('#fv-third-party-mode-basic').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                setThirdPartyAdvancedMode(false);
            });
            $('#fv-third-party-mode-advanced').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                setThirdPartyAdvancedMode(true);
            });
            $('#fv-third-party-preset-recent').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                await applyThirdPartyQuickMode('recent');
            });
            $('#fv-third-party-preset-favorites').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                await applyThirdPartyQuickMode('favorites');
            });
            $('#fv-third-party-preset-most-used').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                thirdPartySortMode = 'usage';
                $('#fv-third-party-sort').val('usage');
                renderThirdPartyFolderList();
                await applyThirdPartyQuickMode('all');
            });
            $('#fv-third-party-preset-folder-icons').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                thirdPartyPackKind = 'folders';
                $('#fv-third-party-pack-kind').val('folders');
                await applyThirdPartyQuickMode('folder');
            });
            $('#fv-third-party-search').off('input.fviconpicker').on('input.fviconpicker', (event) => {
                if (thirdPartyIconSearchTimer) {
                    clearTimeout(thirdPartyIconSearchTimer);
                }
                const value = String($(event.currentTarget).val() || '').trim();
                thirdPartyIconSearchTimer = setTimeout(() => {
                    thirdPartyIconSearchTimer = null;
                    thirdPartyIconSearchQuery = value;
                    thirdPartyIconPage = 1;
                    renderThirdPartyIconGrid();
                    renderThirdPartyFilterUiState();
                }, thirdPartyIconSearchDebounceMs);
            });
            $('#fv-third-party-search-clear').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                if (thirdPartyIconSearchTimer) {
                    clearTimeout(thirdPartyIconSearchTimer);
                    thirdPartyIconSearchTimer = null;
                }
                thirdPartyIconSearchQuery = '';
                thirdPartyIconPage = 1;
                $('#fv-third-party-search').val('').trigger('focus');
                renderThirdPartyIconGrid();
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-view').off('change.fviconpicker').on('change.fviconpicker', async () => {
                await applyThirdPartyQuickMode(String($('#fv-third-party-view').val() || 'folder'));
            });
            $('#fv-third-party-sort').off('change.fviconpicker').on('change.fviconpicker', () => {
                thirdPartySortMode = String($('#fv-third-party-sort').val() || 'usage').trim().toLowerCase();
                thirdPartyIconPage = 1;
                renderThirdPartyFolderList();
                renderThirdPartyIconGrid();
            });
            $('#fv-third-party-pack-search').off('input.fviconpicker').on('input.fviconpicker', async (event) => {
                thirdPartyPackSearchQuery = String($(event.currentTarget).val() || '').trim();
                thirdPartyIconPage = 1;
                await reflowThirdPartyPackSelection();
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-pack-kind').off('change.fviconpicker').on('change.fviconpicker', async () => {
                const next = String($('#fv-third-party-pack-kind').val() || 'all').trim().toLowerCase();
                thirdPartyPackKind = (next === 'folders' || next === 'icons') ? next : 'all';
                thirdPartyIconPage = 1;
                await reflowThirdPartyPackSelection();
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-pack-select').off('change.fviconpicker').on('change.fviconpicker', async (event) => {
                const folder = String($(event.currentTarget).val() || '').trim();
                if (!folder) {
                    return;
                }
                thirdPartySelectedFolder = folder;
                await applyThirdPartyQuickMode('folder');
                thirdPartyIconPage = 1;
                setThirdPartyPackActionsOpen(false);
                renderThirdPartyPackMenu();
            });
            $('#fv-third-party-filter-toggle').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                setThirdPartyFilterSheetOpen(!thirdPartyFilterSheetOpen);
            });
            $('#fv-third-party-pack-actions-toggle').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                setThirdPartyPackActionsOpen(!thirdPartyPackActionsOpen);
            });
            $('#fv-third-party-tag-search').off('input.fviconpicker').on('input.fviconpicker', (event) => {
                thirdPartyTagSearchQuery = String($(event.currentTarget).val() || '').trim();
                renderThirdPartyTagFilters(getThirdPartyActiveBaseIcons());
            });
            $('#fv-third-party-tag-clear').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                thirdPartySelectedTags = new Set();
                renderThirdPartyTagFilters(getThirdPartyActiveBaseIcons());
                renderThirdPartyIconGrid();
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-filter-clear-all').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                thirdPartySelectedTags = new Set();
                thirdPartyTagSearchQuery = '';
                thirdPartyIconSearchQuery = '';
                thirdPartyPackSearchQuery = '';
                thirdPartyPackKind = 'all';
                thirdPartyShowHiddenFolders = false;
                $('#fv-third-party-tag-search').val('');
                $('#fv-third-party-search').val('');
                $('#fv-third-party-pack-search').val('');
                $('#fv-third-party-pack-kind').val('all');
                await reflowThirdPartyPackSelection();
                renderThirdPartyTagFilters(getThirdPartyActiveBaseIcons());
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-tag-filters').off('change.fviconpicker').on('change.fviconpicker', 'input[data-third-party-tag]', (event) => {
                const checkbox = $(event.currentTarget);
                const tag = String(checkbox.attr('data-third-party-tag') || '').trim().toLowerCase();
                if (!tag) {
                    return;
                }
                if (checkbox.is(':checked')) {
                    thirdPartySelectedTags.add(tag);
                } else {
                    thirdPartySelectedTags.delete(tag);
                }
                thirdPartyIconPage = 1;
                renderThirdPartyIconGrid();
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-pack-pin-toggle').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                const folder = String(thirdPartySelectedFolder || '').trim();
                if (!folder) {
                    return;
                }
                if (thirdPartyPinnedFolders.has(folder)) {
                    thirdPartyPinnedFolders.delete(folder);
                } else {
                    thirdPartyPinnedFolders.add(folder);
                }
                persistThirdPartyPreferences();
                renderThirdPartyFolderList();
                renderThirdPartyPackMenu();
            });
            $('#fv-third-party-pack-hide-toggle').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                const folder = String(thirdPartySelectedFolder || '').trim();
                if (!folder) {
                    return;
                }
                if (thirdPartyHiddenFolders.has(folder)) {
                    thirdPartyHiddenFolders.delete(folder);
                } else {
                    thirdPartyHiddenFolders.add(folder);
                }
                persistThirdPartyPreferences();
                thirdPartyIconPage = 1;
                await reflowThirdPartyPackSelection();
                renderThirdPartyPackMenu();
            });
            $('#fv-third-party-show-hidden').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                thirdPartyShowHiddenFolders = !thirdPartyShowHiddenFolders;
                await reflowThirdPartyPackSelection();
                renderThirdPartyFilterUiState();
            });
            $('#fv-third-party-duplicates-cleanup').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                const script = buildThirdPartyDuplicateCleanupScript();
                swal({
                    title: 'Duplicate cleanup helper',
                    text: `<div class="fv-custom-icon-ref-list"><p>Review these commands before running:</p><textarea style="width:100%;min-height:220px;">${escapeHtml(script)}</textarea></div>`,
                    html: true,
                    confirmButtonText: 'Close'
                });
            });
            $('#fv-custom-icon-refresh').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
                event.preventDefault();
                customIconPage = 1;
                await refreshCustomIconManager();
            });
            $('#fv-custom-icon-search').off('input.fviconpicker').on('input.fviconpicker', (event) => {
                if (customIconSearchTimer) {
                    clearTimeout(customIconSearchTimer);
                }
                customIconSearchQuery = String($(event.currentTarget).val() || '').trim();
                customIconPage = 1;
                customIconSearchTimer = setTimeout(async () => {
                    customIconSearchTimer = null;
                    await refreshCustomIconManager();
                }, customIconSearchDebounceMs);
            });
            $('#fv-icon-picker-search').off('input.fviconpicker').on('input.fviconpicker', (event) => {
                if (builtInIconSearchTimer) {
                    clearTimeout(builtInIconSearchTimer);
                }
                const value = String($(event.currentTarget).val() || '').trim();
                builtInIconSearchTimer = setTimeout(() => {
                    builtInIconSearchTimer = null;
                    builtInIconSearchQuery = value;
                    builtInIconPage = 1;
                    renderBuiltInIconPicker();
                }, iconPickerSearchDebounceMs);
            });
            $('#fv-icon-picker-clear').off('click.fviconpicker').on('click.fviconpicker', (event) => {
                event.preventDefault();
                if (builtInIconSearchTimer) {
                    clearTimeout(builtInIconSearchTimer);
                    builtInIconSearchTimer = null;
                }
                builtInIconSearchQuery = '';
                builtInIconPage = 1;
                $('#fv-icon-picker-search').val('');
                renderBuiltInIconPicker();
                $('#fv-icon-picker-search').trigger('focus');
            });

            const closeIconPickersFromOutside = (event) => {
                const target = $(event.target);
                const inThirdPartyPanel = target.closest('#fv-third-party-icon-panel').length > 0;
                if (inThirdPartyPanel && !target.closest('#fv-third-party-pack-actions-panel, #fv-third-party-pack-actions-toggle').length) {
                    setThirdPartyPackActionsOpen(false);
                }
                if (inThirdPartyPanel && !target.closest('#fv-third-party-filter-sheet, #fv-third-party-filter-toggle').length) {
                    setThirdPartyFilterSheetOpen(false);
                }
                if (!target.closest('#fv-icon-picker-panel, #fv-icon-picker-toggle, #fv-third-party-icon-panel, #fv-third-party-refresh, #fv-icon-third-party-toggle, #fv-custom-icon-panel, #fv-icon-custom-manager-toggle, #fv-custom-icon-refresh, #fv-icon-upload, #fv-icon-upload-file, #fv-icon-upload-progress').length) {
                    setBuiltInIconPickerOpen(false);
                    setThirdPartyIconPickerOpen(false);
                    setCustomIconPickerOpen(false);
                    setThirdPartyFilterSheetOpen(false);
                    setThirdPartyPackActionsOpen(false);
                }
            };

            $(doc)
                .off('mousedown.fviconpicker touchstart.fviconpicker pointerdown.fviconpicker')
                .on('pointerdown.fviconpicker', closeIconPickersFromOutside)
                .on('mousedown.fviconpicker touchstart.fviconpicker', closeIconPickersFromOutside);

            const iconInput = getIconInput();
            if (iconInput && iconInput.length) {
                iconInput.off('input.fviconpicker change.fviconpicker').on('input.fviconpicker change.fviconpicker', () => {
                    renderBuiltInIconPicker();
                    renderThirdPartyIconGrid();
                });
            }

            $('#fv-icon-picker-toggle').attr('aria-expanded', 'false');
            $('#fv-icon-third-party-toggle').attr('aria-expanded', 'false');
            $('#fv-icon-custom-manager-toggle').attr('aria-expanded', 'false');
            setBuiltInIconPickerOpen(false);
            setThirdPartyIconPickerOpen(false);
            setCustomIconPickerOpen(false);
            ensureThirdPartyPreferencesLoaded();
            $('#fv-third-party-sort').val(thirdPartySortMode);
            $('#fv-third-party-view').val(thirdPartyQuickMode);
            $('#fv-third-party-search').val(thirdPartyIconSearchQuery);
            $('#fv-third-party-pack-search').val(thirdPartyPackSearchQuery);
            $('#fv-third-party-pack-kind').val(thirdPartyPackKind);
            $('#fv-third-party-tag-search').val(thirdPartyTagSearchQuery);
            setThirdPartyFilterSheetOpen(false);
            setThirdPartyPackActionsOpen(false);
            setThirdPartyAdvancedMode(false);
            renderThirdPartyPackMenu();
            resetIconUploadProgress();
            setIconUploadStatus('');
            if (!builtInIconManifestLoaded) {
                await loadBuiltInIcons();
            }
            builtInIconPage = 1;
            renderBuiltInIconPicker();
            setBuiltInIconPickerOpen(true);
            renderThirdPartyFolderList();
            renderThirdPartyIconGrid();
            renderCustomIconStats();
            renderCustomIconList();
            scheduleInitialCustomIconManagerRefresh();
        };

        return Object.freeze({
            bindIconPickerEvents,
            renderBuiltInIconPicker
        });
    };

    return Object.freeze({
        createApi
    });
}));
