# ADR 0005: Package Artifact Storage

Status: accepted

Active branches retain only the newest 24 directly installable archives. Older packages and checksums are release assets. Git LFS is not used for manifest-addressed packages.

Historical object removal requires a separately approved, backed-up maintenance window and coordinated clone migration; normal automation only audits and prunes current-tree artifacts.

Enforcement: package pruning, artifact-history audit, release asset upload, and the artifact-retention guide.
