# Visual Runtime Contract

FolderView Plus runtime layout work regresses when the same rule is expressed in multiple places. This document defines the small set of visual contracts that Docker, VMs, editor previews, and smoke tooling should all agree on.

## Shared Sources Of Truth

- `scripts/folderviewplus.folder-contract.js`
  - Canonical dropdown style aliases and normalization
  - Canonical preview-border enable/disable normalization
  - Canonical preview-row limit normalization
- `styles/runtime.shared.css`
  - Canonical dropdown geometry and hover visibility
  - Canonical preview wrapper geometry for single-row rendering
- `scripts/docker.runtime.shared.js`
  - Runtime application of preview-border and dropdown tokens

Docker and VM runtime files should only own type-specific differences:

- app-column widths
- right-side gutter sizing
- type-specific card/content layout
- type-specific quick actions

## Non-Negotiable Visual Contracts

These are the behaviors that should not change unless the contract itself is intentionally revised.

1. Chevron visibility
   - Dropdown chevrons stay visible in default, hover, focus, and active states.
   - Theme overrides may recolor the chevron, but runtime CSS must not hide it.

2. Preview wrapper centering
   - Single-row preview cards center vertically within the preview rail.
   - Multi-row wrappers center within each row without changing the wrap calculation.

3. Multi-row wrapping
   - Multi-row packing follows measured available width.
   - Vertical bars, placeholder actions, and row padding must be included in the width budget.

4. Missing WebUI alignment
   - When vertical bars are enabled, rows reserve the same action-strip footprint even if a member has no WebUI.
   - This must not change single-row or multi-row wrap thresholds unexpectedly.

5. Settings/runtime parity
   - Folder editor and runtime both normalize:
     - `dropdown_style`
     - `dropdown_color`
     - `dropdown_hover_color`
     - `preview_border`
     - `preview_rows`

## Preferred Workflow

Use this order for UI/runtime work:

1. Reproduce against the local fixture:
   - `node scripts/generate_runtime_fixture.mjs`
2. Make the smallest contract-safe change.
3. Run targeted validation:
   - `bash scripts/dev_finalize.sh --open-fixture --skip-build`
4. If the fix is ready to package:
   - `git add <files>`
   - `bash scripts/dev_finalize.sh --message "Describe the fix" --open-fixture`
5. For a fast dev build when local validation is intentionally skipped:
   - `git add <files>`
   - `bash scripts/dev_finalize.sh --fast-dev-push --message "Describe the fix"`

## Review Checklist

- Did the change move shared behavior into `runtime.shared.css` or `folderviewplus.folder-contract.js` instead of duplicating it?
- Did Docker and VM keep only type-specific overrides?
- Does a test now pin the behavior?
- If wrap math changed, was single-row behavior left untouched unless that was the explicit target?
