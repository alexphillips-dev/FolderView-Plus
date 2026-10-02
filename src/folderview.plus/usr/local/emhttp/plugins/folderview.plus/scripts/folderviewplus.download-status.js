(() => {
    const importT = (key, fallback) => window.FolderViewPlusI18n?.t?.(key, fallback) ?? fallback;
    const renderDownloadAttemptStatus = (attempt, options = {}) => {
        const resolvedType = attempt?.type === 'vm' ? 'vm' : (attempt?.type === 'docker' ? 'docker' : '');
        if (!resolvedType) {
            return;
        }
        let panel = $(`#${resolvedType}-download-status`);
        if (!panel.length) {
            const folderTable = $(`h2[data-fv-section="${resolvedType === 'vm' ? 'vms' : 'docker'}"]`).next('.folder-table');
            const toolbar = folderTable.find('.folder-toolbar').first();
            if (toolbar.length) {
                panel = $('<div class="fv-download-status" role="status" aria-live="polite" hidden></div>')
                    .attr('id', `${resolvedType}-download-status`);
                toolbar.after(panel);
            }
        }
        if (!panel.length) {
            return;
        }
        const reportedMissing = attempt?.lifecycle === 'user-reported-missing';
        const failed = attempt?.lifecycle === 'synchronous-failure';
        const retryRequested = options.retry === true;
        const title = failed
            ? importT("common.audit.download-failed", "Download request failed")
            : (reportedMissing ? 'Download was not received' : (retryRequested ? 'Download retry requested' : importT('common.download.sent', 'Export sent to your browser')));
        const message = failed
            ? 'FolderView Plus could not hand the export to this browser. The failure is included in the support bundle.'
            : (reportedMissing
                ? 'The missing file has been recorded in diagnostics. Retry from this button to provide a fresh browser user gesture.'
                : importT('common.download.check', 'Check your Downloads folder.'));
        const icon = failed ? 'fa-exclamation-triangle' : (reportedMissing ? 'fa-info-circle' : 'fa-download');
        const content = $('<span class="fv-download-status-copy"></span>');
        content.append($(`<i class="fa ${icon}" aria-hidden="true"></i>`));
        const text = $('<span></span>');
        text.append($('<strong></strong>').text(title));
        text.append($('<small></small>').text(message));
        content.append(text);
        const actions = $('<span class="fv-download-status-actions"></span>');
        const isCurrent = () => panel.data('download-attempt') === attempt.attemptId && !panel.prop('hidden');
        const dismissButton = $('<button type="button" class="fv-download-status-dismiss"></button>')
            .text(importT('legacy.surface.48845bff334a50a5', 'Dismiss'));
        dismissButton.on('click.fvdownload', () => {
            panel.prop('hidden', true).empty();
            $(`[data-fv-onclick="${resolvedType === 'vm' ? 'downloadVm()' : 'downloadDocker()'}"]`).first().trigger('focus');
        });
        actions.append(dismissButton);

        if (!failed && !reportedMissing) {
            const missingButton = $('<button type="button" class="fv-download-status-report"></button>')
                .text(importT('common.download.help', 'File missing? Get help'));
            missingButton.on('click.fvdownload', async () => {
                const updated = getDownloadDiagnosticsApi()?.reportMissing(attempt.attemptId);
                if (!updated) {
                    panel.addClass('is-error');
                    panel.find('.fv-download-status-copy small').text('The diagnostic attempt expired. Run the export again, then report it if no file appears.');
                    return;
                }
                await trackDiagnosticsEvent({
                    eventType: 'export_download_missing',
                    type: resolvedType,
                    status: 'warning',
                    details: buildDownloadDiagnosticsEventDetails(updated)
                });
                if (isCurrent()) renderDownloadAttemptStatus(updated);
            });
            actions.append(missingButton);
        }

        if (reportedMissing) {
            const retryButton = $('<button type="button" class="fv-download-status-retry"><i class="fa fa-refresh" aria-hidden="true"></i> Retry download</button>');
            retryButton.on('click.fvdownload', async () => {
                try {
                    const result = getDownloadDiagnosticsApi()?.retry(attempt.attemptId);
                    if (!result?.ok || !result.attempt) {
                        panel.addClass('is-error');
                        panel.find('.fv-download-status-copy small').text('The in-memory export is no longer available. Select Export all again to create a fresh file.');
                        return;
                    }
                    await trackDiagnosticsEvent({
                        eventType: 'export',
                        type: resolvedType,
                        details: buildDownloadDiagnosticsEventDetails(result.attempt)
                    });
                    if (isCurrent()) renderDownloadAttemptStatus(result.attempt, { retry: true });
                } catch (error) {
                    const failedAttempt = error?.fvplusDownloadAttempt;
                    if (failedAttempt) {
                        await trackDiagnosticsEvent({
                            eventType: 'export',
                            type: resolvedType,
                            status: 'error',
                            details: buildDownloadDiagnosticsEventDetails(failedAttempt)
                        });
                        if (isCurrent()) renderDownloadAttemptStatus(failedAttempt);
                        return;
                    }
                    panel.addClass('is-error');
                    panel.find('.fv-download-status-copy small').text('The retry failed before a browser download request could be created.');
                }
            });
            actions.append(retryButton);
        }

        panel
            .data('download-attempt', attempt.attemptId)
            .removeClass('is-error is-warning is-requested')
            .addClass(failed ? 'is-error' : (reportedMissing ? 'is-warning' : 'is-requested'))
            .empty()
            .append(content)
            .append(actions)
            .prop('hidden', false);
    };
    window.FolderViewPlusFoundationModules = window.FolderViewPlusFoundationModules || {};
    window.FolderViewPlusFoundationModules.downloadStatus = Object.freeze({ render: renderDownloadAttemptStatus });
})();
