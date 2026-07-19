(() => {
    const folders = {
        media: { name: 'Media', createdAt: '2026-07-19T12:00:00Z' },
        child: { name: 'Movies', parentId: 'media', createdAt: '2026-07-19T12:05:00Z' }
    };
    const calls = [];
    window.fixtureFolderEditor = { calls, ready: false };
    window.normalizeManagedType = (type) => type === 'vm' ? 'vm' : 'docker';
    window.getFolderMap = () => folders;
    window.getEffectiveMemberSnapshot = () => ({ media: { members: ['plex', 'sonarr'] }, child: { members: [] } });
    window.infoByType = { docker: { plex: { state: 'started' }, sonarr: { state: 'stopped', updateAvailable: true } }, vm: {} };
    window.getItemRuntimeStateKind = (_type, info) => String(info?.state || 'stopped');
    window.prefsByType = { docker: { autoRules: [], pinnedFolderIds: [] }, vm: { autoRules: [], pinnedFolderIds: [] } };
    window.formatTimestamp = (value) => String(value || 'Unknown');
    window.isFolderPinned = () => false;
    window.isDockerUpdateAvailable = (info) => info?.updateAvailable === true;
    window.evaluateDockerFolderHealth = () => ({ text: 'Healthy' });
    window.normalizeHealthPrefs = () => ({ warnStoppedPercent: 60 });
    window.buildFolderHierarchyMeta = () => ({
        parentById: { media: '', child: 'media' },
        childrenById: { media: ['child'], child: [] }
    });
    window.getFolderBranchIds = () => ['media', 'child'];
    window.syncCollapsedTreeParentsForType = () => new Set();
    window.canFolderUseTreeMove = () => true;
    window.buildFolderPathLabel = () => 'Media';
    window.escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    window.openFolderTreeMoveDialog = () => calls.push('move');
    window.setFolderBranchCollapse = () => calls.push('collapse');
    window.setFolderBranchPinned = () => calls.push('pin');
    window.exportFolderBranch = () => calls.push('export');
    window.downloadDocker = () => calls.push('download-docker');
    window.downloadVm = () => calls.push('download-vm');
    window.importFolderBranch = () => calls.push('import');
    window.clearDocker = () => calls.push('delete');
    window.clearVm = () => calls.push('delete-vm');
    window.copyTextToClipboard = async (value) => calls.push(`copy:${value}`);
    window.showError = (_title, error) => calls.push(`error:${String(error?.message || error || '')}`);
    window.collectVmFolderResources = () => ({ autostartCount: 0 });
    window.evaluateVmResourceBadge = () => ({ text: '0 vCPU | 0 GB' });
    window.rowLongPressByType = { docker: null, vm: null };
    window.tableIdByType = { docker: 'docker', vm: 'vms' };
})();
