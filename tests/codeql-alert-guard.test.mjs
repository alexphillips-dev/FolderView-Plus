import test from 'node:test';
import assert from 'node:assert/strict';

import { actionableAlertsForCommit, analysisAvailableForCommit } from '../scripts/codeql_alert_guard.mjs';

const alert = ({ state = 'open', sha = 'current', number = 1, tool = 'CodeQL' } = {}) => ({
    number,
    state,
    tool: { name: tool },
    rule: { id: 'js/example' },
    most_recent_instance: {
        commit_sha: sha,
        location: { path: 'scripts/example.js', start_line: number }
    }
});

test('CodeQL guard reports only open alerts associated with the analyzed commit', () => {
    const alerts = [
        alert({ number: 1 }),
        alert({ number: 2, state: 'dismissed' }),
        alert({ number: 3, sha: 'older' }),
        alert({ number: 4, tool: 'Scorecard' })
    ];
    assert.deepEqual(actionableAlertsForCommit(alerts, 'current').map((entry) => entry.number), [1]);
    assert.deepEqual(actionableAlertsForCommit(alerts, 'clean'), []);
});

test('CodeQL guard waits for the exact commit and ref analysis', () => {
    const analyses = [
        { commit_sha: 'older', ref: 'refs/heads/dev', error: '' },
        { commit_sha: 'current', ref: 'refs/heads/main', error: '' },
        { commit_sha: 'broken', ref: 'refs/heads/dev', error: 'upload failed' }
    ];
    assert.equal(analysisAvailableForCommit(analyses, 'current', 'refs/heads/dev'), false);
    assert.equal(analysisAvailableForCommit(analyses, 'current', 'refs/heads/main'), true);
    assert.equal(analysisAvailableForCommit(analyses, 'broken', 'refs/heads/dev'), false);
});
