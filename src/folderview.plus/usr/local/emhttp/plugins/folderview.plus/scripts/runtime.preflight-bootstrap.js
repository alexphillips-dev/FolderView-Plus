(function folderViewPlusRuntimePreflightBootstrap(root) {
    'use strict';

    const win = root || globalThis;
    const meta = win.document?.querySelector?.('meta[name="fvplus-runtime-preflight"]');
    if (!meta) return;
    let payload = null;
    try {
        payload = JSON.parse(String(meta.content || ''));
    } catch (_error) {
        return;
    }
    const issues = Array.isArray(payload?.issues) ? payload.issues : [];
    const context = String(payload?.context || 'Runtime').trim() || 'Runtime';
    if (issues.length === 0) return;
    const runtimeContext = win.FolderViewPlusFatalRuntimeContext
        && typeof win.FolderViewPlusFatalRuntimeContext === 'object'
        ? win.FolderViewPlusFatalRuntimeContext
        : {};
    runtimeContext.preflight = { issues };
    win.FolderViewPlusFatalRuntimeContext = runtimeContext;
    const banner = win.FolderViewPlusFatalBanner || null;
    if (!banner) return;
    banner.setPhase?.('server-preflight');
    banner.recordAction?.(`${context} runtime preflight reported diagnostics`);
    const fatalIssue = issues.find((issue) => String(issue?.severity || '').toLowerCase() === 'fatal') || null;
    if (fatalIssue) {
        const error = new Error(String(fatalIssue.message || fatalIssue.title || `${context} runtime preflight failed`));
        error.fvplusBannerShown = true;
        banner.reportFatalError(error, {
            context,
            title: String(fatalIssue.title || `${context} runtime preflight failed`),
            message: String(fatalIssue.message || 'FolderView Plus detected a fatal environment issue before the runtime could start.'),
            code: String(fatalIssue.code || 'FVPLUS-RUN-ENV-001'),
            phase: 'server-preflight',
            category: String(fatalIssue.category || 'environment'),
            detailLabel: 'Diagnostics',
            details: Array.isArray(fatalIssue.details) ? fatalIssue.details : []
        });
        return;
    }
    const details = [];
    issues.forEach((issue) => {
        const title = String(issue?.title || 'Notice').trim();
        if (title) details.push(title);
        (Array.isArray(issue?.details) ? issue.details : []).forEach((line) => {
            const normalized = String(line || '').trim();
            if (normalized) details.push(normalized);
        });
    });
    banner.reportDegradedState('Preflight warnings detected', {
        context,
        title: `${context} troubleshooting notice`,
        message: 'FolderView Plus detected page conditions that may affect runtime behavior or supportability.',
        code: 'FVPLUS-RUN-ENV-002',
        phase: 'server-preflight',
        category: 'environment-warning',
        detailLabel: 'Checks to review',
        details
    });
}(typeof window !== 'undefined' ? window : globalThis));
