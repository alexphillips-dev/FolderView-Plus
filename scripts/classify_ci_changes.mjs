#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_SHA = /^0+$/;
const WORKFLOW_COMPANION_PATTERNS = Object.freeze([
    'docs/sbom.cdx.json'
]);

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
        '.github/ISSUE_TEMPLATE/**',
        'scripts/classify_ci_changes.mjs',
        'scripts/release_validation.mjs',
        'scripts/osv_scan_evidence.mjs',
        'scripts/lib/osv-evidence.mjs',
        'scripts/dev_release_preview.mjs',
        'scripts/ci_duration_report.mjs',
        'scripts/release_sync.sh',
        'scripts/sync_plan.mjs',
        'scripts/release_prepare.sh',
        'scripts/simulate_main_release.sh',
        'scripts/sync_main_to_dev.sh',
        'scripts/prepare_backmerge_dev_package.sh',
        'scripts/lib/release-evidence.mjs',
        'scripts/lib/github-release-validation.mjs',
        '.githooks/pre-push',
        'tests/release-validation.test.mjs',
        'tests/release-overhead.test.mjs',
        'tests/osv-evidence.test.mjs',
        'scripts/main_branch_history_guard.sh',
        'scripts/actionlint_guard.sh',
        'scripts/issue_form_guard.mjs',
        'scripts/run_ci_suite.sh',
        'scripts/test_runner_contract_guard.mjs',
        'scripts/build_release_notes.sh',
        'scripts/docs_metadata_guard.sh',
        'scripts/release_notes_consistency_guard.sh',
        'scripts/workflow_self_check.sh',
        'scripts/codeql_alert_guard.mjs',
        'scripts/unraid_docker_upstream_monitor.sh',
        'scripts/unraid_compatibility_monitor.mjs',
        'scripts/community_applications_guard.mjs',
        'scripts/php_runtime_compatibility.sh',
        'docs/unraid-compatibility-baseline.json',
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
        'scripts/fixture_browser_profiles.json',
        'scripts/test_runner_contracts.json',
        'scripts/runtime_performance_benchmarks.sh',
        'scripts/runtime_performance_benchmarks.mjs',
        'scripts/runtime_perf_budgets.json',
        'scripts/runtime_perf_baseline.json',
        'scripts/production_performance_benchmarks.mjs',
        'scripts/production_perf_*.json',
        'scripts/lib/production-perf-*.mjs',
        'scripts/browser_smoke.sh',
        'scripts/run_ci_suite.sh'
    ],
    theme: [
        'src/**',
        'tests/**',
        'scripts/theme_matrix_smoke.sh',
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
    ],
    performance: [
        'scripts/runtime_performance_benchmarks.*', 'scripts/runtime_perf_*.json',
        'scripts/production_performance_benchmarks.mjs', 'scripts/production_perf_*.json',
        'scripts/lib/production-perf-*.mjs',
        'src/**/scripts/docker*.js', 'src/**/scripts/vm*.js',
        'src/**/scripts/dashboard*.js', 'src/**/scripts/folderviewplus*.js',
        'src/**/scripts/runtime*.js', 'src/**/scripts/folder.*.js', 'src/**/scripts/folder.js'
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

    const docsOnly = matched.docs && !matched.metadata && !matched.workflows && !matched.runtime &&
        changedPaths.every((filePath) =>
            FILTERS.docs.some((pattern) => matchesPattern(filePath, pattern))
        );
    const workflowOnly = matched.workflows && changedPaths.every((filePath) =>
        FILTERS.workflows.some((pattern) => matchesPattern(filePath, pattern)) ||
        WORKFLOW_COMPANION_PATTERNS.some((pattern) => matchesPattern(filePath, pattern))
    );
    const unknown = changedPaths.some(filePath => !Object.values(FILTERS).some(patterns => patterns.some(pattern => matchesPattern(filePath, pattern)))
        && !/^archive\/folderview\.plus-[0-9.]+\.txz(?:\.sha256)?$/.test(filePath));
    return {
        changedPaths,
        matched,
        outputs: {
            no_changes: changedPaths.length === 0,
            docs_only: docsOnly,
            workflow_only: workflowOnly,
            needs_browser: (matched.browser || unknown) && !docsOnly && !workflowOnly,
            needs_theme: (matched.theme || unknown) && !docsOnly && !workflowOnly,
            needs_performance: matched.performance && !docsOnly && !workflowOnly,
            production_surfaces: matched.performance ? productionSurfacesForPaths(changedPaths).join(',') || 'none' : '',
            preview_changed: matched.preview
        }
    };
};

export function productionSurfacesForPaths(paths) {
    const surfaces = new Set();
    for (const file of paths) {
        if (!FILTERS.performance.some(pattern => matchesPattern(file, pattern))) continue;
        if (file.startsWith('scripts/') || /\/(runtime[^/]*|folder(?:\.[^/]*)?|folderviewplus|folderviewplus\.(?:utils|folder-groups-model|i18n|request|runtime-snapshot|prefs-store|theme-|ui|folder-contract|page-bootstrap|fatal-banner|csp-events|safe-dom)[^/]*)\.js$/.test(file)) {
            surfaces.add('settings'); surfaces.add('docker');
        } else if (/\/docker[^/]*\.js$/.test(file)) surfaces.add('docker');
        else if (/\/folderviewplus[^/]*\.js$/.test(file)) surfaces.add('settings');
    }
    return ['settings', 'docker'].filter(surface => surfaces.has(surface));
}

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
    headSha = process.env.FVPLUS_CI_HEAD_SHA || 'HEAD',
    baseSha = process.env.FVPLUS_CI_BASE_SHA || ''
} = {}) => {
    if (eventName === 'workflow_dispatch' && baseSha) {
        if (!/^[a-f0-9]{40}$/.test(baseSha)) throw new Error('Invalid comparison commit');
        ensureCommit(baseSha);
        return git('diff', '--name-only', baseSha, headSha).split(/\r?\n/).filter(Boolean);
    }
    // A manual validation request must cover the whole selected revision.
    if (eventName === 'workflow_dispatch') {
        return git('ls-tree', '-r', '--name-only', headSha).split(/\r?\n/).filter(Boolean);
    }
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
    // Manual full-revision functional checks do not implicitly request every
    // benchmark merely because performance files exist in the repository.
    if (process.env.FVPLUS_CI_EVENT_NAME === 'workflow_dispatch' && !process.env.FVPLUS_CI_BASE_SHA) result.outputs.needs_performance = false;
    writeGithubOutputs(result);
    appendSummary(result);
    process.stdout.write(`Classified ${result.changedPaths.length} changed path(s).\n`);
}
