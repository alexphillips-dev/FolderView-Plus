import test from 'node:test';
import assert from 'node:assert/strict';

import { actionableAlertsForCommit } from '../scripts/codeql_alert_guard.mjs';

const alert = ({ state = 'open', sha = 'current', number = 1 } = {}) => ({
    number,
    state,
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
        alert({ number: 3, sha: 'older' })
    ];
    assert.deepEqual(actionableAlertsForCommit(alerts, 'current').map((entry) => entry.number), [1]);
    assert.deepEqual(actionableAlertsForCommit(alerts, 'clean'), []);
});
