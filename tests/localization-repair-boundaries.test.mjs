import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { applyChannelMessages } from '../scripts/package_channel_messages.mjs';

const require = createRequire(import.meta.url);
const { babelParse, traverse } = require('../node_modules/playwright/lib/transform/babelBundle.js');
const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const locales = fs.readdirSync(path.join(plugin, 'langs/namespaces')).sort();
const catalog = locale => Object.assign({}, read(path.join(plugin, `langs/${locale}.json`)), ...fs.readdirSync(path.join(plugin, `langs/namespaces/${locale}`)).map(f => read(path.join(plugin, `langs/namespaces/${locale}/${f}`))));
const source = name => fs.readFileSync(path.join(plugin, name), 'utf8');
const interpolate = (text, params) => text.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
const bindings = read('tests/fixtures/i18n/repair2-bindings.json');
test('translation transport rejects missing or duplicated parameters even when every key exists', async () => {
    const text = fs.readFileSync('scripts/build_i18n_surface_catalogs.mjs', 'utf8');
    const definitions = [];
    traverse(babelParse(text, 'builder.mjs', false), { VariableDeclaration(p) {
        if (['placeholderSignature', 'protectPlaceholders', 'restorePlaceholders', 'translateBatch'].includes(p.node.declarations[0]?.id?.name)) definitions.push(text.slice(p.node.start, p.node.end));
    } });
    const requests = [];
    let response = ['Éléments : __FVPLUS_PARAM_1__ / __FVPLUS_PARAM_2__'];
    const context = vm.createContext({ URL, AbortSignal, sleep: async () => {}, fetch: async url => {
        requests.push(String(url));
        return String(url).includes('/single?') ? { status: 429 } : { status: 200, ok: true, json: async () => response };
    } });
    const translateBatch = vm.runInContext(definitions.join('\n') + '\ntranslateBatch', context);
    const batch = [['fixture', 'Items: $1 / $2']];
    assert.equal((await translateBatch(batch, 'fr')).fixture, 'Éléments : $1 / $2');
    assert.ok(requests.some(url => url.includes('/translate_a/t?')));
    response = ['Éléments : __FVPLUS_PARAM_1__ / __FVPLUS_PARAM_1__'];
    await assert.rejects(translateBatch(batch, 'fr'), /translation batch returned/);
    response = ['Éléments : __FVPLUS_PARAM_1__ / __FVPLUS_PARAM_2__ / __FVPLUS_PARAM_2__'];
    await assert.rejects(translateBatch(batch, 'fr'), /translation batch returned/);
});
const extracts = new Map();
for (const name of new Set(bindings.map(row => row.file))) {
    const text = source(name), ast = babelParse(text, name, false), calls = [];
    traverse(ast, { CallExpression(p) {
        if (!bindings.some(row => row.file === name && row.key === p.node.arguments[0]?.value)) return;
        const binding = p.scope.getBinding(p.node.callee.name);
        assert.ok(binding, `${name}: translation helper must exist in the calling scope`);
        calls.push({ key: p.node.arguments[0].value, english: p.node.arguments[1]?.value,
            params: p.node.arguments.slice(2).map(n => text.slice(n.start, n.end)), code: text.slice(p.node.start, p.node.end) });
    } });
    extracts.set(name, { text, ast, calls });
}

test('all repaired bindings remain connected to their source parameters independently of catalog completeness', () => {
    for (const row of bindings) assert.ok(extracts.get(row.file).calls.some(call => call.key === row.key && call.english === row.english
        && JSON.stringify(call.params) === JSON.stringify(row.params)), `${row.file}: missing or altered binding ${row.key}`);
    const english = catalog('en');
    for (const locale of locales) {
        const messages = catalog(locale);
        for (const row of bindings) {
            assert.equal(typeof messages[row.key], 'string', `${locale}/${row.key}`);
            for (const count of [0, 1, 2, 5, 21]) {
                const args = row.params.map(expr => /name|label|detailText|templateUpdated|pluginVersion/i.test(expr) ? 'Order <custom>' : expr.includes('resolvedType') ? 'Docker' : count);
                const output = interpolate(messages[row.key], args);
                assert.ok(!/\$\d+|undefined/.test(output), `${locale}/${row.key}: ${output}`);
                const borrowedTerm = (locale === 'nl' && row.english === 'Updates: $1') || (['pt-BR', 'pt-PT'].includes(locale) && row.english === 'Backups: $1');
                if (locale !== 'en' && !borrowedTerm) assert.notEqual(messages[row.key], english[row.key], `${locale}/${row.key}: English fallback escaped the completeness check`);
            }
        }
    }
});

