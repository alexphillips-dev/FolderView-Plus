// @ts-check
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FolderViewPlusDashboardCaptureFeedback = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createController = ({ window: win, translate } = {}) => {
        const show = (type, snapshot) => {
            const body = win.document.querySelector(type === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view');
            const container = body?.querySelector(':scope > tr.updated > td');
            if (!container) return;
            const saved = snapshot?.persisted === true;
            const title = saved ? translate('dashboard.quick.capture-success-title', 'Layout diagnostics captured') : translate('dashboard.quick.capture-unavailable-title', 'Layout diagnostics unavailable');
            const message = saved
                ? translate('dashboard.quick.capture-export-message', 'Export a support bundle from FolderView Plus Settings to include this capture.')
                : snapshot
                    ? translate('dashboard.quick.capture-storage-message', 'Your browser could not save this capture. Allow site storage and try again.')
                    : translate('dashboard.quick.capture-unavailable-message', 'Expand the affected folder and try the capture again.');
            const notice = win.document.createElement('div');
            notice.className = `fv-dashboard-capture-feedback ${saved ? 'is-success' : 'is-warning'}`;
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-live', 'polite');
            notice.setAttribute('aria-atomic', 'true');
            const icon = win.document.createElement('i');
            icon.className = `fa ${saved ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
            icon.setAttribute('aria-hidden', 'true');
            const copy = win.document.createElement('span');
            const heading = win.document.createElement('strong'), detail = win.document.createElement('span');
            heading.textContent = title; detail.textContent = message; copy.append(heading, detail);
            const close = win.document.createElement('button');
            close.type = 'button'; close.textContent = '×';
            close.setAttribute('aria-label', translate('common.close', 'Close'));
            close.addEventListener('click', () => { notice.remove(); body.querySelector('[data-fv-quick-action="view-options"]')?.focus(); });
            notice.append(icon, copy, close);
            const previous = container.querySelector(':scope > .fv-dashboard-capture-feedback');
            if (previous) previous.replaceWith(notice);
            else container.prepend(notice);
        };
        const capture = (type, popover, callback) => {
            popover.close('capture');
            let snapshot = null;
            try { snapshot = callback(); } catch (_error) { /* Show a safe failure without exposing the error. */ }
            show(type, snapshot);
        };
        return Object.freeze({ capture });
    };
    return Object.freeze({ createController });
}));
