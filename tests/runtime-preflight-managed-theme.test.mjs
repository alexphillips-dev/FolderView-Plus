import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const server = path.join(root, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.join(root, 'tests/fixtures/runtime-preflight-managed-theme.php');
const generatedMarker = '/* FolderView Plus generated Theme Workspace asset. Do not edit manually. */\n';

const runPreflight = (t, files) => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-managed-preflight-'));
    t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
    for (const [relative, contents] of Object.entries(files)) {
        const file = path.join(fixtureRoot, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, contents);
    }
    return JSON.parse(execFileSync('php', [fixture, fixtureRoot, server], {
        encoding: 'utf8', timeout: 15000
    }));
};

const overrideIssue = (result, type) => result[type].preflight.issues.find(issue => issue.category === 'custom-overrides');

test('generated Docker and VM Theme Workspace assets do not degrade an otherwise healthy preflight', t => {
    const result = runPreflight(t, {
        'current/styles/fvplus-managed.theme.docker.css': `${generatedMarker}.docker { color: red; }\n`,
        'current/styles/fvplus-managed.theme.vm.css': `${generatedMarker}.vm { color: blue; }\n`
    });
    for (const type of ['docker', 'vm']) {
        assert.deepEqual(result[type].overrides, []);
        assert.deepEqual(result[type].preflight.issues, []);
    }
});

test('managed styles do not hide current or legacy unmanaged overrides', t => {
    const result = runPreflight(t, {
        'current/styles/fvplus-managed.theme.docker.css': `${generatedMarker}.docker { color: red; }\n`,
        'current/styles/manual.docker.css': '.manual { color: blue; }\n',
        'current/scripts/manual.docker.js': 'window.manual = true;\n',
        'legacy/styles/fvplus-managed.theme.docker.css': `${generatedMarker}.legacy { color: green; }\n`,
        'legacy/styles/manual.vm.css': '.manual { color: green; }\n'
    });
    assert.deepEqual(result.docker.overrides.map(entry => `${entry.kind}:${entry.path}`).sort(), [
        'scripts:manual.docker.js',
        'styles:fvplus-managed.theme.docker.css',
        'styles:manual.docker.css'
    ]);
    assert.equal(overrideIssue(result, 'docker')?.code, 'FVPLUS-DKR-OVR-001');
    assert.deepEqual(result.vm.overrides.map(entry => `${entry.kind}:${entry.path}`), ['styles:manual.vm.css']);
    assert.equal(overrideIssue(result, 'vm')?.code, 'FVPLUS-VM-OVR-001');
});

test('a manually replaced managed-path file remains an override warning', t => {
    const result = runPreflight(t, {
        'current/styles/fvplus-managed.theme.docker.css': '.changed-without-generated-marker { color: red; }\n'
    });
    assert.deepEqual(result.docker.overrides.map(entry => entry.path), ['fvplus-managed.theme.docker.css']);
    assert.equal(overrideIssue(result, 'docker')?.code, 'FVPLUS-DKR-OVR-001');
    assert.equal(overrideIssue(result, 'vm'), undefined);
});
