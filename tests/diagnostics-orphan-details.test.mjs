import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const pluginDir = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const viewModule = require(path.join(pluginDir, 'scripts/folderviewplus.diagnostics-view.js'));
const ui = require(path.join(pluginDir, 'scripts/folderviewplus.ui.js'));
const german = JSON.parse(fs.readFileSync(path.join(pluginDir, 'langs/namespaces/de/diagnostics.json'), 'utf8'));
const translate = (key, fallback, ...params) => (german[key] || fallback)
    .replace(/\$(\d+)/g, (token, index) => String(params[Number(index) - 1] ?? token));
const makeDiagnostics = (privacyMode = 'full') => ({
    privacyMode,
    types: {
        docker: {
            integrityChecks: { issuesCount: 4, orphanedMembers: { count: 4, folders: [
                { folderId: 'd1', count: 3, items: ['old-one', 'old-two', '<img src=x onerror=alert(1)>'] },
                { folderId: 'd2', count: 1, items: ['old-four'] }
            ] } },
            stateSnapshot: { folders: { d1: { folderName: '<script>folder</script>' }, d2: { folderName: 'Media' } } }
        },
        vm: {
            integrityChecks: { issuesCount: 1, orphanedMembers: { count: 1, folders: [{ folderId: 'v1', count: 1, items: ['old-vm'] }] } },
            stateSnapshot: { folders: { v1: { folderName: 'Virtual machines' } } }
        }
    }
});
const cards = ['docker', 'vm'].map((key) => ({ key, status: 'error', headline: 'Server summary', detail: 'Server detail' }));
const summary = { recommendedActions: [{ action: 'repair_orphaned_members', label: 'Server repair', reason: 'Server reason' }] };

test('both orphan cards show localized folder and member findings with a type-specific repair each', () => {
    const view = viewModule.createApi({ escapeHtml: ui.escapeHtml, t: translate });
    const diagnostics = makeDiagnostics();
    const before = JSON.stringify(diagnostics);
    const decorated = view.decorateCardsWithRecommendedActions(cards, diagnostics, summary);
    assert.equal(decorated[0].label, 'Docker-Konfiguration');
    assert.equal(decorated[1].label, 'VM-Konfiguration');
    assert.match(decorated[0].detail, /Fehlende Verweise: 4.*Betroffene Ordner: 2/);
    assert.match(decorated[1].technicalDetails.join(' '), /Virtual machines.*old-vm/);
    for (const card of decorated) {
        assert.equal(card.actions.length, 1);
        assert.equal(card.actions[0].type, card.key);
        assert.equal(card.actions[0].reason, german[`diagnostics.orphans.scope-${card.key}`]);
        assert.match(view.buildCard(card), /<details/);
        assert.doesNotMatch(view.buildCard(card), /Server repair|Server reason|Server summary/);
    }
    const html = view.buildCard(decorated[0]);
    assert.match(html, /&lt;script&gt;folder&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<(?:script|img)\b/i);
    assert.equal(JSON.stringify(diagnostics), before, 'display decoration must not add names to the source summary');
    assert.equal(summary.recommendedActions[0].label, 'Server repair');
});

test('orphan details escape mixed-case tags and tag whitespace in saved names', () => {
    const view = viewModule.createApi({ escapeHtml: ui.escapeHtml, t: translate });
    for (const name of ['<SCRIPT>folder</SCRIPT>', '<ScRiPt\tdefer>folder</ScRiPt>', '<IMG\nsrc=x onerror=alert(1)>']) {
        const diagnostics = makeDiagnostics();
        diagnostics.types.docker.stateSnapshot.folders.d1.folderName = name;
        diagnostics.types.docker.integrityChecks.orphanedMembers.folders[0].items = [name];
        const html = view.buildCard(view.decorateCardsWithRecommendedActions(cards, diagnostics, summary)[0]);
        assert.doesNotMatch(html, /<(?:script|img)\b/i);
        assert.ok(html.includes('&lt;'), 'saved names must remain escaped visible text');
    }
});

