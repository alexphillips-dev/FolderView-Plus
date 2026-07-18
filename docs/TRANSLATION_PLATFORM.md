# Translation platform setup

FolderView Plus is ready to connect to Weblate without changing runtime message keys. The repository remains authoritative; the platform must open reviewed pull requests against `dev` and must not push directly to `main`.

## Project components

Create one Weblate project named **FolderView Plus** and use JSON files with English as the monolingual base language. Split it into these components so translators can work with focused UI context:

| Component | File mask | English base |
|---|---|---|
| Legacy | `src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/*.json` | `.../langs/en.json` |
| Common | `.../langs/namespaces/*/common.json` | `.../langs/namespaces/en/common.json` |
| Docker | `.../langs/namespaces/*/docker.json` | `.../langs/namespaces/en/docker.json` |
| Dashboard | `.../langs/namespaces/*/dashboard.json` | `.../langs/namespaces/en/dashboard.json` |
| Diagnostics | `.../langs/namespaces/*/diagnostics.json` | `.../langs/namespaces/en/diagnostics.json` |
| Editor | `.../langs/namespaces/*/editor.json` | `.../langs/namespaces/en/editor.json` |
| Import | `.../langs/namespaces/*/import.json` | `.../langs/namespaces/en/import.json` |
| Settings | `.../langs/namespaces/*/settings.json` | `.../langs/namespaces/en/settings.json` |
| Wizard | `.../langs/namespaces/*/wizard.json` | `.../langs/namespaces/en/wizard.json` |

Use the repository browser pattern `https://github.com/alexphillips-dev/FolderView-Plus/blob/{{branch}}/{{filename}}#L{{line}}`. Exclude `@metadata` from translation. Keep `$1`, `$2`, supported HTML, product names, and plural syntax protected by quality checks.

## Review policy

1. Machine translation may only create a suggestion.
2. A fluent human reviewer must approve wording in UI context.
3. Delete, replace, import, reset, stop, and other destructive labels require a second review.
4. The platform PR must pass `scripts/i18n_guard.sh`, `scripts/lang_usage_guard.sh`, and `tests/i18n-runtime-contract.test.mjs`.
5. `reviewed`, `status`, `source-revision`, and translated counts are updated only after the review is complete.
6. Screenshots should be attached when a translation changes buttons, tables, dialogs, or right-to-left layout.

## Language rollout

Complete Spanish, German, and French first, followed by Italian, Polish, Dutch, Portuguese, Japanese, and Korean. Simplified Chinese uses `zh-Hans`; do not add `zh-Hant` until a Traditional Chinese catalog is reviewed. Portuguese uses separate `pt-BR` and `pt-PT` catalogs. Add Arabic or Hebrew only after the `ar-XB` pseudo-locale browser screenshots show that all affected surfaces are RTL-safe.

The external Weblate project still requires an administrator to create the project and authorize its GitHub integration. No service credentials belong in this repository.
