#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node
NODE_BIN="$(fvplus::resolve_platform_command node)"

"${NODE_BIN}" - "$(fvplus::path_for_command "${NODE_BIN}" "${ROOT_DIR}")" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const ensureFile = (relativePath) => {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`Expected file is missing: ${relativePath}`);
  }
};

for (const relativePath of [
  '.github/workflows/ci.yml',
  '.github/workflows/backmerge-main-to-dev.yml',
  '.github/workflows/release-main.yml',
  '.github/workflows/release-on-main.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/unraid-docker-upstream-monitor.yml',
  '.github/actions/setup-ci-env/action.yml',
  'scripts/run_ci_suite.sh',
  'scripts/fixture_browser_tests.sh',
  'scripts/fixture_browser_tests.mjs',
  'scripts/runtime_performance_benchmarks.sh',
  'scripts/runtime_performance_benchmarks.mjs',
  'scripts/runtime_perf_budgets.json',
  'scripts/runtime_perf_baseline.json',
  'scripts/build_release_notes.sh',
  'scripts/simulate_main_release.sh',
  'scripts/docs_metadata_guard.sh',
  'scripts/release_notes_consistency_guard.sh',
  'scripts/workflow_self_check.sh'
]) {
  ensureFile(relativePath);
}

const ciWorkflow = read('.github/workflows/ci.yml');
const releaseMainWorkflow = read('.github/workflows/release-main.yml');
const releaseOnMainWorkflow = read('.github/workflows/release-on-main.yml');
const backmergeWorkflow = read('.github/workflows/backmerge-main-to-dev.yml');
const upstreamMonitorWorkflow = read('.github/workflows/unraid-docker-upstream-monitor.yml');
const jobBlock = (workflow, jobName) => {
  const match = workflow.match(new RegExp(`^  ${jobName}:\\s*$([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:\\s*$|(?![\\s\\S]))`, 'm'));
  if (!match) {
    fail(`Workflow job is missing: ${jobName}`);
  }
  return match[1];
};

if (!/detect-changes:/.test(ciWorkflow)) {
  fail('CI workflow must define a detect-changes job.');
}
if (!/quality:/.test(ciWorkflow)) {
  fail('CI workflow must define a quality summary job.');
}
if (!/dorny\/paths-filter@v3/.test(ciWorkflow)) {
  fail('CI workflow must use dorny/paths-filter for change-aware fast lanes.');
}
if (!/\.\/\.github\/actions\/setup-ci-env/.test(ciWorkflow)) {
  fail('CI workflow must use the shared setup-ci-env action.');
}
if (!/dev-release-preview/.test(ciWorkflow)) {
  fail('CI workflow must upload a dev release preview artifact.');
}
if (!/ci-duration-report/.test(ciWorkflow)) {
  fail('CI workflow must publish a CI duration report artifact.');
}
if (!/fixture-browser:/.test(ciWorkflow) || !/--lane fixture-browser/.test(ciWorkflow)) {
  fail('CI workflow must run the required deterministic fixture browser lane.');
}
if (!/runtime_performance_benchmarks\.sh/.test(read('scripts/run_ci_suite.sh'))) {
  fail('The deterministic fixture browser lane must enforce runtime performance budgets.');
}
if (!/tmp\/fixture-browser-artifacts/.test(ciWorkflow)) {
  fail('CI workflow must retain deterministic fixture browser artifacts.');
}
for (const jobName of [
  'detect-changes',
  'lint-and-syntax',
  'node-tests',
  'browser-smoke',
  'fixture-browser',
  'theme-matrix'
]) {
  const job = jobBlock(ciWorkflow, jobName);
  if (!/fetch-depth:\s*1/.test(job) || /fetch-depth:\s*0/.test(job)) {
    fail(`CI job ${jobName} must use a shallow checkout.`);
  }
}
for (const jobName of ['guard-suite', 'release-preview']) {
  if (!/fetch-depth:\s*0/.test(jobBlock(ciWorkflow, jobName))) {
    fail(`CI job ${jobName} must retain full history for versioning or packaging.`);
  }
}
for (const [name, workflow] of [
  ['release-main', releaseMainWorkflow],
  ['release-on-main', releaseOnMainWorkflow],
  ['backmerge-main-to-dev', backmergeWorkflow]
]) {
  if (!/FVPLUS_FIXTURE_BROWSERS:\s*'?chromium,firefox,webkit'?/.test(workflow)) {
    fail(`${name} must run deterministic fixtures in Chromium, Firefox, and WebKit.`);
  }
  if (!/tmp\/fixture-browser-artifacts/.test(workflow)) {
    fail(`${name} must retain deterministic fixture artifacts on failure.`);
  }
}

