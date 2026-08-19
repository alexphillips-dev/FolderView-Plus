import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const hostGuardsModule = require(path.resolve(
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.host-guards.js'
));

const createHarness = (busy) => {
    const document = {
        querySelector: (selector) => selector === '#busy' ? busy : null
    };
    const window = {
        document,
        getComputedStyle: (node) => node.style
    };
    return hostGuardsModule.createApi({ window, document, adapter: {} });
};

test('Docker host guard recognizes only a visible Unraid busy indicator', () => {
    const busy = {
        hidden: false,
        style: { display: 'block', visibility: 'visible' },
        getAttribute: () => null
    };
    const api = createHarness(busy);

    assert.equal(api.isNativeBusyPollActive(), true);
    busy.style.display = 'none';
    assert.equal(api.isNativeBusyPollActive(), false);
    busy.style.display = 'block';
    busy.style.visibility = 'hidden';
    assert.equal(api.isNativeBusyPollActive(), false);
    busy.style.visibility = 'visible';
    busy.hidden = true;
    assert.equal(api.isNativeBusyPollActive(), false);
});

test('Docker host guard treats a missing busy indicator as inactive', () => {
    assert.equal(createHarness(null).isNativeBusyPollActive(), false);
});
