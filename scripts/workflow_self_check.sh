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
  '.github/workflows/release-on-main.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/dependency-review.yml',
  '.github/workflows/scorecard.yml',
  '.github/workflows/scheduled-validation.yml',
  '.github/workflows/scheduled-workflow-health.yml',
  '.github/workflows/unraid-docker-upstream-monitor.yml',
  '.github/actions/setup-ci-env/action.yml',
  'scripts/run_ci_suite.sh',
  'scripts/actionlint_guard.sh',
  'scripts/classify_ci_changes.mjs',
  'scripts/csp_readiness_guard.mjs',
  'scripts/fixture_browser_tests.sh',
  'scripts/fixture_browser_tests.mjs',
  'scripts/runtime_performance_benchmarks.sh',
  'scripts/runtime_performance_benchmarks.mjs',
  'scripts/runtime_perf_budgets.json',
  'scripts/runtime_perf_baseline.json',
  'scripts/scheduled_workflow_health.mjs',
  'scripts/codeql_alert_guard.mjs',
  'scripts/build_release_notes.sh',
  'scripts/simulate_main_release.sh',
  'scripts/docs_metadata_guard.sh',
  'scripts/release_notes_consistency_guard.sh',
  'scripts/workflow_self_check.sh'
]) {
  ensureFile(relativePath);
}

