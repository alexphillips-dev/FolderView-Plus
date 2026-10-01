import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.row-details.js');

test('health dialog escapes folder and reason content and preserves its filter action', () => {
    let dialog;
    let confirm;
    let filtered;
    const api = createApi({
        swal: (options, callback) => { dialog = options; confirm = callback; },
        getFolderMap: () => ({ folder: { name: '<img src=x onerror=alert(1)>' } }),
        getEffectiveMemberSnapshot: () => ({ folder: { members: ['a', 'b'] } }),
        getInfoByType: () => ({ a: { state: 'started', update: true }, b: { state: 'paused' } }),
        getItemRuntimeStateKind: (_type, info) => info.state,
        isDockerUpdateAvailable: (info) => info.update === true,
        evaluateDockerFolderHealth: (_folder, members, states, updates) => {
            assert.equal(members, 2);
            assert.deepEqual(states, { started: 1, paused: 1, stopped: 0 });
            assert.equal(updates, 1);
            return { text: 'Warning', severity: 'warn', filterSeverity: 'warn', score: 75,
                policy: { profile: 'balanced', updatesMode: 'maintenance', allStoppedMode: 'critical', warnThreshold: 60, criticalThreshold: 90 },
                reasons: [{ label: '<b>Paused</b>', message: '<script>alert(1)</script>' }] };
        },
        toggleHealthSeverityFilter: (...args) => { filtered = args; }
    });
    api.showFolderHealthBreakdown('docker', 'folder');
    assert.equal(dialog.html, true);
    assert.equal(dialog.customClass, 'fv-health-details-modal');
    assert.match(dialog.text, /is-warn/);
    assert.match(dialog.text, /&lt;img/);
    assert.match(dialog.text, /&lt;script&gt;/);
    assert.doesNotMatch(dialog.text, /<img|<script|<b>/);
    confirm(false);
    assert.equal(filtered, undefined);
    confirm(true);
    assert.deepEqual(filtered, ['docker', 'warn']);
});

test('health details handles absent reasons, missing folders and VM availability', () => {
    const dialogs = [];
    const api = createApi({
        swal: (options) => dialogs.push(options),
        getFolderMap: () => ({ empty: { name: 'Empty' } })
    });
    api.showFolderHealthBreakdown('docker', 'missing');
    assert.equal(dialogs.length, 0);
    api.showFolderHealthBreakdown('docker', 'empty');
    assert.match(dialogs[0].text, /No health reasons available/);
    api.showFolderHealthBreakdown('vm', 'empty');
    assert.equal(dialogs[1].html, undefined);
    assert.match(dialogs[1].text, /available for Docker/);
});
