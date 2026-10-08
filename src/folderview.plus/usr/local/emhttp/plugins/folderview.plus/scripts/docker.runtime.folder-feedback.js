// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.FolderViewPlusDockerFolderFeedback = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const instances = new WeakMap();
    const surfaceT = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params)
        || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
    const summarize = (entries) => Object.values(entries || {}).reduce((counts, entry) => {
        if (!entry || typeof entry !== 'object') return counts;
        counts.total++;
        if (entry.state !== true) counts.stopped++;
        else if (entry.pause === true) counts.paused++;
        else counts.running++;
        if (entry.update === true) counts.updates++;
        return counts;
    }, { running: 0, stopped: 0, paused: 0, updates: 0, total: 0 });
    const eligible = (entry, action) => !!entry && ({ start: !entry.state, stop: !!entry.state,
        pause: !!entry.state && !entry.pause, resume: !!entry.state && !!entry.pause, restart: true })[action] === true;
    const matchesState = (entry, action) => !!entry && ({ start: entry.state === true && entry.pause !== true,
        stop: entry.state === false, pause: entry.state === true && entry.pause === true,
        resume: entry.state === true && entry.pause === false })[action] === true;
    const actionLabel = action => ({
        start: surfaceT('docker.feedback.starting', 'Starting containers'),
        stop: surfaceT('docker.feedback.stopping', 'Stopping containers'),
        pause: surfaceT('docker.feedback.pausing', 'Pausing containers'),
        resume: surfaceT('docker.feedback.resuming', 'Resuming containers'),
        restart: surfaceT('docker.feedback.restarting', 'Restarting containers')
    })[action] || '';
    const getApi = win => {
        if (!win?.document) return null;
        if (instances.has(win)) return instances.get(win);
        const doc = win.document, operations = new Map(), targets = new Map(), reservations = new Set();
        let tip = null, anchor = null, pinned = false, disposed = false;
        const node = (tag, className, text) => {
            const result = doc.createElement(tag);
            result.className = className;
            if (text !== undefined) result.textContent = String(text);
            return result;
        };
        const hideTip = () => {
            const focusTarget = tip?.contains(doc.activeElement) ? anchor : null;
            if (anchor) { anchor.setAttribute('aria-expanded', 'false'); anchor.removeAttribute('aria-describedby'); }
            tip?.remove(); tip = null; anchor = null; pinned = false;
            if (focusTarget?.isConnected) focusTarget.focus();
        };
        const positionTip = () => {
            if (!tip || !anchor?.isConnected) { hideTip(); return; }
            const rect = anchor.getBoundingClientRect(), box = tip.getBoundingClientRect();
            tip.style.left = `${Math.max(8, Math.min(rect.left, win.innerWidth - box.width - 8))}px`;
            tip.style.top = `${Math.max(8, Math.min(rect.bottom + 6, win.innerHeight - box.height - 8))}px`;
        };
        const showTip = trigger => {
            const data = targets.get(trigger.dataset.fvFolderStatus);
            if (!data || disposed) return;
            hideTip(); anchor = trigger;
            tip = node('div', 'fv-docker-status-details fv-ui-popover fv-ui-modal-body'); tip.id = 'fvplus-docker-folder-status-details';
            tip.setAttribute('role', 'tooltip');
            tip.append(node('strong', '', surfaceT('legacy.surface.5527b33a794ed44a', 'Folder status')),
                node('div', '', data.includesChildren
                    ? surfaceT('docker.feedback.includes-children', 'Includes child folders')
                    : surfaceT('docker.feedback.direct-members', 'Direct members only')));
            const labels = { running: surfaceT('legacy.surface.f4ccae29e1bb0c20', 'Running'),
                stopped: surfaceT('legacy.surface.1a4f630ac1b69fd0', 'Stopped'),
                paused: surfaceT('legacy.surface.e159b06187d369a0', 'Paused'),
                updates: surfaceT('docker.feedback.updates-available', 'Updates available') };
            for (const key of Object.keys(labels)) {
                const row = node('div', 'fv-docker-status-detail fv-ui-progress-copy');
                const label = node('span', '', labels[key]);
                const dot = node('i', `fv-ui-badge is-${({ running: 'success', stopped: 'danger', paused: 'warning', updates: 'info' })[key]} fa fa-circle`);
                dot.setAttribute('aria-hidden', 'true'); label.prepend(dot, doc.createTextNode(' '));
                row.append(label, node('strong', '', data.counts[key]));
                tip.append(row);
            }
            tip.append(node('div', 'fv-docker-status-total', surfaceT('docker.feedback.total', 'Total: $1 containers', data.counts.total)));
            doc.body.append(tip); trigger.setAttribute('aria-expanded', 'true');
            trigger.setAttribute('aria-describedby', tip.id); positionTip();
        };
        const removeOperation = operation => {
            if (operation.busy) return;
            const restoreFocus = anchor === operation.indicator && (tip?.contains(doc.activeElement) || doc.activeElement === anchor);
            if (anchor === operation.indicator) hideTip();
            if (restoreFocus) operation.indicator?.parentNode?.querySelector('.folder-dropdown')?.focus();
            win.clearTimeout(operation.timer); operation.indicator?.remove(); operations.delete(operation.id);
        };
        const renderDetails = operation => {
            if (!tip || anchor !== operation.indicator) return;
            const root = tip, revision = `${operation.state}:${operation.message}:${operation.failures.length}`;
            if (root.dataset.fvOperationRevision === revision) return;
            const closeFocused = root.querySelector('.fv-docker-operation-dismiss') === doc.activeElement;
            const detailsOpen = root.querySelector('details')?.open === true;
            root.replaceChildren(); root.dataset.state = operation.state; root.dataset.fvOperationRevision = revision;
            const copy = node('span', 'fv-docker-operation-copy');
            copy.setAttribute('role', 'status'); copy.setAttribute('aria-live', 'polite');
            copy.append(node('strong', 'fv-docker-feedback-name', operation.name || surfaceT('legacy.surface.06ad81df147811c3', 'Folder action')), doc.createTextNode(' · '),
                node('span', '', operation.message));
            root.append(copy);
            if (operation.failures.length) {
                const details = node('details', 'fv-docker-operation-details');
                details.open = detailsOpen;
                details.append(node('summary', '', surfaceT('docker.feedback.view-details', 'View details')));
                for (const failure of operation.failures) {
                    const item = node('div', 'fv-docker-operation-failure');
                    item.append(node('span', 'fv-docker-feedback-name', failure.name || surfaceT('docker.feedback.container', 'Container')), doc.createTextNode(' · '),
                        node('span', '', failure.message));
                    details.append(item);
                }
                root.append(details);
            }
            if (operation.busy) {
                const progress = node('progress', 'fv-docker-operation-progress');
                progress.max = operation.jobs.length; progress.value = operation.completed;
                progress.setAttribute('aria-label', actionLabel(operation.action)); root.append(progress);
            }
            const dismiss = node('button', 'fv-docker-operation-dismiss fv-ui-button fv-ui-icon-button is-sm', '×'); dismiss.type = 'button';
            dismiss.setAttribute('aria-label', operation.busy ? surfaceT('legacy.surface.7d9eb7acb13e2462', 'Close') : surfaceT('legacy.surface.48845bff334a50a5', 'Dismiss'));
            dismiss.addEventListener('click', () => {
                if (operation.busy) { hideTip(); operation.indicator?.focus(); }
                else removeOperation(operation);
            }); root.append(dismiss);
            if (closeFocused) dismiss.focus();
            positionTip();
        };
        const renderOperation = operation => {
            if (disposed) return;
            const cell = doc.querySelector?.(`tr.folder-id-${win.CSS.escape(operation.id)} > td.folder-name`);
            if (!cell) return;
            if (!operation.indicator?.isConnected) {
                if (anchor === operation.indicator) hideTip();
                operation.indicator = cell.querySelector('.fv-docker-operation-icon') || node('span', 'fv-docker-operation-icon'); cell.append(operation.indicator);
                operation.indicator.dataset.fvFolderOperation = operation.id;
                operation.indicator.setAttribute('role', 'button'); operation.indicator.setAttribute('tabindex', '0');
                operation.indicator.setAttribute('aria-expanded', 'false');
            }
            const indicator = operation.indicator; indicator.replaceChildren(); indicator.dataset.state = operation.state;
            indicator.setAttribute('aria-label', operation.message); indicator.setAttribute('title', operation.message);
            indicator.setAttribute('aria-busy', String(operation.busy));
            const icon = node('span', operation.busy ? 'fv-ui-spinner' : 'fv-ui-badge is-warning fa fa-exclamation-triangle');
            icon.setAttribute('aria-hidden', 'true'); indicator.append(icon); renderDetails(operation);
        };
        const showOperationTip = trigger => {
            const operation = operations.get(trigger.dataset.fvFolderOperation); if (!operation) return;
            hideTip(); anchor = trigger; pinned = true;
            tip = node('div', 'fv-docker-operation fv-ui-popover fv-ui-modal-body fv-ui-progress-state');
            tip.id = 'fvplus-docker-folder-operation-details'; tip.setAttribute('role', 'dialog');
            tip.setAttribute('aria-label', surfaceT('legacy.surface.06ad81df147811c3', 'Folder action'));
            doc.body.append(tip); trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-describedby', tip.id);
            renderDetails(operation);
        };
        const finish = (operation, state, message) => {
            if (disposed || operations.get(operation.id) !== operation) return;
            operation.busy = false; operation.state = state; operation.message = message;
            for (const job of operation.jobs) reservations.delete(job.identity);
            win.clearTimeout(operation.timer);
            if (state === 'success') removeOperation(operation);
            else renderOperation(operation);
        };
        const verify = (operation, entries) => {
            if (!operation.settled || !operation.busy || operation.action === 'restart') return;
            const succeeded = operation.jobs.filter(job => !job.failed && matchesState(entries[job.name], operation.action)).length;
            const expected = operation.jobs.length - operation.failures.length;
            if (succeeded === expected) finish(operation, operation.failures.length ? 'warning' : 'success', operation.failures.length
                ? surfaceT('docker.feedback.partial', '$1 confirmed · $2 failed', succeeded, operation.failures.length)
                : surfaceT('docker.feedback.confirmed', '$1 containers reached the requested state', succeeded));
        };
        const decorateStatus = (id, folder, entries, includesChildren) => {
            if (disposed) return;
            if (anchor && !anchor.isConnected) hideTip();
            const trigger = doc.querySelector(`tr.folder-id-${win.CSS.escape(String(id))} span.folder-state`);
            if (!trigger) return;
            trigger.dataset.fvFolderStatus = String(id); trigger.setAttribute('tabindex', '0');
            trigger.setAttribute('role', 'button'); trigger.setAttribute('aria-expanded', anchor === trigger ? 'true' : 'false');
            trigger.setAttribute('aria-label', surfaceT('legacy.surface.5527b33a794ed44a', 'Folder status'));
            targets.set(String(id), { counts: summarize(entries), includesChildren });
            if (anchor === trigger) { const keepPinned = pinned; showTip(trigger); pinned = keepPinned; }
            const operation = operations.get(String(id));
            if (operation) { renderOperation(operation); verify(operation, entries || {}); }
        };
        const run = async ({ id, name, action, entries, request, refresh, read }) => {
            if (disposed || operations.get(String(id))?.busy || !actionLabel(action)) return false;
            const jobs = Object.entries(entries || {}).filter(([, entry]) => eligible(entry, action)).map(([name, entry]) => {
                const id = String(entry.id || entry.shortId || entry.info?.Id || '').trim();
                return { name, entry: { ...entry, id }, identity: id || `name:${name}` };
            });
            if (jobs.some(job => reservations.has(job.identity))) return false;
            const previous = operations.get(String(id)); if (previous) removeOperation(previous);
            const operation = { id: String(id), name, action, jobs, completed: 0, failures: [], busy: true, settled: false,
                state: 'pending', message: actionLabel(action), timer: null, indicator: null };
            operations.set(operation.id, operation); jobs.forEach(job => reservations.add(job.identity)); renderOperation(operation);
            if (!jobs.length) { finish(operation, 'success', surfaceT('docker.feedback.no-matching', 'No containers need this action')); return true; }
            await Promise.all(jobs.map(async job => {
                try {
                    if (!job.entry.id) throw new Error('missing-identity');
                    const response = await request(job.entry);
                    if (response?.success !== true) throw new Error('rejected');
                } catch (error) {
                    job.failed = true;
                    operation.failures.push({ name: job.name, message: error?.message === 'missing-identity'
                        ? surfaceT('docker.feedback.missing-identity', 'The container identifier is unavailable; refresh the page') : error?.message === 'rejected'
                        ? surfaceT('docker.feedback.rejected', 'The container action was rejected')
                        : surfaceT('docker.feedback.request-failed', 'The request failed or timed out') });
                } finally {
                    operation.completed++;
                    operation.message = surfaceT('docker.feedback.progress', '$1 · $2 of $3 requests completed', actionLabel(action), operation.completed, jobs.length);
                    renderOperation(operation);
                }
            }));
            if (disposed) return false;
            operation.settled = true;
            try { await refresh(); } catch (_error) { /* A completed request is not proof of runtime state. */ }
            if (disposed) return false;
            if (action === 'restart') finish(operation, operation.failures.length ? 'warning' : 'success',
                surfaceT('docker.feedback.restart-requested', '$1 restart requests accepted · $2 failed', jobs.length - operation.failures.length, operation.failures.length));
            else {
                verify(operation, read() || {});
                if (operation.busy) {
                    operation.message = surfaceT('docker.feedback.waiting', 'Requests completed · waiting for runtime status'); renderOperation(operation);
                    operation.timer = win.setTimeout(() => finish(operation, 'warning',
                        surfaceT('docker.feedback.unconfirmed', 'Runtime status is not confirmed · $1 requests failed', operation.failures.length)), 10000);
                }
            }
            return true;
        };
        const onPointer = event => {
            if (event.pointerType === 'touch' || pinned) return;
            const trigger = event.target.closest?.('[data-fv-folder-status]');
            if (trigger && !trigger.contains(event.relatedTarget)) showTip(trigger);
        };
        const onLeave = event => { if (!pinned && anchor?.contains(event.target) && !anchor.contains(event.relatedTarget)) hideTip(); };
        const onClick = event => {
            const indicator = event.target.closest?.('[data-fv-folder-operation]');
            if (indicator) {
                event.preventDefault(); event.stopPropagation();
                if (anchor === indicator && pinned) hideTip(); else showOperationTip(indicator);
                return;
            }
            const trigger = event.target.closest?.('[data-fv-folder-status]');
            if (trigger) { event.preventDefault(); event.stopPropagation(); if (pinned && anchor === trigger) hideTip(); else { showTip(trigger); pinned = true; } }
            else if (!tip?.contains(event.target)) hideTip();
        };
        const onKey = event => {
            if (event.key === 'Escape' && tip) { event.preventDefault(); hideTip(); }
            else if (['Enter', ' '].includes(event.key) && event.target.matches?.('[data-fv-folder-status], [data-fv-folder-operation]')) onClick(event);
        };
        const destroy = () => {
            disposed = true; hideTip(); operations.forEach(operation => { win.clearTimeout(operation.timer); operation.indicator?.remove(); });
            operations.clear(); targets.clear(); reservations.clear();
            doc.removeEventListener('pointerover', onPointer); doc.removeEventListener('pointerout', onLeave);
            doc.removeEventListener('focusin', onPointer); doc.removeEventListener('focusout', onLeave);
            doc.removeEventListener('click', onClick, true); doc.removeEventListener('keydown', onKey);
            win.removeEventListener('resize', hideTip); win.removeEventListener('scroll', hideTip, true);
            win.removeEventListener('pagehide', destroy);
            instances.delete(win);
        };
        doc.addEventListener('pointerover', onPointer); doc.addEventListener('pointerout', onLeave);
        doc.addEventListener('focusin', onPointer); doc.addEventListener('focusout', onLeave);
        doc.addEventListener('click', onClick, true); doc.addEventListener('keydown', onKey);
        win.addEventListener('resize', hideTip); win.addEventListener('scroll', hideTip, true);
        win.addEventListener('pagehide', destroy, { once: true });
        const api = Object.freeze({ decorateStatus, run, destroy }); instances.set(win, api); return api;
    };
    return Object.freeze({ summarize, eligible, matchesState, getApi });
}));
