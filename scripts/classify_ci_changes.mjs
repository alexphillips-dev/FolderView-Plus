#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_SHA = /^0+$/;

export const FILTERS = Object.freeze({
    docs: [
        'README.md',
        'docs/**',
        'LICENSE.md',
        '.github/CONTRIBUTING.md',
        '.github/SECURITY.md',
        '.github/SUPPORT*.md',
        'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/README.md'
    ],
    metadata: [
        'folderview.plus.plg',
        'folderview.plus.xml',
        'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/**'
    ],
    workflows: [
        '.github/workflows/**',
        '.github/actions/**',
        'scripts/classify_ci_changes.mjs',
        'scripts/actionlint_guard.sh',
        'scripts/run_ci_suite.sh',
        'scripts/test_runner_contract_guard.mjs',
        'scripts/build_release_notes.sh',
        'scripts/docs_metadata_guard.sh',
        'scripts/release_notes_consistency_guard.sh',
        'scripts/workflow_self_check.sh',
        'scripts/scheduled_workflow_health.mjs',
        'scripts/codeql_alert_guard.mjs',
        'scripts/unraid_docker_upstream_monitor.sh',
        'tests/ci-change-classifier.test.mjs',
        'tests/versioning-guard.test.mjs'
    ],
    runtime: [
        'src/**',
        'tests/**',
        'pkg_build.sh',
        'folderview.plus.plg',
        'folderview.plus.xml'
    ],
    browser: [
        'src/**',
        'tests/**',
        'package.json',
        'package-lock.json',
        'scripts/fixture_browser_tests.sh',
        'scripts/fixture_browser_tests.mjs',
        'scripts/lib/fixture-browser-*.mjs',
        'scripts/lib/browser-smoke-*.mjs',
        'scripts/test_runner_contracts.json',
        'scripts/runtime_performance_benchmarks.sh',
        'scripts/runtime_performance_benchmarks.mjs',
        'scripts/runtime_perf_budgets.json',
        'scripts/runtime_perf_baseline.json',
        'scripts/browser_smoke.sh',
        'scripts/browser_smoke.mjs',
        'scripts/run_ci_suite.sh'
    ],
    theme: [
        'src/**',
        'tests/**',
        'scripts/theme_matrix_smoke.sh',
        'scripts/theme_matrix_smoke.mjs',
        'scripts/lib/theme-matrix-*.mjs',
        'scripts/test_runner_contracts.json',
        'scripts/theme_runtime_guard.sh',
        'scripts/theme_scope_guard.sh',
        'scripts/run_ci_suite.sh'
    ],
    preview: [
        'src/**',
        'pkg_build.sh',
        'folderview.plus.plg',
        'folderview.plus.xml'
    ]
});

const normalizePath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\.\/+/, '');

export const matchesPattern = (filePath, pattern) => {
    const normalized = normalizePath(filePath);
    if (pattern.endsWith('/**')) {
        return normalized.startsWith(pattern.slice(0, -2));
    }
    if (pattern.includes('*')) {
        const escaped = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replaceAll('*', '.*');
        return new RegExp(`^${escaped}$`).test(normalized);
    }
    return normalized === pattern;
};

export const classifyPaths = (paths) => {
    const changedPaths = [...new Set(paths.map(normalizePath).filter(Boolean))].sort();
    const matched = {};
    for (const [group, patterns] of Object.entries(FILTERS)) {
        matched[group] = changedPaths.some((filePath) =>
            patterns.some((pattern) => matchesPattern(filePath, pattern))
        );
    }

    const docsOnly = matched.docs && !matched.metadata && !matched.workflows && !matched.runtime;
    const workflowOnly = matched.workflows && !matched.runtime && !matched.metadata && !matched.docs;
    return {
        changedPaths,
        matched,
        outputs: {
            docs_only: docsOnly,
            workflow_only: workflowOnly,
            needs_browser: matched.browser && !docsOnly && !workflowOnly,
            needs_theme: matched.theme && !docsOnly && !workflowOnly,
            preview_changed: matched.preview
        }
    };
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const ensureCommit = (sha) => {
    try {
        git('cat-file', '-e', `${sha}^{commit}`);
    } catch {
        execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], {
            encoding: 'utf8',
            stdio: ['ignore', 'inherit', 'inherit']
        });
    }
};

export const resolveChangedPaths = ({
    eventName = process.env.FVPLUS_CI_EVENT_NAME || '',
    beforeSha = process.env.FVPLUS_CI_BEFORE_SHA || '',
    headSha = process.env.FVPLUS_CI_HEAD_SHA || 'HEAD'
} = {}) => {
    if (eventName === 'pull_request') {
        const baseParent = git('rev-parse', `${headSha}^1`);
        return git('diff', '--name-only', baseParent, headSha).split(/\r?\n/).filter(Boolean);
    }
    if (eventName === 'push' && beforeSha && !ZERO_SHA.test(beforeSha)) {
        ensureCommit(beforeSha);
        return git('diff', '--name-only', beforeSha, headSha).split(/\r?\n/).filter(Boolean);
    }
    if (eventName === 'push') {
        return git('ls-tree', '-r', '--name-only', headSha).split(/\r?\n/).filter(Boolean);
    }

    try {
        return git('diff', '--name-only', `${headSha}^`, headSha).split(/\r?\n/).filter(Boolean);
    } catch {
        return git('ls-tree', '-r', '--name-only', headSha).split(/\r?\n/).filter(Boolean);
    }
};

export const writeGithubOutputs = (result, outputPath = process.env.GITHUB_OUTPUT) => {
    const lines = Object.entries(result.outputs).map(([key, value]) => `${key}=${value}`);
    if (outputPath) {
        fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
    } else {
        process.stdout.write(`${lines.join('\n')}\n`);
    }
};

const appendSummary = (result, summaryPath = process.env.GITHUB_STEP_SUMMARY) => {
    if (!summaryPath) return;
    const matchedGroups = Object.entries(result.matched)
        .filter(([, matched]) => matched)
        .map(([group]) => group)
        .join(', ') || 'none';
    fs.appendFileSync(summaryPath, [
        '## Native change classification',
        '',
        `- Changed paths: ${result.changedPaths.length}`,
        `- Matched groups: ${matchedGroups}`,
        `- Documentation only: \`${result.outputs.docs_only}\``,
        `- Workflow only: \`${result.outputs.workflow_only}\``,
        `- Browser validation required: \`${result.outputs.needs_browser}\``,
        `- Theme validation required: \`${result.outputs.needs_theme}\``,
        `- Release preview required: \`${result.outputs.preview_changed}\``,
        ''
    ].join('\n'));
};

const isDirectRun = process.argv[1] &&
    path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
    const result = classifyPaths(resolveChangedPaths());
    writeGithubOutputs(result);
    appendSummary(result);
    process.stdout.write(`Classified ${result.changedPaths.length} changed path(s).\n`);
}
