// list of element to select
let choose = [];
// element selected by the regex string
let selectedRegex = [];
// element selected manually
let selected = [];
// docker or vm?
const type = new URLSearchParams(location.search).get('type');
//id of the folder if present
const folderId = new URLSearchParams(location.search).get('id');
const DEFAULT_FOLDER_STATUS_COLORS = {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
};
const FOLDER_LABEL_KEYS = ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
const PREVIEW_MODE_LABELS = {
    0: 'None',
    1: 'Icon and label',
    2: 'Only icon',
    3: 'Only label',
    4: 'List'
};
const CONTEXT_MODE_LABELS = {
    0: 'None',
    1: 'Default',
    2: 'Advanced'
};
const SECTION_META = {
    general: { title: 'General', description: 'Folder identity, icon, and base behavior.' },
    members: { title: 'Members', description: 'Assign containers or VMs to this folder.' },
    preview: { title: 'Preview', description: 'Control how this folder is rendered in tab views.' },
    actions: { title: 'Actions', description: 'Configure quick actions exposed by this folder.' },
    automation: { title: 'Automation', description: 'Auto-assign items using name regex.' },
    advanced: { title: 'Advanced', description: 'Optional defaults and tab behavior.' }
};
const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
const BUILT_IN_ICON_MANIFEST_PATH = '/plugins/folderview.plus/images/icons/icons.json';
const THIRD_PARTY_ICON_API_PATH = '/plugins/folderview.plus/server/third_party_icons.php';
const CUSTOM_ICON_UPLOAD_API_PATH = '/plugins/folderview.plus/server/upload_custom_icon.php';
const REQUEST_TOKEN_STORAGE_KEY = 'fv.request.token';
const ICON_PICKER_PAGE_SIZE = 120;
const ICON_PICKER_SEARCH_DEBOUNCE_MS = 120;
const BUILT_IN_ICON_FALLBACK = [{
    id: 'default-folder',
    name: 'Default Folder',
    path: DEFAULT_FOLDER_ICON_PATH,
    tags: ['default', 'folder']
}];

let existingFolderNames = new Set();
let allFolderNames = new Set();
let currentFolderName = '';
let initialSnapshot = '';
let isFormInitialized = false;
let suppressUnloadPrompt = false;
let builtInIcons = [...BUILT_IN_ICON_FALLBACK];
let builtInIconSearchQuery = '';
let builtInIconPage = 1;
let builtInIconSearchTimer = null;
let thirdPartyIconFolders = [];
let thirdPartySelectedFolder = '';
let thirdPartyIcons = [];
let thirdPartyIconPage = 1;

const getFolderLabelValue = (labels) => {
    const source = labels && typeof labels === 'object' ? labels : {};
    for (const key of FOLDER_LABEL_KEYS) {
        if (typeof source[key] === 'string' && source[key].trim() !== '') {
            return source[key].trim();
        }
    }
    return '';
};

const rgbToHex = (rgb) => {
    rgb = rgb.slice(4, -1).split(', ');
    return "#" + (1 << 24 | rgb[0] << 16 | rgb[1] << 8 | rgb[2]).toString(16).slice(1);
}

const normalizeHexColor = (value, fallback) => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
        return fallback;
    }
    if (trimmed.length === 4) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return trimmed.toLowerCase();
};

const getForm = () => $('div.canvas > form')[0];

