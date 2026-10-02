import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { babelParse, traverse } = require('../node_modules/playwright/lib/transform/babelBundle.js');
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const source = file => fs.readFileSync(path.join(plugin, file), 'utf8');
const reviews = Object.fromEntries(['counts', 'actions', 'ui', 'dialogs', 'server'].map(name => [name === 'ui' ? 'audit' : name, read(`scripts/lib/i18n_reviewed_${name}.json`)]));
const locales = fs.readdirSync(path.join(plugin, 'langs/namespaces')).sort();
const catalog = locale => Object.assign({}, read(path.join(plugin, `langs/${locale}.json`)), ...fs.readdirSync(path.join(plugin, `langs/namespaces/${locale}`)).map(file => read(path.join(plugin, `langs/namespaces/${locale}/${file}`))));
const interpolate = (message, params) => message.replace(/\$(\d+)/g, (match, index) => String(params[Number(index) - 1] ?? match));
const extract = (file, name) => {
    const text = source(file);
    let result;
    traverse(babelParse(text, file, false), { VariableDeclarator(p) {
        if (p.node.id.name === name) result = text.slice(p.node.init.start, p.node.init.end);
    } });
    assert.ok(result, `${file}/${name}`);
    return result;
};

test('reviewed audit messages retain context and parameters in all locales independently of completeness', () => {
    const english = catalog('en');
    for (const [namespace, review] of Object.entries(reviews)) {
        assert.deepEqual(Object.keys(review.locales).sort(), locales.filter(locale => locale !== 'en'));
        for (const locale of locales) {
            const messages = catalog(locale);
            const values = locale === 'en' ? review.en : review.locales[locale];
            assert.equal(values.length, review.keys.length);
            review.keys.forEach((name, index) => {
                const key = `common.${namespace}.${name}`;
                assert.equal(messages[key], values[index], `${locale}/${key}`);
                assert.deepEqual([...values[index].matchAll(/\$\d+/g)].map(m => m[0]).sort(), [...english[key].matchAll(/\$\d+/g)].map(m => m[0]).sort(), key);
                if (locale !== 'en') assert.notEqual(values[index], review.en[index], `${locale}/${key} must not silently fall back to English`);
            });
            if (locale !== 'en') {
                const terms = read('scripts/lib/i18n_reviewed_terms.json');
                assert.notEqual(messages['common.actions.manual-sort'], terms.locales[locale][terms.terms.indexOf('Manual')], `${locale}: sorting is not assignment`);
            }
        }
    }
});

test('backup deletion remains localized and requires both confirmations before mutation', async () => {
    const code = extract('scripts/folderviewplus.js', 'deleteAllBackupEntries');
    for (const locale of locales) for (const type of ['docker', 'vm']) for (const count of [0, 1, 2, 5, 21]) {
        const messages = catalog(locale);
        for (const answers of [[false], [true, false], [true, true]]) {
            const dialogs = [], errors = [], activities = [];
            let mutations = 0;
            const context = vm.createContext({
                surfaceT: (key, fallback, ...params) => interpolate(messages[key] || fallback, params),
                normalizeManagedType: value => value, backupsByType: { [type]: Array(count).fill({}) },
                ensureRuntimeConflictActionAllowed: () => true,
                showError: (_title, error) => errors.push(error.message),
                swal: (options, callback) => dialogs.push({ options, callback }),
                withAdvancedOperationLock: async (_type, _kind, _label, action) => action(),
                deleteAllBackupsForType: async () => { mutations++; return { backups: [], result: { deletedCount: count, failedCount: 0 } }; },
                addActivityEntry: message => activities.push(message), renderBackupRows: () => {}
            });
            const run = vm.runInContext(`(${code})`, context);
            run(type);
            if (count === 0) {
                assert.equal(dialogs.length, 0); assert.equal(mutations, 0);
                assert.equal(errors[0], messages['common.server.no-backups']);
                continue;
            }
            assert.equal(dialogs[0].options.text, interpolate(messages['common.counts.delete-backups'], [type === 'docker' ? 'Docker' : 'VM', count]));
            assert.equal(mutations, 0);
            await dialogs[0].callback(answers[0]);
            assert.equal(mutations, 0, 'first confirmation alone never deletes');
            if (answers[0]) await dialogs[1].callback(answers[1]);
            assert.equal(mutations, answers[1] === true ? 1 : 0);
            if (mutations) assert.equal(activities[0], interpolate(messages['common.counts.backups-deleted'], [type === 'docker' ? 'Docker' : 'VM', count, 0]));
        }
    }
});

test('branch deletion translates its irreversible warning, escapes names, and cancels without deleting', async () => {
    const code = extract('scripts/docker.runtime.actions.js', 'rmFolderBranch');
    for (const locale of locales) for (const count of [1, 2, 5, 21]) {
        const messages = catalog(locale);
        let confirmation, deleted = 0;
        const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        const context = vm.createContext({
            debugLog: () => {}, ensureDockerBranchUnlocked: () => true,
            getFolderMap: () => ({ root: { name: '<img src=x onerror=alert(1)>' } }),
            getFolderDescendants: () => Array.from({ length: count - 1 }, (_, i) => `child-${i}`),
            escapeHtml, surfaceT: (key, fallback, ...params) => interpolate(messages[key] || fallback, params),
            i18nLabel: (key, fallback) => messages[key] || fallback,
            swalFn: (options, callback) => { confirmation = { options, callback }; },
            defer: () => {}, refreshDockerList: () => {}, getSpinner: () => null,
            runDockerGuardedAction: async (_name, action) => { await action(); return { ok: true }; },
            deleteDockerFolderBranch: async () => { deleted++; }, getDockerMenuLabel: (_key, fallback) => fallback
        });
        vm.runInContext(`(${code})`, context)('root');
        assert.ok(confirmation.options.text.includes(escapeHtml(interpolate(messages['common.counts.delete-branch'], [count]))));
        assert.ok(confirmation.options.text.includes(escapeHtml(messages['common.actions.delete-children'])));
        assert.ok(!confirmation.options.text.includes('<img'));
        await confirmation.callback(false); assert.equal(deleted, 0);
        await confirmation.callback(true); assert.equal(deleted, 1);
    }
});

