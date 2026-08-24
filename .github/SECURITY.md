# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| Latest tagged release / `main` | yes |
| `dev` (pre-release testing) | best effort |
| Older releases | no |

`main` tracks the latest stable release. `dev` contains active development builds and can receive security fixes before the next stable release, but it is not covered by the same stability guarantees.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories using
[Report a vulnerability](https://github.com/alexphillips-dev/FolderView-Plus/security/advisories/new):

1. Go to the repository `Security` tab.
2. Select `Report a vulnerability`.
3. Include:
   - affected version (`/boot/config/plugins/folderview.plus/version`)
   - Unraid version
   - reproduction steps
   - impact and expected risk
   - logs/screenshots if available

Do not open public issues for unpatched vulnerabilities.

## Response Targets

- Initial acknowledgement: within 72 hours
- Triage and severity assessment: within 7 days
- Fix or mitigation timeline: communicated after triage

## Security Scope

In-scope components include:

- plugin PHP API endpoints
- client-side settings/runtime scripts
- import/export and backup/restore flows
- release packaging and update metadata
- archive extraction, durable storage, and process-execution boundaries
- privacy sanitization and browser-side injection defenses
- nonce, replay, transaction-idempotency, and mutation rate-limit controls
- installed runtime integrity and privacy-safe security audit verification

## Package Verification

The Unraid plugin manifest publishes SHA-256 digests for shipped archives. Stable
GitHub releases also publish GitHub artifact attestations for build provenance and
the CycloneDX SBOM. Verification steps and the trust model are documented in
[`docs/security/PACKAGE_TRUST.md`](../docs/security/PACKAGE_TRUST.md).

The runtime request model is documented in
[`docs/security/REQUEST_SECURITY.md`](../docs/security/REQUEST_SECURITY.md), and
post-install verification is documented in
[`docs/security/RUNTIME_INTEGRITY.md`](../docs/security/RUNTIME_INTEGRITY.md).

Out-of-scope:

- Unraid core vulnerabilities
- third-party plugins/themes outside this repository
