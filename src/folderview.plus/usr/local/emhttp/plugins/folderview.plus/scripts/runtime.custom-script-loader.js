(function folderViewPlusCustomScriptLoader(root) {
    'use strict';

    let customScriptsPromise = null;
    root.FolderViewPlusDockerLoadCustomScripts = () => {
        if (customScriptsPromise) return customScriptsPromise;
        customScriptsPromise = (async () => {
            const meta = root.document?.querySelector?.('meta[name="fvplus-docker-custom-scripts"]');
            let sources = [];
            try {
                const parsed = JSON.parse(String(meta?.content || '[]'));
                sources = Array.isArray(parsed) ? parsed.map((value) => String(value || '').trim()).filter(Boolean) : [];
            } catch (_error) {
                sources = [];
            }
            for (const source of sources) {
                const loaded = await new Promise((resolve) => {
                    const script = root.document.createElement('script');
                    script.src = source;
                    script.async = false;
                    script.dataset.fvplusDockerLegacyCustom = 'true';
                    script.addEventListener('load', () => resolve(true), { once: true });
                    script.addEventListener('error', () => resolve(false), { once: true });
                    (root.document.head || root.document.documentElement).appendChild(script);
                });
                if (!loaded) root.console?.warn?.('A Docker custom script could not be loaded.');
            }
        })();
        return customScriptsPromise;
    };
}(typeof window !== 'undefined' ? window : globalThis));
