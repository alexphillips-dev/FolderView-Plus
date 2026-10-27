import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const hook = fs.readFileSync('.githooks/pre-push', 'utf8');
const commit = 'a'.repeat(40);
const runHook = (env = {}, ref = 'refs/heads/main') => {
    // Record commands without executing guards, Git operations, or network calls.
    const harness = `
git() {
    case "$*" in
        'rev-parse --show-toplevel') pwd ;;
        'branch --show-current') printf 'main\\n' ;;
        'rev-parse HEAD') printf '${commit}\\n' ;;
        *) return 99 ;;
    esac
}
bash() { printf 'guard:%s\\n' "$*"; }
node() { printf 'evidence:%s\\n' "$*"; }
`;
    const scratchRoot = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const directory = fs.mkdtempSync(path.join(scratchRoot, 'push-policy-'));
    try {
        const script = path.join(directory, 'hook.sh');
        fs.writeFileSync(script, harness + hook);
        const result = spawnSync('bash', [path.relative(process.cwd(), script).replaceAll('\\', '/')], { cwd: process.cwd(),
            input: `refs/heads/main ${commit} ${ref} ${'b'.repeat(40)}\n`, encoding: 'utf8',
            env: { ...process.env, GITHUB_ACTIONS: '', FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '0',
                WSLENV: [process.env.WSLENV, 'FVPLUS_SKIP_WORKSPACE_PERFORMANCE', 'GITHUB_ACTIONS'].filter(Boolean).join(':'), ...env } });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return result.stdout;
    } finally {
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    }
};

test('main push keeps performance budget validation enabled by default', () => {
    assert.match(runHook(), /guard:scripts\/perf_budget_guard\.sh/);
});

test('explicit workspace policy skips only local performance and preserves every other main push guard', () => {
    const output = runHook({ FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1' });
    assert.doesNotMatch(output, /guard:scripts\/perf_budget_guard\.sh/);
    for (const guard of ['main_branch_history_guard', 'dev_version_bump_guard', 'release_guard', 'install_smoke', 'include_order_guard', 'dead_code_guard']) {
        assert.ok(output.includes(`guard:scripts/${guard}.sh`), guard);
    }
    assert.match(output, /evidence:scripts\/release_validation\.mjs verify/);
});

test('workspace performance opt-out cannot suppress hosted push checks', () => {
    assert.match(runHook({ FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1', GITHUB_ACTIONS: 'true' }), /guard:scripts\/perf_budget_guard\.sh/);
});

test('qualification tag push still leaves qualification to candidate CI', () => {
    const output = runHook({ FVPLUS_SKIP_WORKSPACE_PERFORMANCE: '1' }, `refs/tags/fvplus-release-candidate-${commit}`);
    assert.match(output, /candidate CI owns validation/);
    assert.doesNotMatch(output, /guard:|evidence:/);
});
