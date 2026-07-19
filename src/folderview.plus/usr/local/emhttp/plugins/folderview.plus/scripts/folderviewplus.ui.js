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
        button,
        iconButton,
        badge,
        disclosure,
        field,
        dropdown,
        multiselect: (options = {}) => dropdown({ ...options, multiple: true }),
        emptyState,
        loadingState,
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
