(() => {
    const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg';

    const buildForceRefreshInstallScript = ({
        manifestUrl = DEFAULT_MANIFEST_URL,
        cacheBust = Date.now(),
        pluginName = 'folderview.plus'
    } = {}) => {
        const safeManifestUrl = String(manifestUrl || DEFAULT_MANIFEST_URL).trim() || DEFAULT_MANIFEST_URL;
        const safePluginName = String(pluginName || 'folderview.plus').trim() || 'folderview.plus';
        const ts = String(cacheBust || Date.now()).replace(/[^0-9]/g, '').slice(0, 24) || String(Date.now());
        const quotedUrl = `${safeManifestUrl}?ts=${ts}`;
        return [
            `rm -f /boot/config/plugins/${safePluginName}/${safePluginName}-*.txz`,
            `wget -O /tmp/${safePluginName}.plg "${quotedUrl}"`,
            `installplg /tmp/${safePluginName}.plg`,
            `cat /boot/config/plugins/${safePluginName}/version`
        ].join('\n');
    };

    const checkForUpdatesNow = async ({
        apiGetJson,
        setUpdateStatus,
        showError,
        swalFn = window.swal
    }) => {
        if (typeof setUpdateStatus === 'function') {
            setUpdateStatus('Checking for updates...');
        }
        try {
            const response = await apiGetJson('/plugins/folderview.plus/server/update_check.php');
            if (!response?.ok) {
                if (typeof setUpdateStatus === 'function') {
                    setUpdateStatus('Update check failed.');
                }
                if (typeof swalFn === 'function') {
                    swalFn({
                        title: 'Update check failed',
                        text: response?.error || 'Unable to check for updates right now.',
                        type: 'error'
                    });
                }
                return response;
            }

            const message = response.updateAvailable
                ? `Update available: ${response.currentVersion} -> ${response.remoteVersion}`
                : `Up to date: ${response.currentVersion}`;
            const statusMeta = `${response.responseStatus || 'status unknown'} | ${response.durationMs ?? '?'}ms`;

            if (typeof setUpdateStatus === 'function') {
                setUpdateStatus(`${message} (checked ${response.checkedAt})`);
            }
            if (typeof swalFn === 'function') {
                swalFn({
                    title: response.updateAvailable ? 'Update available' : 'No update available',
                    text: `${message}\nSource: ${response.manifestUrl}\nRequest: ${response.requestUrl || response.manifestUrl}\nNetwork: ${statusMeta}`,
                    type: response.updateAvailable ? 'warning' : 'success'
                });
            }
            return response;
        } catch (error) {
            if (typeof setUpdateStatus === 'function') {
                setUpdateStatus('Update check failed.');
            }
            if (typeof showError === 'function') {
                showError('Update check failed', error);
            } else {
                throw error;
            }
            return null;
        }
    };

    const showDevForceRefreshHelper = async ({
        apiGetJson,
        apiGetText,
        setUpdateStatus,
        showError,
        swalFn = window.swal
    }) => {
        if (typeof setUpdateStatus === 'function') {
            setUpdateStatus('Preparing force-refresh helper...');
        }
        try {
            const [updateCheck, localVersionRaw] = await Promise.all([
                apiGetJson('/plugins/folderview.plus/server/update_check.php'),
                apiGetText('/plugins/folderview.plus/server/version.php')
            ]);
            const manifestUrl = String(updateCheck?.manifestUrl || DEFAULT_MANIFEST_URL).trim() || DEFAULT_MANIFEST_URL;
            const localVersion = String(localVersionRaw || '').trim() || String(updateCheck?.currentVersion || '').trim() || 'unknown';
            const script = buildForceRefreshInstallScript({
                manifestUrl,
                cacheBust: Date.now(),
                pluginName: 'folderview.plus'
            });

            let copied = false;
            if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
                try {
                    await navigator.clipboard.writeText(script);
                    copied = true;
                } catch (_error) {
                    copied = false;
                }
            }

            if (typeof setUpdateStatus === 'function') {
                setUpdateStatus(copied
                    ? 'Force-refresh helper copied to clipboard.'
                    : 'Force-refresh helper ready (copy from dialog).');
            }
            if (typeof swalFn === 'function') {
                const messageLines = [
                    `Installed version: ${localVersion}`,
                    `Manifest: ${manifestUrl}`,
                    '',
                    'Run on Unraid CLI:',
                    script
                ];
                if (copied) {
                    messageLines.push('', 'Copied to clipboard.');
                }
                swalFn({
                    title: 'Force-refresh install helper',
                    text: messageLines.join('\n'),
                    type: 'info'
                });
            }
            return {
                script,
                copied,
                manifestUrl,
                localVersion
            };
        } catch (error) {
            if (typeof setUpdateStatus === 'function') {
                setUpdateStatus('Force-refresh helper failed.');
            }
            if (typeof showError === 'function') {
                showError('Force-refresh helper failed', error);
                return null;
            }
            throw error;
        }
    };

    window.FolderViewPlusUpdateTools = Object.freeze({
        buildForceRefreshInstallScript,
        checkForUpdatesNow,
        showDevForceRefreshHelper
    });
})();
