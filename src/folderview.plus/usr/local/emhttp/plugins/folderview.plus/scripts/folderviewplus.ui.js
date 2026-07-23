(function installFolderViewPlusUI(root, factory) {
    const api = factory(root && root.document ? root : null);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.FolderViewPlusUI = api;
        root.FolderViewPlusUIPrimitivesLoaded = true;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFolderViewPlusUI(host) {
    'use strict';

    const actionHandlers = new Map();
    const modalStack = [];
    let toastRegion = null;
    let activePopover = null;
    let popoverSequence = 0;
    let delegatedRoot = null;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const normalizeTone = (tone) => {
        const value = String(tone || 'neutral').trim().toLowerCase();
        return ['neutral', 'primary', 'info', 'success', 'warning', 'danger'].includes(value) ? value : 'neutral';
    };

    const translate = (key, fallback, ...params) => (
        host?.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback || key
    );

    const SVG_ICON_PATHS = Object.freeze({
        'activity': '<polyline points="3 12 7 12 10 4 14 20 17 12 21 12"></polyline>',
        'alert-triangle': '<path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
        'boxes': '<rect x="3" y="4" width="7" height="7" rx="1"></rect><rect x="14" y="4" width="7" height="7" rx="1"></rect><rect x="8.5" y="14" width="7" height="7" rx="1"></rect>',
        'calendar': '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
        'check-circle': '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 8.5"></path>',
        'clock': '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
        'document': '<path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v5h5M9 13h6M9 17h6"></path>',
        'folder': '<path d="M3 6h7l2 2h9v11H3z"></path>',
        'globe': '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"></path>',
        'heart': '<path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"></path>',
        'image': '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m4 17 5-5 4 4 2-2 5 5"></path>',
        'info-circle': '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path>',
        'minus-circle': '<circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path>',
        'monitor': '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
        'package': '<path d="m4 7 8-4 8 4-8 4z"></path><path d="M4 7v10l8 4 8-4V7M12 11v10"></path>',
        'paintbrush': '<path d="m14 4 6 6-8.5 8.5a3 3 0 0 1-4.2-4.2Z"></path><path d="m12 6 6 6M7.3 14.3c-3-.3-4.8 1.2-4.3 4.7 2.5.2 4.2-.6 5.1-2.4"></path>',
        'puzzle': '<path d="M8 3h5v4a2 2 0 1 0 4 0V3h4v6h-4a2 2 0 1 0 0 4h4v8h-7v-4a2 2 0 1 0-4 0v4H3v-7h4a2 2 0 1 0 0-4H3V3z"></path>',
        'refresh': '<path d="M20 7v5h-5"></path><path d="M19 12a7 7 0 1 1-2-5"></path>',
        'server': '<rect x="3" y="4" width="18" height="6" rx="1"></rect><rect x="3" y="14" width="18" height="6" rx="1"></rect><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"></path>',
        'shield': '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"></path><path d="m9 12 2 2 4-4"></path>',
        'support': '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle><path d="m5.6 5.6 4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3"></path>',
        'upload': '<path d="M12 16V4M7 9l5-5 5 5"></path><path d="M4 15v5h16v-5"></path>',
        'x-circle': '<circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6M15 9l-6 6"></path>'
    });

    const svgIcon = (name, { className = '', title = '' } = {}) => {
        const iconName = Object.prototype.hasOwnProperty.call(SVG_ICON_PATHS, name) ? name : 'info-circle';
        const safeTitle = String(title || '').trim();
        const accessibility = safeTitle
            ? `role="img" aria-label="${escapeHtml(safeTitle)}"`
            : 'aria-hidden="true"';
        return `<svg class="fv-ui-svg-icon${className ? ` ${escapeHtml(className)}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" data-fv-icon="${escapeHtml(iconName)}" ${accessibility}>${SVG_ICON_PATHS[iconName]}</svg>`;
    };

    const iconMarkup = (icon) => icon
        ? `<i class="fa ${escapeHtml(icon)}" aria-hidden="true"></i>`
        : '';

    const appendContent = (target, content) => {
        if (!target || content === null || content === undefined) return;
        if (typeof content === 'function') {
            appendContent(target, content(target));
            return;
        }
        if (content && typeof content === 'object' && typeof content.nodeType === 'number') {
            target.append(content);
            return;
        }
        target.insertAdjacentHTML('beforeend', String(content));
    };

    const actionAttributes = ({ action = '', actionData = null } = {}) => {
        const attributes = [];
        if (action) attributes.push(`data-fv-ui-action="${escapeHtml(action)}"`);
        if (actionData !== null && actionData !== undefined) {
            const raw = typeof actionData === 'string' ? actionData : JSON.stringify(actionData);
            attributes.push(`data-fv-ui-action-data="${escapeHtml(raw)}"`);
        }
        return attributes.join(' ');
    };

    const button = ({
        label = '', icon = '', tone = 'neutral', size = 'md', type = 'button',
        action = '', actionData = null, disabled = false, className = '', attributes = ''
    } = {}) => {
        const safeTone = normalizeTone(tone);
        const safeSize = ['sm', 'md', 'lg'].includes(size) ? size : 'md';
        return `<button type="${escapeHtml(type)}" class="fv-ui-button is-${safeTone} is-${safeSize}${className ? ` ${escapeHtml(className)}` : ''}" ${actionAttributes({ action, actionData })} ${disabled ? 'disabled aria-disabled="true"' : ''} ${attributes}>${iconMarkup(icon)}${label ? `<span>${escapeHtml(label)}</span>` : ''}</button>`;
    };

    const iconButton = ({ label, icon, tone = 'neutral', size = 'md', ...options } = {}) => button({
        ...options,
        icon,
        tone,
        size,
        label: '',
        className: `fv-ui-icon-button${options.className ? ` ${options.className}` : ''}`,
        attributes: `aria-label="${escapeHtml(label || '')}" title="${escapeHtml(label || '')}" ${options.attributes || ''}`
    });

    const badge = ({ label = '', tone = 'neutral', icon = '', className = '' } = {}) => (
        `<span class="fv-ui-badge is-${normalizeTone(tone)}${className ? ` ${escapeHtml(className)}` : ''}">${iconMarkup(icon)}<span>${escapeHtml(label)}</span></span>`
    );

    const disclosure = ({ title = '', summary = '', body = '', open = false, icon = '', className = '' } = {}) => `
        <details class="fv-ui-disclosure${className ? ` ${escapeHtml(className)}` : ''}"${open ? ' open' : ''}>
            <summary>${iconMarkup(icon)}<span class="fv-ui-disclosure-title">${escapeHtml(title)}</span>${summary ? `<span class="fv-ui-disclosure-summary">${escapeHtml(summary)}</span>` : ''}<i class="fa fa-angle-down fv-ui-disclosure-chevron" aria-hidden="true"></i></summary>
            <div class="fv-ui-disclosure-body">${body}</div>
        </details>`;

    const field = ({
        id = '', label = '', control = '', help = '', error = '', required = false, className = ''
    } = {}) => {
        const helpId = id && help ? `${id}-help` : '';
        const errorId = id && error ? `${id}-error` : '';
        return `<div class="fv-ui-field${error ? ' has-error' : ''}${className ? ` ${escapeHtml(className)}` : ''}">${label ? `<label${id ? ` for="${escapeHtml(id)}"` : ''}>${escapeHtml(label)}${required ? '<span aria-hidden="true"> *</span>' : ''}</label>` : ''}<div class="fv-ui-field-control">${control}</div>${help ? `<div class="fv-ui-field-help"${helpId ? ` id="${escapeHtml(helpId)}"` : ''}>${escapeHtml(help)}</div>` : ''}${error ? `<div class="fv-ui-field-error" role="alert"${errorId ? ` id="${escapeHtml(errorId)}"` : ''}><i class="fa fa-exclamation-circle" aria-hidden="true"></i>${escapeHtml(error)}</div>` : ''}</div>`;
    };

    const dropdown = ({ id = '', name = '', options = [], value = '', multiple = false, disabled = false, attributes = '' } = {}) => {
        const selected = new Set(Array.isArray(value) ? value.map(String) : [String(value)]);
        const choices = options.map((option) => {
            const normalized = typeof option === 'object' ? option : { value: option, label: option };
            const optionValue = String(normalized.value ?? '');
            return `<option value="${escapeHtml(optionValue)}"${selected.has(optionValue) ? ' selected' : ''}${normalized.disabled ? ' disabled' : ''}>${escapeHtml(normalized.label ?? optionValue)}</option>`;
        }).join('');
        return `<span class="fv-ui-select${multiple ? ' is-multiselect' : ''}"><select${id ? ` id="${escapeHtml(id)}"` : ''}${name ? ` name="${escapeHtml(name)}"` : ''}${multiple ? ' multiple' : ''}${disabled ? ' disabled' : ''} ${attributes}>${choices}</select>${multiple ? '' : '<i class="fa fa-angle-down" aria-hidden="true"></i>'}</span>`;
    };

    const emptyState = ({ title = '', message = '', icon = 'fa-inbox', action = '' } = {}) => `
        <div class="fv-ui-empty-state"><span class="fv-ui-state-icon">${iconMarkup(icon)}</span><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ''}${action ? `<div class="fv-ui-state-action">${action}</div>` : ''}</div>`;

    const loadingState = ({ label = '', detail = '', compact = false } = {}) => `
        <div class="fv-ui-loading-state${compact ? ' is-compact' : ''}" role="status" aria-live="polite"><span class="fv-ui-spinner" aria-hidden="true"></span><span><strong>${escapeHtml(label || translate('common.loading', 'Loading…'))}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span></div>`;

    const openPopover = ({
        trigger = null, content = '', ariaLabel = '', className = '', initialFocus = '', returnFocus = true,
        placement = 'bottom-end', onClose = null
    } = {}) => {
        if (!host?.document?.body || !trigger || typeof trigger.getBoundingClientRect !== 'function') return null;
        activePopover?.close?.('replaced', { restoreFocus: false });

        const element = host.document.createElement('div');
        const popoverId = `fv-ui-popover-${++popoverSequence}`;
        element.id = popoverId;
        element.className = `fv-ui-popover${className ? ` ${className}` : ''}`;
        element.setAttribute('role', 'dialog');
        element.setAttribute('tabindex', '-1');
        if (ariaLabel) element.setAttribute('aria-label', ariaLabel);
        appendContent(element, content);
        host.document.body.append(element);

        const previousExpanded = trigger.getAttribute('aria-expanded');
        const previousControls = trigger.getAttribute('aria-controls');
        trigger.setAttribute('aria-expanded', 'true');
        trigger.setAttribute('aria-controls', popoverId);
        let closed = false;
        let resolveClosed;
        const closedPromise = new Promise((resolve) => { resolveClosed = resolve; });

        const reposition = () => {
            if (closed || !element.isConnected) return;
            if (!trigger.isConnected) {
                close('trigger-removed', { restoreFocus: false });
                return;
            }
            const triggerRect = trigger.getBoundingClientRect();
            const popoverRect = element.getBoundingClientRect();
            const viewportWidth = Math.max(0, host.innerWidth || host.document.documentElement.clientWidth || 0);
            const viewportHeight = Math.max(0, host.innerHeight || host.document.documentElement.clientHeight || 0);
            const gutter = 8;
            const gap = 6;
            const preferAbove = placement.startsWith('top');
            const fitsBelow = triggerRect.bottom + gap + popoverRect.height <= viewportHeight - gutter;
            const fitsAbove = triggerRect.top - gap - popoverRect.height >= gutter;
            const useAbove = preferAbove ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
            const top = useAbove
                ? triggerRect.top - popoverRect.height - gap
                : triggerRect.bottom + gap;
            const alignStart = placement.endsWith('start');
            const desiredLeft = alignStart ? triggerRect.left : triggerRect.right - popoverRect.width;
            const left = Math.min(
                Math.max(gutter, desiredLeft),
                Math.max(gutter, viewportWidth - popoverRect.width - gutter)
            );
            element.style.top = `${Math.max(gutter, Math.min(top, viewportHeight - popoverRect.height - gutter))}px`;
            element.style.left = `${left}px`;
            element.dataset.fvUiPlacement = useAbove ? 'top' : 'bottom';
        };

        const close = (reason = 'close', options = {}) => {
            if (closed) return;
            closed = true;
            host.document.removeEventListener('pointerdown', handleOutsidePointer, true);
            host.document.removeEventListener('keydown', handleKeydown, true);
            host.removeEventListener('resize', reposition);
            host.removeEventListener('scroll', reposition, true);
            element.remove();
            if (previousExpanded === null) trigger.removeAttribute('aria-expanded');
            else trigger.setAttribute('aria-expanded', previousExpanded);
            if (previousControls === null) trigger.removeAttribute('aria-controls');
            else trigger.setAttribute('aria-controls', previousControls);
            if (activePopover?.element === element) activePopover = null;
            if (options.restoreFocus !== false && returnFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
            onClose?.(reason);
            resolveClosed(reason);
        };
        const handleOutsidePointer = (event) => {
            if (!element.contains(event.target) && !trigger.contains(event.target)) close('outside', { restoreFocus: false });
        };
        const handleKeydown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close('escape');
        };

        const controller = Object.freeze({ element, trigger, reposition, close, closed: closedPromise });
        activePopover = controller;
        host.document.addEventListener('pointerdown', handleOutsidePointer, true);
        host.document.addEventListener('keydown', handleKeydown, true);
        host.addEventListener('resize', reposition);
        host.addEventListener('scroll', reposition, true);
        host.requestAnimationFrame?.(reposition) || host.setTimeout(reposition, 0);
        const requestedFocus = initialFocus ? element.querySelector(initialFocus) : null;
        const focusTarget = requestedFocus && !requestedFocus.disabled && requestedFocus.getAttribute('aria-disabled') !== 'true'
            ? requestedFocus
            : getFocusable(element)[0];
        (focusTarget || element).focus({ preventScroll: true });
        return controller;
    };

    const getFocusable = (container) => Array.from(container?.querySelectorAll?.(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), details > summary, [tabindex]:not([tabindex="-1"])'
    ) || []).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

    const syncBodyModalState = () => {
        if (!host?.document?.body) return;
        host.document.body.classList.toggle('fv-ui-modal-open', modalStack.length > 0);
    };

    const openModal = ({
        title = '', eyebrow = '', content = '', actions = '', size = 'md',
        tone = 'neutral', closeLabel = '', closeOnBackdrop = true, closeOnEscape = true,
        initialFocus = '', className = '', onClose = null, labelledBy = ''
    } = {}) => {
        if (!host?.document?.body) return null;
        const documentRef = host.document;
        const opener = documentRef.activeElement;
        const id = `fv-ui-modal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const titleId = labelledBy || `${id}-title`;
        const backdrop = documentRef.createElement('div');
        backdrop.className = `fv-ui-modal-backdrop is-${normalizeTone(tone)}`;
        backdrop.dataset.fvUiModalId = id;
        backdrop.innerHTML = `<section class="fv-ui-modal is-${escapeHtml(size)}${className ? ` ${escapeHtml(className)}` : ''}" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(titleId)}"><header class="fv-ui-modal-header"><div>${eyebrow ? `<span class="fv-ui-modal-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}<h2 id="${escapeHtml(titleId)}">${escapeHtml(title)}</h2></div>${iconButton({ label: closeLabel || translate('common.close', 'Close'), icon: 'fa-times', className: 'fv-ui-modal-close', attributes: 'data-fv-ui-modal-close' })}</header><div class="fv-ui-modal-body"></div><footer class="fv-ui-modal-footer"></footer><div class="fv-ui-modal-live" role="status" aria-live="polite"></div></section>`;
        const modal = backdrop.querySelector('.fv-ui-modal');
        const body = modal.querySelector('.fv-ui-modal-body');
        const footer = modal.querySelector('.fv-ui-modal-footer');
        appendContent(body, content);
        appendContent(footer, actions);
        if (!actions) footer.hidden = true;

        let resolveClosed;
        const closed = new Promise((resolve) => { resolveClosed = resolve; });
        const controller = {
            id,
            element: modal,
            backdrop,
            body,
            footer,
            closed,
            close(reason = 'close') {
                const index = modalStack.indexOf(controller);
                if (index >= 0) modalStack.splice(index, 1);
                documentRef.removeEventListener('keydown', keydownHandler, true);
                backdrop.remove();
                syncBodyModalState();
                if (opener instanceof host.HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
                resolveClosed?.(reason);
                if (typeof onClose === 'function') onClose(reason, controller);
            },
            setBusy(busy, label = '') {
                modal.classList.toggle('is-busy', Boolean(busy));
                modal.setAttribute('aria-busy', busy ? 'true' : 'false');
                modal.querySelectorAll('button, input, select, textarea').forEach((control) => {
                    if (!control.matches('[data-fv-ui-allow-while-busy]')) control.disabled = Boolean(busy);
                });
                if (label) controller.announce(label);
            },
            setContent(nextContent) {
                body.replaceChildren();
                appendContent(body, nextContent);
            },
            announce(message) {
                const live = modal.querySelector('.fv-ui-modal-live');
                if (live) live.textContent = String(message || '');
            }
        };
        const keydownHandler = (event) => {
            if (modalStack.at(-1) !== controller) return;
            if (event.key === 'Escape' && closeOnEscape && !modal.classList.contains('is-busy')) {
                event.preventDefault();
                controller.close('escape');
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = getFocusable(modal);
            if (!focusable.length) {
                event.preventDefault();
                modal.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && documentRef.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && documentRef.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        modal.setAttribute('tabindex', '-1');
        backdrop.addEventListener('mousedown', (event) => {
            if (event.target === backdrop && closeOnBackdrop && !modal.classList.contains('is-busy')) controller.close('backdrop');
        });
        modal.querySelector('[data-fv-ui-modal-close]')?.addEventListener('click', () => controller.close('close'));
        documentRef.addEventListener('keydown', keydownHandler, true);
        documentRef.body.append(backdrop);
        modalStack.push(controller);
        syncBodyModalState();
        host.requestAnimationFrame?.(() => {
            const focusTarget = initialFocus ? modal.querySelector(initialFocus) : getFocusable(modal)[0];
            (focusTarget || modal).focus({ preventScroll: true });
        });
        return controller;
    };

    const openActionSheet = (options = {}) => openModal({ ...options, className: `fv-ui-action-sheet${options.className ? ` ${options.className}` : ''}` });

    const confirm = ({
        title = '', message = '', detail = '', confirmLabel = '', cancelLabel = '',
        tone = 'warning', requireText = '', checkboxLabel = ''
    } = {}) => new Promise((resolve) => {
        const confirmText = confirmLabel || translate('common.confirm', 'Confirm');
        const cancelText = cancelLabel || translate('common.cancel', 'Cancel');
        const requirement = String(requireText || '');
        const content = `<div class="fv-ui-confirm"><span class="fv-ui-confirm-icon">${iconMarkup(tone === 'danger' ? 'fa-exclamation-triangle' : 'fa-question-circle')}</span><div>${message ? `<p>${escapeHtml(message)}</p>` : ''}${detail ? `<p class="fv-ui-confirm-detail">${escapeHtml(detail)}</p>` : ''}${requirement ? field({ id: 'fv-ui-confirm-text', label: translate('common.confirm-type', 'Type to confirm'), control: `<input id="fv-ui-confirm-text" type="text" autocomplete="off" data-fv-ui-confirm-input>`, help: requirement }) : ''}${checkboxLabel ? `<label class="fv-ui-check"><input type="checkbox" data-fv-ui-confirm-check> <span>${escapeHtml(checkboxLabel)}</span></label>` : ''}</div></div>`;
        const actions = `${button({ label: cancelText, action: 'modal-cancel' })}${button({ label: confirmText, tone: tone === 'danger' ? 'danger' : 'primary', action: 'modal-confirm', disabled: Boolean(requirement || checkboxLabel) })}`;
        const modal = openModal({ title, content, actions, tone, closeOnBackdrop: false, initialFocus: requirement ? '[data-fv-ui-confirm-input]' : '[data-fv-ui-action="modal-confirm"]' });
        if (!modal) {
            resolve(false);
            return;
        }
        const confirmButton = modal.element.querySelector('[data-fv-ui-action="modal-confirm"]');
        const validate = () => {
            const textOkay = !requirement || modal.element.querySelector('[data-fv-ui-confirm-input]')?.value === requirement;
            const checkOkay = !checkboxLabel || modal.element.querySelector('[data-fv-ui-confirm-check]')?.checked;
            confirmButton.disabled = !(textOkay && checkOkay);
        };
        modal.element.addEventListener('input', validate);
        modal.element.addEventListener('change', validate);
        modal.element.querySelector('[data-fv-ui-action="modal-cancel"]')?.addEventListener('click', () => modal.close('cancel'));
        confirmButton?.addEventListener('click', () => modal.close('confirm'));
        modal.closed.then((reason) => resolve(reason === 'confirm'));
    });

    const alert = ({ title = '', message = '', tone = 'info', closeLabel = '' } = {}) => new Promise((resolve) => {
        const actions = button({ label: closeLabel || translate('common.close', 'Close'), tone: tone === 'danger' ? 'danger' : 'primary', action: 'modal-acknowledge' });
        const modal = openModal({ title, content: `<div class="fv-ui-alert"><span class="fv-ui-confirm-icon">${iconMarkup(tone === 'danger' ? 'fa-exclamation-circle' : tone === 'success' ? 'fa-check-circle' : 'fa-info-circle')}</span><p>${escapeHtml(message)}</p></div>`, actions, tone, initialFocus: '[data-fv-ui-action="modal-acknowledge"]' });
        if (!modal) {
            resolve();
            return;
        }
        modal.element.querySelector('[data-fv-ui-action="modal-acknowledge"]')?.addEventListener('click', () => modal.close('acknowledge'));
        modal.closed.then(resolve);
    });

    const ensureToastRegion = () => {
        if (!host?.document?.body) return null;
        if (toastRegion?.isConnected) return toastRegion;
        toastRegion = host.document.createElement('div');
        toastRegion.className = 'fv-ui-toast-region';
        toastRegion.setAttribute('aria-label', translate('common.notifications', 'Notifications'));
        host.document.body.append(toastRegion);
        return toastRegion;
    };

    const toast = ({ title = '', message = '', tone = '', level = '', duration = null, durationMs = 4200, actionLabel = '', onAction = null } = {}) => {
        const region = ensureToastRegion();
        if (!region) return null;
        const resolvedTone = normalizeTone(tone || level || 'info');
        const element = host.document.createElement('article');
        element.className = `fv-ui-toast is-${resolvedTone}`;
        element.setAttribute('role', resolvedTone === 'danger' ? 'alert' : 'status');
        element.innerHTML = `<span class="fv-ui-toast-icon">${iconMarkup(resolvedTone === 'success' ? 'fa-check-circle' : resolvedTone === 'danger' ? 'fa-exclamation-circle' : resolvedTone === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle')}</span><div class="fv-ui-toast-copy">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${message ? `<p>${escapeHtml(message)}</p>` : ''}</div>${actionLabel ? button({ label: actionLabel, size: 'sm', className: 'fv-ui-toast-action' }) : ''}${iconButton({ label: translate('common.dismiss', 'Dismiss'), icon: 'fa-times', size: 'sm', className: 'fv-ui-toast-close' })}`;
        const close = () => {
            if (!element.isConnected) return;
            element.classList.add('is-leaving');
            host.setTimeout(() => element.remove(), 180);
        };
        element.querySelector('.fv-ui-toast-close')?.addEventListener('click', close);
        element.querySelector('.fv-ui-toast-action')?.addEventListener('click', () => {
            onAction?.();
            close();
        });
        region.append(element);
        const timeout = Number(duration ?? durationMs);
        if (timeout > 0) host.setTimeout(close, timeout);
        return Object.freeze({ element, close });
    };

    const progress = ({ title = '', label = '', detail = '', value = 0, max = 100, cancellable = false, onCancel = null } = {}) => {
        const safeMax = Math.max(1, Number(max) || 100);
        const actions = cancellable ? button({ label: translate('common.cancel', 'Cancel'), action: 'progress-cancel' }) : '';
        const content = `<div class="fv-ui-progress-state" role="status" aria-live="polite"><div class="fv-ui-progress-copy"><strong data-fv-ui-progress-label>${escapeHtml(label)}</strong><span data-fv-ui-progress-value></span></div><progress value="${Math.max(0, Number(value) || 0)}" max="${safeMax}"></progress>${detail ? `<p data-fv-ui-progress-detail>${escapeHtml(detail)}</p>` : ''}</div>`;
        const modal = openModal({ title, content, actions, closeOnBackdrop: false, closeOnEscape: cancellable, className: 'fv-ui-progress-modal' });
        if (!modal) return null;
        const update = ({ value: nextValue, max: nextMax, label: nextLabel, detail: nextDetail } = {}) => {
            const progressElement = modal.element.querySelector('progress');
            if (nextMax !== undefined) progressElement.max = Math.max(1, Number(nextMax) || 1);
            if (nextValue !== undefined) progressElement.value = Math.max(0, Number(nextValue) || 0);
            if (nextLabel !== undefined) modal.element.querySelector('[data-fv-ui-progress-label]').textContent = String(nextLabel);
            if (nextDetail !== undefined) {
                let detailElement = modal.element.querySelector('[data-fv-ui-progress-detail]');
                if (!detailElement) {
                    detailElement = host.document.createElement('p');
                    detailElement.dataset.fvUiProgressDetail = '';
                    progressElement.after(detailElement);
                }
                detailElement.textContent = String(nextDetail);
            }
            const valueElement = modal.element.querySelector('[data-fv-ui-progress-value]');
            valueElement.textContent = `${Math.round(progressElement.value)} / ${Math.round(progressElement.max)}`;
        };
        modal.element.querySelector('[data-fv-ui-action="progress-cancel"]')?.addEventListener('click', () => {
            onCancel?.();
            modal.close('cancel');
        });
        update({ value, max: safeMax });
        return Object.freeze({ ...modal, update });
    };

    const registerAction = (name, handler) => {
        const key = String(name || '').trim();
        if (!key || typeof handler !== 'function') throw new TypeError('A named UI action requires a handler.');
        actionHandlers.set(key, handler);
        return () => actionHandlers.delete(key);
    };

    const dispatchAction = (name, context = {}) => {
        const handler = actionHandlers.get(String(name || '').trim());
        return handler ? handler(context) : undefined;
    };

    const installDelegation = (rootNode = host?.document) => {
        if (!rootNode || delegatedRoot === rootNode) return;
        delegatedRoot?.removeEventListener?.('click', delegatedClickHandler);
        rootNode.addEventListener('click', delegatedClickHandler);
        delegatedRoot = rootNode;
    };

    function delegatedClickHandler(event) {
        const trigger = event.target?.closest?.('[data-fv-ui-action]');
        if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
        const action = String(trigger.dataset.fvUiAction || '').trim();
        const handler = actionHandlers.get(action);
        if (!handler) return;
        let data = trigger.dataset.fvUiActionData || '';
        if (data) {
            try { data = JSON.parse(data); } catch (_error) { /* keep string */ }
        }
        event.preventDefault();
        handler({ event, trigger, data, action });
    }

    installDelegation();

    return Object.freeze({
        escapeHtml,
        svgIcon,
        button,
        iconButton,
        badge,
        disclosure,
        field,
        dropdown,
        multiselect: (options = {}) => dropdown({ ...options, multiple: true }),
        emptyState,
        loadingState,
        openPopover,
        openModal,
        openActionSheet,
        confirm,
        alert,
        toast,
        progress,
        registerAction,
        dispatchAction,
        installDelegation
    });
}));
