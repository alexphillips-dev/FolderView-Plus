import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { selectProductionPerfSurfaces } from '../scripts/production_performance_benchmarks.mjs';

test('the Docker exception preserves Settings startup checks and leaves defaults intact', () => {
    assert.deepEqual(selectProductionPerfSurfaces({}), ['settings', 'docker']);
    assert.deepEqual(selectProductionPerfSurfaces({}, true), ['settings']);
    assert.deepEqual(selectProductionPerfSurfaces({ surfaces: ['docker'] }, true), []);
    assert.deepEqual(selectProductionPerfSurfaces({ surfaces: ['settings'] }, true), ['settings']);
    for (const file of ['ci.yml']) {
        const workflow = fs.readFileSync(`.github/workflows/${file}`, 'utf8');
        assert.ok(workflow.includes("FVPLUS_SKIP_DOCKER_BENCHMARK: ${{ vars.FVPLUS_SKIP_DOCKER_BENCHMARK || '0' }}"), file);
    }
});

test('an explicit theme exception omits the browser matrix and reports the skipped lane', () => {
    const output = execFileSync('bash', ['-c', 'FVPLUS_SKIP_THEME_MATRIX=1 bash scripts/run_ci_suite.sh --lane theme-matrix'], { encoding: 'utf8' });
    assert.match(output, /theme-matrix skipped: explicit FVPLUS_SKIP_THEME_MATRIX=1 override/);
    assert.match(output, /Shared CI suite passed/);
    assert.doesNotMatch(output, /Running deterministic local theme|Fixture browser suite:/);
});

test('release defaults use focused layout coverage; exhaustive themes are explicit or scheduled', () => {
    const suite = fs.readFileSync('scripts/run_ci_suite.sh', 'utf8');
    assert.match(suite, /REQUESTED_LANES=\(lint tests guards fixture-browser layout-checks\)/);
    assert.match(suite, /"\$\{lane\}" == "theme-matrix" && "\$\{FVPLUS_SKIP_THEME_MATRIX:-0\}" == "1"/);
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    assert.match(ci, /inputs\.profile == 'exhaustive' && vars\.FVPLUS_SKIP_THEME_MATRIX != '1'/);
    assert.match(ci, /"success","skipped"/);
    const scheduled = fs.readFileSync('.github/workflows/scheduled-validation.yml', 'utf8');
    assert.match(scheduled, /--lane theme-matrix/);
    assert.match(scheduled, /--lane performance/);
    for (const file of ['release-on-main.yml', 'backmerge-main-to-dev.yml']) {
        assert.doesNotMatch(fs.readFileSync('.github/workflows/' + file, 'utf8'), /run_ci_suite/);
    }
});
