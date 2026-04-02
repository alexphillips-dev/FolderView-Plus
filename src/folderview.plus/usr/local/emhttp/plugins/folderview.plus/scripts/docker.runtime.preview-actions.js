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
                .append('<i class="fa fa-globe" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    openWebuiInNewTab(webuiUrl);
                })
        );

        const buildDockerPreviewConsoleButton = (containerName, shellValue) => jq('<span class="folder-element-custom-btn folder-element-console"></span>').append(
            jq('<a href="#"></a>')
                .append('<i class="fa fa-terminal" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
                    openTerminal('docker', containerName, shellValue);
                })
        );

        const buildDockerPreviewLogsButton = (containerName) => jq('<span class="folder-element-custom-btn folder-element-logs"></span>').append(
            jq('<a href="#"></a>')
                .append('<i class="fa fa-bars" aria-hidden="true"></i>')
                .on('click', (event) => {
                    event.preventDefault();
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
