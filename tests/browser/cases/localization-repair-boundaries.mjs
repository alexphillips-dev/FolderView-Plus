import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { babelParse, traverse } = require('../../../node_modules/playwright/lib/transform/babelBundle.js');
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const reviewed = read('scripts/lib/i18n_reviewed_repair.json');
const sourceSurfaces = read('scripts/lib/i18n_additional_surfaces.json');
const tools = require('../../../scripts/lib/i18n_surface_tools.cjs');
const nativeCalls = [];
const explicitCalls = {};
for (const file of new Set(sourceSurfaces.filter(row => row.explicit).flatMap(row => row.locations.map(location => location.file)))) {
    const text = fs.readFileSync(path.join(plugin, file), 'utf8');
    traverse(babelParse(text, file, false), { CallExpression(p) {
        if (p.node.callee.name !== 'surfaceT' || !sourceSurfaces.some(row => row.explicit && tools.keyForPhrase(row.phrase) === p.node.arguments[0]?.value)) return;
        explicitCalls[p.node.arguments[0].value] = text.slice(p.node.start, p.node.arguments[2]?.start || p.node.end - 1)
            + p.node.arguments.slice(2).map((_node, index) => 'fixtureArgs[' + index + ']').join(', ') + ')';
    } });
}
let dateFormatter, byteFormatter, emptyStateBinding;
for (const name of ['folder.js', 'docker.runtime.actions.js', 'folder.editor.icons.js', 'folder.editor.icon-api.js', 'folder.editor.chrome.js']) {
    const text = fs.readFileSync(path.join(plugin, 'scripts', name), 'utf8');
    traverse(babelParse(text, name, false), {
        CallExpression(p) {
            if (['confirm', 'promptFn'].includes(p.node.callee.name)) nativeCalls.push(text.slice(p.node.start, p.node.end));
        },
        OptionalCallExpression(p) {
            if (p.node.callee.property?.name === 'setAttribute' && p.node.arguments[0]?.value === 'data-empty-message') emptyStateBinding = text.slice(p.node.start, p.node.end);
        },
        VariableDeclarator(p) {
            if (name === 'folder.editor.icons.js' && p.node.id.name === 'formatDateTimeShort') dateFormatter = text.slice(p.node.init.start, p.node.init.end);
            if (name === 'folder.editor.icon-api.js' && p.node.id.name === 'formatByteCount') byteFormatter = text.slice(p.node.init.start, p.node.init.end);
        }
    });
}

