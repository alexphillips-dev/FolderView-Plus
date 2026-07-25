# Package Artifact Retention

FolderView Plus keeps the newest 24 package archives on each active branch because the Unraid manifest downloads the current package from that branch. Older packages belong on their matching GitHub releases with their SHA-256 files.

Do not use Git LFS for a package referenced by `folderview.plus.plg`: a raw GitHub URL can return an LFS pointer instead of the package bytes.

## Current-tree guard

```bash
bash scripts/artifact_history_audit.sh
```

The package builder and archive-pruning guard enforce the same 24-package current-tree limit.

## Historical audit

```bash
bash scripts/artifact_history_audit.sh --history
```

This slower report counts every reachable historical package blob. Removing old files from the current branch does not remove their existing Git objects.

## Coordinated history migration

A history rewrite is intentionally not automated. Before performing one:

1. Mirror the repository, tags, releases, manifests, archives, and checksums.
2. Confirm every retained plugin version is downloadable from a release asset or an intentionally retained branch object.
3. Freeze pushes and notify every contributor that all clones must be replaced or rebased.
4. Use `git filter-repo` to remove only obsolete `archive/*.txz` blobs, preserving current and recent packages.
5. Validate stable and dev manifest URLs from clean clones.
6. Force-push only during the approved maintenance window.
7. Re-run release, install, and remote publication guards.

The normal development workflow must never rewrite history or force-push.
