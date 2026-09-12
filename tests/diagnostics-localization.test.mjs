import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const modelApi = require(path.join(root, 'scripts/folderviewplus.diagnostics-view-model.js'));
const viewApi = require(path.join(root, 'scripts/folderviewplus.diagnostics-view.js'));
const ui = require(path.join(root, 'scripts/folderviewplus.ui.js'));
const catalogFor = (locale) => Object.assign({}, ...['common', 'diagnostics'].map((namespace) =>
    JSON.parse(fs.readFileSync(path.join(root, `langs/namespaces/${locale}/${namespace}.json`), 'utf8'))));
const translator = (catalog) => (key, fallback, ...params) => {
    assert.equal(typeof catalog[key], 'string', `Missing catalog entry: ${key}`);
    return catalog[key].replace(/\$(\d+)/g, (token, index) => String(params[Number(index) - 1] ?? token));
};
const healthyReport = () => ({
    pluginVersion: '2026.09.11.01', privacyMode: 'full',
    runtimeIntegrity: { status: 'healthy' }, customIcons: { fileCount: 0 },
    update: { ok: true, updateAvailable: false, currentVersion: '2026.09.11.01' },
    types: Object.fromEntries(['docker', 'vm'].map((type) => [type, {
        folderCount: type === 'docker' ? 5 : 3, ruleCount: 0, backupCount: 25,
        integrityChecks: { issuesCount: 0, orphanedMembers: { count: 0, folders: [] } }
    }])),
    summary: { recommendedActions: [], cards: [
        { key: 'docker', label: 'Docker config', headline: 'No issues detected.', detail: '5 folder(s), 0 rule(s), 25 backup(s).' },
        { key: 'vm', label: 'VM config', headline: 'No issues detected.', detail: '3 folder(s), 0 rule(s), 25 backup(s).' },
        { key: 'storage', label: 'Storage and paths', headline: 'Paths look healthy.', detail: 'Folder maps, prefs, backups, and installed runtime files passed integrity checks.' },
        { key: 'custom_icons', label: 'Custom icons', headline: 'Custom icon storage looks healthy.', detail: '0 icon file(s) tracked.' },
        { key: 'update', label: 'Update check', headline: 'Plugin is up to date.', detail: 'Current version 2026.09.11.01.' }
    ].map((card) => ({ ...card, count: 0, status: 'healthy' })) }
});

test('healthy System Health renders translated summaries and counts from all 27 catalogs without English source fallthrough', () => {
    for (const locale of fs.readdirSync(path.join(root, 'langs/namespaces'))) {
        const catalog = catalogFor(locale), t = translator(catalog);
        const view = viewApi.createApi({ t, escapeHtml: ui.escapeHtml });
        const report = healthyReport(), before = JSON.stringify(report);
        const cards = view.decorateCardsWithRecommendedActions(report.summary.cards, report, report.summary);
        cards.push(modelApi.buildThemeCard({ warnings: [], adjustments: [] }, { t, appliedMode: 'auto' }));
        const model = modelApi.buildDiagnosticsViewModel({ t, hasResults: true, coreCards: cards, pluginVersion: report.pluginVersion });
        assert.equal(model.overall.headline, catalog['diagnostics.overall.healthy']);
        assert.equal(model.metrics.updateLabel, catalog['diagnostics.update.current']);
        assert.equal(cards[0].detail, t('diagnostics.cards.config-counts', '', 5, 0, 25));
        assert.equal(cards[2].label, catalog['diagnostics.cards.storage']);
        assert.equal(cards[3].detail, t('diagnostics.cards.icons-count', '', 0));
        const html = view.buildHero(model) + view.buildSection('health', t('diagnostics.sections.system'), model.coreCards);
        assert.ok(html.includes(ui.escapeHtml(catalog['diagnostics.metrics.passed'])));
        assert.ok(html.includes(ui.escapeHtml(t('diagnostics.cards.healthy-count', '', 6, 6))));
        if (locale !== 'en') {
            assert.doesNotMatch(html, /All systems operational|Storage and paths|Custom icons|Update check|No issues detected|All checks passed|Up to date/);
        }
        assert.equal(JSON.stringify(report), before, 'UI translation must not mutate support data');
    }
});

test('warning and failed update labels use structured status, and raw evidence remains escaped in technical details', () => {
    const catalog = catalogFor('de'), t = translator(catalog);
    const view = viewApi.createApi({ t, escapeHtml: ui.escapeHtml });
    const report = healthyReport();
    report.update = { ok: true, updateAvailable: true, currentVersion: '1', remoteVersion: '2' };
    const card = report.summary.cards.at(-1);
    card.status = 'warning';
    let cards = view.decorateCardsWithRecommendedActions([card], report, report.summary);
    let model = modelApi.buildDiagnosticsViewModel({ t, hasResults: true, coreCards: cards });
    assert.equal(model.metrics.updateLabel, catalog['diagnostics.update.available']);
    assert.equal(model.overall.headline, catalog['diagnostics.overall.warning']);
    report.update = { ok: false, updateAvailable: false };
    card.detail = 'Synthetic error <img src=x onerror=alert(1)>';
    cards = view.decorateCardsWithRecommendedActions([card], report, report.summary);
    model = modelApi.buildDiagnosticsViewModel({ t, hasResults: true, coreCards: cards });
    assert.equal(model.metrics.updateLabel, catalog['diagnostics.update.follow-up']);
    assert.equal(cards[0].headline, catalog['diagnostics.cards.update-failed']);
    assert.ok(cards[0].technicalDetails.includes(card.detail));
    const html = view.buildCard(model.coreCards[0]);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img/);
});

test('unchecked, failed, core error and advisory summaries all resolve through the selected catalog', () => {
    const catalog = catalogFor('de'), t = translator(catalog);
    assert.equal(modelApi.buildDiagnosticsViewModel({ t }).overall.label, catalog['diagnostics.state.not-checked']);
    assert.equal(modelApi.buildDiagnosticsViewModel({ t, errorMessage: 'Synthetic failure' }).overall.headline, catalog['diagnostics.overall.failed']);
    assert.equal(modelApi.buildDiagnosticsViewModel({ t, hasResults: true, coreCards: [{ key: 'docker', status: 'error' }] }).overall.headline,
        catalog['diagnostics.overall.error']);
    assert.equal(modelApi.buildDiagnosticsViewModel({ t, hasResults: true, advisoryCards: [{ key: 'localization', status: 'warning' }] }).overall.detail,
        catalog['diagnostics.overall.advisories-detail']);
});