const escapeHtml = (value) => {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseJsonPayload = (value) => {
    if (typeof value === 'string') {
        return JSON.parse(value.replace(/^\uFEFF/, ''));
    }
    return value;
};

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

const fallbackFilterIconsByQuery = (icons, query) => {
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

const iconPickerRuntime = window.FolderViewIconPickerRuntime || {
    paginateItems: fallbackPaginateItems,
    filterIconsByQuery: fallbackFilterIconsByQuery
};

const paginateItems = (items, page, pageSize) => iconPickerRuntime.paginateItems(items, page, pageSize);
const filterIconItems = (icons, query) => iconPickerRuntime.filterIconsByQuery(icons, query);

const getOptionalRequestToken = () => {
    const metaToken = document.querySelector('meta[name="fv-request-token"]');
    if (metaToken instanceof HTMLMetaElement) {
        return String(metaToken.content || '').trim();
    }
    try {
        return String(localStorage.getItem(REQUEST_TOKEN_STORAGE_KEY) || '').trim();
    } catch (_error) {
        return '';
    }
};

const normalizeBuiltInIconEntry = (entry, basePath) => {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const id = String(entry.id || entry.name || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    if (!id) {
        return null;
    }
    const file = String(entry.file || '').trim();
    const path = String(entry.path || '').trim() || (file ? `${basePath}${file}` : '');
    if (!path) {
        return null;
    }
    const name = String(entry.name || id).trim() || id;
    const tags = asArray(entry.tags).map((tag) => String(tag || '').trim().toLowerCase()).filter((tag) => tag !== '');
    return { id, name, path, tags };
};

const normalizeBuiltInIconManifest = (payload) => {
    const source = (payload && typeof payload === 'object') ? payload : {};
    const basePath = String(source.basePath || '/plugins/folderview.plus/images/icons/').trim();
    const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const icons = asArray(source.icons)
        .map((entry) => normalizeBuiltInIconEntry(entry, normalizedBase))
        .filter(Boolean);
    if (icons.length === 0) {
        return [...BUILT_IN_ICON_FALLBACK];
    }
    return icons;
};

const getIconInput = () => $(getForm()?.icon);

const getCurrentIconValue = () => String(getIconInput().val() || '').trim();

const setIconInputValue = (value) => {
    const input = getIconInput();
    if (!input.length) {
        return;
    }
    input.val(value || '');
    input.trigger('input');
    input.trigger('change');
};

const setIconUploadStatus = (message, isError = false) => {
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

const uploadCustomIconFile = async (file) => {
    if (!file || typeof file.name !== 'string') {
        throw new Error('No icon file selected.');
    }

    const token = getOptionalRequestToken();
    const formData = new FormData();
    formData.append('icon', file);
    if (token) {
        formData.append('token', token);
    }

    const headers = { 'X-FV-Request': '1' };
    if (token) {
        headers['X-FV-Token'] = token;
    }

    const response = await $.ajax({
        url: CUSTOM_ICON_UPLOAD_API_PATH,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        headers
    }).promise();

    const payload = parseJsonPayload(response);
    if (!payload || payload.ok !== true) {
        throw new Error(String(payload?.error || 'Upload failed.'));
    }

    const url = String(payload.url || '').trim();
    if (!url) {
        throw new Error('Upload did not return an icon URL.');
    }

    return {
        name: String(payload.name || file.name).trim() || file.name,
        url
    };
};

const setBuiltInIconPickerOpen = (open) => {
    const panel = $('#fv-icon-picker-panel');
    const toggle = $('#fv-icon-picker-toggle');
    if (!panel.length || !toggle.length) {
        return;
    }
    panel.prop('hidden', !open);
    toggle.attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-open', open);
};

const setThirdPartyIconPickerOpen = (open) => {
    const panel = $('#fv-third-party-icon-panel');
    const toggle = $('#fv-icon-third-party-toggle');
    if (!panel.length || !toggle.length) {
        return;
    }
    panel.prop('hidden', !open);
    toggle.attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-open', open);
};

const renderBuiltInIconPicker = () => {
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
    const paged = paginateItems(filtered, builtInIconPage, ICON_PICKER_PAGE_SIZE);
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
                <img src="${safePath}" alt="${safeName}" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">
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

const renderThirdPartyFolderList = () => {
    const list = $('#fv-third-party-folder-list');
    const status = $('#fv-third-party-icon-status');
    if (!list.length || !status.length) {
        return;
    }
    if (!thirdPartyIconFolders.length) {
        list.html('<div class="fv-icon-picker-empty">No folders found. Add folders under /usr/local/emhttp/plugins/folderview.plus/images/third-party-icons.</div>');
        status.text('No third-party icon folders detected.');
        return;
    }
    const rows = thirdPartyIconFolders.map((folder) => {
        const name = escapeHtml(folder.name || '');
        const count = Number(folder.iconCount || 0);
        const active = folder.name === thirdPartySelectedFolder ? ' is-active' : '';
        return `
            <button type="button" class="fv-third-party-folder${active}" data-third-party-folder="${name}">
                <span class="fv-third-party-folder-name">${name}</span>
                <span class="fv-third-party-folder-count">${count}</span>
            </button>
        `;
    }).join('');
    list.html(rows);
    list.find('.fv-third-party-folder').off('click').on('click', async (event) => {
        event.preventDefault();
        const folder = String($(event.currentTarget).attr('data-third-party-folder') || '').trim();
        if (!folder) {
            return;
        }
        await loadThirdPartyIcons(folder);
    });
};

const renderThirdPartyIconGrid = () => {
    const grid = $('#fv-third-party-icon-grid');
    const header = $('#fv-third-party-current-folder');
    const status = $('#fv-third-party-icon-status');
    const prevButton = $('#fv-third-party-icon-prev');
    const nextButton = $('#fv-third-party-icon-next');
    const pageLabel = $('#fv-third-party-icon-page-label');
    if (!grid.length || !header.length || !status.length) {
        return;
    }

    const setPager = (page, totalPages) => {
        if (!prevButton.length || !nextButton.length || !pageLabel.length) {
            return;
        }
        prevButton.prop('disabled', page <= 1);
        nextButton.prop('disabled', page >= totalPages);
        pageLabel.text(`Page ${page} / ${totalPages}`);
    };

    if (!thirdPartySelectedFolder) {
        header.text('Select a folder to browse icons.');
        grid.empty();
        setPager(1, 1);
        return;
    }
    header.text(`Folder: ${thirdPartySelectedFolder}`);

    if (!thirdPartyIcons.length) {
        grid.html('<div class="fv-icon-picker-empty">No supported icon files found in this folder.</div>');
        status.text(`Folder "${thirdPartySelectedFolder}" has 0 supported icon files.`);
        setPager(1, 1);
        return;
    }

    const paged = paginateItems(thirdPartyIcons, thirdPartyIconPage, ICON_PICKER_PAGE_SIZE);
    thirdPartyIconPage = paged.page;
    setPager(paged.page, paged.totalPages);
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

    const currentValue = getCurrentIconValue();
    const rows = paged.items.map((icon) => {
        const selected = currentValue === icon.url ? ' is-selected' : '';
        const safeUrl = escapeHtml(icon.url);
        const safeName = escapeHtml(icon.name);
        return `
            <button type="button" class="fv-icon-picker-item${selected}" data-icon-value="${safeUrl}" title="${safeName}">
                <img src="${safeUrl}" alt="${safeName}" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">
                <span class="fv-icon-picker-item-name">${safeName}</span>
            </button>
        `;
    }).join('');
    grid.html(rows);
    status.text(`Showing ${paged.startIndex + 1}-${paged.endIndex} of ${thirdPartyIcons.length} icon${thirdPartyIcons.length === 1 ? '' : 's'} in "${thirdPartySelectedFolder}".`);
    grid.find('.fv-icon-picker-item').off('click').on('click', (event) => {
        event.preventDefault();
        const value = String($(event.currentTarget).attr('data-icon-value') || '').trim();
        if (!value) {
            return;
        }
        setIconInputValue(value);
    });
};

const loadThirdPartyFolders = async () => {
    const response = await $.get(THIRD_PARTY_ICON_API_PATH, { action: 'list_folders' }).promise();
    const payload = parseJsonPayload(response);
    if (!payload || payload.ok !== true) {
        throw new Error(String(payload?.error || 'Failed to load third-party icon folders.'));
    }
    thirdPartyIconFolders = asArray(payload.folders).map((entry) => ({
        name: String(entry?.name || '').trim(),
        iconCount: Number(entry?.iconCount || 0)
    })).filter((entry) => entry.name !== '');
    if (thirdPartySelectedFolder && !thirdPartyIconFolders.some((entry) => entry.name === thirdPartySelectedFolder)) {
        thirdPartySelectedFolder = '';
        thirdPartyIcons = [];
    }
};

const loadThirdPartyIcons = async (folderName) => {
    const folder = String(folderName || '').trim();
    if (!folder) {
        return;
    }
    const response = await $.get(THIRD_PARTY_ICON_API_PATH, { action: 'list_icons', folder }).promise();
    const payload = parseJsonPayload(response);
    if (!payload || payload.ok !== true) {
        throw new Error(String(payload?.error || 'Failed to load icons for selected folder.'));
    }
    thirdPartySelectedFolder = String(payload.folder || folder);
    thirdPartyIcons = asArray(payload.icons).map((entry) => ({
        name: String(entry?.name || '').trim(),
        url: String(entry?.url || '').trim()
    })).filter((entry) => entry.name !== '' && entry.url !== '');
    thirdPartyIconPage = 1;
    renderThirdPartyFolderList();
    renderThirdPartyIconGrid();
};

const refreshThirdPartyIconPicker = async () => {
    const status = $('#fv-third-party-icon-status');
    if (status.length) {
        status.text('Refreshing third-party icon folders...');
    }
    try {
        await loadThirdPartyFolders();
        renderThirdPartyFolderList();
        renderThirdPartyIconGrid();
        if (!thirdPartySelectedFolder && thirdPartyIconFolders.length > 0) {
            await loadThirdPartyIcons(thirdPartyIconFolders[0].name);
        }
    } catch (error) {
        if (status.length) {
            status.text(`Error: ${error.message}`);
        }
    }
};

const loadBuiltInIcons = async () => {
    try {
        const response = await $.get(BUILT_IN_ICON_MANIFEST_PATH).promise();
        const payload = (typeof response === 'string')
            ? JSON.parse(response.replace(/^\uFEFF/, ''))
            : response;
        builtInIcons = normalizeBuiltInIconManifest(payload);
    } catch (_error) {
        builtInIcons = [...BUILT_IN_ICON_FALLBACK];
    }
    builtInIconPage = 1;
};

const initBuiltInIconPicker = async () => {
    const panel = $('#fv-icon-picker-panel');
    if (!panel.length) {
        return;
    }

    await loadBuiltInIcons();
    $('#fv-icon-picker-toggle').off('click.fviconpicker').on('click.fviconpicker', (event) => {
        event.preventDefault();
        const isOpen = !panel.prop('hidden');
        setThirdPartyIconPickerOpen(false);
        setBuiltInIconPickerOpen(!isOpen);
        if (!isOpen) {
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
        setThirdPartyIconPickerOpen(!isOpen);
        if (!isOpen) {
            await refreshThirdPartyIconPicker();
        }
    });
    $('#fv-icon-picker-default').off('click.fviconpicker').on('click.fviconpicker', (event) => {
        event.preventDefault();
        setIconInputValue(DEFAULT_FOLDER_ICON_PATH);
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

        const uploadButton = $('#fv-icon-upload');
        const safeName = String(file.name || 'icon').trim() || 'icon';
        uploadButton.prop('disabled', true);
        setIconUploadStatus(`Uploading "${safeName}"...`);

        try {
            const result = await uploadCustomIconFile(file);
            setIconInputValue(result.url);
            setIconUploadStatus(`Uploaded "${result.name}" and set as icon.`);
        } catch (error) {
            setIconUploadStatus(`Upload failed: ${error.message || 'Unknown error.'}`, true);
        } finally {
            uploadButton.prop('disabled', false);
            $(input).val('');
        }
    });
    $('#fv-third-party-refresh').off('click.fviconpicker').on('click.fviconpicker', async (event) => {
        event.preventDefault();
        await refreshThirdPartyIconPicker();
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
        }, ICON_PICKER_SEARCH_DEBOUNCE_MS);
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
        if (!target.closest('#fv-icon-picker-panel, #fv-icon-picker-toggle, #fv-third-party-icon-panel, #fv-icon-third-party-toggle, #fv-icon-upload, #fv-icon-upload-file').length) {
            setBuiltInIconPickerOpen(false);
            setThirdPartyIconPickerOpen(false);
        }
    };
    $(document)
        .off('mousedown.fviconpicker touchstart.fviconpicker pointerdown.fviconpicker')
        .on('pointerdown.fviconpicker', closeIconPickersFromOutside)
        .on('mousedown.fviconpicker touchstart.fviconpicker', closeIconPickersFromOutside);
    getIconInput().off('input.fviconpicker change.fviconpicker').on('input.fviconpicker change.fviconpicker', () => {
        renderBuiltInIconPicker();
        renderThirdPartyIconGrid();
    });

    $('#fv-icon-picker-toggle').attr('aria-expanded', 'false');
    $('#fv-icon-third-party-toggle').attr('aria-expanded', 'false');
    setBuiltInIconPickerOpen(false);
    setThirdPartyIconPickerOpen(false);
    setIconUploadStatus('');
    renderBuiltInIconPicker();
    renderThirdPartyFolderList();
    renderThirdPartyIconGrid();
};

const getAllMembers = () => {
    const map = new Map();
    [...selectedRegex, ...selected, ...choose].forEach((member) => {
        if (!map.has(member.Name)) {
            map.set(member.Name, member);
        }
    });
    return [...map.values()];
};

const computeFormSnapshot = () => {
    const form = getForm();
    const state = {
        fields: {},
        members: [],
        actions: $('input[name*="custom_action"]').map((_, el) => $(el).val()).get()
    };

    $(form).find(':input[name]').each((_, element) => {
        if (!element.name) {
            return;
        }

        const value = element.type === 'checkbox' ? element.checked : $(element).val();
        if (Object.prototype.hasOwnProperty.call(state.fields, element.name)) {
            if (!Array.isArray(state.fields[element.name])) {
                state.fields[element.name] = [state.fields[element.name]];
            }
            state.fields[element.name].push(value);
        } else {
            state.fields[element.name] = value;
        }
    });

    $('table.sortable > tbody > tr').each((_, row) => {
        const input = $(row).find('input.container-switch');
        state.members.push({
            name: $(row).attr('data-name') || '',
            included: input.prop('checked'),
            locked: input.prop('disabled')
        });
    });

    return JSON.stringify(state);
};

const updateUnsavedIndicator = () => {
    const current = computeFormSnapshot();
    const dirty = Boolean(initialSnapshot) && current !== initialSnapshot;
    $('#unsavedIndicator').toggle(dirty);
    return dirty;
};

const markCleanState = () => {
    initialSnapshot = computeFormSnapshot();
    updateUnsavedIndicator();
};

const registerBeforeUnloadGuard = () => {
    window.addEventListener('beforeunload', (event) => {
        if (suppressUnloadPrompt || !updateUnsavedIndicator()) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    });
};

const resetStatusColorDefaults = () => {
    const form = $('div.canvas > form')[0];
    form.status_color_started.value = DEFAULT_FOLDER_STATUS_COLORS.started;
    form.status_color_paused.value = DEFAULT_FOLDER_STATUS_COLORS.paused;
    form.status_color_stopped.value = DEFAULT_FOLDER_STATUS_COLORS.stopped;
};
window.resetStatusColorDefaults = resetStatusColorDefaults;

const setFieldError = (fieldName, message) => {
    const form = getForm();
    const input = $(form?.elements?.[fieldName]);
    if (!input.length) {
        return;
    }
    const dd = input.closest('dd');
    if (!dd.length) {
        return;
    }

    let error = dd.find(`.fv-field-error[data-field="${fieldName}"]`);
    if (!error.length) {
        error = $(`<div class="fv-field-error" data-field="${fieldName}" style="display:none;"></div>`);
        dd.append(error);
    }

    if (message) {
        error.text(message).show();
        input.addClass('fv-input-error');
    } else {
        error.hide().text('');
        input.removeClass('fv-input-error');
    }
};

const validateNameField = () => {
    const form = getForm();
    const value = (form.name.value || '').trim();
    const lower = value.toLowerCase();

    if (!value) {
        setFieldError('name', 'Folder name is required.');
        return false;
    }

    if (!/^[a-zA-Z0-9_. \-]+$/.test(value)) {
        setFieldError('name', 'Use letters, numbers, spaces, ., _, and - only.');
        return false;
    }

    if (existingFolderNames.has(lower) && lower !== currentFolderName.toLowerCase()) {
        setFieldError('name', 'A folder with this name already exists.');
        return false;
    }

    setFieldError('name', '');
    return true;
};

const validateRegexField = () => {
    const form = getForm();
    const value = (form.regex.value || '').trim();
    if (!value) {
        setFieldError('regex', '');
        return true;
    }
    try {
        // eslint-disable-next-line no-new
        new RegExp(value);
        setFieldError('regex', '');
        return true;
    } catch (error) {
        setFieldError('regex', `Invalid regex: ${error.message}`);
        return false;
    }
};

const validateFolderWebUiUrl = () => {
    const form = getForm();
    const enabled = form.folder_webui.checked;
    const value = (form.folder_webui_url.value || '').trim();
    if (!enabled || !value) {
        setFieldError('folder_webui_url', '');
        return true;
    }
    try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) {
            throw new Error('URL must start with http:// or https://');
        }
        setFieldError('folder_webui_url', '');
        return true;
    } catch (error) {
        setFieldError('folder_webui_url', `Invalid URL: ${error.message}`);
        return false;
    }
};

const validateContextGraphTime = () => {
    const form = getForm();
    const contextIsAdvanced = form.context.value === '2';
    const graphEnabled = form.context_graph.value !== '0';
    const value = Number(form.context_graph_time.value || 0);
    if (!contextIsAdvanced || !graphEnabled) {
        setFieldError('context_graph_time', '');
        return true;
    }
    if (!Number.isInteger(value) || value <= 0) {
        setFieldError('context_graph_time', 'Time frame must be a positive integer.');
        return false;
    }
    setFieldError('context_graph_time', '');
    return true;
};

const validateHealthWarnThreshold = () => {
    const form = getForm();
    const input = form.health_warn_stopped_percent;
    if (!input) {
        return true;
    }
    const raw = String(input.value || '').trim();
    if (!raw) {
        setFieldError('health_warn_stopped_percent', '');
        return true;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setFieldError('health_warn_stopped_percent', 'Threshold must be an integer between 0 and 100.');
        return false;
    }
    setFieldError('health_warn_stopped_percent', '');
    return true;
};

const validateForm = () => {
    const valid = [
        validateNameField(),
        validateRegexField(),
        validateFolderWebUiUrl(),
        validateContextGraphTime(),
        validateHealthWarnThreshold()
    ].every(Boolean);

    const summary = $('#fvValidationSummary');
    if (summary.length) {
        summary.toggleClass('invalid', !valid).text(valid ? 'All checks passed.' : 'Fix highlighted fields before saving.');
    }
    $('.folder-btn-submit, .folder-btn-copy').prop('disabled', !valid);
    return valid;
};

const updateMemberStats = () => {
    const rows = $('table.sortable > tbody > tr');
    const total = rows.length;
    const included = rows.find('input.container-switch:checked').length;
    const visible = rows.filter(':visible').length;
    const text = `${included}/${total} included` + (visible !== total ? ` (${visible} shown)` : '');
    $('#fvMemberStats').text(text);
    $('#fvLiveMembers').text(text);
};

const applyMemberFilters = () => {
    const query = ($('#fvMemberSearch').val() || '').trim().toLowerCase();
    const filter = $('#fvMemberFilter').val() || 'all';

    $('table.sortable > tbody > tr').each((_, row) => {
        const $row = $(row);
        const name = ($row.attr('data-name') || '').toLowerCase();
        const membership = $row.attr('data-membership');
        const included = $row.find('input.container-switch').prop('checked');
        const matchesQuery = !query || name.includes(query);

        let matchesFilter = true;
        if (filter === 'included') {
            matchesFilter = included;
        } else if (filter === 'excluded') {
            matchesFilter = !included;
        } else if (filter === 'regex') {
            matchesFilter = membership === 'regex';
        } else if (filter === 'manual') {
            matchesFilter = membership === 'manual';
        }

        $row.toggle(matchesQuery && matchesFilter);
    });

    updateMemberStats();
};

const syncMemberArraysFromTable = () => {
    const rows = $('table.sortable > tbody > tr');
    if (!rows.length) {
        return;
    }
    const memberMap = new Map(getAllMembers().map((member) => [member.Name, member]));
    const nextSelected = [];
    const nextChoose = [];
    const nextSelectedRegex = [];

    rows.each((_, row) => {
        const name = $(row).attr('data-name');
        const member = memberMap.get(name);
        if (!member) {
            return;
        }
        const membership = $(row).attr('data-membership');
        const checked = $(row).find('input.container-switch').prop('checked');
        if (membership === 'regex') {
            nextSelectedRegex.push(member);
        } else if (checked) {
            nextSelected.push(member);
        } else {
            nextChoose.push(member);
        }
    });

    selected = nextSelected;
    choose = nextChoose;
    selectedRegex = nextSelectedRegex;
};

const moveMemberRow = (button, direction) => {
    const row = $(button).closest('tr');
    if (!row.length) {
        return;
    }
    if (direction === 'up') {
        const prev = row.prev('tr');
        if (prev.length) {
            prev.before(row);
        }
    } else {
        const next = row.next('tr');
        if (next.length) {
            next.after(row);
        }
    }
    if (isFormInitialized) {
        updateUnsavedIndicator();
    }
};

const applyAdvancedMode = () => {
    const checkbox = $('#fvShowAdvanced');
    if (!checkbox.length) {
        return;
    }
    const showAdvanced = checkbox.prop('checked');
    localStorage.setItem('fv.folder.editor.showAdvanced', showAdvanced ? '1' : '0');
    $('.fv-advanced-setting').toggleClass('fv-advanced-hidden', !showAdvanced);
};

const enforceLeftAlignedSettingsLayout = () => {
    try {
        const isMobile = window.innerWidth <= 980;
        const form = document.querySelector('div.canvas > form.folder-editor-form');
        if (!form) {
            return;
        }

        // fv-force-left-v2 marker: retained for release guard compatibility.
        // fv-force-left-v3 marker: hard-force stable left grid layout.
        form.classList.add('fv-force-left-v3');

        const setImportant = (el, property, value) => {
            if (!el) {
                return;
            }
            el.style.setProperty(property, value, 'important');
        };

        Array.from(form.children).forEach((row) => {
            const isBasicRow = row.classList?.contains('basic') && !row.classList.contains('order-section');
            const isListRow = row.tagName === 'UL';
            if (!isBasicRow && !isListRow) {
                return;
            }
            setImportant(row, 'width', 'calc(100% - 2em)');
            setImportant(row, 'max-width', 'none');
            setImportant(row, 'margin-left', '1em');
            setImportant(row, 'margin-right', '0');
            setImportant(row, 'box-sizing', 'border-box');
        });

        form.querySelectorAll('ul .basic').forEach((row) => {
            if (row.classList.contains('order-section')) {
                return;
            }
            setImportant(row, 'width', '100%');
            setImportant(row, 'max-width', 'none');
            setImportant(row, 'margin-left', '0');
            setImportant(row, 'margin-right', '0');
        });

        form.querySelectorAll('.basic:not(.order-section) > dl').forEach((dl) => {
            setImportant(dl, 'display', 'grid');
            setImportant(dl, 'grid-template-columns', isMobile ? '1fr' : 'minmax(150px, 200px) minmax(280px, 640px)');
            setImportant(dl, 'column-gap', isMobile ? '0.4em' : '0.85em');
            setImportant(dl, 'row-gap', isMobile ? '0.4em' : '0');
            setImportant(dl, 'align-items', 'center');
            setImportant(dl, 'justify-content', 'start');
            setImportant(dl, 'width', '100%');
            setImportant(dl, 'max-width', 'none');
            setImportant(dl, 'margin-left', '0');
            setImportant(dl, 'margin-right', '0');

            const dt = dl.getElementsByTagName('dt')[0];
            setImportant(dt, 'float', 'none');
            setImportant(dt, 'width', 'auto');
            setImportant(dt, 'text-align', 'left');
            setImportant(dt, 'margin', '0');
            setImportant(dt, 'padding', '0');

            const dd = dl.getElementsByTagName('dd')[0];
            setImportant(dd, 'float', 'none');
            setImportant(dd, 'width', 'auto');
            setImportant(dd, 'margin', '0');
            setImportant(dd, 'min-width', '0');
            setImportant(dd, 'text-align', 'left');

            if (dd) {
                dd.querySelectorAll('input[type="text"], input[type="number"], select, textarea').forEach((field) => {
                    setImportant(field, 'margin-left', '0');
                    setImportant(field, 'margin-right', 'auto');
                });
                dd.querySelectorAll('.switch-button, .switch-button-background, .switch-button-button').forEach((toggle) => {
                    setImportant(toggle, 'margin-left', '0');
                    setImportant(toggle, 'margin-right', 'auto');
                    setImportant(toggle, 'float', 'none');
                });
            }
        });

        form.querySelectorAll('.basic > blockquote.inline_help').forEach((help) => {
            setImportant(help, 'width', '100%');
            setImportant(help, 'max-width', 'none');
            setImportant(help, 'margin-left', '0');
            setImportant(help, 'margin-right', '0');
        });
    } catch (_error) {
        // Do not block folder editor if layout overrides fail on older browsers.
    }
};

const updateLiveSummary = () => {
    const form = getForm();
    if (!form) {
        return;
    }
    $('#fvLiveName').text((form.name.value || '').trim() || '(unnamed)');
    $('#fvLivePreview').text(PREVIEW_MODE_LABELS[Number(form.preview.value)] || 'Unknown');
    $('#fvLiveContext').text(CONTEXT_MODE_LABELS[Number(form.context.value)] || 'Unknown');
    $('#fvSwatchStarted').css('background-color', normalizeHexColor(form.status_color_started.value, DEFAULT_FOLDER_STATUS_COLORS.started));
    $('#fvSwatchPaused').css('background-color', normalizeHexColor(form.status_color_paused.value, DEFAULT_FOLDER_STATUS_COLORS.paused));
    $('#fvSwatchStopped').css('background-color', normalizeHexColor(form.status_color_stopped.value, DEFAULT_FOLDER_STATUS_COLORS.stopped));
    updateMemberStats();
};

const updateRegexSimulator = () => {
    const form = getForm();
    if (!form) {
        return;
    }

    const regexSource = (form.regex.value || '').trim();
    const probe = ($('#fvRegexSimulatorInput').val() || '').trim();
    const result = $('#fvRegexSimulatorResult');
    const meta = $('#fvRegexSimulatorMeta');

    if (!regexSource) {
        result.removeClass('match no-match error').text('No regex configured.');
        meta.text('');
        return;
    }

    let regex;
    try {
        regex = new RegExp(regexSource);
    } catch (error) {
        result.removeClass('match no-match').addClass('error').text(`Regex error: ${error.message}`);
        meta.text('');
        return;
    }

    const names = getAllMembers().map((member) => member.Name);
    const matches = [];
    names.forEach((name) => {
        regex.lastIndex = 0;
        if (regex.test(name)) {
            matches.push(name);
        }
    });

    if (probe) {
        regex.lastIndex = 0;
        const matched = regex.test(probe);
        result
            .removeClass('error')
            .toggleClass('match', matched)
            .toggleClass('no-match', !matched)
            .text(matched ? `"${probe}" matches.` : `"${probe}" does not match.`);
    } else {
        result.removeClass('error no-match').addClass('match').text('Enter a name above to test one item.');
    }

    const preview = matches.slice(0, 6).join(', ');
    meta.text(`${matches.length}/${names.length} members match.` + (preview ? ` Sample: ${preview}` : ''));
};

const applySectionTags = () => {
    $('[data-editor-section]').removeAttr('data-editor-section');
    $('.fv-advanced-setting').removeClass('fv-advanced-setting');

    const markSection = (selector, section) => $(selector).attr('data-editor-section', section);
    const markAdvanced = (selector) => $(selector).addClass('fv-advanced-setting');

    markSection('div.basic:has([name="name"])', 'general');
    markSection('div.basic:has([name="icon"])', 'general');
    markSection('div.basic:has([name="folder_webui"])', 'general');
    markSection('ul:has([name="folder_webui_url"])', 'general');

    markSection('div.basic.order-section', 'members');

    markSection('div.basic:has([name="preview"])', 'preview');
    markSection('ul:has([name="preview_hover"])', 'preview');
    markSection('div.basic:has([name="status_color_started"])', 'preview');
    markSection('div.basic:has([name="health_warn_stopped_percent"])', 'preview');

    markSection('div.basic.custom-action-wrapper-parent', 'actions');
    markSection('div.basic:has(a.custom-action)', 'actions');

    markSection('div.basic:has([name="regex"])', 'automation');

    markSection('div.basic:has([name="update_column"])', 'advanced');
    markSection('div.basic:has([name="override_default_actions"])', 'advanced');
    markSection('div.basic:has([name="default_action"])', 'advanced');
    markSection('div.basic:has([name="expand_tab"])', 'advanced');
    markSection('div.basic:has([name="expand_dashboard"])', 'advanced');

    markAdvanced('ul:has([name="folder_webui_url"])');
    markAdvanced('ul:has([name="preview_hover"])');
    markAdvanced('div.basic:has([name="health_warn_stopped_percent"])');
    markAdvanced('div.basic:has([name="update_column"])');
    markAdvanced('div.basic:has([name="override_default_actions"])');
    markAdvanced('div.basic:has([name="default_action"])');
    markAdvanced('div.basic:has([name="expand_tab"])');
    markAdvanced('div.basic:has([name="expand_dashboard"])');
    markAdvanced('div.basic.custom-action-wrapper-parent');
    markAdvanced('div.basic:has(a.custom-action)');
};

const initEditorChrome = () => {
    const form = $('div.canvas > form');
    if (!form.length) {
        return;
    }

    if (!$('#fvEditorChrome').length) {
        const navButtons = Object.entries(SECTION_META)
            .map(([key, section]) => `<button type="button" data-target="${key}">${section.title}</button>`)
            .join('');
        form.prepend(`
            <div id="fvEditorChrome" class="fv-editor-chrome">
                <div class="fv-editor-nav-row">
                    <div class="fv-section-nav">${navButtons}</div>
                    <label class="fv-advanced-toggle"><input type="checkbox" id="fvShowAdvanced">Show advanced</label>
                </div>
                <div class="fv-editor-status-row">
                    <span id="fvValidationSummary" class="fv-validation-summary">All checks passed.</span>
                </div>
            </div>
            <div id="fvLivePanel" class="fv-live-panel">
                <div class="fv-live-grid">
                    <span><strong>Name:</strong> <span id="fvLiveName">-</span></span>
                    <span><strong>Preview:</strong> <span id="fvLivePreview">-</span></span>
                    <span><strong>Context:</strong> <span id="fvLiveContext">-</span></span>
                    <span><strong>Members:</strong> <span id="fvLiveMembers">0/0 included</span></span>
                </div>
                <div class="fv-live-swatches">
                    <span class="fv-swatch-item"><em>Started</em><i id="fvSwatchStarted"></i></span>
                    <span class="fv-swatch-item"><em>Paused</em><i id="fvSwatchPaused"></i></span>
                    <span class="fv-swatch-item"><em>Stopped</em><i id="fvSwatchStopped"></i></span>
                </div>
                <div class="fv-regex-simulator">
                    <label for="fvRegexSimulatorInput"><strong>Regex simulator</strong></label>
                    <input type="text" id="fvRegexSimulatorInput" placeholder="Test a container or VM name">
                    <span id="fvRegexSimulatorResult" class="fv-regex-result">No regex configured.</span>
                </div>
                <div id="fvRegexSimulatorMeta" class="fv-regex-meta"></div>
            </div>
        `);
    }

    if (!$('#fvMemberTools').length) {
        $('.basic.order-section dd').prepend(`
            <div id="fvMemberTools" class="fv-member-tools">
                <input type="text" id="fvMemberSearch" placeholder="Search members">
                <select id="fvMemberFilter">
                    <option value="all">All</option>
                    <option value="included">Included</option>
                    <option value="excluded">Excluded</option>
                    <option value="regex">Regex included</option>
                    <option value="manual">Manually included</option>
                </select>
                <button type="button" id="fvMemberClear">Clear</button>
                <span id="fvMemberStats" class="fv-member-stats">0/0 included</span>
            </div>
        `);
    }

    $('.fv-section-heading').remove();
    Object.entries(SECTION_META).forEach(([key, section]) => {
        const first = $(`[data-editor-section="${key}"]`).first();
        if (!first.length) {
            return;
        }
        first.before(`
            <div class="fv-section-heading" id="fv-section-${key}">
                <h3>${section.title}</h3>
                <p>${section.description}</p>
            </div>
        `);
    });

    $('.fv-section-nav button').off('click').on('click', function onSectionClick() {
        const target = $(this).data('target');
        const heading = document.getElementById(`fv-section-${target}`);
        if (!heading) {
            return;
        }
        const offset = 72;
        const top = heading.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    });

    $('#fvMemberSearch').off('input').on('input', applyMemberFilters);
    $('#fvMemberFilter').off('change').on('change', applyMemberFilters);
    $('#fvMemberClear').off('click').on('click', () => {
        $('#fvMemberSearch').val('');
        $('#fvMemberFilter').val('all');
        applyMemberFilters();
    });

    const advancedPref = localStorage.getItem('fv.folder.editor.showAdvanced');
    $('#fvShowAdvanced').prop('checked', advancedPref === '1');
    $('#fvShowAdvanced').off('change').on('change', () => {
        updateForm();
        applyAdvancedMode();
        if (isFormInitialized) {
            updateUnsavedIndicator();
        }
    });
    $('#fvRegexSimulatorInput').off('input').on('input', updateRegexSimulator);

    enforceLeftAlignedSettingsLayout();
    setTimeout(enforceLeftAlignedSettingsLayout, 50);
    setTimeout(enforceLeftAlignedSettingsLayout, 250);
};

getForm().preview_border_color.value = rgbToHex($('body').css('color'));
getForm().preview_vertical_bars_color.value = rgbToHex($('body').css('color'));
resetStatusColorDefaults();

(async () => {
    registerBeforeUnloadGuard();
    // if editing a vm hide docker related settings
    if (type !== 'docker') {
        $('[constraint*="docker"]').hide();
    }
    // get folders
    let folders = JSON.parse(await $.get(`/plugins/folderview.plus/server/read.php?type=${type}`).promise());
    allFolderNames = new Set(Object.values(folders).map((folder) => (folder.name || '').trim().toLowerCase()));
    // get the list of element docker/vm
    let typeFilter;
    if (type === 'docker') {
        typeFilter = (e) => {
            const labels = e?.info?.Config?.Labels || {};
            return {
                'Name': e.info.Name,
                'Icon': labels['net.unraid.docker.icon'],
                'Label': getFolderLabelValue(labels)
            }
        };
    } else if (type === 'vm') {
        typeFilter = (e) => {
            return {
                'Name': e.name,
                'Icon': e.icon,
                'Label': undefined
            }
        };
    }

    choose = Object.values(JSON.parse(await $.get(`/plugins/folderview.plus/server/read_info.php?type=${type}`).promise())).map(typeFilter);

    // if editing a folder and not creating one
    if (folderId) {
        // select the folder and delete it from the list
        const currFolder = folders[folderId];
        currentFolderName = currFolder.name || '';
        delete folders[folderId];

        // set the value of the form
        const form = $('div.canvas > form')[0];
        form.name.value = currFolder.name;
        form.icon.value = currFolder.icon;
        form.folder_webui.checked = currFolder.settings.folder_webui || false;
        form.folder_webui_url.value = currFolder.settings.folder_webui_url || '';
        form.preview.value = currFolder.settings.preview.toString();
        form.preview_hover.checked = currFolder.settings.preview_hover;
        form.preview_update.checked = currFolder.settings.preview_update;
        form.preview_text_width.value = currFolder.settings.preview_text_width || '';
        form.preview_grayscale.checked = currFolder.settings.preview_grayscale;
        form.preview_webui.checked = currFolder.settings.preview_webui;
        form.preview_logs.checked = currFolder.settings.preview_logs;
        form.preview_console.checked = currFolder.settings.preview_console || false;
        form.preview_vertical_bars.checked = currFolder.settings.preview_vertical_bars || false;
        form.context.value = currFolder.settings.context?.toString() || '1';
        form.context_trigger.value = currFolder.settings.context_trigger?.toString() || '0';
        form.context_graph.value = currFolder.settings.context_graph?.toString() || '1';
        form.context_graph_time.value = currFolder.settings.context_graph_time?.toString() || '60';
        form.preview_border.checked = currFolder.settings.preview_border || false;
        form.preview_border_color.value = currFolder.settings.preview_border_color || rgbToHex($('body').css('color'));
        form.preview_vertical_bars_color.value = currFolder.settings.preview_vertical_bars_color || currFolder.settings.preview_border_color || rgbToHex($('body').css('color'));
        form.status_color_started.value = normalizeHexColor(currFolder.settings.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started);
        form.status_color_paused.value = normalizeHexColor(currFolder.settings.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused);
        form.status_color_stopped.value = normalizeHexColor(currFolder.settings.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped);
        form.health_warn_stopped_percent.value = currFolder.settings.health_warn_stopped_percent === undefined
            || currFolder.settings.health_warn_stopped_percent === null
            || currFolder.settings.health_warn_stopped_percent === ''
            ? ''
            : String(currFolder.settings.health_warn_stopped_percent);
        form.update_column.checked = currFolder.settings.update_column || false;
        form.default_action.checked = currFolder.settings.default_action || false;
        form.expand_tab.checked = currFolder.settings.expand_tab;
        form.override_default_actions.checked = currFolder.settings.override_default_actions;
        form.expand_dashboard.checked = currFolder.settings.expand_dashboard;
        form.regex.value = currFolder.regex;
        for (const ct of currFolder.containers) {
            const index = choose.findIndex((e) => e.Name === ct);
            if (index > -1) {
                selected.push(choose.splice(index, 1)[0]);
            }
        };

        currFolder.actions?.forEach((e, i) => {
            const safeActionName = escapeHtml(e?.name || '');
            $('.custom-action-wrapper').append(`<div class="custom-action-n-${i}">${safeActionName} <button onclick="return customAction(${i});"><i class="fa fa-pencil" aria-hidden="true"></i></button><button onclick="return rCcustomAction(${i});"><i class="fa fa-trash" aria-hidden="true"></i></button><input type="hidden" name="custom_action[]" value="${btoa(JSON.stringify(e))}"></div>`);
        });


        // make the ui respond to the previus changes
        updateForm();
        updateRegex(form.regex);
        updateIcon(form.icon);
    }

    existingFolderNames = new Set(Object.values(folders).map((folder) => (folder.name || '').trim().toLowerCase()));

    // create the *cool* unraid button for the autostart
    $('input.basic-switch').switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on')});

    // iterate over the folders
    for (const [folderId, value] of Object.entries(folders)) {
        // match the element to the regex
        if (value.regex) {
            const regex = new RegExp(value.regex);
            for (const container of choose) {
                regex.lastIndex = 0;
                if (regex.test(container.Name)) {
                    value.containers.push(container.Name);
                }
            }
        }

        // remove the containers from the order
        for (const container of value.containers) {
            const index = choose.findIndex((e) => e.Name === container);
            if (index > -1) {
                choose.splice(index, 1);
            }
        }
    }

    choose.sort((a, b) => a.Name.localeCompare(b.Name));
    await initBuiltInIconPicker();

    updateList();
    applySectionTags();
    initEditorChrome();
    updateForm();
    applyAdvancedMode();
    enforceLeftAlignedSettingsLayout();
    validateForm();
    updateLiveSummary();
    updateRegexSimulator();
    markCleanState();
    isFormInitialized = true;

    const form = getForm();
    $(form).on('input change', ':input', (event) => {
        if (!isFormInitialized) {
            return;
        }
        if (event.target.name === 'name') {
            updateRegex(form.regex);
        }
        validateForm();
        updateLiveSummary();
        updateRegexSimulator();
        enforceLeftAlignedSettingsLayout();
        updateUnsavedIndicator();
    });

    window.addEventListener('resize', enforceLeftAlignedSettingsLayout);
})();

/**
 * Update the folder icon when editing the respective field
 * @param {*} e the element
 */
const updateIcon = (e) => {
    if (e.previousElementSibling && e.previousElementSibling.tagName === 'IMG') {
        e.previousElementSibling.src = e.value;
    }
    renderBuiltInIconPicker();
};

/**
 * Update the regex selection when editing the respective field
 * @param {*} e the element
 */
const updateRegex = (e) => {
    syncMemberArraysFromTable();
    choose = choose.concat(selectedRegex);
    const fldName = ($('[name="name"]')[0].value || '').trim();
    if (fldName) {
        selectedRegex = choose.filter(el => el.Label === fldName);
        choose = choose.filter(el => el.Label !== fldName);
    } else {
        selectedRegex = [];
    }
    if (e.value) {
        let regex;
        try {
            regex = new RegExp(e.value);
        } catch (_error) {
            updateList();
            return false;
        }
        for (let i = 0; i < choose.length; i++) {
            if (regex.test(choose[i].Name)) {
                const tmpSel = choose.splice(i, 1)[0];
                if(!selectedRegex.includes(tmpSel)) {
                    selectedRegex.push(tmpSel);
                }
                i--;
            }
            regex.lastIndex = 0;
        }
    }
    updateList();
    updateRegexSimulator();
    return true;
};

/**
 * Update the setting visibility according to the preview setting
 * @param {*} e the element
 */
const previewChange = (e) => {
    $('[constraint^="preview-"]').hide();
    $(`[constraint*="preview-${e.value}"]`).show();
    if (type !== 'docker') {
        $('[constraint*="docker"]').hide();
    }

    applyAdvancedMode();
    validateForm();
    updateLiveSummary();
    updateRegexSimulator();
};

/**
 * Update the setting visibility according to the changin of settings
 */
const updateForm = () => {
    const form = $('div.canvas > form')[0];
    $('[constraint*="preview-"]').hide();
    $(`[constraint*="preview-${form.preview.value}"]`).show();
    $('[constraint*="context-"]').hide();
    $(`[constraint*="context-${form.context.value}"]`).show();
    $('[constraint*="border-color"]').hide();
    $('[constraint*="bars-color"]').hide();
    if(form.preview_border.checked) {
        $('[constraint*="border-color"]').show();
    }
    if(form.preview_vertical_bars.checked) {
        $('[constraint*="bars-color"]').show();
    }
    $('[constraint*="folder-webui"]').hide();
    if(form.folder_webui.checked) {
        $('[constraint*="folder-webui"]').show();
    }

    if (type !== 'docker') {
        $('[constraint*="docker"]').hide();
    }

    enforceLeftAlignedSettingsLayout();
};

/**
 * Create the element select table
 */
const updateList = () => {
    const table = $('.sortable > tbody');
    table.empty();

    const rows = [];
    selectedRegex.forEach((member) => rows.push({ member, membership: 'regex', checked: true, locked: true }));
    selected.forEach((member) => rows.push({ member, membership: 'manual', checked: true, locked: false }));
    choose.forEach((member) => rows.push({ member, membership: 'available', checked: false, locked: false }));

    rows.forEach(({ member, membership, checked, locked }) => {
        const icon = escapeHtml(member.Icon || '/plugins/dynamix.docker.manager/images/question.png');
        const name = escapeHtml(member.Name);
        const orderControls = locked
            ? '<span class="order-lock" title="Auto-included by regex or label"><i class="fa fa-lock" aria-hidden="true"></i></span>'
            : '<div class="order-buttons"><button type="button" class="member-move" data-direction="up" title="Move up"><i class="fa fa-chevron-up" aria-hidden="true"></i></button><button type="button" class="member-move" data-direction="down" title="Move down"><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div>';

        table.append($(`
            <tr class="item" data-name="${name}" data-membership="${membership}">
                <td class="order-col">${orderControls}</td>
                <td class="name-col"><span style="cursor: pointer;" onclick="setIconAsContainer(this)"><img src="${icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span>${name}</td>
                <td><input class="container-switch" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''} type="checkbox" name="containers[]" value="${name}" style="display: none;"></td>
            </tr>
        `));
    });

    $('table.sortable > tbody > tr > td > input.container-switch').switchButton({ show_labels: false });
    $('table.sortable > tbody > tr > td > input.container-switch:disabled').each(function() {
        const input = $(this);
        input.closest('td').find('*').css('opacity', '0.5').css('cursor', 'default').off();
        this.checked = true;
    });

    $('.item').css('border-color', $('body').css('color'));

    $('.member-move').off('click').on('click', function() {
        moveMemberRow(this, $(this).data('direction'));
    });

    $('input.container-switch').off('change').on('change', () => {
        updateMemberStats();
        updateLiveSummary();
        if (isFormInitialized) {
            validateForm();
            updateUnsavedIndicator();
        }
    });

    applyMemberFilters();
    updateMemberStats();
    updateLiveSummary();
    updateRegexSimulator();

    if (isFormInitialized) {
        validateForm();
        updateUnsavedIndicator();
    }
};

/**
 * Handle sthe form submission
 * @param {*} e the form
 * @returns {bool} always false
 */
const generateCopyName = (baseName) => {
    const trimmed = (baseName || '').trim() || 'Folder';
    let suffix = 1;
    let candidate = `${trimmed} Copy`;
    while (allFolderNames.has(candidate.toLowerCase())) {
        suffix += 1;
        candidate = `${trimmed} Copy ${suffix}`;
    }
    allFolderNames.add(candidate.toLowerCase());
    return candidate;
};

const submitForm = async (e, saveAsCopy = false) => {
    if (!validateForm()) {
        return false;
    }
    const actions = $('input[name*="custom_action"]').map((i, e) => JSON.parse(atob($(e).val()))).get();
    const healthWarnThresholdRaw = String(e.health_warn_stopped_percent?.value || '').trim();
    const healthWarnThreshold = healthWarnThresholdRaw === ''
        ? ''
        : (() => {
            const parsed = Number(healthWarnThresholdRaw);
            if (!Number.isFinite(parsed)) {
                return '';
            }
            return Math.min(100, Math.max(0, Math.round(parsed)));
        })();
    // this is easy, no need for a comment :)
    const folder = {
        name: e.name.value.toString().trim(),
        icon: e.icon.value.toString(),
        settings: {
            folder_webui: e.folder_webui.checked,
            folder_webui_url: e.folder_webui_url.value.toString(),
            preview: parseInt(e.preview.value.toString()),
            preview_hover: e.preview_hover.checked,
            preview_update: e.preview_update.checked,
            preview_text_width: e.preview_text_width.value,
            preview_grayscale: e.preview_grayscale.checked,
            preview_webui: e.preview_webui.checked,
            preview_logs: e.preview_logs.checked,
            preview_console: e.preview_console.checked,
            preview_vertical_bars: e.preview_vertical_bars.checked,
            context: parseInt(e.context.value.toString()),
            context_trigger: parseInt(e.context_trigger.value.toString()),
            context_graph: parseInt(e.context_graph.value.toString()),
            context_graph_time: parseInt(e.context_graph_time.value.toString()),
            preview_border: e.preview_border.checked,
            preview_border_color: e.preview_border_color.value.toString(),
            preview_vertical_bars_color: e.preview_vertical_bars_color.value.toString(),
            status_color_started: normalizeHexColor(e.status_color_started.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.started),
            status_color_paused: normalizeHexColor(e.status_color_paused.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.paused),
            status_color_stopped: normalizeHexColor(e.status_color_stopped.value.toString(), DEFAULT_FOLDER_STATUS_COLORS.stopped),
            health_warn_stopped_percent: healthWarnThreshold,
            update_column: e.update_column.checked,
            default_action: e.default_action.checked,
            expand_tab: e.expand_tab.checked,
            override_default_actions: e.override_default_actions.checked,
            expand_dashboard: e.expand_dashboard.checked,
        },
        regex: e.regex.value.toString(),
        containers: [...$('input[name*="containers"]:checked').map((i, e) => $(e).val())],
        actions
    }
    if (saveAsCopy) {
        folder.name = generateCopyName(folder.name);
    }
    if (!folder.name) {
        setFieldError('name', 'Folder name is required.');
        return false;
    }
    // send the data to the right endpoint
    if (folderId && !saveAsCopy) {
        await $.post('/plugins/folderview.plus/server/update.php', { type: type, content: JSON.stringify(folder), id: folderId });
    } else {
        await $.post('/plugins/folderview.plus/server/create.php', { type: type, content: JSON.stringify(folder) });
    }

    if (type === 'docker') {
        await $.post('/plugins/folderview.plus/server/sync_order.php', { type: type });
    }

    // return to the right tab
    suppressUnloadPrompt = true;
    let loc = location.pathname.split('/');
    loc.pop();
    location.href = loc.join('/');
    
    return false;
}

/**
 * Handles the button to return to the tab
 */
const cancelBtn = () => {
    if (updateUnsavedIndicator()) {
        const confirmLeave = confirm('You have unsaved changes. Leave without saving?');
        if (!confirmLeave) {
            return;
        }
    }
    suppressUnloadPrompt = true;
    let loc = location.pathname.split('/');
    loc.pop();
    location.href = loc.join('/');
};

const resetUnsavedChanges = () => {
    if (!updateUnsavedIndicator()) {
        return;
    }
    const confirmed = confirm('Discard all unsaved changes and reload this editor?');
    if (!confirmed) {
        return;
    }
    suppressUnloadPrompt = true;
    location.reload();
};

/**
 * Set the Folder icon to the clicked element icon
 * @param {*} e the element
 */
const setIconAsContainer = (e) => {
    const form = getForm();
    form.icon.value = e.firstChild.src;
    $(form.icon).trigger('input');
};

/**
 * Add a custom action to the folder
 * @param {number | undefined} action 
 */
const customAction = (action = undefined) => {
    let config = {
        name: '',
        type: 0,
        action: 0,
        modes: 0,
        conatiners: [],
        script_icon: ''
    }
    if(action !== undefined) {
        config = JSON.parse(atob($('input[name*="custom_action"]').map((i, e) => $(e).val()).get()[action]));
    }
    const selectCt = $('.action-subject [name="action_elements"]');
    selectCt.children().remove();
    [...$('input[name*="containers"]:checked').map((i, e) => $(e).val()), ...selectedRegex.map(e => e.Name)].forEach((e) => {
        if(config.conatiners?.includes(e)) {
            selectCt.append(`<option value="${e}" selected>${e}</option>`);
        } else {
            selectCt.append(`<option value="${e}">${e}</option>`);
        }
    });
    const dialog = $('.dialogCustomAction');
    const customNumber = $('input[name*="custom_action"]').length;
    dialog.html($('.templateDialogCustomAction').html());
    dialog.find('[name="action_elements"]').multiselect({
        header: false,
        noneSelectedText: "Select options",
        zIndex: 99998,
        appendTo: document.body,
        selectedText: (numChecked, numTotal, checkedItems) => {
            return checkedItems.map(e => e.value).join(', ');
        },
        classes: 'multiselect-container'
    });
    dialog.find('[name="action_name"]').val(config.name);
    dialog.find('[name="action_type"]').val(config.type);
    dialog.find('[constraint*=\'action-type-\']').hide();
    dialog.find(`[constraint*=\'action-type-${config.type}\']`).show();
    dialog.find('input.basic-switch-sync').prop("checked", config.script_sync || false);
    dialog.find('input.basic-switch-sync').switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on')});
    if(config.type === 0) {
        dialog.find('[name="action_standard"]').val(config.action);
        dialog.find('[constraint*=\'action-standard-\']').hide();
        dialog.find(`[constraint*=\'action-standard-${config.action}\']`).show();
        if(config.action === 0) {
            dialog.find('[name="action_cycle"]').val(config.modes);
        } else if(config.action === 1) {
            dialog.find('[name="action_set"]').val(config.modes);
        }
    } else if(config.type === 1){
        dialog.find('[name="action_script"]').val(config.script || '');
        dialog.find('[name="action_script_args"]').val(config.script_args || '');
    }
    dialog.find('[name="action_script_icon"]').val(config.script_icon);
    let buttons = {};
    buttons[(action !== undefined) ? $.i18n('action-edit-btn') : $.i18n('action-add-btn')] = function() {
        const that = $(this);
        let cfg = {
            name: that.find('[name="action_name"]').val(),
            type: parseInt(that.find('[name="action_type"]').val()),
        }
        cfg.script_icon = that.find('[name="action_script_icon"]').val() || ((cfg.type === 0) ? 'fa-cogs' : ((cfg.type === 1) ? 'fa-file-text-o' : 'fa-bolt'));
        if(cfg.type === 0) {
            cfg.conatiners = that.find('[name="action_elements"]').val();
            cfg.action = parseInt(that.find('[name="action_standard"]').val());
            if(cfg.action === 0) {
                cfg.modes = parseInt(that.find('[name="action_cycle"]').val());
            } else if(cfg.action === 1) {
                cfg.modes = parseInt(that.find('[name="action_set"]').val());
            }
        } else if(cfg.type === 1) {
            cfg.script = that.find('[name="action_script"]').val();
            cfg.script_args = that.find('[name="action_script_args"]').val();
            cfg.script_sync = that.find('[name="action_script_sync"]').prop("checked");
        }
        if(action !== undefined) {
            $(`.custom-action-n-${action} > input[type="hidden"]`).val(btoa(JSON.stringify(cfg)));
            $(`.custom-action-n-${action} > span`).text(cfg.name + ' ');
        } else {
            const safeCfgName = escapeHtml(cfg.name || '');
            $('.custom-action-wrapper').append(`<div class="custom-action-n-${(action !== undefined) ? action : customNumber}"><span>${safeCfgName} </span><button onclick="return customAction(${(action !== undefined) ? action : customNumber});"><i class="fa fa-pencil" aria-hidden="true"></i></button><button onclick="return rCcustomAction(${(action !== undefined) ? action : customNumber});"><i class="fa fa-trash" aria-hidden="true"></i></button><input type="hidden" name="custom_action[]" value="${btoa(JSON.stringify(cfg))}"></div>`);
        }
        if (isFormInitialized) {
            validateForm();
            updateUnsavedIndicator();
        }
        $(this).dialog("close");
    };
    buttons[$.i18n('cancel')] = function() {
        $(this).dialog("close");
    };
    dialog.dialog({
        title: (action !== undefined) ? $.i18n('action-edit') : $.i18n('action-add'),
        resizable: false,
        width: 800,
        modal: true,
        show: { effect: 'fade', duration: 250 },
        hide: { effect: 'fade', duration: 250 },
        buttons,
        close: () => {
            dialog.find('[name="action_elements"]').multiselect("destroy");
        }
    });
    const dialogWidget = dialog.closest('.ui-dialog');
    dialogWidget.find('.ui-dialog-titlebar').addClass('menu');
    dialogWidget.find('.ui-dialog-titlebar-close').css({ display: 'none' });
    dialogWidget.find('.ui-dialog-title').css({ 'text-align': 'center', width: '100%' });
    dialogWidget.find('.ui-dialog-content').css({ 'padding-top': '15px', 'vertical-align': 'bottom' });
    dialogWidget.find('.ui-button-text').css({ padding: '0px 5px' });
    return false;
};

/**
 * Remove a custom action from the folder
 * @param {number} action 
 */
const rCcustomAction =  (action) => {
    $(`.custom-action-n-${action}`).remove();
    if (isFormInitialized) {
        validateForm();
        updateUnsavedIndicator();
    }
    return false;
};

window.updateIcon = updateIcon;
window.updateRegex = updateRegex;
window.updateForm = updateForm;
window.submitForm = submitForm;
window.cancelBtn = cancelBtn;
window.resetUnsavedChanges = resetUnsavedChanges;
window.setIconAsContainer = setIconAsContainer;
window.customAction = customAction;
window.rCcustomAction = rCcustomAction;
