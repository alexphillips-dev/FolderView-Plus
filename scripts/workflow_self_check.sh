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
  '.github/workflows/dependency-vulnerability-scan.yml',
  '.github/workflows/scorecard.yml',
  '.github/workflows/clone-traffic-badge.yml',
  '.github/workflows/scheduled-validation.yml',
  '.github/actions/setup-ci-env/action.yml',
  'scripts/run_ci_suite.sh',
  'scripts/actionlint_guard.sh',
  'scripts/classify_ci_changes.mjs',
  'scripts/issue_form_guard.mjs',
  'scripts/csp_readiness_guard.mjs',
  'scripts/fixture_browser_tests.sh',
  'scripts/fixture_browser_tests.mjs',
  'scripts/runtime_performance_benchmarks.sh',
  'scripts/runtime_performance_benchmarks.mjs',
  'scripts/runtime_perf_budgets.json',
  'scripts/runtime_perf_baseline.json',
  'scripts/codeql_alert_guard.mjs',
  'scripts/community_applications_guard.mjs',
  'scripts/php_runtime_compatibility.sh',
  'scripts/unraid_compatibility_monitor.mjs',
  'docs/unraid-compatibility-baseline.json',
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
const dependencyVulnerabilityScanWorkflow = read('.github/workflows/dependency-vulnerability-scan.yml');
const scorecardWorkflow = read('.github/workflows/scorecard.yml');
const cloneTrafficBadgeWorkflow = read('.github/workflows/clone-traffic-badge.yml');
const scheduledValidationWorkflow = read('.github/workflows/scheduled-validation.yml');
for (const retiredWorkflow of [
  '.github/workflows/scheduled-workflow-health.yml',
  '.github/workflows/unraid-docker-upstream-monitor.yml'
]) {
  if (fs.existsSync(path.join(root, retiredWorkflow))) {
    fail(`Retired issue monitor must not be restored: ${retiredWorkflow}`);
  }
}
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
if (!/^  guard-suite:\s*$[\s\S]*?^    name:\s*CI tests and guards\s*$/m.test(ciWorkflow)) {
  fail('CI guard-suite must expose an always-present test signal recognized by repository quality scanners.');
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
  fail('The separate performance lane must enforce runtime performance budgets.');
}
if (!/test_runner_contract_guard\.mjs/.test(read('scripts/run_ci_suite.sh'))) {
  fail('The shared lint lane must enforce split test-runner contracts.');
}
if (!/run_timed_step issue-form-contract/.test(read('scripts/run_ci_suite.sh'))) {
  fail('Workflow and full guard lanes must enforce issue-form contracts.');
}
if (!/'\.github\/ISSUE_TEMPLATE\/\*\*'/.test(read('scripts/classify_ci_changes.mjs'))
    || !/'scripts\/issue_form_guard\.mjs'/.test(read('scripts/classify_ci_changes.mjs'))) {
  fail('Issue forms and their guard must be classified as workflow changes.');
}
if (!/tmp\/fixture-browser-artifacts/.test(ciWorkflow)) {
  fail('CI workflow must retain deterministic fixture browser artifacts.');
}
for (const jobName of [
  'lint-and-syntax',
  'node-tests',
  'layout-checks',
  'performance',
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
  'layout-checks',
  'performance',
  'fixture-browser',
  'theme-matrix',
  'release-preview',
  'quality'
]) {
  if (!/timeout-minutes:\s*[1-9][0-9]*/.test(jobBlock(ciWorkflow, jobName))) {
    fail(`CI job ${jobName} must define a bounded timeout.`);
  }
}
if (!/bash scripts\/build_release_notes\.sh/.test(releaseOnMainWorkflow)) {
  fail('Release On Main workflow must build release notes via scripts/build_release_notes.sh.');
}
if (!/^permissions:\s*\n  contents:\s*read\s*$/m.test(releaseOnMainWorkflow)
    || !/permissions:\s*\n\s*contents:\s*write\s*\n\s*id-token:\s*write\s*\n\s*attestations:\s*write/.test(jobBlock(releaseOnMainWorkflow, 'release'))) {
  fail('Release On Main must keep top-level access read-only and scope release, OIDC, and attestation writes to its release job.');
}
if ((codeqlWorkflow.match(/github\/codeql-action\/(?:init|autobuild|analyze)@[0-9a-f]{40}\s+# v4/g) || []).length !== 3) {
  fail('CodeQL must use commit-pinned v4 init, autobuild, and analyze actions.');
}
if (!/node scripts\/codeql_alert_guard\.mjs --commit-sha/.test(codeqlWorkflow)) {
  fail('CodeQL must enforce zero open alerts for the analyzed commit.');
}
if (!/schedule:/.test(codeqlWorkflow) || !/workflow_dispatch:/.test(codeqlWorkflow)) {
  fail('CodeQL must run on schedule and support manual recovery checks.');
}
if (!/^permissions:\s*\n  actions:\s*read\s*\n  contents:\s*read\s*$/m.test(codeqlWorkflow)
    || !/permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*security-events:\s*write/.test(jobBlock(codeqlWorkflow, 'analyze'))) {
  fail('CodeQL must keep top-level access read-only and scope security-events write to the analyze job.');
}
if (!/actions\/dependency-review-action@[0-9a-f]{40}\s+# v5/.test(dependencyReviewWorkflow)
    || !/fail-on-severity:\s*high/.test(dependencyReviewWorkflow)
    || !/license-check:\s*true/.test(dependencyReviewWorkflow)
    || !/warn-only:\s*false/.test(dependencyReviewWorkflow)) {
  fail('Dependency Review must fail pull requests on high-severity vulnerabilities and enforce the approved license policy.');
}
if (!/ossf\/scorecard-action@[0-9a-f]{40}\s+# v2\.4\.4/.test(scorecardWorkflow)
    || !/github\/codeql-action\/upload-sarif@[0-9a-f]{40}\s+# v4/.test(scorecardWorkflow)
    || !/push:\s*\n\s*branches:\s*\n\s*- main/.test(scorecardWorkflow)
    || !/publish_results:\s*true/.test(scorecardWorkflow)
    || !/security-events:\s*write/.test(scorecardWorkflow)
    || !/id-token:\s*write/.test(scorecardWorkflow)) {
  fail('OpenSSF Scorecard must publish signed results to GitHub code scanning with pinned actions.');
}
if (!/push:\s*\n\s*branches:\s*\n\s*- main/.test(dependencyVulnerabilityScanWorkflow)
    || !/paths:[\s\S]*docs\/sbom\.cdx\.json/.test(dependencyVulnerabilityScanWorkflow)
    || !/schedule:/.test(dependencyVulnerabilityScanWorkflow)
    || !/workflow_dispatch:/.test(dependencyVulnerabilityScanWorkflow)
    || !/google\/osv-scanner-action\/osv-scanner-action@[0-9a-f]{40}\s+# v2\.\d+\.\d+/.test(dependencyVulnerabilityScanWorkflow)
    || !/google\/osv-scanner-action\/osv-reporter-action@[0-9a-f]{40}\s+# v2\.\d+\.\d+/.test(dependencyVulnerabilityScanWorkflow)
    || !/--sbom=docs\/sbom\.cdx\.json/.test(dependencyVulnerabilityScanWorkflow)
    || !/--fail-on-vuln=true/.test(dependencyVulnerabilityScanWorkflow)
    || !/github\/codeql-action\/upload-sarif@[0-9a-f]{40}\s+# v4/.test(dependencyVulnerabilityScanWorkflow)) {
  fail('Dependency vulnerability scanning must refresh on main inventory updates, use pinned OSV actions, scan the generated SBOM, fail on vulnerabilities, and publish SARIF.');
}
if ((releaseOnMainWorkflow.match(/uses:\s*actions\/attest@[0-9a-f]{40}\s+# v4/g) || []).length !== 2 ||
    !/Attest release archive provenance/.test(releaseOnMainWorkflow) ||
    !/Attest release archive SBOM/.test(releaseOnMainWorkflow) ||
    !/sbom-path:\s*docs\/sbom\.cdx\.json/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must publish commit-pinned provenance and SBOM attestations for the release archive.');
}
const validationWorkflows = [
  ciWorkflow,
  backmergeWorkflow,
  releaseOnMainWorkflow,
  scheduledValidationWorkflow,
  dependencyVulnerabilityScanWorkflow
].join('\n');
if (/FVPLUS_UNRAID_MATRIX|FVPLUS_BROWSER_SMOKE_URL|FVPLUS_THEME_MATRIX_URLS/.test(validationWorkflows)) {
  fail('Tracked validation workflows must not accept live-Unraid targets or secrets.');
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

if (!/workflow_run:/.test(backmergeWorkflow) || !/workflows: \[Release On Main\]/.test(backmergeWorkflow)
    || !/node scripts\/sync_plan\.mjs/.test(backmergeWorkflow)
    || !/release_sync\.sh --push-dev/.test(backmergeWorkflow)
    || /contents:\s*write|pull-requests:\s*write|actions:\s*write|git push|gh api --method|run_ci_suite/.test(backmergeWorkflow)) {
  fail('Main-to-dev workflow must produce a read-only plan after publication, without remote branches, PRs or duplicate validation.');
}
if (!/permissions:\s*\n\s*contents:\s*read/.test(scheduledValidationWorkflow)
    || /issues:\s*write/.test(scheduledValidationWorkflow)) {
  fail('Scheduled cross-browser validation must keep repository contents read-only.');
}

if (!/browser: \[chromium, firefox, webkit\]/.test(scheduledValidationWorkflow)
    || !/--lane theme-matrix/.test(scheduledValidationWorkflow) || !/--lane performance/.test(scheduledValidationWorkflow)) {
  fail('Scheduled validation must run the exhaustive parallel browser matrix and separate performance suite.');
}
if (/FVPLUS_UNRAID_MATRIX|FVPLUS_BROWSER_SMOKE_URL|FVPLUS_THEME_MATRIX_URLS|live-unraid:|gh issue/.test(scheduledValidationWorkflow)) {
  fail('Scheduled validation must not depend on live-Unraid targets, secrets, or issue automation.');
}
const cloneTrafficCollectJob = jobBlock(cloneTrafficBadgeWorkflow, 'collect');
const cloneTrafficPublishJob = jobBlock(cloneTrafficBadgeWorkflow, 'publish');
if (!/schedule:/.test(cloneTrafficBadgeWorkflow)
    || !/workflow_dispatch:/.test(cloneTrafficBadgeWorkflow)
    || !/^permissions:\s*\n  contents:\s*read\s*$/m.test(cloneTrafficBadgeWorkflow)
    || !/secrets\.FVPLUS_TRAFFIC_TOKEN/.test(cloneTrafficCollectJob)
    || /github\.token/.test(cloneTrafficCollectJob)
    || !/repos\/\$\{GITHUB_REPOSITORY\}\/traffic\/clones/.test(cloneTrafficCollectJob)
    || !/permissions:\s*\n\s*contents:\s*write/.test(cloneTrafficPublishJob)
    || !/github\.token/.test(cloneTrafficPublishJob)
    || /secrets\.FVPLUS_TRAFFIC_TOKEN/.test(cloneTrafficPublishJob)
    || !/--branch metrics/.test(cloneTrafficBadgeWorkflow)
    || !/Total clones \\u00b7 14d/.test(cloneTrafficBadgeWorkflow)) {
  fail('Clone traffic badge workflow must isolate authenticated collection from the write-scoped metrics publisher.');
}
for (const [workflowName, workflow, jobNames] of [
  ['release-on-main', releaseOnMainWorkflow, ['release']],
  ['backmerge-main-to-dev', backmergeWorkflow, ['backmerge']],
  ['codeql', codeqlWorkflow, ['analyze']],
  ['dependency-review', dependencyReviewWorkflow, ['dependency-review']],
  ['dependency-vulnerability-scan', dependencyVulnerabilityScanWorkflow, ['scan']],
  ['scorecard', scorecardWorkflow, ['analysis']],
  ['clone-traffic-badge', cloneTrafficBadgeWorkflow, ['collect', 'publish']],
  ['scheduled-validation', scheduledValidationWorkflow, ['cross-browser-fixtures', 'performance']]
]) {
  for (const jobName of jobNames) {
    if (!/timeout-minutes:\s*[1-9][0-9]*/.test(jobBlock(workflow, jobName))) {
      fail(`${workflowName} job ${jobName} must define a bounded timeout.`);
    }
  }
}


const fixtureJob = jobBlock(ciWorkflow, 'fixture-browser');
const layoutJob = jobBlock(ciWorkflow, 'layout-checks');
const performanceJob = jobBlock(ciWorkflow, 'performance');
const candidateDependencyJob = jobBlock(ciWorkflow, 'dependency-review');
const themeJob = jobBlock(ciWorkflow, 'theme-matrix');
if (!/browser: \[chromium, firefox, webkit\]/.test(fixtureJob) || !/matrix\.browser/.test(fixtureJob)
    || !/--lane layout-checks/.test(layoutJob) || !/needs_performance/.test(performanceJob)
    || !/inputs\.profile == 'exhaustive'/.test(themeJob) || /^  browser-smoke:/m.test(ciWorkflow)) {
  fail('CI must parallelize full browser coverage, use focused layout checks and run exhaustive themes and benchmarks selectively.');
}
if (!/dependency-review-action@[0-9a-f]{40}/.test(candidateDependencyJob)
    || !/base-ref:/.test(candidateDependencyJob) || !/head-ref:/.test(candidateDependencyJob)
    || !/fail-on-severity: high/.test(candidateDependencyJob) || !/license-check: true/.test(candidateDependencyJob)
    || !/'Dependency Review' \|\| 'Release dependency policy'/.test(candidateDependencyJob)) {
  fail('Candidate CI must retain the protected dependency vulnerability and license review without overriding ordinary PR checks.');
}
if (!/release_validation\.mjs wait/.test(releaseOnMainWorkflow) || /run_ci_suite|npm ci/.test(releaseOnMainWorkflow)
    || !/release_validation\.mjs qualify/.test(read('scripts/release_prepare.sh'))
    || !/release_validation\.mjs verify/.test(read('.githooks/pre-push'))
    || !/release_validation\.mjs reissue/.test(jobBlock(ciWorkflow, 'quality'))) {
  fail('Release preparation, protected push and publication must consume exact candidate evidence without repeating CI.');
}

const runCiSuite = read('scripts/run_ci_suite.sh');
if (!/nonzero base_sha before qualification starts/.test(ciWorkflow)
    || !/FVPLUS_MAIN_HISTORY_BASE_REF: \$\{\{ inputs.base_sha \|\| github.event.before \}\}/.test(ciWorkflow)
    || !/COMPARISON_BASE: \$\{\{ needs.detect-changes.outputs.comparison_base \}\}/.test(ciWorkflow)
    || !/node scripts\/dev_release_preview.mjs/.test(ciWorkflow)
    || !/FVPLUS_PRODUCTION_PERF_SURFACES:/.test(performanceJob)) {
  fail('CI must use one explicit release baseline, current-package previews and selected production benchmark surfaces.');
}
if (!/osv_scan_evidence.mjs find/.test(dependencyVulnerabilityScanWorkflow)
    || !/osv_scan_evidence.mjs verify/.test(dependencyVulnerabilityScanWorkflow)
    || !/if: github.event_name == 'push' && github.ref_name == 'main'/.test(dependencyVulnerabilityScanWorkflow)
    || !/sha: \$\{\{ github.sha \}\}/.test(dependencyVulnerabilityScanWorkflow)) {
  fail('Main OSV reuse must verify exact candidate evidence and retain main code-scanning publication.');
}
for (const file of ['.github/actions/setup-ci-env/action.yml', '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml', '.github/workflows/backmerge-main-to-dev.yml', '.github/workflows/dependency-vulnerability-scan.yml']) {
  if (/(?:node-version:|default:) ['"]?20['"]?/.test(read(file))
      || !/(?:node-version:|default:) ['"]24['"]/.test(read(file))) fail(`${file} must use the supported Node 24 toolchain.`);
}
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
  '.github/workflows/clone-traffic-badge.yml',
  '.github/workflows/dependency-vulnerability-scan.yml'
]) {
  const content = read(workflowPath);
  const scriptRefs = [...content.matchAll(/bash (scripts\/[A-Za-z0-9._/-]+\.sh)/g)].map((match) => match[1]);
  for (const scriptRef of scriptRefs) {
    ensureFile(scriptRef);
  }
}

console.log('Workflow self-check passed.');
NODE
