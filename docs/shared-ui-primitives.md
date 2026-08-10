# Shared UI primitives

FolderView Plus ships one theme-aware UI layer on Settings, Docker, VM, Dashboard, and the modern folder editor:

- `styles/ui.primitives.css` owns visual tokens and the `fv-ui-*` component classes.
- `scripts/folderviewplus.ui.js` owns rendering and behavior.

## Components

`FolderViewPlusUI` exposes renderers for buttons, icon buttons, badges, disclosures, fields, dropdowns, multiselects, empty states, and loading states. It also exposes managed modal/action-sheet, alert, confirmation, nonvisual status announcement, and progress APIs. Action completion is recorded in the Settings activity/recovery surfaces instead of displaying lower-right popup notifications.

Managed dialogs provide dialog semantics, focus trapping, Escape and backdrop policy, nested-modal ordering, body scroll locking, initial focus, live announcements, busy state, and focus restoration. Callers provide content and labels; they do not recreate that behavior.

## Delegated actions

New static markup should use `data-fv-ui-action="name"` and register the handler once:

```js
const dispose = FolderViewPlusUI.registerAction('folder-save', ({ trigger, data }) => {
    // Run the action.
});
```

Do not add new inline `onclick`, `onchange`, or similar attributes. Existing handlers are migrated by surface as those modules are changed.

## Styling rules

- Compose `fv-ui-*` classes with a surface class when a component needs local layout.
- Use theme tokens; do not hard-code dark-mode colors.
- Do not add `!important` to `ui.primitives.css`.
- Keep native focus visible through the shared focus ring.
- Use a tone (`neutral`, `primary`, `info`, `success`, `warning`, or `danger`) to communicate meaning. Hover is neutral and does not add an orange fill.
- Keep modal width and scrolling owned by the modal primitive. Content modules should not position dialogs.

## Migration guard

`node scripts/ui_debt_guard.mjs` records a downward-only baseline for first-party `!important` declarations, SweetAlert references, and inline page event handlers. A migration may lower those counts. A change may not increase them or introduce `!important` into the primitive stylesheet.

Behavior is covered by `tests/ui-primitives-contract.test.mjs` and the real Chromium fixture in `scripts/fixture_browser_tests.mjs`.
