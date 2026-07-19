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

If testing against an Unraid box is available, also run:

```bash
bash scripts/unraid_matrix_smoke.sh
```

## Pull Request Expectations

- Include a clear summary of what changed and why.
- Include screenshots for UI changes (desktop and mobile when relevant).
- Update the relevant user guide, troubleshooting page, `docs/current-state.json`, release notes, screenshots, or language catalogs when behavior changes.
- Keep backwards compatibility unless the change is intentional and documented.

## Coding Standards

- Use ASCII unless a file already requires Unicode.
- Keep naming and structure consistent with existing plugin files.
- Prefer small, composable functions over large inline blocks.
- Avoid introducing theme-breaking global selectors.

## Release and Versioning

- Version format: `YYYY.MM.DD.UU`
- `UU` is zero-padded for stable Unraid update ordering.
- Dev packages are finalized from `dev`; stable releases are prepared from `main` with `bash scripts/release_prepare.sh`.
- Contributors should not manually edit generated package checksums or version entries.