test('sanitized snapshots never render member tokens as names, and full reports disclose list truncation', () => {
    const view = viewModule.createApi({ escapeHtml: ui.escapeHtml });
    const sanitized = view.decorateCardsWithRecommendedActions(cards, makeDiagnostics('sanitized'), summary);
    const html = sanitized.map(view.buildCard).join('');
    assert.match(html, /Names are hidden in this sanitized snapshot/);
    assert.doesNotMatch(html, /old-one|old-vm|Virtual machines|onerror/);
    const full = makeDiagnostics();
    full.types.docker.integrityChecks.orphanedMembers.folders[0].items = ['old-one'];
    full.types.docker.integrityChecks.issuesCount = 5;
    const mixed = view.decorateCardsWithRecommendedActions(cards, full, summary)[0];
    assert.equal(mixed.headline, 'Issues requiring attention: 5');
    assert.match(mixed.technicalDetails.join(' '), /2 more references are not listed/);
    assert.ok(mixed.technicalDetails.includes('Server detail'), 'other integrity failures must remain visible');
});

test('VM-only findings receive a VM repair and confirmation explains scope and backup before mutation', async () => {
    const diagnostics = makeDiagnostics();
    diagnostics.types.docker.integrityChecks = { issuesCount: 0, orphanedMembers: { count: 0, folders: [] } };
    let confirmed = false;
    const prompts = [];
    const repairs = [];
    const view = viewModule.createApi({
        escapeHtml: ui.escapeHtml,
        window: { FolderViewPlusUI: { confirm: async (options) => { prompts.push(options); return confirmed; } } },
        runRepair: async (action, type) => { repairs.push({ action, type }); return true; }
    });
    const decorated = view.decorateCardsWithRecommendedActions(cards, diagnostics, summary);
    assert.equal(decorated[0].actions.length, 0);
    assert.equal(decorated[1].actions.length, 1);
    const data = decorated[1].actions[0];
    assert.equal(await view.confirmRepair({ data }), false);
    assert.equal(repairs.length, 0);
    assert.match(prompts[0].detail, /VM folders only.*Docker folders are unchanged.*backup/);
    confirmed = true;
    assert.equal(await view.confirmRepair({ data }), true);
    assert.deepEqual(repairs, [{ action: 'repair_orphaned_members', type: 'vm' }]);
});

test('rendered repairs preserve each card type and reject absent or invalid scope before confirmation', async () => {
    const repairs = [], errors = [], prompts = [];
    const view = viewModule.createApi({
        escapeHtml: ui.escapeHtml,
        window: { FolderViewPlusUI: { confirm: async (options) => { prompts.push(options); return true; } } },
        showError: (...args) => errors.push(args),
        runRepair: async (action, type) => { repairs.push({ action, type }); return true; }
    });
    const modelModule = require(path.join(pluginDir, 'scripts/folderviewplus.diagnostics-view-model.js'));
    const model = modelModule.buildDiagnosticsViewModel({ hasResults: true,
        coreCards: view.decorateCardsWithRecommendedActions(cards, makeDiagnostics(), summary) });
    for (const card of model.coreCards) {
        const html = view.buildCard(card);
        const data = JSON.parse(html.match(/data-fv-ui-action-data="([^"]+)"/)[1].replaceAll('&quot;', '"'));
        assert.equal(data.type, card.key);
        assert.equal(await view.confirmRepair({ data }), true);
    }
    assert.deepEqual(repairs.map((entry) => entry.type), ['docker', 'vm']);
    for (const type of [undefined, '', 'all', 'other']) {
        assert.equal(await view.confirmRepair({ data: { action: 'repair_orphaned_members', type } }), false);
    }
    assert.equal(prompts.length, 2);
    assert.equal(repairs.length, 2);
    assert.equal(errors.length, 4);
});
