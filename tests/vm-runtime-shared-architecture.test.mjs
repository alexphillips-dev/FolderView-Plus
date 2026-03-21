import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('vm runtime page loads shared runtime module before vm runtime script', () => {
    const sharedIndex = vmPage.indexOf('/plugins/folderview.plus/scripts/docker.runtime.shared.js');
    const runtimeIndex = vmPage.indexOf('/plugins/folderview.plus/scripts/vm.js');
    assert.ok(sharedIndex >= 0, 'shared runtime include missing from VMs page');
    assert.ok(runtimeIndex >= 0, 'vm runtime include missing from VMs page');
    assert.ok(sharedIndex < runtimeIndex, 'shared runtime must load before vm.js');
});

test('vm runtime consumes shared state/perf/action modules and exposes telemetry snapshots', () => {
    assert.match(vmJs, /^\/\/ @ts-check/m);
    assert.match(vmJs, /const runtimeShared = window\.FolderViewDockerRuntimeShared \|\| \{\};/);
    assert.match(vmJs, /const vmRuntimeStateStore = createVmRuntimeStateStore\(/);
    assert.match(vmJs, /const vmActionBoundary = createVmAsyncActionBoundary\(/);
    assert.match(vmJs, /const vmSafeUiActionRunner = createVmSafeUiActionRunner\(\);/);
    assert.match(vmJs, /const runVmGuardedAction = async \(actionName, action, context = \{\}\) =>/);
    assert.match(vmJs, /let vmRuntimePerformanceProfile = resolveVmRuntimePerformanceProfile\(/);
    assert.match(vmJs, /window\.getVmRuntimePerfTelemetrySnapshot =/);
    assert.match(vmJs, /window\.getVmRuntimeStateSnapshot =/);
});
