import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const modelModule = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.diagnostics-view-model.js'
));
const viewModule = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.diagnostics-view.js'
));
const uiModule = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.ui.js'
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

test('healthy results count six core checks and the informational notice separately', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        checkedAt: '2026-07-23T12:00:00Z',
        checkedAtLabel: '7/23/2026, 8:00 AM',
        pluginVersion: '2026.07.23.07',
        now: Date.parse('2026-07-23T12:05:00Z'),
        coreCards: healthyCoreCards,
        advisoryCards: [{ key: 'performance_budget', status: 'healthy', headline: 'Within budget.' }],
        additionalCards: [
            { key: 'localization', status: 'info', headline: 'Catalog loaded.' }
        ]
    });

    assert.equal(model.state, 'results');
    assert.equal(model.overall.status, 'healthy');
    assert.equal(model.metrics.coreHealthy, 6);
    assert.equal(model.metrics.coreTotal, 6);
    assert.equal(model.metrics.optionalCount, 1);
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
            { key: 'localization', label: 'Localization', status: 'info', headline: 'Catalog loaded.' }
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

test('diagnostics renderer provides SVG metric and card icons with a complete core progress bar', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        checkedAtLabel: 'just now',
        pluginVersion: '2026.07.23.08',
        coreCards: healthyCoreCards,
        additionalCards: []
    });
    const view = viewModule.createApi({
        escapeHtml: uiModule.escapeHtml,
        svgIcon: uiModule.svgIcon
    });
    const hero = view.buildHero(model);
    const card = view.buildCard(healthyCoreCards[0]);

    assert.equal((hero.match(/fv-diagnostics-metric-icon/g) || []).length, 3);
    assert.match(hero, /data-fv-icon="info-circle"/);
    assert.match(hero, /data-fv-icon="calendar"/);
    assert.match(hero, /data-fv-icon="package"/);
    assert.match(hero, /role="progressbar"/);
    assert.match(hero, /aria-valuenow="6"/);
    assert.match(hero, /data-fv-progress-percent="100"/);
    assert.match(card, /fv-diagnostics-health-card-icon is-docker/);
    assert.match(card, /data-fv-icon="boxes"/);
});

test('diagnostics renderer omits healthy advisory and optional cards from the workspace', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        checkedAtLabel: 'just now',
        pluginVersion: '2026.07.24.04',
        coreCards: healthyCoreCards,
        advisoryCards: [
            { key: 'performanceBudget', label: 'Performance Budgets', status: 'healthy', headline: 'Within budget.', technicalDetails: ['Timing detail'] }
        ],
        additionalCards: [
            { key: 'localization', label: 'Localization', status: 'info', headline: 'Catalog loaded.', technicalDetails: ['Catalog detail'] }
        ]
    });
    const view = viewModule.createApi({
        escapeHtml: uiModule.escapeHtml,
        svgIcon: uiModule.svgIcon
    });
    const host = {
        innerHTML: '',
        setAttribute() {},
        querySelector() { return null; }
    };

    view.render(host, model);

    assert.match(host.innerHTML, /System health/);
    assert.doesNotMatch(host.innerHTML, /Additional diagnostics/);
    assert.doesNotMatch(host.innerHTML, /Performance Budgets|Localization|Technical details/);
});

test('advisory findings remain visible without linking to a hidden card', () => {
    const model = modelModule.buildDiagnosticsViewModel({
        hasResults: true,
        coreCards: healthyCoreCards,
        advisoryCards: [
            { key: 'performanceBudget', label: 'Performance Budgets', status: 'warning', headline: 'Repeated slowdown.' }
        ]
    });
    const view = viewModule.createApi({
        escapeHtml: uiModule.escapeHtml,
        svgIcon: uiModule.svgIcon
    });
    const findings = view.buildFindings(model);

    assert.match(findings, /fv-diagnostics-finding is-warning is-summary-only/);
    assert.match(findings, /Performance Budgets/);
    assert.doesNotMatch(findings, /href="#fv-diagnostics-card-performanceBudget"/);
});
