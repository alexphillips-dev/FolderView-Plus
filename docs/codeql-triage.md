# CodeQL Triage and Merge Policy

## Baseline

The security update started from the GitHub code-scanning API snapshot captured on 2026-07-28:

| Classification | Open alerts |
| --- | ---: |
| High security severity | 27 |
| Medium security severity | 7 |
| Quality / no security severity | 39 |

The baseline predates the changes on `dev`; it is retained here so alert reductions can be measured after the branch scan and again after the next stable merge.

## Triage Decisions

- Production browser findings are treated as actionable. The first pass removes unsafe translated-HTML insertion, validates image and external URLs, rejects prototype-sensitive folder identifiers, avoids tainted selector construction in the affected render paths, and replaces diagnostic `Math.random()` identifiers with Web Crypto where available.
- Mutation protection is actionable even when Origin or Referer appears same-origin. A mutating endpoint must receive the shared mutation marker and a valid per-install token; missing token storage fails closed.
- Shell/path findings in repository tests and guards are treated as actionable when dynamic values are interpolated into interpreter source. The affected harnesses pass paths through environment variables or direct argument arrays.
- Stack traces from deterministic fixture servers are logged to the local runner only and are no longer returned in HTTP responses.
- Live Unraid screenshots, reports, URLs, and logs are private operator evidence. Capture is disabled by default and workflows do not upload those files.
- Quality-only alerts remain visible for maintainability work, but do not weaken the security-severity merge threshold.

## Enforcement

CodeQL Action v4 runs for pushes and pull requests targeting both `dev` and
`main`, plus the weekly scheduled scan. Repository rules require CodeQL to report
no new high-or-higher security findings before a protected branch can be merged.
Dependency Review separately rejects pull requests that introduce high-or-critical
known vulnerabilities or licenses outside the repository's approved quality-tooling
set. OpenSSF Scorecard publishes a scheduled supply-chain posture report to code
scanning. Code-quality findings remain part of CI and triage without being
mislabeled as security vulnerabilities.

## Review Procedure

1. Reproduce each alert on the scanned ref and trace the complete source-to-sink path.
2. Fix exploitable or ambiguous paths in code and add a regression contract.
3. Dismiss only findings proven to be test-only, unreachable, or false positive, using a specific GitHub dismissal reason and note.
4. Re-run CodeQL on `dev`.
5. Compare the branch result with this baseline before merging to `main`.
