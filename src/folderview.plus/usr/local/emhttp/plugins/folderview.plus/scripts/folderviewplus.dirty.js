(() => {
    const DEFAULT_INSTANT_PERSIST_ONCHANGE_TOKENS = Object.freeze([
        'changesortmode(',
        'changebadgepref(',
        'changevisibilitypref(',
        'changestatuspref(',
        'changeruntimepref(',
        'changehealthpref(',
        'changebackupschedulepref(',
        'changecolumnvisibility(',
        'togglerulekindfields(',
        'toggleallruleselections(',
        'togglealltemplateselections('
    ]);

    const isElementLike = (value) => {
        if (!value || typeof value !== 'object') {
            return false;
        }
        if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
            return true;
        }
        return typeof value.getAttribute === 'function';
    };

    const getInputSerializedValue = (input) => {
        if (!input) {
            return '';
        }
        if (input.type === 'checkbox') {
            return input.checked ? '1' : '0';
        }
        return String(input.value ?? '');
    };

    const isInstantPersistInput = (input, options = {}) => {
        if (!isElementLike(input)) {
            return false;
        }
        if (String(input.dataset?.fvTrackSave || '') === '1') {
            return false;
        }
        const handler = String(input.getAttribute('onchange') || '').trim().toLowerCase();
        if (!handler) {
            // Inputs without onchange handlers are transient helpers/filters and should
            // not participate in staged save/cancel state.
            return true;
        }
        const tokens = Array.isArray(options?.tokens) && options.tokens.length > 0
            ? options.tokens
            : DEFAULT_INSTANT_PERSIST_ONCHANGE_TOKENS;
        return tokens.some((token) => handler.includes(String(token || '').toLowerCase()));
    };

    const getTrackedInputs = (root = document, options = {}) => {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        return Array
            .from(scope.querySelectorAll('input[id], select[id], textarea[id]'))
            .filter((input) => !isInstantPersistInput(input, options));
    };

    const getChangedInputs = (inputs, baselineByInputId, serializeValue = getInputSerializedValue) => {
        const list = Array.isArray(inputs) ? inputs : [];
        if (!(baselineByInputId instanceof Map)) {
            return [];
        }
        return list.filter((input) => (
            input
            && typeof input.id === 'string'
            && baselineByInputId.has(input.id)
            && baselineByInputId.get(input.id) !== serializeValue(input)
        ));
    };

    const captureBaseline = (inputs, baselineByInputId, serializeValue = getInputSerializedValue) => {
        const list = Array.isArray(inputs) ? inputs : [];
        if (!(baselineByInputId instanceof Map)) {
            return baselineByInputId;
        }
        baselineByInputId.clear();
        for (const input of list) {
            if (!input || typeof input.id !== 'string' || input.id === '') {
                continue;
            }
            baselineByInputId.set(input.id, serializeValue(input));
        }
        return baselineByInputId;
    };

    const applyBaselineValues = (inputs, baselineByInputId) => {
        const list = Array.isArray(inputs) ? inputs : [];
        if (!(baselineByInputId instanceof Map)) {
            return [];
        }
        const touched = [];
        for (const input of list) {
            if (!input || typeof input.id !== 'string' || !baselineByInputId.has(input.id)) {
                continue;
            }
            const baseline = baselineByInputId.get(input.id);
            if (input.type === 'checkbox') {
                input.checked = baseline === '1';
            } else {
                input.value = baseline;
            }
            touched.push(input);
        }
        return touched;
    };

    window.FolderViewPlusDirtyTracker = Object.freeze({
        DEFAULT_INSTANT_PERSIST_ONCHANGE_TOKENS,
        getInputSerializedValue,
        isInstantPersistInput,
        getTrackedInputs,
        getChangedInputs,
        captureBaseline,
        applyBaselineValues
    });
})();