test('server response keys preserve original diagnostics and reject unknown human text', () => {
    const inputs = reviews.server.en.map((message, index) => ({ [index < 6 ? 'error' : 'message']: message, ok: index >= 6, traceId: 'fixture-trace', transactionId: 'fixture-transaction', details: { count: 21 } }));
    inputs.push({ error: 'Private folder <name> /private/path', ok: false }, { message: 'Unknown response' }, { error: ['invalid'] });
    const php = `require ${JSON.stringify(path.join(plugin, 'server/lib.i18n.php').replaceAll('\\', '/'))}; $rows=json_decode(base64_decode('${Buffer.from(JSON.stringify(inputs)).toString('base64')}'),true); echo json_encode(array_map('fvplus_localize_response_keys',$rows));`;
    const outputs = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    outputs.forEach((row, index) => {
        const expected = { ...inputs[index] };
        if (index < reviews.server.keys.length) expected[index < 6 ? 'errorKey' : 'messageKey'] = `common.server.${reviews.server.keys[index]}`;
        assert.deepEqual(row, expected);
    });
});

test('actual JSON response boundary attaches localized keys while preserving HTTP status and trace fields', () => {
    const library = source('server/lib.php');
    const response = library.slice(library.indexOf('    function fvplus_json_response('), library.indexOf('    function fvplus_json_ok('))
        .replaceAll('__DIR__', JSON.stringify(path.join(plugin, 'server').replaceAll('\\', '/')));
    const inputs = reviews.server.en.map((message, index) => ({ [index < 6 ? 'error' : 'message']: message, ok: index >= 6, details: { count: 21 } }));
    inputs.push({ error: 'Private folder <name> /private/path', ok: false });
    const php = `function emitRequestTraceHeader() {} function getRequestTraceId() {return 'fixture-trace';} function getRequestTransactionId() {return 'fixture-transaction';}
        ${response}
        $rows=json_decode(base64_decode('${Buffer.from(JSON.stringify(inputs)).toString('base64')}'),true); $result=[];
        foreach ($rows as $row) { $status=$row['ok'] ? 200 : 409; ob_start(); fvplus_json_response($row,$status); $result[]=['payload'=>json_decode(ob_get_clean(),true),'status'=>http_response_code()]; }
        echo json_encode($result);`;
    const outputs = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    outputs.forEach((row, index) => {
        const expected = { ...inputs[index], traceId: 'fixture-trace', transactionId: 'fixture-transaction' };
        if (index < reviews.server.keys.length) expected[index < 6 ? 'errorKey' : 'messageKey'] = `common.server.${reviews.server.keys[index]}`;
        assert.deepEqual(row.payload, expected);
        assert.equal(row.status, inputs[index].ok ? 200 : 409);
    });
    const cacheWriter = library.slice(library.indexOf('    function fv3_write_json_cache_payload('), library.indexOf('    function fv3_get_tailscale_cache_path('));
    assert.ok(!cacheWriter.includes('fvplus_localize_response_keys'));
});

test('all audited UI strings and native prompts are explicitly bound at their call sites', () => {
    const seen = new Set();
    const prompts = [];
    for (const file of fs.readdirSync(path.join(plugin, 'scripts')).filter(name => name.endsWith('.js'))) {
        const text = source(`scripts/${file}`);
        traverse(babelParse(text, file, false), { CallExpression(p) {
            if (['surfaceT', 'importT', 'starterTemplateT', 'translate', 'dockerT'].includes(p.node.callee.name)) {
                seen.add(p.node.arguments[0]?.value);
                assert.ok(p.scope.getBinding(p.node.callee.name), `${file}: translation helper must be in the caller's scope`);
            }
            if (p.node.callee.property?.name === 'prompt') prompts.push({ file, first: text.slice(p.node.arguments[0].start, p.node.arguments[0].end) });
        } });
    }
    for (const namespace of ['counts', 'audit', 'dialogs']) for (const key of reviews[namespace].keys) assert.ok(seen.has(`common.${namespace}.${key}`), key);
    for (const file of ['folderviewplus.import.js', 'folder.editor.icons.js', 'folderviewplus.js', 'vm.js', 'folderviewplus.starter-templates.js']) {
        const rows = prompts.filter(row => row.file === file);
        assert.ok(rows.length, file);
        rows.forEach(row => assert.match(row.first, /^(?:surfaceT|importT|starterTemplateT|translateVmText)\(/, file));
    }
    assert.equal((source('FolderViewPlus.page').match(/value="manual" data-i18n="common.actions.manual-sort"/g) || []).length, 2);
    assert.match(source('scripts/folderviewplus.wizard.js'), /value="manual"[^\n]+data-i18n="common.actions.manual-sort"/);
    assert.match(source('scripts/folderviewplus.js'), /label: surfaceT\("common.actions.manual-sort"/);
});