export const registerLocalizationRepairBoundaryCases = ({ test, baseUrl, loadI18n }) => {
    for (const locale of ['en', ...Object.keys(reviewed.locales)]) {
        test(`complete localization boundaries: native dialogs, CSS, reports, formatting and conditional messages in ${locale}`, async ({ page }) => {
            const catalogs = Object.assign({}, ...['common', 'import', 'settings', 'legacy-surface'].map(namespace => read(path.join(plugin, `langs/namespaces/${locale}/${namespace}.json`))));
            await page.goto(baseUrl + '/localization');
            await loadI18n(page, baseUrl);
            await page.addStyleTag({ url: baseUrl + '/plugin/styles/folder.css' });
            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folderviewplus.folderview3-report.js' });
            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folderviewplus.ui.js' });
            assert.ok(emptyStateBinding && dateFormatter && byteFormatter);
            const result = await page.evaluate(async ({ locale, surfaces, emptyStateBinding, dateFormatter, byteFormatter }) => {
                const root = document.getElementById('dynamic-root');
                root.innerHTML = '<div class="fv-modern-field-row is-actions-list-row"><div class="custom-action-wrapper"></div></div>';
                const actionsList = root.querySelector('.custom-action-wrapper');
                // Execute the real initializer before catalogs arrive, then hydrate in place.
                new Function('actionsList', emptyStateBinding)(actionsList);
                await window.FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale,
                    catalogReport: { locales: { [locale]: { coveragePercent: 100, missingMessages: 0 } } },
                    assets: [...new Set(['en', locale])].flatMap(language => [
                        { locale: language, namespace: 'legacy', url: '/plugin/langs/' + language + '.json' },
                        ...['common', 'import', 'settings', 'legacy-surface'].map(namespace => ({ locale: language, namespace,
                            url: '/plugin/langs/namespaces/' + language + '/' + namespace + '.json' }))
                    ]) });
                window.FolderViewPlusI18n.translate(root);
                const detail = "printf '%s' '/fixture/<custom>' $HOME";
                const serverTemplate = 'Custom icon directory is not writable. Run: $1';
                const serverInput = { error: serverTemplate.replace('$1', detail), errorKey: 'common.server.custom-icon-directory-unwritable', errorParams: [detail] };
                const translatedServer = window.FolderViewPlusI18n.serverMessage(serverInput);
                const forgedServer = window.FolderViewPlusI18n.serverMessage({ ...serverInput, errorParams: ['different'] });
                const failures = [];
                const pluralResults = [0, 1, 2, 5, 21].flatMap(count => ['import.review.count', 'import.summary.update', 'import.summary.delete'].map(key => ({ key, count, text: window.FolderViewPlusI18n.t(key, '', count) })));
                const countLabels = [0, 1, 2, 5, 21].flatMap(count => ['import.summary.folder-change', 'import.summary.planned-change'].map(key => window.FolderViewPlusI18n.t(key, '', count)));
                for (const row of surfaces) {
                    const args = Array(12).fill('Fixture <custom>');
                    const original = row.phrase.replace(/\$(\d+)/g, (_m, n) => args[Number(n) - 1]);
                    const expected = window.FolderViewPlusI18n.t(row.key, row.phrase, ...args);
                    const actual = row.explicit ? new Function('surfaceT', 'fixtureArgs', 'return ' + row.call)(window.FolderViewPlusI18n.t, args) : window.FolderViewPlusI18n.message(original);
                    if (actual !== expected) failures.push({ key: row.key, original, actual, expected });
                }
                const reports = [];
                for (const count of [0, 1, 2, 5, 21]) for (const mode of ['unmanaged', 'docker-page', 'custom-batches']) {
                    const reportNode = document.createElement('section');
                    reportNode.innerHTML = window.FolderViewPlusFoundationModules.folderView3Report.buildReportHtml({
                        report: { source: { kind: 'installed', pluginVersion: 'Fixture' },
                            operations: [{ id: 'docker-folders', label: 'Replace Docker folders', selected: true, count }], warnings: [],
                            summary: { dockerFolderCount: count, dockerRuleCount: count, vmFolderCount: count, vmRuleCount: count, startOrderMode: mode,
                                appearanceProfileActive: false, dockerOrderStatus: 'imported', vmOrderStatus: 'missing', nativeAutostartCount: count, organizerRegistryCount: count } },
                        escapeHtml: text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
                        formatTimestamp: String, translate: window.FolderViewPlusI18n.t });
                    reports.push({ mode, text: reportNode.textContent });
                }
                const formatDate = new Function('return (' + dateFormatter + ')')();
                const formatBytes = new Function('return (' + byteFormatter + ')')();
                const when = '2026-09-17T12:34:00Z';
                return { failures, reports, pluralResults, countLabels, translatedServer, forgedServer, serverOriginal: serverInput.error,
                    expectedServer: window.FolderViewPlusI18n.t(serverInput.errorKey, serverTemplate, detail), direction: document.documentElement.dir, css: getComputedStyle(actionsList, '::before').content,
                    date: formatDate(when), expectedDate: window.FolderViewPlusI18n.formatDate(when, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    bytes: formatBytes(1536), expectedBytes: window.FolderViewPlusI18n.formatNumber(1.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' KB',
                    untouched: window.FolderViewPlusI18n.message('Order <custom>'), snapshot: window.FolderViewPlusI18n.snapshot() };
            }, { locale, surfaces: sourceSurfaces.map(row => ({ ...row, key: tools.keyForPhrase(row.phrase), call: explicitCalls[tools.keyForPhrase(row.phrase)] })), emptyStateBinding, dateFormatter, byteFormatter });
            assert.deepEqual(result.failures, [], 'all source-backed conditional messages must cross the UI boundary');
            assert.equal(result.date, result.expectedDate);
            assert.equal(result.bytes, result.expectedBytes);
            assert.equal(result.untouched, 'Order <custom>');
            assert.equal(result.translatedServer, result.expectedServer);
            assert.equal(result.forgedServer, result.serverOriginal);
            assert.equal(result.direction, locale === 'ar' ? 'rtl' : 'ltr');
            assert.ok(result.countLabels.every(label => !/[0-9]/.test(label)), `${locale}: the adjacent total already displays the count`);
            for (const plural of result.pluralResults) {
                assert.ok(!/\{\{|\}\}|\$1/.test(plural.text), `${locale}: unresolved plural ${plural.key}`);
                if (plural.count === 21 || (plural.count === 0 && ['bn', 'fr', 'pt-BR'].includes(locale))) assert.ok(plural.text.includes(String(plural.count)), `${locale}: wrong quantity ${plural.text}`);
            }
            const emptyKey = Object.keys(catalogs).find(key => catalogs[key] && key.startsWith('common.repair.no-custom-actions'));
            assert.equal(result.css.slice(1, -1), catalogs[emptyKey]);
            for (const report of result.reports) {
                assert.ok(report.text.includes(catalogs['settings.start-order.' + report.mode]) || report.mode === 'docker-page');
                if (locale !== 'en') assert.ok(!/No changes made|Appearance inactive:|optional native autostart entries/.test(report.text));
            }
            assert.equal(nativeCalls.length, 5);
            for (const code of nativeCalls) {
                const pending = page.waitForEvent('dialog');
                const returned = page.evaluate(code => {
                    const surfaceT = window.FolderViewPlusI18n.t, promptFn = window.prompt.bind(window), defaultName = 'Order <custom>';
                    return new Function('surfaceT', 'promptFn', 'defaultName', 'return ' + code)(surfaceT, promptFn, defaultName);
                }, code);
                const dialog = await pending;
                assert.ok(Object.values(catalogs).includes(dialog.message()), `${locale}: native dialog text`);
                if (dialog.type() === 'prompt') assert.equal(dialog.defaultValue(), 'Order <custom>');
                await dialog.dismiss(); await returned;
            }
            assert.equal(result.snapshot.missingKeyCount, 0);
            assert.deepEqual(result.snapshot.loadErrors, []);
        });
    }
};
