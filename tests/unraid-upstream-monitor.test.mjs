import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const script = 'scripts/unraid_docker_upstream_monitor.sh';
const fixtures = 'tests/fixtures/unraid-upstream';
const bash = process.env.FVPLUS_BASH_BIN || 'bash';

const runMonitor = (...args) => spawnSync(bash, [script, '--json', ...args], {
    cwd: repoRoot,
    encoding: 'utf8'
});

test('upstream monitor reports the current disabled source gate as dormant', () => {
    const result = runMonitor(
        '--source-file',
        `${fixtures}/docker-page-dormant.ts`
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
        status: 'dormant',
        reason: 'upstream-shouldApply-false',
        sourceGate: 'false',
        releaseAnnouncement: 'not-scanned'
    });
});

test('upstream monitor raises a release-blocking signal when shouldApply flips', () => {
    const result = runMonitor(
        '--source-file',
        `${fixtures}/docker-page-active.ts`
    );
    assert.equal(result.status, 20, result.stderr);
    assert.equal(JSON.parse(result.stdout.trim()).reason, 'upstream-shouldApply-true');
});

test('upstream monitor raises a release-blocking signal for an activation announcement', () => {
    const result = runMonitor(
        '--source-file',
        `${fixtures}/docker-page-dormant.ts`,
        '--release-notes-dir',
        `${fixtures}/release-notes-active`
    );
    assert.equal(result.status, 20, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.reason, 'release-note-activation-announcement');
    assert.equal(output.releaseAnnouncement, 'detected');
});
