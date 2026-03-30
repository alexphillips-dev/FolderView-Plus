import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

const extractArrowFunctionBody = (source, signature) => {
    const startIndex = source.indexOf(signature);
    assert.ok(startIndex >= 0, `Missing function signature: ${signature}`);
    const braceStart = source.indexOf('{', startIndex + signature.length);
    assert.ok(braceStart >= 0, `Missing opening brace for: ${signature}`);
    let depth = 0;
    for (let index = braceStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart + 1, index);
            }
        }
    }
    throw new Error(`Failed to extract function body for: ${signature}`);
};

const initializeDockerTooltipOnDemandBody = extractArrowFunctionBody(
    dockerJs,
    'const initializeDockerTooltipOnDemand = ($target, init, options = {}) => '
);

const initializeDockerTooltipOnDemand = new Function(
    '$target',
    'init',
    'options',
    'DOCKER_PREVIEW_POPUP_ENABLED',
    'setTimeout',
    initializeDockerTooltipOnDemandBody
);

const createLazyTooltipTarget = () => {
    const dataStore = new Map();
    const handlers = new Map();
    const tooltipsterCalls = [];
    const target = {
        length: 1,
        data(key, value) {
            if (arguments.length === 1) {
                return dataStore.get(key);
            }
            dataStore.set(key, value);
            return this;
        },
        one(events, handler) {
            String(events || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .forEach((eventName) => {
                    handlers.set(eventName.split('.')[0], handler);
                });
            return this;
        },
        tooltipster(action) {
            tooltipsterCalls.push(action);
            return this;
        }
    };

    return {
        target,
        emit(type) {
            const handler = handlers.get(type);
            handlers.clear();
            if (handler) {
                handler({ type });
            }
        },
        getTooltipsterCalls: () => [...tooltipsterCalls],
        getData: (key) => dataStore.get(key)
    };
};

const runImmediateTimeout = (callback) => {
    callback();
    return 0;
};

test('docker lazy tooltip init does not eager-open click-trigger tooltips on first hover', () => {
    const lazyTarget = createLazyTooltipTarget();
    let initCount = 0;

    initializeDockerTooltipOnDemand(
        lazyTarget.target,
        () => {
            initCount += 1;
        },
        { openOnEventTypes: ['click', 'touchstart'] },
        true,
        runImmediateTimeout
    );

    lazyTarget.emit('mouseenter');

    assert.equal(initCount, 1);
    assert.equal(lazyTarget.getData('fvTooltipsterInitialized'), true);
    assert.deepEqual(lazyTarget.getTooltipsterCalls(), []);
});

test('docker lazy tooltip init still eager-opens hover-trigger tooltips on first hover', () => {
    const lazyTarget = createLazyTooltipTarget();
    let initCount = 0;

    initializeDockerTooltipOnDemand(
        lazyTarget.target,
        () => {
            initCount += 1;
        },
        { openOnEventTypes: ['mouseenter', 'click', 'touchstart'] },
        true,
        runImmediateTimeout
    );

    lazyTarget.emit('mouseenter');

    assert.equal(initCount, 1);
    assert.deepEqual(lazyTarget.getTooltipsterCalls(), ['open']);
});

test('docker lazy tooltip init eager-opens click-trigger tooltips on first click', () => {
    const lazyTarget = createLazyTooltipTarget();
    let initCount = 0;

    initializeDockerTooltipOnDemand(
        lazyTarget.target,
        () => {
            initCount += 1;
        },
        { openOnEventTypes: ['click', 'touchstart'] },
        true,
        runImmediateTimeout
    );

    lazyTarget.emit('click');

    assert.equal(initCount, 1);
    assert.deepEqual(lazyTarget.getTooltipsterCalls(), ['open']);
});
