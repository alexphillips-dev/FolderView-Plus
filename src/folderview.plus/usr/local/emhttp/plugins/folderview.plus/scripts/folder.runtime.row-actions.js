(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const api = factory();
    if (root.FolderViewDockerRuntimeShared && 'object' === typeof root.FolderViewDockerRuntimeShared) {
        root.FolderViewDockerRuntimeShared.createFolderRowActionsController = api.createController;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createController = (deps = {}) => {
        const jq = deps.$;
        const doc = deps.document || (typeof document !== 'undefined' ? document : null);
        const namespace = String(deps.namespace || '').replace(/[^A-Za-z0-9]/g, '');
        const actionAttribute = String(deps.actionAttribute || '').trim();
        const handlers = deps.handlers && typeof deps.handlers === 'object' ? deps.handlers : {};
        if (!jq || !doc || !namespace || !/^data-fv-[a-z0-9-]+$/.test(actionAttribute)) {
            throw new Error('Folder row action controller dependencies are invalid.');
        }

        const selector = `[${actionAttribute}]`;
        const eventName = `click.${namespace}`;
        const decorateTarget = ($row, targetSelector, action, first = false) => {
            const $target = first ? $row.find(targetSelector).first() : $row.find(targetSelector);
            $target
                .removeAttr('data-fv-onclick')
                .attr({
                    [actionAttribute]: action,
                    'data-fv-folder-id': String($row.attr('data-fv-folder-id') || '')
                });
            return $target;
        };
        const decorate = ($row, folderId) => {
            if (!$row || !$row.length) {
                return;
            }
            const id = String(folderId || '').trim();
            if (!id) {
                return;
            }
            $row.attr('data-fv-folder-id', id);
            decorateTarget($row, '.folder-hand', 'context', true);
            decorateTarget($row, '.folder-appname', 'edit', true);
            decorateTarget($row, '.folder-dropdown', 'toggle', true).attr('type', 'button');
        };
        const dispatch = (element, event, options = {}) => {
            const action = String(element?.getAttribute?.(actionAttribute) || '').trim();
            const id = String(element?.getAttribute?.('data-fv-folder-id') || '').trim();
            const handler = handlers[action];
            if (!action || !id || typeof handler !== 'function') {
                return false;
            }
            if (options.preventDefault !== false) {
                event?.preventDefault?.();
            }
            handler(id, event);
            return true;
        };
        const handleContextCapture = (event) => {
            const target = event?.target?.closest?.(selector);
            if (String(target?.getAttribute?.(actionAttribute) || '') !== 'context') {
                return;
            }
            dispatch(target, event, { preventDefault: false });
        };
        const bind = () => {
            doc.removeEventListener?.('click', handleContextCapture, true);
            doc.addEventListener?.('click', handleContextCapture, true);
            jq(doc)
                .off(eventName, selector)
                .on(eventName, selector, function(event) {
                    if (String(this?.getAttribute?.(actionAttribute) || '') === 'context') {
                        return;
                    }
                    dispatch(this, event);
                });
        };
        const destroy = () => {
            doc.removeEventListener?.('click', handleContextCapture, true);
            jq(doc).off(eventName, selector);
        };

        return Object.freeze({
            bind,
            decorate,
            destroy,
            dispatch,
            actionAttribute,
            selector
        });
    };

    return Object.freeze({
        createController
    });
}));
