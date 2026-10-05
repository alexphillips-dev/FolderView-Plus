# Stable release workflow

Release work requires explicit owner authorization. Ordinary development updates
stay on `dev`; keep remote branches limited to `main`, `dev` and `metrics`.
Workflow, test and documentation changes alone do not bump the plugin version.

## Prepare and qualify once

1. Fetch main and dev, verify clean aligned worktrees, and inspect the full
   difference since the previous stable release. Curate complete user-facing
   release notes and audit the Wiki before publishing.
2. When packaging, installation, versioning or release tooling changes, run
   `bash scripts/simulate_main_release.sh`. This isolated rehearsal checks
   packaging; it does not run the complete functional suite again.
3. Merge the authorized candidate into clean main, then run
   `bash scripts/release_prepare.sh --push-main`. GitHub CLI must be authenticated
   with access to publish qualification tags and dispatch workflows.
4. The script builds the package, checks installation and notes, commits the
   final candidate, and creates `fvplus-release-candidate-<full commit SHA>`.
   CI, CodeQL and OSV start together. Required functional CI jobs are lint,
   Node tests, guards, dependency vulnerability/license review, all three browser
   engines and focused layout checks. Candidate dependency review preserves the
   protected `Dependency Review` check; ordinary PRs keep their existing review.
5. CI uploads release evidence bound to the exact commit, tree, package digest,
   lockfile digest, validation inputs, comparison base, repository and run.
   Evidence expires after
   24 hours from the original qualification, including after receipt reissuance.
   Candidate-tag CI applies the main-history guard from the exact comparison
   baseline. Manual `profile=release` dispatches require the previous stable
   commit as a full nonzero `base_sha` before qualification starts. The guarded
   push verifies the trusted successful run and security
   scans. Changing any tracked candidate input requires fresh qualification.
6. Main CI verifies and reuses this evidence; it does not repeat the required
   functional jobs. CodeQL refreshes main code-scanning results. Changed dependency
   inventory also requires a successful main OSV workflow. Main OSV reuses a
   clean exact-candidate SARIF report only when its committed SBOM, scanner inputs,
   repository, run, report digest and original scan age (24 hours maximum) match.
   It still uploads results to main code scanning. Missing, expired or invalid
   proof causes a fresh scan; scheduled/manual security scans always scan fresh.
   The publisher waits for required
   results, verifies release notes and raw package publication, then publishes
   the archive, checksum, provenance and SBOM attestations. Existing release tags
   must point to the qualified commit. The successful candidate tag is removed.

Do not bypass protection or fabricate evidence. A successful unrelated dev run,
fork PR, different package, failed/cancelled job or expired receipt is insufficient.
The first release using changed workflow tooling still needs complete remote
monitoring; local tests cannot prove hosted runner or ruleset acceptance.

## Coverage without repeated work

| Validation | When it runs |
| --- | --- |
| Full functional browser suite | Once per release candidate; Chromium, Firefox and WebKit jobs run in parallel |
| Focused layout profile | Chromium, light/dark and desktop/mobile, on release candidates and relevant changes |
| Exhaustive theme matrix | Weekly scheduled validation or manual CI with `profile=exhaustive` |
| Component and production benchmarks | Performance-sensitive changes, weekly schedule, or manual CI with `benchmarks=true` |
| Browser smoke subset | Optional local troubleshooting; not an additional required CI job |
| Install, archive/source integrity and reproducibility | Candidate package checks and required guards |
| CodeQL, OSV, Scorecard and attestations | Retained security and publication checks |

CI uses shallow checkouts for ordinary jobs and blob-filtered full history where
versioning requires it. Validation tooling uses Node 24 LTS. Browser jobs install
only their engine. Locked Node
dependencies are reused only with a matching installation stamp; missing or
changed lockfiles cause a clean install. CI publishes lane results and timing
artifacts so duration claims can be checked against actual runs.

Performance-sensitive shared runtime modules select both Settings and Docker
startup benchmarks. Settings-only or Docker-only modules select the affected
startup surface. VM and Dashboard changes retain component benchmarks and
functional fixtures; production startup fixtures currently model Settings and
Docker only. Scheduled runs and explicit `benchmarks=true` requests keep full
startup coverage. Review `production_surfaces` and the report's skipped surfaces
when diagnosing a benchmark. No timing baseline is relaxed automatically.

Qualification-tag-only pushes skip repeated local package/install hooks because
candidate CI owns qualification. Mixed pushes and main promotion still run the
guards and verify candidate evidence. Dev preview artifacts verify the committed
package and checksum and upload only the current archive, checksum and curated
notes, rather than rebuilding a package or uploading archive history.

The intended improvement is to remove repeated suites and parallelize work.
No fixed release duration is guaranteed: runner queues, security scans and
publication retries can still affect elapsed time.

## Synchronize main back to dev

The Back-Merge workflow runs after successful publication and uploads a read-only
synchronization plan. It creates no PR or remote branch and does not run another
full suite. After verifying the stable release, from current main run:

```bash
bash scripts/release_sync.sh --push-dev
```

The script uses an isolated detached worktree, preserves dev release artifacts,
and checks main ancestry. If the merged tree equals published dev, it pushes only
the ancestry merge and performs raw publication checks. A changed tree qualifies
once under `fvplus-sync-candidate-<full commit SHA>`; shipped source changes also
rebuild the dev package. Main or dev moving during synchronization stops the push.
Delete its qualification tag only after raw publication and `0 0` alignment
succeed; failed verification retains the tag and worktree for diagnosis.
After success, return to dev and fast-forward to origin/dev; verify a clean
worktree and `0 0` alignment. Do not monitor Actions after this dev push.

## Failure and recovery

- Failed qualification stops before the main push. Keep the candidate and inspect
  the failed job. Correct source on dev; a changed candidate receives a new SHA
  and fresh qualification. Never reuse success from an older candidate.
- For transient benchmark timing failures, rerun only the benchmark job after
  checking the report. Functional failures remain blockers. Do not rerun every
  browser/theme job to retry one timing sample or relax a baseline automatically.
- For a completed failed security scan, correct the reported vulnerability or
  infrastructure failure before retrying. A skip is not a successful scan.
- `node scripts/release_validation.mjs qualify` reuses valid evidence and requests
  missing/failed candidate checks again. It requires a clean exact candidate.
- Publication failures should retry only the failed workflow/job. A stale or
  mismatched receipt requires fresh candidate qualification, not a bypass.
  Requalification at the same main commit can renew expired evidence without
  rewriting or force-pushing the published release.
- Failed synchronization retains its exact isolated worktree for inspection;
  unpublished owner work is never reset or discarded. Remove only that worktree
  and its exact abandoned qualification tag after resolving the failure.
- After a stable release, monitor triggered main workflows to terminal success
  and verify public tag, notes, assets, checksum, attestations and raw manifest.
  Wiki and release-note accuracy remain release requirements.
