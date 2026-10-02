import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { babelParse, traverse } = require('../../../node_modules/playwright/lib/transform/babelBundle.js');
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const review = read('scripts/lib/i18n_reviewed_ui.json');
const counts = read('scripts/lib/i18n_reviewed_counts.json');
const server = read('scripts/lib/i18n_reviewed_server.json');
const bindings = [];
let promptCall;
for (const file of fs.readdirSync(path.join(plugin, 'scripts')).filter(name => name.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(plugin, 'scripts', file), 'utf8');
    traverse(babelParse(text, file, false), { CallExpression(p) {
        const key = p.node.arguments[0]?.value;
        if (['surfaceT', 'importT', 'starterTemplateT', 'translate', 'dockerT'].includes(p.node.callee.name)
            && /^common\.(?:audit|counts)\./.test(key || '')) bindings.push({ key, code: text.slice(p.node.start, p.node.end) });
        if (file === 'folderviewplus.import.js' && p.node.callee.property?.name === 'prompt') promptCall = text.slice(p.node.start, p.node.end);
    } });
}
// Execute the actual binding expressions in the browser, with controlled inputs.
// This catches missing wrappers even when every catalog reports complete coverage.
const probeScript = `window.auditBindings = count => {
    const surfaceT = window.FolderViewPlusI18n.t, importT = surfaceT, starterTemplateT = surfaceT, translate = surfaceT, dockerT = surfaceT;
    const rows = Array(count).fill('fixture');
    const advisoryWarnings = rows, infoWarnings = rows, refs = rows, branchIds = rows,
        selectedIds = rows, targetIds = rows, targetRows = rows, upserts = rows, toRepair = rows;
    const chunkNumber = count, chunkCount = count, chunkSize = count, visibleCount = count,
        allCount = count, BULK_LIST_RENDER_CHUNK_SIZE = count, deletes = count, selectedDeletes = count,
        deletedCount = count, failedCount = count, byFolder = {size: count}, result = {updatedCount: count};
    const label = 'Docker', targetId = 'fixture', folders = {fixture: {name: 'Order <custom>'}},
        verificationError = {message: 'fixture failure'}, verifiedCounts = {repairableIssueCount: count, advisoryIssueCount: count};
    return [${bindings.map(row => `{key:${JSON.stringify(row.key)},text:${row.code}}`).join(',')}];
};
window.auditNativePrompt = () => {
    const importT = window.FolderViewPlusI18n.t, suggestedName = 'Order <custom>';
    return ${promptCall};
};`;

