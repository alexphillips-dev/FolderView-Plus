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
  '.github/workflows/scheduled-workflow-health.yml',
  '.github/workflows/unraid-docker-upstream-monitor.yml',
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
  'scripts/scheduled_workflow_health.mjs',
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
  fail('The deterministic fixture browser lane must enforce runtime performance budgets.');
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
    || !/publish_results:\s*true/.test(scorecardWorkflow)
    || !/security-events:\s*write/.test(scorecardWorkflow)
    || !/id-token:\s*write/.test(scorecardWorkflow)) {
  fail('OpenSSF Scorecard must publish signed results to GitHub code scanning with pinned actions.');
}
if (!/schedule:/.test(dependencyVulnerabilityScanWorkflow)
    || !/workflow_dispatch:/.test(dependencyVulnerabilityScanWorkflow)
    || !/google\/osv-scanner-action\/osv-scanner-action@[0-9a-f]{40}\s+# v2\.5\.0/.test(dependencyVulnerabilityScanWorkflow)
    || !/google\/osv-scanner-action\/osv-reporter-action@[0-9a-f]{40}\s+# v2\.5\.0/.test(dependencyVulnerabilityScanWorkflow)
    || !/--sbom=docs\/sbom\.cdx\.json/.test(dependencyVulnerabilityScanWorkflow)
    || !/--fail-on-vuln=true/.test(dependencyVulnerabilityScanWorkflow)
    || !/github\/codeql-action\/upload-sarif@[0-9a-f]{40}\s+# v4/.test(dependencyVulnerabilityScanWorkflow)) {
  fail('Dependency vulnerability scanning must use pinned OSV actions, scan the generated SBOM, fail on vulnerabilities, and publish SARIF.');
}
if ((releaseOnMainWorkflow.match(/uses:\s*actions\/attest@[0-9a-f]{40}\s+# v4/g) || []).length !== 2 ||
    !/Attest release archive provenance/.test(releaseOnMainWorkflow) ||
    !/Attest release archive SBOM/.test(releaseOnMainWorkflow) ||
    !/sbom-path:\s*docs\/sbom\.cdx\.json/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must publish commit-pinned provenance and SBOM attestations for the release archive.');
}
if (!/FVPLUS_BROWSER_SMOKE_BROWSERS:\s*chromium/.test(releaseOnMainWorkflow)
    || !/FVPLUS_THEME_COLOR_SCHEMES:\s*'light,dark'/.test(releaseOnMainWorkflow)
    || !/FVPLUS_THEME_VIEWPORTS:\s*'1180x720,390x844'/.test(releaseOnMainWorkflow)) {
  fail('Release On Main must run deterministic browser, theme, and responsive fixture coverage.');
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
if (!/upload-artifact@[0-9a-f]{40}\s+# v7/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must upload debug artifacts on failure.');
}
if (!/FVPLUS_EXPECT_PLUGIN_BRANCH:\s*'dev'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must validate merged dev state with FVPLUS_EXPECT_PLUGIN_BRANCH set to dev.');
}
if (!/Sync main into dev[\s\S]*Install merged dev validation dependencies[\s\S]*npm ci --ignore-scripts/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must install locked Node validation dependencies from the merged dev tree before packaging and validation.');
}
if (!/Commit synchronized dev package[\s\S]*git add --all[\s\S]*git commit --no-verify -m "Rebuild dev package after main sync"/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must commit the rebuilt dev package before validation and push.');
}
if (!/bash scripts\/prepare_backmerge_dev_package\.sh/.test(backmergeWorkflow) ||
    /FVPLUS_ALLOW_PACKAGED_SOURCE_DRIFT:\s*'1'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must package merged source instead of bypassing packaged/source drift validation.');
}
if (!/^permissions:\s*\n  contents:\s*read\s*$/m.test(backmergeWorkflow)
    || !/permissions:\s*\n\s*contents:\s*write\s*\n\s*pull-requests:\s*write/.test(jobBlock(backmergeWorkflow, 'backmerge'))) {
  fail('Back-merge workflow must keep top-level access read-only and scope contents and pull-request writes to the backmerge job.');
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
if (!/name:\s*Unraid Compatibility Monitor/.test(upstreamMonitorWorkflow)
    || !/cron:\s*'43 9 \* \* \*'/.test(upstreamMonitorWorkflow)
    || !/workflow_dispatch:/.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitor must run daily and support manual checks.');
}
if (!/scripts\/unraid_docker_upstream_monitor\.sh/.test(upstreamMonitorWorkflow)
    || !/scripts\/unraid_compatibility_monitor\.mjs/.test(upstreamMonitorWorkflow)
    || !/scripts\/community_applications_guard\.mjs/.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitor must evaluate Docker/API, OS/webGUI, and Community Applications contracts.');
}
if (!/permissions:\s*\n\s*contents:\s*read/.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitor must keep repository contents read-only.');
}
if (!/issues:\s*write/.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitor must be able to open a deduplicated compatibility alert.');
}
if (!/Close resolved compatibility review issues/.test(upstreamMonitorWorkflow) || !/gh issue close/.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitor must close its compatibility alert after a reviewed recovery.');
}
if (!/Run isolated compatibility fixtures on upstream drift/.test(upstreamMonitorWorkflow)
    || !/--lane tests --lane fixture-browser/.test(upstreamMonitorWorkflow)
    || !/npx playwright install --with-deps chromium/.test(upstreamMonitorWorkflow)) {
  fail('Upstream drift must run isolated contract and browser fixtures before review.');
}
if (!/php-runtime-compatibility:/.test(upstreamMonitorWorkflow)
    || !/php:8\.3\.8-cli-alpine/.test(upstreamMonitorWorkflow)
    || !/php:8\.4\.23-cli-alpine/.test(upstreamMonitorWorkflow)
    || !/php:8\.4\.24-cli-alpine/.test(upstreamMonitorWorkflow)
    || !/scripts\/php_runtime_compatibility\.sh/.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitor must test the oldest, stable, and prerelease PHP runtime profiles in isolation.');
}
if (/FVPLUS_UNRAID_MATRIX|FVPLUS_BROWSER_SMOKE_URL|FVPLUS_THEME_MATRIX_URLS|live-unraid:|secrets\.[A-Za-z0-9_]*UNRAID/i.test(upstreamMonitorWorkflow)) {
  fail('Unraid compatibility monitoring must not accept live-Unraid targets or secrets.');
}
if (!/ca\.unraid\.net\/submit\/help\/repository-xml/.test(upstreamMonitorWorkflow)
    || !/ca\.unraid\.net\/assets\/feed\/applicationFeed\.json/.test(upstreamMonitorWorkflow)
    || !/unraid-community-apps-starter/.test(upstreamMonitorWorkflow)) {
  fail('Community Applications validation must use the official portal guidance, public feed, and starter contract.');
}
if (!/permissions:\s*\n\s*contents:\s*read/.test(scheduledValidationWorkflow)
    || /issues:\s*write/.test(scheduledValidationWorkflow)) {
  fail('Scheduled cross-browser validation must keep repository contents read-only.');
}
if (!/FVPLUS_FIXTURE_BROWSERS:\s*chromium,firefox,webkit/.test(scheduledValidationWorkflow)
    || !/bash scripts\/run_ci_suite\.sh --lane fixture-browser/.test(scheduledValidationWorkflow)) {
  fail('Scheduled validation must run deterministic Chromium, Firefox, and WebKit fixtures.');
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
if (!/schedule:/.test(scheduledWorkflowHealthWorkflow)
    || !/workflow_dispatch:/.test(scheduledWorkflowHealthWorkflow)
    || !/actions:\s*read/.test(scheduledWorkflowHealthWorkflow)
    || !/issues:\s*write/.test(scheduledWorkflowHealthWorkflow)
    || !/scripts\/scheduled_workflow_health\.mjs/.test(scheduledWorkflowHealthWorkflow)
    || !/Scheduled workflow health requires attention/.test(scheduledWorkflowHealthWorkflow)) {
  fail('Scheduled workflow health must check run freshness and maintain a deduplicated recovery alert.');
}
const scheduledWorkflowHealthScript = read('scripts/scheduled_workflow_health.mjs');
for (const workflowFile of ['codeql.yml', 'scorecard.yml', 'dependency-vulnerability-scan.yml']) {
  if (!scheduledWorkflowHealthScript.includes(`workflowFile: '${workflowFile}'`)) {
    fail(`Scheduled workflow health must monitor ${workflowFile}.`);
  }
}
for (const [workflowName, workflow, jobNames] of [
  ['release-on-main', releaseOnMainWorkflow, ['release']],
  ['backmerge-main-to-dev', backmergeWorkflow, ['backmerge']],
  ['codeql', codeqlWorkflow, ['analyze']],
  ['dependency-review', dependencyReviewWorkflow, ['dependency-review']],
  ['dependency-vulnerability-scan', dependencyVulnerabilityScanWorkflow, ['scan']],
  ['scorecard', scorecardWorkflow, ['analysis']],
  ['clone-traffic-badge', cloneTrafficBadgeWorkflow, ['collect', 'publish']],
  ['scheduled-validation', scheduledValidationWorkflow, ['cross-browser-fixtures']],
  ['scheduled-workflow-health', scheduledWorkflowHealthWorkflow, ['watchdog']],
  ['unraid-compatibility-monitor', upstreamMonitorWorkflow, ['monitor', 'php-runtime-compatibility']]
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
  '.github/workflows/clone-traffic-badge.yml',
  '.github/workflows/dependency-vulnerability-scan.yml',
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
