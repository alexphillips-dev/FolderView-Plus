import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const modelModule = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.diagnostics-view-model.js'
));

const healthyCoreCards = [
    { key: 'docker', label: 'Docker config', status: 'healthy', headline: 'No issues detected.' },
    { key: 'vm', label: 'VM config', status: 'healthy', headline: 'No issues detected.' },
    { key: 'storage', label: 'Storage and paths', status: 'healthy', headline: 'Paths look healthy.' },
    { key: 'custom_icons', label: 'Custom icons', status: 'healthy', headline: 'Custom icon storage looks healthy.' },
    { key: 'update', label: 'Update check', status: 'healthy', headline: 'Plugin is up to date.' },
    { key: 'theme', label: 'Theme', status: 'healthy', headline: 'Theme diagnostics look healthy.' }
];

test('unchecked diagnostics never report a partial live check as healthy', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: false,
        coreCards: [healthyCoreCards.at(-1)]
    });

    assert.equal(model.state, 'unchecked');
    assert.equal(model.overall.status, 'unchecked');
    assert.equal(model.metrics.coreTotal, 0);
    assert.equal(model.findings.length, 0);
});

test('healthy results count six core checks and informational notices separately', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        checkedAt: '2026-07-23T12:00:00Z',
        checkedAtLabel: '7/23/2026, 8:00 AM',
        pluginVersion: '2026.07.23.07',
        now: Date.parse('2026-07-23T12:05:00Z'),
        coreCards: healthyCoreCards,
        advisoryCards: [{ key: 'performance_budget', status: 'healthy', headline: 'Within budget.' }],
        additionalCards: [
            { key: 'native_organizer', status: 'info', headline: 'Optional integration unavailable.' },
            { key: 'localization', status: 'info', headline: 'Catalog loaded.' }
        ]
    });

    assert.equal(model.state, 'results');
    assert.equal(model.overall.status, 'healthy');
    assert.equal(model.metrics.coreHealthy, 6);
    assert.equal(model.metrics.coreTotal, 6);
    assert.equal(model.metrics.optionalCount, 2);
    assert.equal(model.metrics.updateLabel, 'Up to date');
    assert.equal(model.findings.length, 0);
    assert.equal(model.stale, false);
});

test('priority findings include core failures and performance advisories but exclude optional notices', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        checkedAt: '2026-07-23T12:00:00Z',
        now: Date.parse('2026-07-23T12:20:00Z'),
        coreCards: [
            ...healthyCoreCards.slice(0, 2),
            { key: 'storage', label: 'Storage and paths', status: 'error', headline: 'Path issue detected.' }
        ],
        advisoryCards: [
            { key: 'performance_budget', label: 'Performance advisories', status: 'warning', headline: 'Repeated slowdown.' }
        ],
        additionalCards: [
            { key: 'native_organizer', label: 'Optional integrations', status: 'info', headline: 'Unavailable.' }
        ]
    });

    assert.equal(model.overall.status, 'error');
    assert.deepEqual(model.findings.map((finding) => finding.key), ['storage', 'performance_budget']);
    assert.equal(model.stale, true);
});

test('failed refresh preserves prior results while exposing the failure state', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        errorMessage: 'Request timed out',
        coreCards: healthyCoreCards
    });

    assert.equal(model.state, 'error');
    assert.equal(model.errorMessage, 'Request timed out');
    assert.equal(model.metrics.coreTotal, 6);
});
