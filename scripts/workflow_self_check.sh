#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib.sh
source "${ROOT_DIR}/scripts/lib.sh"
cd "${ROOT_DIR}"

fvplus::require_commands bash node

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
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
  '.github/actions/setup-ci-env/action.yml',
  'scripts/run_ci_suite.sh',
  'scripts/build_release_notes.sh',
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
if (!/upload-artifact@v4/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must upload debug artifacts on failure.');
}
if (!/FVPLUS_EXPECT_PLUGIN_BRANCH:\s*'dev'/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must validate merged dev state with FVPLUS_EXPECT_PLUGIN_BRANCH set to dev.');
}
if (!/pull-requests:\s*write/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must have pull-requests: write permission.');
}
if (!/Create or update back-merge PR/.test(backmergeWorkflow) ||
    !/gh pr create/.test(backmergeWorkflow) ||
    !/gh pr edit/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must open or update a PR into dev instead of pushing directly.');
}
if (/git push origin dev/.test(backmergeWorkflow)) {
  fail('Back-merge workflow must not push directly to protected dev.');
}

for (const workflowPath of [
  '.github/workflows/ci.yml',
  '.github/workflows/release-main.yml',
  '.github/workflows/release-on-main.yml',
  '.github/workflows/backmerge-main-to-dev.yml'
]) {
  const content = read(workflowPath);
  const scriptRefs = [...content.matchAll(/bash (scripts\/[A-Za-z0-9._/-]+\.sh)/g)].map((match) => match[1]);
  for (const scriptRef of scriptRefs) {
    ensureFile(scriptRef);
  }
}

console.log('Workflow self-check passed.');
NODE
