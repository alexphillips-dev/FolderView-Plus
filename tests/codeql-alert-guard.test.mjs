import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

const runGuard = (states, stableReads = 2) => {
    const mock = `const states = ${JSON.stringify(states)}; let attempt = -1;
        globalThis.fetch = async url => {
            const analysis = String(url).includes('/analyses?');
            if (analysis) attempt++;
            const state = states[attempt];
            return { ok: state !== 'api-error', status: 503, json: async () => analysis
                ? (state === 'missing' ? [] : [{ commit_sha: 'current', ref: 'refs/heads/fixture', error: '' }])
                : (state === 'alert' ? [${JSON.stringify(alert())}] : []) };
        };`;
    return spawnSync(process.execPath, [
        '--import', 'data:text/javascript,' + encodeURIComponent(mock),
        fileURLToPath(new URL('../scripts/codeql_alert_guard.mjs', import.meta.url)),
        '--commit-sha', 'current', '--ref', 'refs/heads/fixture',
        '--attempts', String(states.length), '--stable-reads', String(stableReads), '--interval-ms', '0'
    ], { encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: 'example/fixture', GITHUB_TOKEN: 'synthetic-fixture-token' } });
};

for (const [name, states] of [
    ['configured insufficient attempts', ['clean']],
    ['analysis visible only on the final default attempt', [...Array(11).fill('missing'), 'clean']],
    ['an intervening open alert', ['clean', 'alert', 'clean']],
    ['an intervening missing analysis', ['clean', 'missing', 'clean']]
]) {
    test(`CodeQL CLI fails closed after ${name}`, () => {
        const result = runGuard(states);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /stable reads.*timed out/i);
        assert.doesNotMatch(result.stdout, /guard passed/);
    });
}

for (const states of [['clean', 'clean'], ['clean', 'alert', 'clean', 'clean'], ['clean', 'missing', 'clean', 'clean']]) {
    test(`CodeQL CLI accepts consecutive clean reads after ${states.join(', ')}`, () => {
        const result = runGuard(states);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /no open alerts across 2 stable reads/);
        assert.equal(result.stderr, '');
    });
}

test('CodeQL CLI retains explicit terminal alert, missing-analysis and API failures', () => {
    for (const [state, status, message] of [['alert', 1, /Open CodeQL alert/], ['missing', 1, /analysis.*timed out/], ['api-error', 2, /HTTP 503/]]) {
        const result = runGuard([state]);
        assert.equal(result.status, status, result.stdout + result.stderr);
        assert.match(result.stderr, message);
        assert.doesNotMatch(result.stdout, /guard passed/);
    }
});
