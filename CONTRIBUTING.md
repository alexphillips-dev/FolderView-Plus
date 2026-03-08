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
2. Create a branch from `main`.
3. Install required tools:
   - Node.js 20+
   - PHP
   - Bash + shellcheck

## Validation Checklist

Run these before opening a pull request:

```bash
node --test tests/*.mjs
bash scripts/release_guard.sh
bash scripts/install_smoke.sh
bash scripts/api_contract_guard.sh
bash scripts/i18n_guard.sh
bash scripts/lang_usage_guard.sh
bash scripts/theme_scope_guard.sh
bash scripts/perf_budget_guard.sh
```

If testing against an Unraid box is available, also run:

```bash
bash scripts/unraid_matrix_smoke.sh
```

## Pull Request Expectations

- Include a clear summary of what changed and why.
- Include screenshots for UI changes (desktop and mobile when relevant).
- Update docs (`README.md`, `CHANGELOG-fixes.md`, or language files) when behavior changes.
- Keep backwards compatibility unless the change is intentional and documented.

## Coding Standards

- Use ASCII unless a file already requires Unicode.
- Keep naming and structure consistent with existing plugin files.
- Prefer small, composable functions over large inline blocks.
- Avoid introducing theme-breaking global selectors.

## Release and Versioning

- Version format: `YYYY.MM.DD.UU`
- `UU` is zero-padded for stable Unraid update ordering.
- Releases are prepared with `bash scripts/release_prepare.sh`.
