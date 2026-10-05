import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectFixtureTests } from '../scripts/lib/fixture-browser-profile.mjs';

test('full fixture profile preserves every registered test; layout and smoke select useful subsets', async () => {
    const source = fs.readFileSync(new URL('../scripts/fixture_browser_tests.mjs', import.meta.url), 'utf8');
    const tests = [];
    const context = { test: (name, handler, options = {}) => tests.push({ name, handler, ...options }),
        baseUrl: 'http://127.0.0.1', surfaceKeyFor: value => value, germanSurfaceCatalog: {} };
    for (const [, names, location] of source.matchAll(/import \{([^}]+)\} from '(\.\.\/tests\/browser\/cases\/[^']+)'/g)) {
        const module = await import(new URL(location, new URL('../scripts/fixture_browser_tests.mjs', import.meta.url)));
        for (const name of names.split(',').map(value => value.trim())) module[name](context);
    }
    assert.ok(tests.length > 70, 'Primary registration retains the existing suite');
    assert.equal(selectFixtureTests(tests), tests);
    const layout = selectFixtureTests(tests, 'layout');
    const smoke = selectFixtureTests(tests, 'smoke');
    assert.ok(layout.length > 10 && layout.length < tests.length);
    assert.ok(smoke.length > 3 && smoke.length < layout.length);
    for (const pattern of [/Settings alerts/i, /Bulk move/i, /snapshot comparison/i, /Dashboard.*expansion/i, /overflow/i]) {
        assert.ok(layout.some(entry => pattern.test(entry.name)), `Layout profile missing ${pattern}`);
    }
    assert.throws(() => selectFixtureTests(tests, 'typo'), /Unknown/);
    assert.throws(() => selectFixtureTests([{ name: 'irrelevant' }], 'layout'), /no tests/);
    console.log(`Fixture profiles: full=${tests.length}, layout=${layout.length}, smoke=${smoke.length}`);
});
