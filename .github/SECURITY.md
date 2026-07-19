# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| Latest tagged release / `main` | yes |
| `dev` (pre-release testing) | best effort |
| Older releases | no |

`main` tracks the latest stable release. `dev` contains active development builds and can receive security fixes before the next stable release, but it is not covered by the same stability guarantees.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories:

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

Out-of-scope:

- Unraid core vulnerabilities
- third-party plugins/themes outside this repository
