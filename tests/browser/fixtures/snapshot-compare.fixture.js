let backupsByType = {};
let backupCompareSelectionByType = { docker: { right: '__current__', includePrefs: true }, vm: { right: '__current__', includePrefs: true } };
let backupCompareDiffPagingState = { rows: [], page: 1, pageSize: 20 };
const prefsByType = { docker: { hideEmptyFolders: false }, vm: { hideEmptyFolders: false } };
const formatTimestamp = value => value;
const snapshots = {
    first: { createdAt: '2026-10-01 09:00', reason: 'manual', prefs: { hideEmptyFolders: true }, folders: {
        changed: { name: 'Media', containers: ['a'], settings: { preview: 1 } }, removed: { name: 'Old folder' }, same: { name: 'Same' }
    } },
    second: { createdAt: '2026-10-01 10:00', reason: 'manual', prefs: { hideEmptyFolders: false }, folders: {
        changed: { name: 'Media library', containers: ['a', 'b'], settings: { preview: 2 } }, added: { name: 'New folder' }, same: { name: 'Same' }
    } }
};
utils.normalizePrefs = value => value || {};
utils.diffFolderFields = (before, after) => ['name', 'settings', 'members'].filter(field => JSON.stringify(before[field === 'members' ? 'containers' : field]) !== JSON.stringify(after[field === 'members' ? 'containers' : field]));
const getFolderMap = () => snapshots.second.folders;
const showError = (title, error) => { window.compareErrors.push(`${title}: ${error.message}`); };
const swal = options => { window.compareErrors.push(options.title); };
const compareWorkspaces = window.FolderViewPlusSettingsWorkspaces.createApi({ window, document, $ });
const syncVisibleRecoveryCompareControls = type => compareWorkspaces.syncVisibleRecoveryCompareControls(type);
const syncHiddenRecoveryCompareControls = type => compareWorkspaces.syncHiddenRecoveryCompareControls(type);
const fetchBackupSnapshot = async (type, target) => {
    window.compareRequests.push({ type, target });
    if (window.fixtureCompare.defer) await new Promise(resolve => window.comparePending.push(resolve));
    if (window.fixtureCompare.fail) throw new Error('Synthetic snapshot read failure');
    return snapshots[target];
};
window.compareRequests = []; window.compareErrors = []; window.comparePending = [];
window.fixtureCompare = {
    open: type => openBackupComparePicker(type), defer: false, fail: false,
    release() { window.comparePending.splice(0).forEach(resolve => resolve()); },
    reset() { for (const type of ['docker', 'vm']) backupsByType[type] = Object.entries(snapshots).map(([name, snapshot]) => ({ name, ...snapshot })); },
    snapshots
};
window.fixtureCompare.reset();

// Synthetic host dialog adapter: exercises the plugin's callbacks and layouts without a live Unraid host.
$.fn.dialog = function(action, ...args) {
    let state = this.data('fixtureDialog');
    if (typeof action === 'string') {
        if (action === 'widget') return state.widget;
        if (action === 'isOpen') return Boolean(state?.opened);
        if (action === 'close') { state.close(); return this; }
        if (action === 'option' && args[0] === 'width') state.widget.css('width', args[1]);
        return this;
    }
    if (!state) {
        const content = this;
        const widget = $('<div class="ui-dialog" role="dialog" aria-modal="true" tabindex="-1"></div>').css({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1100 }).appendTo('body');
        const head = $('<div class="ui-dialog-titlebar"><span class="ui-dialog-title"></span><button class="ui-dialog-titlebar-close" type="button" aria-label="Close">×</button></div>').appendTo(widget);
        content.addClass('ui-dialog-content').appendTo(widget);
        const footer = $('<div class="ui-dialog-buttonpane"><div class="ui-dialog-buttonset"></div></div>').appendTo(widget);
        state = { widget, content, head, footer, opened: false };
        state.close = () => { state.opened = false; widget.hide(); state.overlay?.remove(); state.options.close?.call(content[0]); state.opener?.focus(); };
        head.find('button').on('click', state.close);
        widget.on('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); state.close(); }
            if (event.key !== 'Tab') return;
            const controls = widget.find('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary').filter(':visible').toArray();
            const next = controls.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1);
            if (next < 0 || next >= controls.length) { event.preventDefault(); controls[next < 0 ? controls.length - 1 : 0]?.focus(); }
        });
        this.data('fixtureDialog', state);
    }
    state.opener = document.activeElement;
    state.options = action; state.opened = true;
    // Current jQuery UI ignores the legacy dialogClass option unless compatibility mode is enabled.
    state.widget.attr('class', `ui-dialog ${action.classes?.['ui-dialog'] || ''}`).css({ width: action.width, display: 'block' });
    state.head.find('.ui-dialog-title').text(action.title).attr('id', `${this.attr('id')}-title`);
    state.widget.attr('aria-labelledby', `${this.attr('id')}-title`);
    state.footer.find('.ui-dialog-buttonset').empty();
    for (const button of action.buttons || []) $('<button type="button"></button>').text(button.text).attr('class', button.class || '').prop('disabled', button.disabled === true).on('click', () => button.click.call(this[0])).appendTo(state.footer.find('.ui-dialog-buttonset'));
    state.overlay?.remove();
    state.overlay = $('<div class="ui-widget-overlay"></div>').css({ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000 }).appendTo('body');
    action.open?.call(this[0]);
    const focusTarget = state.content.find('select:not(:disabled),input:not(:disabled)').first();
    (focusTarget.length ? focusTarget : state.footer.find('button:not(:disabled)').first()).trigger('focus');
    return this;
};
