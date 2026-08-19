(async () => {
    'use strict';
    window.__fvInjection = 0;
    window.__fvTrustedTypesAvailable = typeof window.trustedTypes?.createPolicy === 'function';
    if (window.__fvTrustedTypesAvailable) {
        window.trustedTypes.createPolicy('fvplus-fixture', {
            createHTML: (value) => String(value),
            createScript: (value) => String(value),
            createScriptURL: (value) => String(value)
        });
    }
    const response = await fetch('/security-fixtures/malicious-persisted-values.json');
    const values = await response.json();
    const output = document.getElementById('csp-fixture-output');
    const fragment = document.createDocumentFragment();
    Object.entries(values).forEach(([kind, value]) => {
        fragment.appendChild(window.FolderViewPlusSafeDom.create(document, 'p', {
            className: 'csp-malicious-value',
            text: value,
            attributes: { 'data-value-kind': kind }
        }));
    });
    window.FolderViewPlusSafeDom.replaceChildren(output, fragment);
    try {
        window.FolderViewPlusSafeDom.create(document, 'img', {
            attributes: { onerror: 'window.__fvInjection=99' }
        });
    } catch (error) {
        window.__fvUnsafeAttributeRejected = error instanceof TypeError;
    }
    const missingIcon = '/missing-container-icon.png';
    const fallbackIcon = '/plugin/images/folder-icon.png';
    const loadImage = (source, onerror = '') => new Promise((resolve) => {
        const image = document.createElement('img');
        image.addEventListener('load', resolve, { once: true });
        if (onerror) image.setAttribute('data-fv-onerror', onerror);
        document.body.append(image);
        image.src = source;
    });
    await loadImage(missingIcon, `this.src='${fallbackIcon}'`);
    const replacementSource = window.FolderViewPlusFoundationModules.utilityFoundation.sanitizeImageUrl(missingIcon, fallbackIcon);
    await loadImage(replacementSource);
    window.__fvImageFallbackEvidence = {
        replacementSource,
        missingRequests: performance.getEntriesByType('resource')
            .filter((entry) => new URL(entry.name).pathname === missingIcon).length
    };
    window.__fvCspFixtureReady = true;
})();
