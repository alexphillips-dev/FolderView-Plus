import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.diagnostics-bootstrap.js', 'utf8');
const secret = 'SyntheticPrivateFolder https://private.example/path?token=syntheticSecret';
const createHarness = ({ fatal, legacy = false, result = true, throws = false } = {}) => {
    const copied = [], feedback = [], nodes = new Set();
    const button = { childNodes: [], replaceChildren: node => feedback.push(node?.text || '') };
    const document = {
        readyState: 'complete', addEventListener() {},
        getElementById: id => id === 'fvFolderEditorBootstrapCopy' ? button : null,
        createTextNode: text => ({ text }),
        body: { appendChild: node => nodes.add(node), removeChild: node => nodes.delete(node) },
        createElement: () => ({ value: '', style: {}, select() {}, remove() { nodes.delete(this); } }),
        execCommand: () => { copied.push([...nodes][0].value); if (throws) throw new Error('fixture denial'); return result; }
    };
    const window = { document, location: { href: secret }, FolderViewPlusFatalBanner: fatal,
        FolderViewPlusFolderEditorRequestedId: secret, FolderViewPlusFolderEditorResolvedId: secret,
        FolderViewPlusFolderEditorRuntimeScriptSource: secret, FolderViewPlusFolderEditorRuntimeLoaded: true,
        navigator: legacy ? {} : { clipboard: { writeText: async text => copied.push(text) } },
        setTimeout: () => 1, clearTimeout() {} };
    vm.runInNewContext(source, { window, document, navigator: window.navigator });
    window.FolderViewPlusReportFolderEditorBootstrap({ summary: secret, details: secret, debug: secret, tone: 'invalid', stage: secret });
    return { window, copied, feedback, nodes };
};

for (const mode of ['missing', 'failed', 'throws', 'partial']) {
    test(`editor copy uses private fallback when fatal collector is ${mode}`, async () => {
        const fatal = mode === 'missing' ? undefined : { getStartupIncidentSnapshot: () => ({ available: true }),
            ...(mode === 'partial' ? {} : { copyDiagnostics: async () => { if (mode === 'throws') throw new Error('fixture failure'); return false; } }) };
        const f = createHarness({ fatal });
        await f.window.FolderViewPlusCopyFolderEditorBootstrapDiagnostics();
        assert.equal(f.copied.length, 1);
        for (const value of ['SyntheticPrivateFolder', 'private.example', 'syntheticSecret']) assert.ok(!f.copied[0].includes(value));
        assert.match(f.copied[0], /runtimeLoaded: yes/);
        assert.equal(f.feedback.at(-1), 'Copied');
    });
}

for (const mode of ['false', 'throw', 'success']) {
    test(`editor legacy copy ${mode} reports actual outcome and removes temporary input`, async () => {
        const f = createHarness({ legacy: true, result: mode === 'success', throws: mode === 'throw' });
        await f.window.FolderViewPlusCopyFolderEditorBootstrapDiagnostics();
        assert.equal(f.feedback.at(-1), mode === 'success' ? 'Copied' : 'Copy failed');
        assert.equal(f.nodes.size, 0);
        assert.ok(!f.copied[0].includes('SyntheticPrivateFolder'));
    });
}

test('editor successful fatal collector owns copy without fallback', async () => {
    let calls = 0;
    const f = createHarness({ fatal: { getStartupIncidentSnapshot: () => ({ available: true }), copyDiagnostics: async () => { calls++; return true; } } });
    await f.window.FolderViewPlusCopyFolderEditorBootstrapDiagnostics();
    assert.equal(calls, 1);
    assert.equal(f.copied.length, 0);
    assert.equal(f.feedback.at(-1), 'Copied');
});
