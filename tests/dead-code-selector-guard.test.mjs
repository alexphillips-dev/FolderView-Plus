import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const guard = fs.readFileSync(new URL('../scripts/dead_code_guard.sh', import.meta.url), 'utf8');
const guardProgram = guard.split("<<'NODE'\n")[1].split('\nNODE')[0];
const finder = fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.quick-finder.js', import.meta.url), 'utf8');

function check(t, source = finder, extraCss = '') {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-selector-guard-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(path.join(directory, 'finder.js'), source);
    fs.writeFileSync(path.join(directory, 'finder.css'), `#fvplus-docker-quick-finder, #fvplus-vm-quick-finder { color: inherit; }\n${extraCss}`);
    return spawnSync(process.execPath, ['-', directory, '1'], { input: guardProgram, encoding: 'utf8' });
}

test('strict selector guard recognizes both IDs produced by Quick finder', t => {
    const result = check(t);
    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('Quick finder selectors fail when their generated ID assignment is removed', t => {
    const result = check(t, finder.replace('shell.id = prefix;', ''));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /#fvplus-docker-quick-finder/);
    assert.match(result.stdout, /#fvplus-vm-quick-finder/);
});

test('Quick finder selectors fail when their generating prefix changes', t => {
    const result = check(t, finder.replace('`fvplus-${type}-quick-finder`', '`fvplus-${type}-unused-finder`'));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /#fvplus-docker-quick-finder/);
    assert.match(result.stdout, /#fvplus-vm-quick-finder/);
});

test('Quick finder recognition does not exempt unrelated unused selectors', t => {
    const result = check(t, finder, '#fv-unused-finder-control { color: inherit; }');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /#fv-unused-finder-control/);
    assert.doesNotMatch(result.stdout, /#fvplus-(docker|vm)-quick-finder/);
});
