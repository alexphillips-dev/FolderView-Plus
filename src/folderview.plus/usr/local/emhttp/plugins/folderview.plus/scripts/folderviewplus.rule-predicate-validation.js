(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.rulePredicateValidation = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const create = (requestClient, delayMs = 0) => {
        let current = null;
        const clear = () => {
            current?.controller.abort();
            current = null;
        };
        const check = ({ type, kind = 'name_regex', pattern, regexMode = '' }, onSettled = null) => {
            const key = JSON.stringify([type, kind, pattern, regexMode]);
            if (current?.key === key) return current;
            clear();
            const controller = new AbortController();
            const check = { key, controller, status: 'pending', done: null };
            current = check;
            check.done = new Promise((resolve) => {
                const timer = setTimeout(resolve, delayMs);
                controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
            }).then(async () => {
                if (controller.signal.aborted) return 'unavailable';
                try {
                    const response = await requestClient.request({
                        url: '/plugins/folderview.plus/server/rule_preview.php', method: 'POST', timeoutMs: 5000,
                        data: { action: 'validate_predicate', type, kind, pattern, regexMode },
                        readOnlyPost: true, parseMutationJson: true, signal: controller.signal
                    });
                    return response?.valid === true ? 'valid' : (response?.valid === false ? 'invalid' : 'unavailable');
                } catch (_error) {
                    return 'unavailable';
                }
            }).then((status) => {
                check.status = status;
                if (current === check && !controller.signal.aborted) onSettled?.();
                return status;
            });
            return check;
        };
        return Object.freeze({ check, clear });
    };

    const formatLegacyStatus = (status, translate) => status === 'pending' ? translate('common.loading', 'Loading…')
        : status === 'unavailable' ? translate('diagnostics.cards.runtime-unavailable', 'Connection failed')
        : translate('legacy.surface.4301076935159ac1', 'Legacy regex is invalid');

    return Object.freeze({ create, formatLegacyStatus });
}));
