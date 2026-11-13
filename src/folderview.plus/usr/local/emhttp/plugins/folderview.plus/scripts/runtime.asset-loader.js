(function fvplusAssetLoaderScope(window) {
    'use strict';
    const pending = new Map();
    const failedAttempts = new Map();
    const buildAttemptUrl = (source) => {
        const attempt = failedAttempts.get(source) || 0;
        if (!attempt) return source;
        const url = new URL(source, window.location.href);
        url.searchParams.set('fv_retry', String(attempt));
        return url.href;
    };
    const loadScript = (url) => {
        const source = String(url || '').trim();
        if (!source) return Promise.reject(new Error('Asset URL is required'));
        if (pending.has(source)) return pending.get(source);
        const promise = new Promise((resolve, reject) => {
            const requestedUrl = buildAttemptUrl(source);
            const existing = Array.from(document.scripts || []).find((script) => script.src === new URL(requestedUrl, window.location.href).href
                && script.dataset?.fvplusLoadFailed !== 'true');
            if (existing && (existing.dataset?.fvplusLoaded === 'true'
                || existing.readyState === 'complete'
                || existing.readyState === 'loaded'
                || document.readyState !== 'loading')) {
                failedAttempts.delete(source);
                existing.dataset.fvplusLoaded = 'true';
                resolve(existing);
                return;
            }
            const script = existing || document.createElement('script');
            script.async = false;
            script.addEventListener('load', () => { failedAttempts.delete(source); script.dataset.fvplusLoaded = 'true'; resolve(script); }, { once: true });
            script.addEventListener('error', () => {
                script.dataset.fvplusLoadFailed = 'true';
                if (script.dataset.fvplusLazyAsset === 'true') script.remove();
                failedAttempts.set(source, (failedAttempts.get(source) || 0) + 1);
                pending.delete(source);
                reject(new Error(`Failed to load ${source}`));
            }, { once: true });
            if (!existing) {
                script.src = requestedUrl;
                script.dataset.fvplusLazyAsset = 'true';
                document.head.appendChild(script);
            }
        });
        pending.set(source, promise);
        return promise;
    };
    const loadSequential = (urls) => {
        const sources = Array.isArray(urls) ? urls : [];
        const preloads = [];
        try {
            if (document.head?.appendChild) {
                for (const source of new Set(sources.map((url) => String(url || '').trim()).filter(Boolean))) {
                    if (pending.has(source)) continue;
                    const link = document.createElement('link');
                    if (link.relList?.supports?.('preload') !== true) break;
                    link.rel = 'preload';
                    link.as = 'script';
                    link.href = buildAttemptUrl(source);
                    link.dataset.fvplusLazyPreload = 'true';
                    preloads.push(link);
                    document.head.appendChild(link);
                }
            }
        } catch (_error) {
            // Optional hints never replace ordered loading or its failure/retry path.
        }
        return sources.reduce(
            (chain, url) => chain.then(() => loadScript(url)),
            Promise.resolve()
        ).finally(() => {
            preloads.forEach((link) => {
                try { link.remove(); } catch (_error) { /* Resource hint cleanup is best-effort. */ }
            });
        });
    };
    const ensureChartStack = () => {
        const urls = window.FolderViewPlusAssetUrls?.chartStack || [];
        return loadSequential(urls).then(() => {
            if (typeof window.Chart !== 'function') throw new Error('Chart runtime did not initialize');
            return window.Chart;
        });
    };
    window.FolderViewPlusAssetLoader = Object.freeze({ loadScript, loadSequential, ensureChartStack, pendingCount: () => pending.size });
})(window);
