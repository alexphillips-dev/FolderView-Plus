# FolderView Plus Support Policy

This project follows a compatibility-first policy for migrations from `folder.view`, `folder.view2`, and `folder.view3`.

## Backward Compatibility Commitments

- Legacy import payloads from `folder.view2`/`folder.view3` remain supported.
- Legacy Docker label keys remain supported: `folder.view`, `folder.view2`, `folder.view3`, `folderview.plus`.
- Legacy custom override roots remain supported:
  - `/boot/config/plugins/folder.view/styles`
  - `/boot/config/plugins/folder.view2/styles`
  - `/boot/config/plugins/folder.view3/styles`
  - `/boot/config/plugins/folder.view/scripts`
  - `/boot/config/plugins/folder.view2/scripts`
  - `/boot/config/plugins/folder.view3/scripts`

## Stable Selector/Tag Contracts

Selectors listed below are treated as stable customization hooks and protected by CI contract tests.

### Docker

- `td.ct-name.folder-name`
- `div.folder-name-sub`
- `button.dropDown-*` + `.folder-dropdown`
- `td.updatecolumn.folder-update`
- `div.folder-preview`
- `img.img.folder-img`
- `span.state.folder-state`
- Tooltip hooks: `.preview-outbox`, `.action-info`, `.info-ct`, `.tooltipster-docker-folder`

### VM

- `td.vm-name.folder-name`
- `div.folder-name-sub`
- `button.dropDown-*` + `.folder-dropdown`
- `div.folder-preview`
- `img.img.folder-img`
- `span.state.folder-state`

### Dashboard

- `.folder-showcase-outer-*`
- `.folder-img-docker`, `.folder-state-docker`
- `.folder-img-vm`, `.folder-state-vm`

## Deprecation Policy

- If a stable selector or payload shape must change, it is first marked as deprecated.
- Deprecations must be announced in release notes with a migration note.
- Removal is delayed for at least **2 stable releases** after deprecation notice.
- Contract tests are updated only after replacement hooks exist and are documented.

## Regression Policy

- Compatibility contracts are validated in CI (tests + release guards).
- Changes that break documented legacy support are treated as release blockers.
