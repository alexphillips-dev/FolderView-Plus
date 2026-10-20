import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const badges = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.folder-badges.js');
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const registry = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-registry.js');

test('all folder badges default on for missing and partial preferences without overriding opt-outs', () => {
    const defaults = { running: true, stopped: true, updates: true };
    for (const prefs of [{}, { badges: {} }, { badges: { running: true } }, { badges: { updates: true } }]) {
        assert.deepEqual(utils.normalizePrefs(prefs).badges, defaults);
    }
    for (const key of Object.keys(defaults)) {
        assert.deepEqual(utils.normalizePrefs({ runtimePrefsSchema: 5, badges: { [key]: false } }).badges, { ...defaults, [key]: false });
        for (const type of key === 'updates' ? ['docker'] : ['docker', 'vm']) {
            assert.equal(registry.getDefinition('changeBadgePref', key, type).default, true);
        }
    }
    const disabled = { running: false, stopped: false, updates: false };
    assert.deepEqual(utils.normalizePrefs({ runtimePrefsSchema: 5, badges: disabled }).badges, disabled);
});

test('stopped badge is enabled once for all older preferences and later opt-outs stay disabled', () => {
    for (const runtimePrefsSchema of [undefined, 0, 1, 2, 3, 4]) {
        const upgraded = utils.normalizePrefs({ runtimePrefsSchema, badges: { running: false, stopped: false, updates: false } });
        assert.deepEqual(upgraded.badges, { running: false, stopped: true, updates: false });
        assert.equal(upgraded.runtimePrefsSchema, 5);
        upgraded.badges.stopped = false;
        assert.equal(utils.normalizePrefs(JSON.parse(JSON.stringify(upgraded))).badges.stopped, false);
    }
});

test('folder status badges preserve normalized defaults and independent preferences', () => {
    for (const prefs of [{}, { badges: { running: false, stopped: true } }, { badges: { running: true, stopped: true } }]) {
        const normalized = utils.normalizePrefs(prefs).badges;
        assert.equal(badges.isStatusVisible('started', normalized), normalized.running);
        assert.equal(badges.isStatusVisible('stopped', normalized), normalized.stopped);
        assert.equal(badges.isStatusVisible('paused', normalized), true);
    }
    assert.equal(badges.isStatusVisible('started'), true);
    assert.equal(badges.isStatusVisible('stopped'), true);
    assert.equal(badges.isStatusVisible('stopped', {}), true);
    assert.equal(badges.isStatusVisible('stopped', null), true);
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
