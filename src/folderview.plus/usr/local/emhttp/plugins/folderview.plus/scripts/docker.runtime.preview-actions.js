// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerPreviewActions = factory();
    root.FolderViewPlusDockerPreviewActionsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const jq = deps.$ || win?.jQuery || win?.$;
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function' ? deps.getSafeWebuiUrl : ((value) => String(value || '').trim());
        const openWebuiInNewTab = typeof deps.openWebuiInNewTab === 'function' ? deps.openWebuiInNewTab : (() => {});
        const openTerminal = typeof deps.openTerminal === 'function' ? deps.openTerminal : (() => {});
        const shouldRenderPreviewWebuiPlaceholder = typeof deps.shouldRenderPreviewWebuiPlaceholder === 'function'
            ? deps.shouldRenderPreviewWebuiPlaceholder
            : (() => false);
        const appendPreviewWebuiPlaceholder = typeof deps.appendPreviewWebuiPlaceholder === 'function'
            ? deps.appendPreviewWebuiPlaceholder
            : (() => {});
        const isCompactMultiRowPreview = typeof deps.isCompactMultiRowPreview === 'function'
            ? deps.isCompactMultiRowPreview
            : (() => false);
        const applyFolderPreviewLayout = typeof deps.applyFolderPreviewLayout === 'function'
            ? deps.applyFolderPreviewLayout
            : (() => {});
        const layoutFolderPreviewRows = typeof deps.layoutFolderPreviewRows === 'function'
            ? deps.layoutFolderPreviewRows
            : (() => {});
        const webuiLinkRel = String(deps.webuiLinkRel || 'noopener noreferrer').trim() || 'noopener noreferrer';

        const buildDockerPreviewWebuiButton = (webuiUrl) => jq('<span class="folder-element-custom-btn folder-element-webui"></span>').append(
            jq('<a></a>')
                .attr('href', webuiUrl)
                .attr('target', '_blank')
                .attr('rel', webuiLinkRel)
                .attr('data-fv-preview-action', 'webui')
                .attr('data-webui-url', webuiUrl)
                .append('<i class="fa fa-globe" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openWebuiInNewTab(webuiUrl);
                })
        );

        const buildDockerPreviewConsoleButton = (containerName, shellValue) => jq('<span class="folder-element-custom-btn folder-element-console"></span>').append(
            jq('<a href="#"></a>')
                .attr('data-fv-preview-action', 'console')
                .attr('data-container-name', containerName)
                .attr('data-shell-value', shellValue)
                .append('<i class="fa fa-terminal" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openTerminal('docker', containerName, shellValue);
                })
        );

        const buildDockerPreviewLogsButton = (containerName) => jq('<span class="folder-element-custom-btn folder-element-logs"></span>').append(
            jq('<a href="#"></a>')
                .attr('data-fv-preview-action', 'logs')
                .attr('data-container-name', containerName)
                .attr('data-shell-value', '.log')
                .append('<i class="fa fa-bars" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openTerminal('docker', containerName, '.log');
                })
        );

        const collectDockerPreviewActionTargets = ($preview, settings = {}) => {
            if (!$preview || !$preview.length) {
                return [];
            }
            if (isCompactMultiRowPreview(settings)) {
                return $preview.find('.fv-preview-actions-compact').get().map((node) => jq(node));
            }
            const previewMode = Number(settings?.preview || 0);
            switch (previewMode) {
                case 2:
                    return $preview.find('span.hand').get().map((node) => jq(node));
                case 3:
                    return $preview.find('span.inner').get().map((node) => jq(node));
                case 4:
                    return $preview.find('span.outer > span.inner').get().map((node) => jq(node));
                case 1:
                default:
                    return $preview.find('span.outer').get().map((node) => {
                        const $outer = jq(node);
                        const $inner = $outer.children('span.inner').last();
                        return $inner.length ? $inner : $outer;
                    });
            }
        };

        const appendDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '') => {
            if (!$target || !$target.length) {
                return;
            }
            if (settings.preview_webui && webuiUrl) {
                $target.append(buildDockerPreviewWebuiButton(webuiUrl));
            } else if (shouldRenderPreviewWebuiPlaceholder(settings, settings.preview_webui === true)) {
                appendPreviewWebuiPlaceholder($target);
            }
            if (settings.preview_console && containerName) {
                $target.append(buildDockerPreviewConsoleButton(containerName, shellValue));
            }
            if (settings.preview_logs && containerName) {
                $target.append(buildDockerPreviewLogsButton(containerName));
            }
        };

        const getDockerPreviewStatusMeta = (entry = {}) => {
            const running = entry?.state === true;
            const paused = running && entry?.pause === true;
            if (running && paused) {
                return {
                    key: 'paused',
                    icon: 'fa-pause',
                    compactClassName: 'fv-preview-status-paused',
                    legacyStateClass: 'paused',
                    legacyToneClass: 'orange-text'
                };
            }
            if (running) {
                return {
                    key: 'started',
                    icon: 'fa-play',
                    compactClassName: 'fv-preview-status-started',
                    legacyStateClass: 'started',
                    legacyToneClass: 'green-text'
                };
            }
            return {
                key: 'stopped',
                icon: 'fa-square',
                compactClassName: 'fv-preview-status-stopped',
                legacyStateClass: 'stopped',
                legacyToneClass: 'red-text'
            };
        };

        const resolveDockerPreviewStateTargets = ($target) => {
            if (!$target || !$target.length) {
                return {
                    $compactStatus: jq(),
                    $stateLabel: jq(),
                    $icon: jq()
                };
            }
            const $compactStatus = $target.hasClass('fv-preview-status-compact')
                ? $target
                : $target.siblings('.fv-preview-status-compact').first();
            if ($compactStatus.length) {
                return {
                    $compactStatus,
                    $stateLabel: $compactStatus.find('span.state').first(),
                    $icon: $compactStatus.find('i.fa').first()
                };
            }
            const $stateLabel = $target.find('span.state').first().length
                ? $target.find('span.state').first()
                : $target.closest('span.inner, span.outer').find('span.state').first();
            const $icon = $stateLabel.length
                ? $stateLabel.prevAll('i.fa').first()
                : jq();
            return {
                $compactStatus: jq(),
                $stateLabel,
                $icon
            };
        };

        const syncDockerPreviewStatus = ($target, entry = {}) => {
            const { $compactStatus, $stateLabel, $icon } = resolveDockerPreviewStateTargets($target);
            if (!$stateLabel.length && !$icon.length && !$compactStatus.length) {
                return;
            }
            const statusMeta = getDockerPreviewStatusMeta(entry);
            const localizedLabel = typeof jq?.i18n === 'function'
                ? String(jq.i18n(statusMeta.key) || statusMeta.key).trim()
                : statusMeta.key;
            if ($compactStatus.length) {
                $compactStatus.attr('title', localizedLabel);
            }
            if ($icon.length) {
                $icon
                    .removeClass('fa-play fa-pause fa-square started paused stopped green-text orange-text red-text fv-preview-status-started fv-preview-status-paused fv-preview-status-stopped')
                    .addClass(`fa ${statusMeta.icon} ${$compactStatus.length ? statusMeta.compactClassName : `${statusMeta.legacyStateClass} ${statusMeta.legacyToneClass}`}`);
            }
            if ($stateLabel.length) {
                $stateLabel.text(` ${localizedLabel}`);
            }
        };

        const syncDockerLeafFolderPreviewActions = (id, folder, runtimeContainers) => {
            const $preview = jq(`tr.folder-id-${id} div.folder-preview`);
            if (!$preview.length) {
                return;
            }
            const settings = folder?.settings || {};
            const previewMode = Number(settings?.preview || 0);
            if (previewMode <= 0) {
                $preview.empty();
                return;
            }
            const actionTargets = collectDockerPreviewActionTargets($preview, settings);
            const entries = Object.values(runtimeContainers || {});
            actionTargets.forEach(($target, index) => {
                const entry = entries[index];
                if (!$target || !$target.length || !entry) {
                    return;
                }
                const containerName = String(entry?.name || '').trim();
                const shellValue = String(entry?.shell || '/bin/sh').trim() || '/bin/sh';
                const webuiUrl = getSafeWebuiUrl(entry?.webui);
                syncDockerPreviewStatus($target, entry);
                $target.children('span.folder-element-webui, span.folder-element-console, span.folder-element-logs, span.fv-preview-webui-placeholder').remove();
                appendDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl);
            });
            $preview.find('[id^="folder-preview-"]').each((_, node) => {
                jq(node).data('fvTooltipLazyBuilt', false);
            });
            applyFolderPreviewLayout($preview, settings);
            layoutFolderPreviewRows($preview, settings);
            $preview.find('span.inner > span.appname').css('width', settings?.preview_text_width || '');
        };

        return Object.freeze({
            appendDockerPreviewActionButtons,
            syncDockerLeafFolderPreviewActions
        });
    };

    return Object.freeze({
        createApi
    });
}));
