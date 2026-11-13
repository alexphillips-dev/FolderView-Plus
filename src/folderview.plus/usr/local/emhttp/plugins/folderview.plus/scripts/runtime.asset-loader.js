(function fvplusAssetLoaderScope(window) {
    'use strict';
    const pending = new Map();
    const loadScript = (url) => {
        const source = String(url || '').trim();
        if (!source) return Promise.reject(new Error('Asset URL is required'));
        if (pending.has(source)) return pending.get(source);
        const promise = new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts || []).find((script) => script.src === new URL(source, window.location.href).href
                && script.dataset?.fvplusLoadFailed !== 'true');
            if (existing && (existing.dataset?.fvplusLoaded === 'true'
                || existing.readyState === 'complete'
                || existing.readyState === 'loaded'
                || document.readyState !== 'loading')) {
                existing.dataset.fvplusLoaded = 'true';
                resolve(existing);
                return;
            }
            const script = existing || document.createElement('script');
            script.async = false;
            script.addEventListener('load', () => { script.dataset.fvplusLoaded = 'true'; resolve(script); }, { once: true });
            script.addEventListener('error', () => {
                script.dataset.fvplusLoadFailed = 'true';
                if (script.dataset.fvplusLazyAsset === 'true') script.remove();
                pending.delete(source);
                reject(new Error(`Failed to load ${source}`));
            }, { once: true });
            if (!existing) {
                script.src = source;
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
                    link.href = source;
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
