# Contributing to FolderView Plus

Thanks for helping improve FolderView Plus.

## Before You Start

- Search existing issues first:
  - Bugs: `Bug report` form
  - Features: `Feature request` form
  - Help: `Support / troubleshooting` form
- Keep changes focused and scoped to one problem per pull request.

## Local Setup

1. Fork and clone the repository.
2. Create a branch from `dev` and normally target `dev` with the pull request. `main` is the stable release branch.
3. Install required tools:
   - Node.js 20+
   - PHP
   - Bash + shellcheck
4. Enable repo hooks (recommended, prevents failed pushes):
   - `bash scripts/install_git_hooks.sh`
5. Install locked validation dependencies with `npm ci --ignore-scripts`.

## Validation Checklist

Run the shared validation entry point before opening a pull request:

```bash
bash scripts/run_ci_suite.sh
```

Use `bash scripts/run_ci_suite.sh --lane <name>` for a focused run. Supported lanes are listed by `bash scripts/run_ci_suite.sh --help`. Changes to runtime rendering or shared UI should also run the fixture-browser lane when Playwright is available:

```bash
bash scripts/run_ci_suite.sh --lane fixture-browser
```

API, browser, theme, responsive, and cross-browser qualification is isolated and deterministic. The default profile uses full functional fixtures and focused layout coverage. Run expanded qualification when relevant:

```bash
bash scripts/run_ci_suite.sh --lane layout-checks
bash scripts/run_ci_suite.sh --lane theme-matrix
bash scripts/run_ci_suite.sh --lane performance
```

Do not configure repository validation with a live Unraid URL, session, or secret. Add or update a synthetic profile under `tests/fixtures/unraid-api/` when an upstream API outcome needs coverage.

## Pull Request Expectations

- Include a clear summary of what changed and why.
- Include screenshots for UI changes (desktop and mobile when relevant).
- Update the relevant user guide, troubleshooting page, `docs/current-state.json`, release notes, screenshots, or language catalogs when behavior changes.
- Keep backwards compatibility unless the change is intentional and documented.

### Stable releases and synchronization

For an explicitly authorized release exception, an administrator may set
`FVPLUS_SKIP_THEME_MATRIX` or `FVPLUS_SKIP_DOCKER_BENCHMARK` to `1` as repository
variables. The theme job is reported as skipped; the Docker exception omits
Docker startup measurements while retaining Settings startup checks. Other
validation remains required. Delete the variables after the release to restore
the defaults. Skipped checks are not passing checks.

Keep remote branches limited to `main`, `dev` and `metrics`. An authorized stable
release uses `bash scripts/release_prepare.sh --push-main`: it packages and commits
the final candidate, qualifies that exact commit through a temporary tag, and
pushes main only after CI, CodeQL and OSV succeed. Browser engines run in parallel;
the exhaustive theme matrix is scheduled/manual, and benchmarks run separately
for relevant changes or explicit requests. The publisher verifies candidate
evidence and package integrity rather than repeating the complete test suite.

The Back-Merge workflow now produces a read-only synchronization plan after
publication. From verified current main, run `bash scripts/release_sync.sh --push-dev`.
Identical dev files use an ancestry-only fast path. Changed files qualify once;
only shipped source changes rebuild the dev package. No extra remote branch,
back-merge PR, or duplicate PR/manual CI is created. See
[Release workflow](../docs/release-workflow.md) for evidence, failures and retries.

OpenSSF Scorecard samples historical merged PRs and commits. Missing checks on
older back-merges can continue to affect its CI-Tests and SAST findings even
when the current revision passes. Review the sampled PR heads before treating
these findings as current code defects or dismissing them.

## Coding Standards

### Translation changes

Use explicit semantic translation keys for conditional labels, counters, and text passed
through rendering helpers. Catalog coverage counts registered messages; it does not prove
that every visible string is bound or that its wording is correct. Test initial rendering
and subsequent interactions, including delayed catalog loading and Arabic directionality.

The reviewed runtime, terminology, and workflow tables in `scripts/lib/i18n_reviewed_*.json`
preserve corrections across all supported locales. Their key/term arrays define the order
of each locale's values. Update the corresponding values together, preserve every `$1`-style
parameter, and regenerate all catalogs with `node scripts/build_i18n_surface_catalogs.mjs --translate`.
Reviewed entries can be regenerated without the translation service. Keep user names,
filenames, paths, and saved configuration values outside translation bindings.

The counts, actions, UI, dialogs, and server review tables also generate their semantic
keys in `common.json`. Use complete count messages or count labels, never an English
plural suffix as a parameter. Keep manual sort order separate from manual membership.
Translate native browser prompts before opening them; their text is outside the DOM.
For reviewed static server messages, `lib.i18n.php` adds an `errorKey` or `messageKey`
while retaining the original message and diagnostic fields. Localize these responses
at the UI boundary with `FolderViewPlusI18n.serverMessage`; unknown details stay intact.
The audit regression tests exercise confirmation cancellation, numeric edge cases,
native prompts, and server messages independently of catalog completeness.

- Use ASCII unless a file already requires Unicode.
- Keep naming and structure consistent with existing plugin files.
- Prefer small, composable functions over large inline blocks.
- Avoid introducing theme-breaking global selectors.

## Release and Versioning

- Version format: `YYYY.MM.DD.UU`
- `UU` is zero-padded for stable Unraid update ordering.
- Dev packages are finalized from `dev`; stable releases are prepared from `main` with `bash scripts/release_prepare.sh`.
- Contributors should not manually edit generated package checksums or version entries.
