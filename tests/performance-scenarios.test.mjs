import assert from 'node:assert/strict';
import test from 'node:test';
import { performanceScenarios, DEFAULT_PERFORMANCE_RESOURCE_LIMIT } from '../scripts/lib/performance-scenarios.mjs';

const scenarios = { small: { members: 50 }, normal: { members: 500 }, extreme: { members: 2000 } };

test('routine benchmarks cap resources at 500 and explicitly report the excluded 2000 case', () => {
    assert.equal(DEFAULT_PERFORMANCE_RESOURCE_LIMIT, 500);
    const result = performanceScenarios(scenarios, DEFAULT_PERFORMANCE_RESOURCE_LIMIT);
    assert.deepEqual(result.selected.map(([name]) => name), ['small', 'normal']);
    assert.deepEqual(result.skipped, [{ name: 'extreme', members: 2000, reason: 'resource-limit' }]);
});

test('an explicit resource limit can narrow the matrix or opt into every retained scenario', () => {
    assert.deepEqual(performanceScenarios(scenarios, 50).selected.map(([name]) => name), ['small']);
    assert.deepEqual(performanceScenarios(scenarios, 0).selected.map(([name]) => name), Object.keys(scenarios));
    assert.throws(() => performanceScenarios(scenarios, 1), /No performance scenario/);
    for (const limit of ['', -1, 1.5, 'invalid']) assert.throws(() => performanceScenarios(scenarios, limit));
});
