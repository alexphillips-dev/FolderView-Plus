# ADR 0001: Branch Package Integrity

Status: accepted

Every committed shipped-source state on `dev` or `main` must have a matching manifest archive. Back-merges therefore rebuild the dev package before validation and never waive packaged-source drift.

Version selection considers both branch manifests and release tags so a version cannot be reused on another branch.

Enforcement: `prepare_backmerge_dev_package.sh`, `pkg_build.sh`, release guards, and workflow contract tests.

Archive provenance is content-addressed with the packaged source SHA-256. It
does not embed the containing Git commit because that would be self-referential
and would make checked-in archives impossible to reproduce byte for byte.
