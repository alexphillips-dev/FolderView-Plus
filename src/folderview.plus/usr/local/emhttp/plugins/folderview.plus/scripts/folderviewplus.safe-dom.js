// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSafeDom = factory();
    root.FolderViewPlusSafeDomModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const SAFE_ATTRIBUTE = /^(?:aria-[a-z0-9-]+|data-[a-z0-9-]+|id|name|title|type|value|role|href|target|rel|disabled|checked|selected)$/i;
    const SAFE_TAG = /^(?:a|button|div|i|input|label|li|ol|option|p|small|span|strong|ul)$/i;

    const create = (documentRef, tagName, options = {}) => {
        if (!documentRef || !SAFE_TAG.test(String(tagName || ''))) {
            throw new TypeError('Safe DOM construction rejected an unsupported element.');
        }
        const node = documentRef.createElement(String(tagName).toLowerCase());
        if (options.className) node.className = String(options.className);
        if (Object.prototype.hasOwnProperty.call(options, 'text')) node.textContent = String(options.text ?? '');
        for (const [name, value] of Object.entries(options.attributes || {})) {
            if (!SAFE_ATTRIBUTE.test(name) || /^on/i.test(name)) {
                throw new TypeError(`Safe DOM construction rejected attribute: ${name}`);
            }
            if (value === false || value === null || value === undefined) continue;
            if (value === true) node.setAttribute(name, '');
            else node.setAttribute(name, String(value));
        }
        for (const child of options.children || []) {
            if (child && typeof child.nodeType === 'number') node.appendChild(child);
            else if (child !== null && child !== undefined) node.appendChild(documentRef.createTextNode(String(child)));
        }
        return node;
    };

    const replaceChildren = (parent, ...children) => {
        if (!parent || typeof parent.replaceChildren !== 'function') {
            throw new TypeError('Safe DOM replacement requires a parent element.');
        }
        parent.replaceChildren(...children.filter(Boolean));
        return parent;
    };

    return Object.freeze({ create, replaceChildren });
}));
