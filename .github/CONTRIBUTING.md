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

## Validation Checklist

Run the shared validation entry point before opening a pull request:

```bash
bash scripts/run_ci_suite.sh
```

Use `bash scripts/run_ci_suite.sh --lane <name>` for a focused run. Supported lanes are listed by `bash scripts/run_ci_suite.sh --help`. Changes to runtime rendering or shared UI should also run the fixture-browser lane when Playwright is available:

```bash
bash scripts/run_ci_suite.sh --lane fixture-browser
```

API, browser, theme, responsive, and cross-browser qualification is isolated and deterministic. Run:

```bash
bash scripts/run_ci_suite.sh --lane browser-smoke
bash scripts/run_ci_suite.sh --lane theme-matrix
```

Do not configure repository validation with a live Unraid URL, session, or secret. Add or update a synthetic profile under `tests/fixtures/unraid-api/` when an upstream API outcome needs coverage.

## Pull Request Expectations

- Include a clear summary of what changed and why.
- Include screenshots for UI changes (desktop and mobile when relevant).
- Update the relevant user guide, troubleshooting page, `docs/current-state.json`, release notes, screenshots, or language catalogs when behavior changes.
- Keep backwards compatibility unless the change is intentional and documented.

### Automated back-merges

The main-to-dev back-merge workflow requests CI and CodeQL on the generated
`backmerge/main-to-dev` branch. Before merging, verify that both workflows passed
for the PR's current head commit. The earlier validation inside the back-merge
workflow does not replace checks attached to that commit.

If either request fails, use **Run workflow** in the CI and CodeQL Actions pages
and select `backmerge/main-to-dev`. Manual CI validates the full selected
revision, including browser and theme fixtures. Do not merge while checks are
missing, pending, or failing.

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