const ciWorkflow = read('.github/workflows/ci.yml');
const releaseOnMainWorkflow = read('.github/workflows/release-on-main.yml');
const backmergeWorkflow = read('.github/workflows/backmerge-main-to-dev.yml');
const codeqlWorkflow = read('.github/workflows/codeql.yml');
const dependencyReviewWorkflow = read('.github/workflows/dependency-review.yml');
const scorecardWorkflow = read('.github/workflows/scorecard.yml');
const scheduledValidationWorkflow = read('.github/workflows/scheduled-validation.yml');
const scheduledWorkflowHealthWorkflow = read('.github/workflows/scheduled-workflow-health.yml');
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
if (/dorny\/paths-filter@/.test(ciWorkflow)) {
  fail('CI workflow must use the repository-owned change classifier instead of dorny/paths-filter.');
}
if (!/node scripts\/classify_ci_changes\.mjs/.test(ciWorkflow)) {
  fail('CI workflow must use scripts/classify_ci_changes.mjs.');
}
if (!/group:\s*folderview-plus-ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/.test(ciWorkflow) ||
    !/cancel-in-progress:\s*true/.test(ciWorkflow)) {
  fail('CI workflow must cancel superseded runs for the same pull request or ref.');
}
if (!/permissions:\s*\n\s*contents:\s*read/.test(ciWorkflow)) {
  fail('CI workflow must explicitly keep repository contents read-only.');
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
if (!/test_runner_contract_guard\.mjs/.test(read('scripts/run_ci_suite.sh'))) {
  fail('The shared lint lane must enforce split test-runner contracts.');
}
if (!/tmp\/fixture-browser-artifacts/.test(ciWorkflow)) {
  fail('CI workflow must retain deterministic fixture browser artifacts.');
}
for (const jobName of [
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
const detectChangesJob = jobBlock(ciWorkflow, 'detect-changes');
if (!/fetch-depth:\s*2/.test(detectChangesJob) || /fetch-depth:\s*0/.test(detectChangesJob)) {
  fail('CI detect-changes job must fetch the merge parents needed for native path classification.');
}
for (const jobName of ['guard-suite', 'release-preview']) {
  if (!/fetch-depth:\s*0/.test(jobBlock(ciWorkflow, jobName))) {
    fail(`CI job ${jobName} must retain full history for versioning or packaging.`);
  }
}
for (const jobName of [
  'detect-changes',
  'lint-and-syntax',
  'node-tests',
  'guard-suite',
  'browser-smoke',
  'fixture-browser',
  'theme-matrix',
  'release-preview',
  'quality'
]) {
  if (!/timeout-minutes:\s*[1-9][0-9]*/.test(jobBlock(ciWorkflow, jobName))) {
    fail(`CI job ${jobName} must define a bounded timeout.`);
  }
}
for (const [name, workflow] of [
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
if (!/permissions:\s*\n\s*contents:\s*write\s*\n\s*id-token:\s*write\s*\n\s*attestations:\s*write/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must grant only the release, OIDC, and attestation permissions required for signed provenance.');
}
if ((codeqlWorkflow.match(/github\/codeql-action\/(?:init|autobuild|analyze)@[0-9a-f]{40}\s+# v4/g) || []).length !== 3) {
  fail('CodeQL must use commit-pinned v4 init, autobuild, and analyze actions.');
}
if (!/node scripts\/codeql_alert_guard\.mjs --commit-sha/.test(codeqlWorkflow)) {
  fail('CodeQL must enforce zero open alerts for the analyzed commit.');
}
if (!/actions\/dependency-review-action@[0-9a-f]{40}\s+# v5/.test(dependencyReviewWorkflow)
    || !/fail-on-severity:\s*high/.test(dependencyReviewWorkflow)
    || !/license-check:\s*true/.test(dependencyReviewWorkflow)
    || !/warn-only:\s*false/.test(dependencyReviewWorkflow)) {
  fail('Dependency Review must fail pull requests on high-severity vulnerabilities and enforce the approved license policy.');
}
if (!/ossf\/scorecard-action@[0-9a-f]{40}\s+# v2\.4\.4/.test(scorecardWorkflow)
    || !/github\/codeql-action\/upload-sarif@[0-9a-f]{40}\s+# v4/.test(scorecardWorkflow)
    || !/publish_results:\s*true/.test(scorecardWorkflow)
    || !/security-events:\s*write/.test(scorecardWorkflow)
    || !/id-token:\s*write/.test(scorecardWorkflow)) {
  fail('OpenSSF Scorecard must publish signed results to GitHub code scanning with pinned actions.');
}
if ((releaseOnMainWorkflow.match(/uses:\s*actions\/attest@[0-9a-f]{40}\s+# v4/g) || []).length !== 2 ||
    !/Attest release archive provenance/.test(releaseOnMainWorkflow) ||
    !/Attest release archive SBOM/.test(releaseOnMainWorkflow) ||
    !/sbom-path:\s*docs\/sbom\.cdx\.json/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must publish commit-pinned provenance and SBOM attestations for the release archive.');
}
if (!/FVPLUS_BROWSER_SMOKE_REQUIRED:\s*\$\{\{\s*secrets\.FVPLUS_BROWSER_SMOKE_URL != '' && '1' \|\| '0'\s*\}\}/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must require live browser smoke coverage whenever its target secret is configured.');
}
if (!/FVPLUS_THEME_MATRIX_REQUIRED:\s*\$\{\{\s*secrets\.FVPLUS_THEME_MATRIX_URLS != '' && '1' \|\| '0'\s*\}\}/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must require the live theme matrix whenever its target secrets are configured.');
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
if (!/push:\s*\n\s*branches:\s*\n\s*-\s*main/.test(releaseOnMainWorkflow) ||
    !/workflow_dispatch:/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must remain the single push and manual release publisher.');
}
if (fs.existsSync(path.join(root, '.github/workflows/release-main.yml'))) {
  fail('The obsolete direct-push Release Main workflow must remain retired.');
}
if (!/upload-artifact@[0-9a-f]{40}\s+# v7/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must upload debug artifacts on failure.');
}
if (!/FVPLUS_EXPECT_PLUGIN_BRANCH:\s*'dev'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must validate merged dev state with FVPLUS_EXPECT_PLUGIN_BRANCH set to dev.');
}
if (!/Install Node validation dependencies[\s\S]*npm ci --ignore-scripts/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must install locked Node validation dependencies before running the full suite.');
}
if (!/bash scripts\/prepare_backmerge_dev_package\.sh/.test(backmergeWorkflow) ||
    /FVPLUS_ALLOW_PACKAGED_SOURCE_DRIFT:\s*'1'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must package merged source instead of bypassing packaged/source drift validation.');
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
  fail('Unraid Docker upstream monitor must keep repository contents read-only.');
}
if (!/issues:\s*write/.test(upstreamMonitorWorkflow)) {
  fail('Unraid Docker upstream monitor must be able to open a deduplicated compatibility alert.');
}
if (!/Close resolved compatibility alert/.test(upstreamMonitorWorkflow) || !/gh issue close/.test(upstreamMonitorWorkflow)) {
  fail('Unraid Docker upstream monitor must close its compatibility alert after a reviewed recovery.');
}
if (!/issues:\s*write/.test(scheduledValidationWorkflow)
    || !/Live Unraid validation configuration required/.test(scheduledValidationWorkflow)) {
  fail('Scheduled validation must report missing live-Unraid secret configuration without exposing secret values.');
}
if (!/gh issue list[\s\S]*--repo "\$\{GITHUB_REPOSITORY\}"/.test(scheduledValidationWorkflow)
    || !/gh issue create --repo "\$\{GITHUB_REPOSITORY\}"/.test(scheduledValidationWorkflow)
    || !/gh issue close "\$\{issue_number\}" --repo "\$\{GITHUB_REPOSITORY\}"/.test(scheduledValidationWorkflow)) {
  fail('Scheduled validation issue operations must target GITHUB_REPOSITORY without relying on a checkout.');
}
if (!/schedule:/.test(scheduledWorkflowHealthWorkflow)
    || !/workflow_dispatch:/.test(scheduledWorkflowHealthWorkflow)
    || !/actions:\s*read/.test(scheduledWorkflowHealthWorkflow)
    || !/issues:\s*write/.test(scheduledWorkflowHealthWorkflow)
    || !/scripts\/scheduled_workflow_health\.mjs/.test(scheduledWorkflowHealthWorkflow)
    || !/Scheduled workflow health requires attention/.test(scheduledWorkflowHealthWorkflow)) {
  fail('Scheduled workflow health must check run freshness and maintain a deduplicated recovery alert.');
}
for (const [workflowName, workflow, jobNames] of [
  ['release-on-main', releaseOnMainWorkflow, ['release']],
  ['backmerge-main-to-dev', backmergeWorkflow, ['backmerge']],
  ['codeql', codeqlWorkflow, ['analyze']],
  ['dependency-review', dependencyReviewWorkflow, ['dependency-review']],
  ['scorecard', scorecardWorkflow, ['analysis']],
  ['scheduled-validation', scheduledValidationWorkflow, ['configuration', 'cross-browser-fixtures', 'live-unraid']],
  ['scheduled-workflow-health', scheduledWorkflowHealthWorkflow, ['watchdog']],
  ['unraid-docker-upstream-monitor', upstreamMonitorWorkflow, ['monitor']]
]) {
  for (const jobName of jobNames) {
    if (!/timeout-minutes:\s*[1-9][0-9]*/.test(jobBlock(workflow, jobName))) {
      fail(`${workflowName} job ${jobName} must define a bounded timeout.`);
    }
  }
}

const runCiSuite = read('scripts/run_ci_suite.sh');
const actionlintGuard = read('scripts/actionlint_guard.sh');
if (!/run_timed_step csp-readiness/.test(runCiSuite)) {
  fail('The lint lane must enforce the deterministic CSP readiness report.');
}
if (!/run_timed_step actionlint bash scripts\/actionlint_guard\.sh/.test(runCiSuite)) {
  fail('Workflow and full guard lanes must run the pinned actionlint guard.');
}
if (!/ACTIONLINT_VERSION="1\.7\.12"/.test(actionlintGuard) ||
    !/archive_sha256=/.test(actionlintGuard) ||
    !/sha256sum --check/.test(actionlintGuard)) {
  fail('actionlint guard must pin and checksum-verify the downloaded release.');
}

for (const workflowPath of [
  '.github/workflows/ci.yml',
  '.github/workflows/release-on-main.yml',
  '.github/workflows/backmerge-main-to-dev.yml',
  '.github/workflows/scheduled-workflow-health.yml',
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
