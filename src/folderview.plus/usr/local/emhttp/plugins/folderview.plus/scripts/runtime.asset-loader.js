(function fvplusAssetLoaderScope(window) {
    'use strict';
    const pending = new Map();
    const loadScript = (url) => {
        const source = String(url || '').trim();
        if (!source) return Promise.reject(new Error('Asset URL is required'));
        if (pending.has(source)) return pending.get(source);
        const promise = new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts || []).find((script) => script.src === new URL(source, window.location.href).href);
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
            script.addEventListener('error', () => { pending.delete(source); reject(new Error(`Failed to load ${source}`)); }, { once: true });
            if (!existing) {
                script.src = source;
                script.dataset.fvplusLazyAsset = 'true';
                document.head.appendChild(script);
            }
        });
        pending.set(source, promise);
        return promise;
    };
    const loadSequential = (urls) => (Array.isArray(urls) ? urls : []).reduce(
        (chain, url) => chain.then(() => loadScript(url)),
        Promise.resolve()
    );
    const ensureChartStack = () => {
        if (typeof window.Chart === 'function') return Promise.resolve(window.Chart);
        const urls = window.FolderViewPlusAssetUrls?.chartStack || [];
        return loadSequential(urls).then(() => {
            if (typeof window.Chart !== 'function') throw new Error('Chart runtime did not initialize');
            return window.Chart;
        });
    };
    window.FolderViewPlusAssetLoader = Object.freeze({ loadScript, loadSequential, ensureChartStack, pendingCount: () => pending.size });
})(window);
