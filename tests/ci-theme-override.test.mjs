import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('an explicit theme exception omits the browser matrix and reports the skipped lane', () => {
    const output = execFileSync('bash', ['-c', 'FVPLUS_SKIP_THEME_MATRIX=1 bash scripts/run_ci_suite.sh --lane theme-matrix'], { encoding: 'utf8' });
    assert.match(output, /theme-matrix skipped: explicit FVPLUS_SKIP_THEME_MATRIX=1 override/);
    assert.match(output, /Shared CI suite passed/);
    assert.doesNotMatch(output, /Running deterministic local theme|Fixture browser suite:/);
});

test('release and synchronization default to the full matrix and share the explicit exception', () => {
    const suite = fs.readFileSync('scripts/run_ci_suite.sh', 'utf8');
    assert.match(suite, /REQUESTED_LANES=\(lint tests guards fixture-browser browser-smoke theme-matrix\)/);
    assert.match(suite, /"\$\{lane\}" == "theme-matrix" && "\$\{FVPLUS_SKIP_THEME_MATRIX:-0\}" == "1"/);
    for (const file of ['ci.yml', 'release-on-main.yml', 'backmerge-main-to-dev.yml']) {
        const workflow = fs.readFileSync(`.github/workflows/${file}`, 'utf8');
        assert.ok(workflow.includes("FVPLUS_SKIP_THEME_MATRIX: ${{ vars.FVPLUS_SKIP_THEME_MATRIX || '0' }}"), file);
    }
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    assert.ok(ci.includes("needs.detect-changes.outputs.needs_theme == 'true' && vars.FVPLUS_SKIP_THEME_MATRIX != '1'"));
    assert.match(ci, /success\|skipped\)/);
});
