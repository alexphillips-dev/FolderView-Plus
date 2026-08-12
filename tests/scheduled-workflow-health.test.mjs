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
        runs: [run({ createdAt: '2026-08-04T12:00:00Z' })]
    });
    assert.equal(result.healthy, true);
    assert.equal(result.reason, 'healthy');
    assert.equal(result.latestSuccess.event, 'schedule');
});

test('scheduled workflow health accepts a manual proof run until the weekly interval expires', () => {
    const result = evaluateWorkflowRuns({
        target,
        nowMs,
        runs: [run({ event: 'workflow_dispatch', createdAt: '2026-08-10T10:00:00Z' })]
    });
    assert.equal(result.healthy, true);
    assert.equal(result.latestSuccess.event, 'workflow_dispatch');
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