if (!/bash scripts\/build_release_notes\.sh/.test(releaseOnMainWorkflow)) {
  fail('Release On Main workflow must build release notes via scripts/build_release_notes.sh.');
}
if (!/FVPLUS_BROWSER_SMOKE_REQUIRED:\s*\$\{\{\s*secrets\.FVPLUS_BROWSER_SMOKE_URL\s*!=\s*''\s*&&\s*'1'\s*\|\|\s*'0'\s*\}\}/.test(releaseMainWorkflow) ||
    !/FVPLUS_BROWSER_SMOKE_REQUIRED:\s*\$\{\{\s*secrets\.FVPLUS_BROWSER_SMOKE_URL\s*!=\s*''\s*&&\s*'1'\s*\|\|\s*'0'\s*\}\}/.test(releaseOnMainWorkflow)) {
  fail('Release workflows must gate browser smoke coverage on configured target URLs.');
}
if (!/FVPLUS_THEME_MATRIX_REQUIRED:\s*\$\{\{\s*secrets\.FVPLUS_THEME_MATRIX_URLS\s*!=\s*''\s*&&\s*'1'\s*\|\|\s*'0'\s*\}\}/.test(releaseMainWorkflow) ||
    !/FVPLUS_THEME_MATRIX_REQUIRED:\s*\$\{\{\s*secrets\.FVPLUS_THEME_MATRIX_URLS\s*!=\s*''\s*&&\s*'1'\s*\|\|\s*'0'\s*\}\}/.test(releaseOnMainWorkflow)) {
  fail('Release workflows must gate theme matrix smoke coverage on configured target URLs.');
}
if (!/Detect release artifact changes/.test(releaseOnMainWorkflow)) {
  fail('Release On Main workflow must detect whether a main push actually changed release artifacts.');
}
if (!/Skip release publish for non-release main pushes/.test(releaseOnMainWorkflow)) {
  fail('Release On Main workflow must explicitly skip publishing for workflow-only main pushes.');
}
if (!/gh release create/.test(releaseOnMainWorkflow) || !/gh release edit/.test(releaseOnMainWorkflow)) {
  fail('Release On Main workflow must own GitHub release publishing.');
}
if (/gh release create/.test(releaseMainWorkflow) || /gh release edit/.test(releaseMainWorkflow)) {
  fail('Release Main workflow must not publish GitHub releases directly.');
}
if (!/bash scripts\/release_prepare\.sh --push-main/.test(releaseMainWorkflow)) {
  fail('Release Main workflow must use scripts/release_prepare.sh --push-main as the shared release entrypoint.');
}
if (!/upload-artifact@v4/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must upload debug artifacts on failure.');
}
if (!/FVPLUS_EXPECT_PLUGIN_BRANCH:\s*'dev'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must validate merged dev state with FVPLUS_EXPECT_PLUGIN_BRANCH set to dev.');
}
if (!/FVPLUS_ALLOW_PACKAGED_SOURCE_DRIFT:\s*'1'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must allow expected packaged/source drift while validating non-release back-merge branches.');
}
if (!/pull-requests:\s*write/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must have pull-requests: write permission.');
}
if (!/Create or update back-merge PR/.test(backmergeWorkflow) ||
    !/gh api --method POST/.test(backmergeWorkflow) ||
    !/gh api --method PATCH/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must open or update a PR into dev instead of pushing directly.');
}
if (!/secrets\.FVPLUS_BACKMERGE_TOKEN\s*\|\|\s*github\.token/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must support a scoped token when the repository GITHUB_TOKEN cannot create pull requests.');
}
if (!/Back-merge follow-up required/.test(backmergeWorkflow) ||
    !/::error title=Back-merge PR was not created/.test(backmergeWorkflow) ||
    !/exit 1/.test(backmergeWorkflow) ||
    /::warning::Back-merge branch/.test(backmergeWorkflow)) {
  fail('Back-merge PR failures must fail visibly and provide a manual recovery path.');
}
if (/git push origin dev/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must not push directly to protected dev.');
}
if (!/schedule:/.test(upstreamMonitorWorkflow) || !/workflow_dispatch:/.test(upstreamMonitorWorkflow)) {
  fail('Unraid Docker upstream monitor must support scheduled and manual checks.');
}
if (!/scripts\/unraid_docker_upstream_monitor\.sh/.test(upstreamMonitorWorkflow)) {
  fail('Unraid Docker upstream monitor workflow must use the repository monitor script.');
}
if (!/permissions:\s*\n\s*contents:\s*read/.test(upstreamMonitorWorkflow)) {
  fail('Unraid Docker upstream monitor must remain read-only.');
}

for (const workflowPath of [
  '.github/workflows/ci.yml',
  '.github/workflows/release-main.yml',
  '.github/workflows/release-on-main.yml',
  '.github/workflows/backmerge-main-to-dev.yml',
  '.github/workflows/unraid-docker-upstream-monitor.yml'
]) {
  const content = read(workflowPath);
  const scriptRefs = [...content.matchAll(/bash (scripts\/[A-Za-z0-9._/-]+\.sh)/g)].map((match) => match[1]);
  for (const scriptRef of scriptRefs) {
    ensureFile(scriptRef);
  }
}

console.log('Workflow self-check passed.');
NODE
