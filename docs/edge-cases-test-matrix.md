# FolderView Plus Edge Cases and Test Matrix

This matrix is the minimum validation target before release packaging.

## Known Edge Cases

- Docker runtime long folder names can push the chevron into the Version column if app width reflow/gap guards regress.
- Nested parent folders can hide direct members if direct-row recovery drifts from runtime membership state.
- Mobile compact settings controls can pick up browser/theme button chrome (iPhone Safari) and render ghost box artifacts.
- Mobile quick-actions modal can clip at viewport edges on iPhone if safe-area bounds are not enforced.
- Refresh/resize/font-load bursts can trigger width recalculation thrash if reflow debounce contracts regress.

## Runtime Surfaces

| Surface | Required checks |
| --- | --- |
| Docker tab | Long-name row, short-name row, dropdown alignment, Version gap, nested parent expand/collapse |
| VMs tab | Nested expand/collapse parity, status rendering, compact viewport behavior |
| Dashboard widgets | Nested folder expansion and quick-action visibility without overflow clipping |
| Settings basic/advanced | Mobile compact row controls, quick-actions modal bounds, no ghost boxes |

## Browser Matrix

| Platform | Browser | Required |
| --- | --- | --- |
| Desktop | Chrome (latest) | Yes |
| Desktop | Firefox (latest) | Yes |
| Desktop | Safari/WebKit | Yes |
| Mobile | iPhone Safari | Yes |
| Mobile | Android Chrome | Yes |

## Verification Checklist

1. Run `node --test tests/*.mjs`.
2. Run `bash scripts/release_guard.sh`.
3. Run `bash scripts/install_smoke.sh`.
4. Run `bash scripts/browser_smoke.sh` with runtime URLs configured.
5. Manually confirm iPhone settings rows and quick-actions modal are artifact-free.
