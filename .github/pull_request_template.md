## Summary

- What changed:
- Why:

## Validation

- [ ] `bash scripts/run_ci_suite.sh` or the relevant focused lanes
- [ ] `bash scripts/release_guard.sh` and `bash scripts/install_smoke.sh` (if packaging/release files changed)
- [ ] Desktop flow verified for changed areas
- [ ] Mobile/touch flow verified for changed areas (phone width and touch interaction)
- [ ] Updated/added mobile guard tests when UI behavior changed

## Documentation

- [ ] Updated the relevant user guide or troubleshooting steps when behavior changed
- [ ] Updated `docs/current-state.json` when a guarded feature name or contract changed
- [ ] Added categorized release notes for user-visible changes
- [ ] Updated screenshots when the documented interface changed materially
- [ ] Updated localization catalogs or extraction output for new user-facing text

## Notes

- Any migration, compatibility, or follow-up notes:
