# ADR 0004: Diagnostics Privacy Invariants

Status: accepted

Sanitized support bundles are the default public troubleshooting artifact. Names, identifiers, paths, addresses, URLs, request metadata, and oversized collections must be hashed, masked, omitted, or truncated before export.

Comparison tooling may compare sanitized structure and fingerprints but must not attempt to reverse or label hashes as identities.

Enforcement: support-bundle redactors, privacy self-checks, bundle schema tests, and comparator tests.
