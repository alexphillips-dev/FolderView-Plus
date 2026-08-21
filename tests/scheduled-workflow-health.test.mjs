import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SCHEDULED_WORKFLOW_TARGETS,
    evaluateWorkflowRuns
} from '../scripts/scheduled_workflow_health.mjs';

const target = SCHEDULED_WORKFLOW_TARGETS[0];
const nowMs = Date.parse('2026-08-10T12:00:00Z');

const run = ({ event = 'schedule', status = 'completed', conclusion = 'success', createdAt, updatedAt = createdAt } = {}) => ({
    event,
    status,
    conclusion,
    created_at: createdAt,
    updated_at: updatedAt,
    html_url: 'https://example.test/run'
});

test('scheduled workflow health accepts a recent scheduled success', () => {
    const result = evaluateWorkflowRuns({
        target,
        nowMs,
        runs: [run({ createdAt: '2026-08-08T12:01:00Z' })]
    });
    assert.equal(result.healthy, true);
    assert.equal(result.reason, 'healthy');
    assert.equal(result.latestSuccess.event, 'schedule');
});

test('scheduled workflow health accepts a manual proof run until the daily-monitor grace period expires', () => {
    const result = evaluateWorkflowRuns({
        target,
        nowMs,
        runs: [run({ event: 'workflow_dispatch', createdAt: '2026-08-10T10:00:00Z' })]
    });
    assert.equal(result.healthy, true);
    assert.equal(result.latestSuccess.event, 'workflow_dispatch');
});

test('scheduled workflow health identifies the daily Unraid compatibility monitor', () => {
    assert.equal(target.workflowFile, 'unraid-docker-upstream-monitor.yml');
    assert.equal(target.label, 'Unraid Compatibility Monitor');
    assert.equal(target.maximumSuccessAgeHours, 72);
});

test('scheduled workflow health monitors the daily clone badge with a bounded grace period', () => {
    const cloneBadgeTarget = SCHEDULED_WORKFLOW_TARGETS.find((candidate) => (
        candidate.workflowFile === 'clone-traffic-badge.yml'
    ));
    assert.ok(cloneBadgeTarget);
    assert.equal(cloneBadgeTarget.label, 'Rolling Clone Traffic Badge');
    assert.equal(cloneBadgeTarget.maximumSuccessAgeHours, 72);

    const fresh = evaluateWorkflowRuns({
        target: cloneBadgeTarget,
        nowMs,
        runs: [run({ createdAt: '2026-08-08T12:01:00Z' })]
    });
    assert.equal(fresh.healthy, true);

    const stale = evaluateWorkflowRuns({
        target: cloneBadgeTarget,
        nowMs,
        runs: [run({ createdAt: '2026-08-07T11:59:00Z' })]
    });
    assert.equal(stale.healthy, false);
    assert.equal(stale.reason, 'successful-run-stale');
});

test('scheduled workflow health monitors weekly security workflows', () => {
    const expected = new Map([
        ['codeql.yml', 'CodeQL'],
        ['scorecard.yml', 'OpenSSF Scorecard'],
        ['dependency-vulnerability-scan.yml', 'Dependency Vulnerability Scan']
    ]);
    for (const [workflowFile, label] of expected) {
        const securityTarget = SCHEDULED_WORKFLOW_TARGETS.find((candidate) => candidate.workflowFile === workflowFile);
        assert.ok(securityTarget, `${workflowFile} must be monitored`);
        assert.equal(securityTarget.label, label);
        assert.equal(securityTarget.maximumSuccessAgeHours, 204);
    }
});

test('scheduled workflow health rejects missing, failed, and stale successes', () => {
    const missing = evaluateWorkflowRuns({ target, nowMs, runs: [] });
    assert.equal(missing.healthy, false);
    assert.equal(missing.reason, 'no-successful-run');

    const failed = evaluateWorkflowRuns({
        target,
        nowMs,
        runs: [run({ conclusion: 'startup_failure', createdAt: '2026-08-10T10:00:00Z' })]
    });
    assert.equal(failed.healthy, false);
    assert.equal(failed.latestAttempt.conclusion, 'startup_failure');

    const stale = evaluateWorkflowRuns({
        target,
        nowMs,
        runs: [run({ createdAt: '2026-07-20T10:00:00Z' })]
    });
    assert.equal(stale.healthy, false);
    assert.equal(stale.reason, 'successful-run-stale');
});
