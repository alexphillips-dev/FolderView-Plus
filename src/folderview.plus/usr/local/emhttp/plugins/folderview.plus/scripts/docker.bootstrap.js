// @ts-check
(function dockerBootstrapScope(window) {
    'use strict';

    const compatibilityModule = window.FolderViewPlusHostCompatibility || null;
    const compatibilityController = window.FolderViewPlusDockerHostCompatibilityController
        || compatibilityModule?.getDefaultController?.({
            window,
            document: window.document
        })
        || null;
    const initialDecision = window.FolderViewPlusDockerHostCompatibilityDecision || null;
    const decision = compatibilityController?.evaluateDockerRuntime?.()
        || initialDecision
        || {
            hostGeneration: 'unknown-docker-host',
            runtimeActivationAllowed: false
        };
    window.FolderViewPlusDockerHostCompatibilityController = compatibilityController;
    window.FolderViewPlusDockerHostCompatibilityDecision = decision;

    const providerRegistry = window.FolderViewPlusDockerProviders?.getDefaultRegistry?.({
        window,
        document: window.document,
        compatibilityModule,
        compatibilityController,
        transport: window.FolderViewPlusRuntimeTransport || null
    }) || null;

    const start = async () => {
        const timing = window.FolderViewPlusRuntimePerformanceTelemetry?.getOrCreate?.('docker', { window, document: window.document });
        timing?.begin?.('providerPreparation');
        let pageExited = false;
        window.addEventListener?.('pagehide', () => {
            pageExited = true;
            providerRegistry?.dispose?.();
        }, { once: true });
        await providerRegistry?.prepare?.({
            hostGeneration: decision.hostGeneration
        });
        timing?.end?.('providerPreparation');
        if (pageExited) {
            return {
                loaded: false,
                hostGeneration: decision.hostGeneration,
                reason: 'page-exited'
            };
        }
        if (decision.runtimeActivationAllowed !== true) {
            return {
                loaded: false,
                hostGeneration: decision.hostGeneration,
                reason: 'compatibility-safe-mode'
            };
        }

        window.document?.querySelectorAll?.('link[data-fvplus-docker-legacy-style="true"]')
            .forEach((link) => {
                link.media = 'all';
            });

        try {
            timing?.begin?.('customScripts');
            const loadCustomScripts = window.FolderViewPlusDockerLoadCustomScripts;
            window.FolderViewPlusDockerCustomScriptsReady = typeof loadCustomScripts === 'function'
                ? Promise.resolve(loadCustomScripts())
                : (window.FolderViewPlusDockerCustomScriptsReady || Promise.resolve());
            await window.FolderViewPlusDockerCustomScriptsReady;
        } catch (_error) {
            // Custom overrides are optional. A failed override must not prevent the core runtime.
        } finally {
            timing?.end?.('customScripts');
        }

        const runtimeUrl = String(window.FolderViewPlusDockerRuntimeAssetUrl || '').trim();
        if (!runtimeUrl) {
            throw new Error('FolderView Plus Docker runtime asset URL is unavailable.');
        }
        if (window.document?.querySelector?.('script[data-fvplus-docker-runtime="true"]')) {
            return {
                loaded: true,
                hostGeneration: decision.hostGeneration,
                reason: 'already-loaded'
            };
        }
        timing?.begin?.('runtimeAsset');
        await new Promise((resolve, reject) => {
            const script = window.document.createElement('script');
            script.src = runtimeUrl;
            script.async = false;
            script.dataset.fvplusDockerRuntime = 'true';
            script.onload = resolve;
            script.onerror = () => reject(new Error('FolderView Plus Docker runtime could not be loaded.'));
            (window.document.head || window.document.documentElement).appendChild(script);
        });
        timing?.end?.('runtimeAsset');
        timing?.mark?.('runtimeLoaded');
        return {
            loaded: true,
            hostGeneration: decision.hostGeneration,
            reason: 'legacy-runtime-loaded'
        };
    };

    window.FolderViewPlusDockerBootstrapPromise = start().catch((error) => {
        const fatalBanner = window.FolderViewPlusFatalBanner || null;
        if (fatalBanner && typeof fatalBanner.reportFatalError === 'function') {
            fatalBanner.reportFatalError(error, {
                title: 'Docker runtime could not start',
                message: 'FolderView Plus could not load its legacy Docker runtime assets.',
                code: 'FVPLUS-DKR-BOOT-002',
                phase: 'runtime-load',
                category: 'asset-load'
            });
            error.fvplusBannerShown = true;
        }
        throw error;
    });
    window.FolderViewPlusDockerBootstrapModuleLoaded = true;
}(window));
