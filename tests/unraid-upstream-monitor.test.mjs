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
        releaseAnnouncement: 'not-scanned',
        schemaStatus: 'not-scanned',
        schemaSignature: 'not-scanned',
        latestApiRelease: 'not-scanned',
        apiReleaseStatus: 'not-scanned'
    });
});

test('upstream monitor raises a review signal when the tracked Docker schema changes', () => {
    const result = runMonitor(
        '--source-file',
        `${fixtures}/docker-page-dormant.ts`,
        '--schema-file',
        `${fixtures}/docker-schema-changed.graphql`,
        '--baseline-file',
        `${fixtures}/docker-schema-baseline.json`,
        '--api-release-file',
        `${fixtures}/api-release-current.json`
    );
    assert.equal(result.status, 20, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.status, 'review');
    assert.equal(output.reason, 'docker-schema-changed');
    assert.equal(output.schemaStatus, 'changed');
    assert.equal(output.latestApiRelease, 'v4.36.1');
    assert.equal(output.apiReleaseStatus, 'matched');
});

test('upstream monitor raises a review signal for a newer Unraid API release', () => {
    const result = runMonitor(
        '--source-file',
        `${fixtures}/docker-page-dormant.ts`,
        '--schema-file',
        `${fixtures}/docker-schema-changed.graphql`,
        '--baseline-file',
        `${fixtures}/docker-schema-release-baseline.json`,
        '--api-release-file',
        `${fixtures}/api-release-new.json`
    );
    assert.equal(result.status, 20, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.status, 'review');
    assert.equal(output.reason, 'new-unraid-api-release');
    assert.equal(output.schemaStatus, 'matched');
    assert.equal(output.latestApiRelease, 'v4.37.0');
    assert.equal(output.apiReleaseStatus, 'changed');
});

test('upstream monitor fails closed when a requested Docker schema is unavailable', () => {
    const result = runMonitor(
        '--source-file',
        `${fixtures}/docker-page-dormant.ts`,
        '--schema-file',
        `${fixtures}/does-not-exist.graphql`
    );
    assert.equal(result.status, 21, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.status, 'unknown');
    assert.equal(output.reason, 'docker-schema-unavailable');
    assert.equal(output.schemaStatus, 'unavailable');
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
