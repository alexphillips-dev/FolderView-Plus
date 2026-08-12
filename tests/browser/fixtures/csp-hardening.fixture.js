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
    window.__fvCspFixtureReady = true;
})();
