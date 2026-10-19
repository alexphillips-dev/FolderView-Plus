import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const badges = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.folder-badges.js');
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

test('folder status badges preserve normalized defaults and independent preferences', () => {
    for (const prefs of [{}, { badges: { running: false, stopped: true } }, { badges: { running: true, stopped: true } }]) {
        const normalized = utils.normalizePrefs(prefs).badges;
        assert.equal(badges.isStatusVisible('started', normalized), normalized.running);
        assert.equal(badges.isStatusVisible('stopped', normalized), normalized.stopped);
        assert.equal(badges.isStatusVisible('paused', normalized), true);
    }
    assert.equal(badges.isStatusVisible('started'), true);
    assert.equal(badges.isStatusVisible('stopped'), false);
    assert.equal(badges.isStatusVisible('paused', null), true);
});

test('folder status badge application restores visibility for the next state and preference', () => {
    let kind = 'stopped', visible = false;
    const icon = { length: 1, hasClass: value => value === kind, toggle: value => { visible = value; } };
    const prefs = { running: true, stopped: false };
    for (const [state, expected] of [['started', true], ['stopped', false], ['paused', true], ['started', true]]) {
        kind = state;
        badges.applyStatus(icon, prefs);
        assert.equal(visible, expected);
    }
    prefs.running = false;
    badges.applyStatus(icon, prefs);
    assert.equal(visible, false);
    assert.doesNotThrow(() => badges.applyStatus(null));
    assert.doesNotThrow(() => badges.applyStatus({ length: 0 }));
});
