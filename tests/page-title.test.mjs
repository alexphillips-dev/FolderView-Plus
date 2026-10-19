import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const utils = require(path.join(plugin, 'scripts/folderviewplus.utils.js'));
const registry = require(path.join(plugin, 'scripts/folderviewplus.settings-registry.js'));
const pageTitle = require(path.join(plugin, 'scripts/runtime.page-title.js'));

test('page title defaults, safe text, limits, PHP parity and persistence round trips', () => {
    const inputs = [{}, null, [], { enabled: true, text: ' Change Me! ', size: 48, bold: false, italic: true, color: '#AABBCC', font: 'serif' },
        { text: '<img src=x onerror=alert(1)>\nTitle', font: 'url(unsafe)', size: 999, color: 'red;background:url(x)' },
        { text: '😀'.repeat(101), size: 14 }, { text: '\n\u0000', size: 'bad', bold: false }, { size: 27.8 }, { text: 'Long title '.repeat(12) },
        { text: '\ufeff\u00a0Title\u3000' }, { text: 'x'.repeat(99) + '\u00a0tail' }];
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-page-title-'));
    const driver = path.join(temp, 'driver.php');
    fs.writeFileSync(driver, `<?php
require getenv('FVPLUS_SETTINGS_LIB_PATH');
$inputs = json_decode(getenv('FVPLUS_TITLE_INPUTS'), true);
$normalized = array_map('normalizePageTitle', $inputs);
$initial = writeTypePrefs('docker', ['pageTitle' => ['enabled' => true, 'text' => 'Fixture title', 'font' => 'serif', 'size' => 40]]);
writeTypePrefs('docker', mergeTypePrefsPatch($initial, ['pageTitle' => ['enabled' => false]]));
$disabled = readTypePrefs('docker');
writeTypePrefs('docker', mergeTypePrefsPatch($disabled, ['pageTitle' => ['enabled' => true, 'bold' => false]]));
$restored = readTypePrefs('docker');
$snapshot = createBackupSnapshot('docker', 'transaction-title-test', false);
$snapshotTitle = readBackupSnapshot('docker', $snapshot['name'])['prefs']['pageTitle'];
$rejected = false;
try { fvplus_assert_prefs_payload_shape(['pageTitle' => ['text' => ['unsafe']]]); } catch (Throwable $error) { $rejected = true; }
echo json_encode(['normalized' => $normalized, 'disabled' => $disabled['pageTitle'], 'restored' => $restored['pageTitle'], 'snapshotTitle' => $snapshotTitle, 'rejected' => $rejected]);
`);
    try {
        const result = JSON.parse(execFileSync('php', [driver], { encoding: 'utf8', env: { ...process.env,
            FVPLUS_SETTINGS_LIB_PATH: path.join(plugin, 'server/lib.php'), FVPLUS_TITLE_INPUTS: JSON.stringify(inputs),
            FVPLUS_TEST_CONFIG_DIR: path.join(temp, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(temp, 'runtime'), FVPLUS_TEST_DOCUMENT_ROOT: path.join(temp, 'document-root') } }));
        assert.deepEqual(result.normalized, inputs.map(input => utils.normalizePrefs({ pageTitle: input }).pageTitle));
        for (const prefs of result.normalized) assert.deepEqual(utils.normalizePageTitle(prefs), prefs, 'normalizing again must preserve saved title text');
        assert.deepEqual(result.normalized[0], { enabled: false, text: 'Change Me!', font: 'theme', size: 28, bold: true, italic: false, color: 'theme' });
        assert.equal(result.normalized[5].text, '😀'.repeat(100));
        assert.equal(result.disabled.enabled, false);
        assert.equal(result.restored.text, 'Fixture title'); assert.equal(result.restored.font, 'serif');
        assert.equal(result.restored.size, 40); assert.equal(result.restored.bold, false);
        assert.deepEqual(result.snapshotTitle, result.restored, 'configuration snapshots retain the complete title preferences');
        assert.equal(result.rejected, true);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('page title registry validates text and colors and limits the setting to Docker', () => {
    const change = (key, value) => registry.resolveChange('changePageTitlePref', 'docker', key, value)?.value;
    assert.equal(change('text', ' Hello\nworld '), 'Hello world');
    assert.equal(change('text', ''), 'Change Me!');
    assert.equal(change('color', '#FFAB12'), '#ffab12');
    assert.equal(change('color', 'url(x)'), 'theme');
    assert.equal(change('size', 999), 48);
    assert.equal(registry.resolveChange('changePageTitlePref', 'vm', 'enabled', true), null);
});

test('a background preference save cannot overwrite an uncommitted title draft', () => {
    const prefs = utils.normalizePageTitle({ enabled: true });
    const elements = Object.fromEntries(['enabled', 'fields', 'text', 'font', 'size', 'bold', 'italic', 'color', 'preview'].map(key => [key, { style: {}, value: '', checked: false, dataset: { fvTitleField: key } }]));
    const listeners = new Map();
    let controller;
    const doc = { getElementById: id => elements[id.replace('docker-page-title-', '')], addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
    controller = pageTitle.createSettingsController({ document: doc, window: { getComputedStyle: () => ({ color: 'rgb(255, 255, 255)' }) }, getPrefs: () => prefs,
        onChange: (key, value) => { prefs[key] = value; controller.sync(); } });
    controller.sync();
    elements.text.value = 'Uncommitted draft'; listeners.get('input')({ target: elements.text });
    prefs.size = 40; controller.sync();
    assert.equal(elements.text.value, 'Uncommitted draft');
    assert.equal(elements.preview.textContent, 'Uncommitted draft');
    listeners.get('change')({ target: elements.text });
    assert.equal(prefs.text, 'Uncommitted draft');
    controller.dispose(); assert.equal(listeners.size, 0);
});