export const registerLocalizationAuditCases = ({ test, baseUrl, loadI18n }) => {
    for (const locale of ['en', ...Object.keys(review.locales).sort()]) {
        test(`audited confirmations, native prompts and server messages render in ${locale} at 100% coverage`, async ({ page }) => {
            const catalog = read(path.join(plugin, `langs/namespaces/${locale}/common.json`));
            await page.goto(baseUrl + '/localization');
            await loadI18n(page, baseUrl);
            await page.evaluate(async locale => {
                await window.FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale,
                    catalogReport: { locales: { [locale]: { coveragePercent: 100, missingMessages: 0 } } },
                    assets: [...new Set(['en', locale])].flatMap(language => [
                        { locale: language, namespace: 'legacy', url: '/plugin/langs/' + language + '.json' },
                        ...['common', 'legacy-surface'].map(namespace => ({ locale: language, namespace,
                            url: '/plugin/langs/namespaces/' + language + '/' + namespace + '.json' }))
                    ]) });
            }, locale);
            await page.addScriptTag({ content: probeScript });
            for (const count of [0, 1, 2, 5, 21]) {
                const result = await page.evaluate(count => {
                    const rows = window.auditBindings(count);
                    document.getElementById('dynamic-root').replaceChildren(...rows.map(row => {
                        const node = document.createElement('p'); node.textContent = row.text; return node;
                    }));
                    return rows;
                }, count);
                assert.equal(new Set(result.filter(row => row.key.startsWith('common.audit.')).map(row => row.key)).size, review.keys.length);
                assert.equal(new Set(result.filter(row => row.key.startsWith('common.counts.')).map(row => row.key)).size, counts.keys.length);
                for (const row of result) {
                    const params = row.key.endsWith('delete-backups') ? ['Docker', count]
                        : row.key.endsWith('backups-deleted') ? ['Docker', count, count]
                            : row.key.endsWith('folders-imported') ? [count, 'Order <custom>']
                                : row.key.endsWith('repair-unverified') ? [count, 'fixture failure'] : [count, count, count];
                    const expected = catalog[row.key].replace(/\$(\d+)/g, (_, index) => String(params[Number(index) - 1]));
                    assert.equal(row.text, expected, `${locale}/${row.key}/${count}`);
                }
                assert.equal(await page.locator('#dynamic-root custom').count(), 0);
            }
            const dialogPromise = page.waitForEvent('dialog');
            const promptResult = page.evaluate(() => window.auditNativePrompt());
            const dialog = await dialogPromise;
            assert.equal(dialog.message(), catalog['common.dialogs.preset-name']);
            assert.equal(dialog.defaultValue(), 'Order <custom>');
            await dialog.dismiss(); assert.equal(await promptResult, null);

            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folder.editor.icon-api.js' });
            const serverResults = await page.evaluate(async ({ keys, messages }) => {
                const results = [];
                for (let index = 0; index < keys.length; index++) {
                    const field = index < 6 ? 'error' : 'message';
                    const payload = { ok: index >= 6, [field]: messages[index], [field + 'Key']: 'common.server.' + keys[index], traceId: 'fixture-trace' };
                    const original = JSON.stringify(payload);
                    const text = window.FolderViewPlusI18n.serverMessage(payload);
                    let apiText = text;
                    if (index < 6) {
                        const api = window.FolderViewPlusFolderIconApi.createApi({ window, iconUploadApiPath: '/fixture/icons',
                            requestClient: { postJson: async () => payload } });
                        try { await api.requestCustomIconApi('rename', {}, 'POST'); } catch (error) { apiText = error.message; }
                    }
                    results.push({ key: keys[index], text, apiText, unchanged: original === JSON.stringify(payload) });
                }
                return results;
            }, { keys: server.keys, messages: server.en });
            for (const row of serverResults) {
                assert.equal(row.text, catalog['common.server.' + row.key]);
                assert.equal(row.apiText, row.text); assert.equal(row.unchanged, true);
            }
            const unknown = await page.evaluate(() => [
                window.FolderViewPlusI18n.serverMessage({ error: 'Order <custom>', errorKey: 'common.server.unknown' }),
                window.FolderViewPlusI18n.serverMessage({ error: 'Order <custom>', errorKey: 'common.server.icon-exists' })
            ]);
            assert.deepEqual(unknown, ['Order <custom>', 'Order <custom>']);
            await page.evaluate(() => {
                document.getElementById('dynamic-root').innerHTML = '<label for="audit-sort">Order</label><select id="audit-sort"><option value="manual" data-i18n="common.actions.manual-sort">Manual order</option></select><span data-fvplus-user-content>Manual</span>';
                window.FolderViewPlusI18n.translate();
            });
            assert.equal(await page.locator('option[value="manual"]').textContent(), catalog['common.actions.manual-sort']);
            assert.equal(await page.locator('[data-fvplus-user-content]').textContent(), 'Manual');
            const snapshot = await page.evaluate(() => window.FolderViewPlusI18n.snapshot());
            assert.equal(snapshot.activeLocaleReport.coveragePercent, 100);
            assert.equal(snapshot.missingKeyCount, 0);
            assert.equal(snapshot.loadErrors.length, 0);
        });
    }
};
