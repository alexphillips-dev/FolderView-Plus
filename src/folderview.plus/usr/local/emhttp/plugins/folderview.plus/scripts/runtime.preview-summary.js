(function runtimePreviewSummaryModule(win) {
    'use strict';

    const endpoint = '/plugins/folderview.plus/server/docker_runtime_preview.php';
    const privacyClasses = ['fvplus-privacy-docker-runtime', 'fvplus-privacy-docker-dashboard'];
    const restartPolicies = ['no', 'always', 'unless-stopped', 'on-failure'];
    const networkModes = ['bridge', 'host', 'none', 'default', 'nat', 'container', 'custom'];
    const composeLabel = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
    const envName = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
    const dockerId = /^(?:(?:sha256|docker|Container|DockerContainer):)?([a-f0-9]{12}|[a-f0-9]{64})$/;
    const i18nText = (key, fallback) => win.FolderViewPlusI18n?.t(key, fallback) ?? fallback;

    const idFor = (entry, fullOnly = false) => {
        const ids = [entry?.id, entry?.fullContainerId, entry?.info?.Id, entry?.Id, entry?.shortId]
            .map(value => typeof value === 'string' ? dockerId.exec(value)?.[1] : null)
            .filter(Boolean);
        const full = ids.find(id => id.length === 64);
        if (full) return ids.every(id => full.startsWith(id)) ? full : '';
        return fullOnly ? '' : ids[0] || '';
    };

    const append = (parent, tag, value, className) => {
        const element = parent.ownerDocument.createElement(tag);
        if (value !== undefined) element.textContent = value;
        if (className) element.className = className;
        parent.append(element);
        return element;
    };

    const render = (panel, summary) => {
        const unknown = i18nText('common.runtime-preview.unknown', 'Unknown');
        const labels = append(panel, 'dl');
        const row = (label, value) => {
            append(labels, 'dt', label);
            append(labels, 'dd', value);
        };
        if (typeof summary.composeProject === 'string' && composeLabel.test(summary.composeProject)) {
            row(i18nText('common.runtime-preview.compose-project', 'Docker Compose project'), summary.composeProject);
        }
        if (typeof summary.composeService === 'string' && composeLabel.test(summary.composeService)) {
            row(i18nText('common.runtime-preview.compose-service', 'Docker Compose service'), summary.composeService);
        }
        row(i18nText('common.runtime-preview.restart-policy', 'Restart policy'),
            restartPolicies.includes(summary.restartPolicy) ? summary.restartPolicy : unknown);
        const network = summary.networkMode === 'custom'
            ? i18nText('common.runtime-preview.custom-network', 'Custom network')
            : summary.networkMode === 'container'
                ? i18nText('common.runtime-preview.container-network', 'Container network')
                : networkModes.includes(summary.networkMode) ? summary.networkMode : unknown;
        row(i18nText('common.runtime-preview.network-mode', 'Network mode'), network);

        const environment = Array.isArray(summary.environment)
            ? summary.environment.slice(0, 256).filter(entry => typeof entry?.name === 'string' && envName.test(entry.name))
            : [];
        if (!environment.length) return;

        append(panel, 'p', i18nText('common.runtime-preview.environment', 'Environment variable names'));
        const list = append(panel, 'ul');
        environment.forEach(entry => {
            const item = append(list, 'li');
            append(item, 'code', entry.name);
            if (entry.overridden === true) {
                append(item, 'span', i18nText('common.runtime-preview.overridden', 'Overridden'));
            } else if (entry.overridden === null) {
                append(item, 'span', unknown);
            }
        });
    };

    const attach = (tooltip, { instance, surface, entry, getCurrentEntry, origin } = {}) => {
        const root = tooltip?.[0] || tooltip;
        const content = root?.querySelector?.('.tooltipster-content') || root;
        const doc = root?.ownerDocument;
        const request = win.FolderViewPlusRequest;
        const originalId = idFor(entry);
        if (!doc || !originalId || typeof request?.getJson !== 'function') return;

        const currentId = () => {
            const id = idFor(getCurrentEntry ? getCurrentEntry() : entry, true);
            return id.startsWith(originalId) ? id : '';
        };
        const isPrivate = () => privacyClasses.some(className => doc.body.classList.contains(className));
        const isClosing = () => ['disappearing', 'closed'].includes(instance?.status?.()?.state);
        let details;
        let panel;
        let pending;
        let displayedId = '';
        let disposed = false;
        const clear = () => {
            const previous = pending;
            pending = null;
            displayedId = '';
            previous?.abort();
            panel?.replaceChildren();
        };
        const reset = () => {
            if (details) details.open = false;
            clear();
        };
        const onToggle = async () => {
            clear();
            if (!details?.open || disposed || isPrivate() || isClosing() || !root.isConnected) return;
            const id = currentId();
            if (!id) return status(i18nText('common.runtime-preview.unavailable', 'Runtime details unavailable.'));
            displayedId = id;
            const controller = new AbortController();
            pending = controller;
            const accepts = () => pending === controller && details?.open && root.contains(details)
                && root.isConnected && !disposed && !isClosing() && !isPrivate() && currentId() === id;
            const unavailable = () => status(i18nText('common.runtime-preview.unavailable', 'Runtime details unavailable.'));
            status(i18nText('common.runtime-preview.loading', 'Loading runtime details…'));
            try {
                const result = await request.getJson(endpoint, {
                    headers: { 'X-FV-Container': id, 'X-FV-Surface': surface },
                    signal: controller.signal,
                    retries: 0
                });
                if (!accepts()) return;
                if (result?.ok !== true || !result.summary || typeof result.summary !== 'object') return unavailable();
                panel.replaceChildren();
                render(panel, result.summary);
            } catch (_error) {
                if (accepts()) unavailable();
            } finally {
                if (pending === controller) pending = null;
            }
        };
        const status = message => {
            panel.replaceChildren();
            append(panel, 'p', message).setAttribute('role', 'status');
        };
        const mount = () => {
            if (disposed) return;
            if (details && !root.contains(details)) {
                reset();
                details.removeEventListener('toggle', onToggle);
                details = null;
                panel = null;
            }
            const host = content.querySelector?.('.preview-outbox');
            if (!details && host) {
                details = append(host, 'details', undefined, 'fv-runtime-preview-summary');
                append(details, 'summary', i18nText('common.runtime-preview.title', 'Runtime details'));
                panel = append(details, 'div', undefined, 'fv-runtime-preview-panel');
                details.addEventListener('toggle', onToggle);
            }
            if (details) {
                details.hidden = isPrivate();
                if (details.hidden || isClosing() || (displayedId && displayedId !== currentId())) reset();
            }
        };
        const onState = event => {
            if (event?.state === 'disappearing' || event?.state === 'closed') reset();
        };
        const observer = new MutationObserver(mount);
        observer.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
        observer.observe(content, { childList: true });
        const member = (origin?.[0] || origin)?.closest?.('[data-fv-runtime-name]');
        if (member) observer.observe(member, { attributes: true, attributeFilter: ['data-fv-runtime-state'] });
        instance?.on?.('state', onState);
        const dispose = () => {
            disposed = true;
            observer.disconnect();
            instance?.off?.('state', onState);
            win.removeEventListener('pagehide', onPageHide);
            reset();
            details?.removeEventListener('toggle', onToggle);
            details?.remove();
        };
        const onPageHide = event => {
            if (event?.persisted) reset();
            else dispose();
        };
        win.addEventListener('pagehide', onPageHide);
        mount();
        return dispose;
    };

    win.FolderViewPlusFoundationModules = win.FolderViewPlusFoundationModules || {};
    win.FolderViewPlusFoundationModules.runtimePreviewSummary = Object.freeze({ attach });
}(window));