test('bare editor confirmations cancel before defaults, navigation, or reload in every locale', () => {
    const { text, ast } = extracts.get('scripts/folder.js'), functions = [];
    traverse(ast, { CallExpression(p) {
        if (p.node.callee.name === 'confirm') {
            const fn = p.findParent(parent => parent.isFunction());
            functions.push(text.slice(fn.node.start, fn.node.end));
        }
    } });
    assert.equal(functions.length, 3, 'test every bare confirmation in the editor');
    for (const locale of locales) for (const confirmed of [false, true]) for (const code of functions) {
        const messages = catalog(locale), dialogs = [];
        let changes = 0;
        const location = { pathname: '/Docker/Folder', reload: () => { changes++; } };
        Object.defineProperty(location, 'href', { set() { changes++; } });
        const context = vm.createContext({
            surfaceT: (key, fallback, ...args) => interpolate(messages[key] || fallback, args),
            confirm: message => { dialogs.push(message); return confirmed; },
            applyEditorPluginDefaults: () => { changes++; }, updateUnsavedIndicator: () => true,
            suppressUnloadPrompt: false, editingFolderDefaults: false, location
        });
        vm.runInContext(`(${code})`, context)();
        assert.equal(dialogs.length, 1);
        assert.equal(changes, confirmed ? 1 : 0, 'cancel must not mutate state');
        assert.ok(Object.values(messages).includes(dialogs[0]), `${locale}: dialog must use the selected catalog`);
    }
});

test('aliased clone prompts preserve the suggested name and cancel before creating folders', async () => {
    const { text, ast } = extracts.get('scripts/docker.runtime.actions.js'), functions = [];
    traverse(ast, { VariableDeclarator(p) {
        if (['cloneDockerFolderFromMenu', 'cloneDockerFolderBranchFromMenu'].includes(p.node.id.name)) functions.push(text.slice(p.node.init.start, p.node.init.end));
    } });
    assert.equal(functions.length, 2);
    for (const locale of locales) for (const code of functions) {
        const messages = catalog(locale), prompts = [];
        let mutations = 0;
        const context = vm.createContext({
            surfaceT: (key, fallback, ...args) => interpolate(messages[key] || fallback, args),
            runDockerGuardedAction: async (_action, run) => run(), ensureDockerFolderUnlocked: () => true, ensureDockerBranchUnlocked: () => true,
            getFolderById: () => ({ name: 'Order <custom>' }), getFolderMap: () => ({ root: { name: 'Order <custom>' } }),
            getFolderDescendants: () => ['child'], promptFn: (message, suggested) => { prompts.push({ message, suggested }); return null; },
            getDockerFolderBranchCloneOrder: () => ['root', 'child'],
            getDockerMenuLabel: (_key, fallback) => fallback, persistDockerFolderClonePayload: () => { mutations++; },
            buildDockerFolderClonePayload: () => { mutations++; return {}; }
        });
        await vm.runInContext(`(${code})`, context)('root');
        assert.equal(prompts.length, 1);
        assert.ok(prompts[0].suggested.includes('Order <custom>'));
        assert.ok(Object.values(messages).includes(prompts[0].message));
        assert.equal(mutations, 0);
    }
});

