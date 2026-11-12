import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFixtureBrowserConfig } from '../scripts/lib/fixture-browser-config.mjs';

const matrixKeys = ['FVPLUS_FIXTURE_BROWSERS', 'FVPLUS_FIXTURE_COLOR_SCHEMES', 'FVPLUS_FIXTURE_VIEWPORTS'];
const withMatrixEnvironment = (values, callback) => {
    const saved = matrixKeys.map((key) => process.env[key]);
    try {
        matrixKeys.forEach((key) => delete process.env[key]);
        Object.assign(process.env, values);
        callback();
    } finally {
        matrixKeys.forEach((key, index) => {
            if (saved[index] === undefined) delete process.env[key];
            else process.env[key] = saved[index];
        });
    }
};

for (const [key, value] of [
    ['FVPLUS_FIXTURE_BROWSERS', ' , '],
    ['FVPLUS_FIXTURE_COLOR_SCHEMES', 'invalid'],
    ['FVPLUS_FIXTURE_VIEWPORTS', 'invalid']
]) {
    test(`fixture configuration rejects an empty ${key} matrix`, () => {
        withMatrixEnvironment({ [key]: value }, () => {
            assert.throws(() => readFixtureBrowserConfig(process.cwd()), new RegExp(key));
        });
    });
}

test('fixture configuration preserves defaults and valid matrix selections', () => {
    withMatrixEnvironment({}, () => {
        const config = readFixtureBrowserConfig(process.cwd());
        assert.deepEqual(config.requestedBrowsers, ['chromium']);
        assert.deepEqual(config.colorSchemes, ['dark']);
        assert.deepEqual(config.viewports, [{ width: 1180, height: 720 }]);
    });
    withMatrixEnvironment({
        FVPLUS_FIXTURE_BROWSERS: 'chromium, firefox',
        FVPLUS_FIXTURE_COLOR_SCHEMES: 'light, invalid, dark',
        FVPLUS_FIXTURE_VIEWPORTS: 'invalid, 390x844, 1180x720'
    }, () => {
        const config = readFixtureBrowserConfig(process.cwd());
        assert.deepEqual(config.requestedBrowsers, ['chromium', 'firefox']);
        assert.deepEqual(config.colorSchemes, ['light', 'dark']);
        assert.deepEqual(config.viewports, [{ width: 390, height: 844 }, { width: 1180, height: 720 }]);
    });
});

const runActionGuard = (source) => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-action-pin-'));
    try {
        fs.mkdirSync(path.join(fixture, 'scripts'));
        fs.mkdirSync(path.join(fixture, '.github/workflows'), { recursive: true });
        fs.mkdirSync(path.join(fixture, '.github/actions/setup-ci-env'), { recursive: true });
        fs.copyFileSync('scripts/action_pin_guard.mjs', path.join(fixture, 'scripts/action_pin_guard.mjs'));
        fs.writeFileSync(path.join(fixture, '.github/workflows/fixture.yml'), source);
        fs.writeFileSync(path.join(fixture, '.github/actions/setup-ci-env/action.yml'), 'runs:\n  using: composite\n  steps: []\n');
        fs.writeFileSync(path.join(fixture, '.github/dependabot.yml'), 'updates:\n  - package-ecosystem: github-actions\n  - package-ecosystem: npm\n');
        return spawnSync(process.execPath, ['scripts/action_pin_guard.mjs'], { cwd: fixture, encoding: 'utf8' });
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
};

test('action pin guard rejects mutable unnamed workflow steps', () => {
    const result = runActionGuard('jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v4 # v4\n');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /not pinned to a full commit SHA/);
});

test('action pin guard checks version comments on unnamed workflow steps', () => {
    const result = runActionGuard(`jobs:\n  check:\n    steps:\n      - uses: actions/checkout@${'a'.repeat(40)}\n`);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /human-readable major-version comment/);
});

test('action pin guard accepts named and unnamed immutable steps and local actions', () => {
    const result = runActionGuard(`jobs:\n  check:\n    steps:\n      - uses: actions/checkout@${'a'.repeat(40)} # v4\n      - name: Setup\n        uses: actions/setup-node@${'b'.repeat(40)} # v4\n      - uses: ./local-action\n`);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /2 external uses/);
});