test('actual PHP upload and backup validators return localized keys without changing diagnostic errors', () => {
    const server = path.join(plugin, 'server').replaceAll('\\', '/');
    const code = `require ${JSON.stringify(server + '/lib.custom-icon-validation.php')}; require ${JSON.stringify(server + '/lib.backup-snapshots.php')}; require ${JSON.stringify(server + '/lib.i18n.php')};
        const FVPLUS_CUSTOM_ICON_MAX_BYTES=4194304; const FVPLUS_CUSTOM_ICON_EXTENSIONS=['png','svg','ico']; function ensureType($type){return $type;}
        $rows=[]; foreach(['no-file','empty','oversized','unsupported','backup-name'] as $case){$_FILES=[];$_POST=[];try{
        if($case==='empty')$_FILES=['icon'=>['error'=>0,'size'=>0]];
        if($case==='oversized')$_FILES=['icon'=>['error'=>0,'size'=>4194305]];
        if($case==='unsupported')$_POST=['icon_inline_data'=>'fixture','icon_inline_name'=>'fixture.exe'];
        if($case==='backup-name')getBackupSnapshotPath('docker','invalid.json');else resolveCustomIconUploadInput();
        }catch(Throwable $error){$rows[]=fvplus_localize_response_keys(['ok'=>false,'error'=>$error->getMessage(),'traceId'=>'fixture']);}} echo json_encode($rows);`;
    const responses = JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8' }));
    assert.equal(responses.length, 5);
    const english = catalog('en');
    for (const response of responses) {
        assert.equal(response.ok, false); assert.equal(response.traceId, 'fixture');
        assert.equal(english[response.errorKey], response.error);
        for (const locale of locales) assert.equal(typeof catalog(locale)[response.errorKey], 'string');
    }
});

test('server detail templates retain opaque parameters and original diagnostic fields', () => {
    const messages = read('scripts/lib/i18n_repair_messages.json');
    const templates = Object.entries(messages).filter(([key, value]) => key.startsWith('common.server.') && value.endsWith('$1'));
    assert.equal(templates.length, 5);
    const detail = "printf '%s' '/fixture/<custom>' $HOME";
    const input = templates.map(([, value]) => ({ error: value.replace('$1', detail), ok: false, traceId: 'fixture', details: { original: detail } }));
    const php = `require ${JSON.stringify(path.join(plugin, 'server/lib.i18n.php').replaceAll('\\', '/'))}; $rows=json_decode(base64_decode('${Buffer.from(JSON.stringify(input)).toString('base64')}'),true); echo json_encode(array_map('fvplus_localize_response_keys',$rows));`;
    const output = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
    output.forEach((row, index) => {
        assert.deepEqual(row, { ...input[index], errorKey: templates[index][0], errorParams: [detail] });
        for (const locale of locales) assert.ok(interpolate(catalog(locale)[row.errorKey], row.errorParams).includes(detail));
    });
});

test('reviewed source inventory excludes data literals and detects untranslated sentence blocks', () => {
    const rows = read('scripts/lib/i18n_additional_surfaces.json');
    for (const value of ['jc21/nginx-proxy-manager:latest', 'bulk start stop restart pause resume', 'ubuntu desktop']) {
        assert.ok(!rows.some(row => row.phrase === value));
    }
    const { keyForPhrase } = require('../scripts/lib/i18n_surface_tools.cjs');
    for (const locale of locales.filter(locale => locale !== 'en')) {
        const messages = catalog(locale);
        for (const row of rows.filter(row => (row.phrase.match(/[A-Za-z]{2,}/g) || []).length >= 5)) {
            assert.notEqual(messages[keyForPhrase(row.phrase)], row.phrase, `${locale}: untranslated sentence ${row.phrase}`);
        }
    }
});

test('dev packaging preserves the README bootstrap and uses each locale for both channel messages', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-language-package-'));
    try {
        fs.mkdirSync(path.join(temp, 'langs'));
        for (const locale of locales) fs.copyFileSync(path.join(plugin, `langs/${locale}.json`), path.join(temp, `langs/${locale}.json`));
        fs.copyFileSync(path.join(plugin, 'README.md'), path.join(temp, 'README.md'));
        const original = fs.readFileSync(path.join(temp, 'README.md'), 'utf8');
        applyChannelMessages(temp, 'main');
        assert.equal(fs.readFileSync(path.join(temp, 'README.md'), 'utf8'), original);
        applyChannelMessages(temp, 'dev');
        const packaged = fs.readFileSync(path.join(temp, 'README.md'), 'utf8');
        assert.ok(packaged.includes('<script id="folderviewplus-script">'));
        assert.equal((packaged.match(/<script/g) || []).length, (original.match(/<script/g) || []).length);
        for (const locale of locales) {
            const messages = read(path.join(temp, `langs/${locale}.json`));
            assert.equal(messages['folderviewplus-desc'], messages['folderviewplus-dev-desc']);
            assert.equal(messages['folderviewplus-quickstart'], messages['folderviewplus-dev-quickstart']);
            if (locale !== 'en') assert.notEqual(messages['folderviewplus-desc'], catalog('en')['folderviewplus-dev-desc']);
        }
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
