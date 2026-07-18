# Translating FolderView Plus

FolderView Plus uses English as its source catalog and falls back to English whenever a translation is missing. A locale is only presented as complete after its messages have been reviewed by a person who can judge the language in context.

## Catalog layout

- `src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/en.json` contains legacy messages.
- `src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/namespaces/en/` contains feature-oriented modern messages.
- `src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/<locale>.json` contains existing non-English legacy translations.
- Modern translation scaffolds live under `langs/namespaces/<locale>/<namespace>.json`; add reviewed messages to the existing locale file instead of copying English into it.
- `langs/registry.php` records the native language name, direction, and review status used by the runtime loader.

Message keys describe meaning instead of copying English wording. New keys should use a feature namespace, for example `docker.privacy.mask-lan-ips` or `wizard.navigation.review`. Do not rename a key solely because the English sentence was edited.

## Translation status

- `source`: authoritative English source.
- `complete`: every current source message is translated and human reviewed.
- `partial`: useful translations exist, but English fallback remains visible for missing or stale messages.
- `placeholder`: no reviewed translation is currently shipped. The runtime deliberately loads English instead of an English-copy locale file.

Do not fill untranslated keys with copied English text to increase the apparent completion percentage. Missing keys are the correct representation of unfinished work.

## Message rules

1. Preserve parameters such as `$1` and `$2` exactly.
2. Keep supported markup and links equivalent to the English source. Never add scripts, event attributes, or untrusted URLs.
3. Translate full sentences instead of joining independently translated fragments.
4. Use `{{PLURAL:$1|singular|plural}}` where the sentence depends on a count. Languages may provide every plural form supported by jquery.i18n.
5. Keep product names such as FolderView Plus, Unraid, Docker, and User Scripts unchanged unless an established localized name exists.
6. Preserve the distinction between Docker containers, virtual machines, folders, members, rules, previews, and backups.

## Glossary

| English term | Meaning in FolderView Plus |
|---|---|
| Folder | A visual organization group; not a filesystem directory. |
| Member | A Docker container, VM, or child folder assigned to a folder. |
| Rule | An automatic assignment condition evaluated by FolderView Plus. |
| Preview | The compact member display shown inside or alongside a folder row. |
| Runtime page | The Unraid Docker, VM, or Dashboard page enhanced by the plugin. |
| Snapshot | A saved FolderView Plus configuration used for compare or recovery. |
| Import | Applying a FolderView/FolderView Plus configuration export. |

## Validation

Run these repository-provided checks before submitting a translation:

```bash
bash scripts/i18n_guard.sh
bash scripts/lang_usage_guard.sh
```

The guards validate catalog JSON, metadata, duplicate keys, message parameters, plural syntax, HTML consistency, source-code references, unused keys, and the hard-coded-string regression ceiling.

## Pseudo-locales

After a FolderView Plus page has loaded, use the browser console to test text expansion:

```js
FolderViewPlusI18n.usePseudoLocale('en-XA')
```

Use the bidirectional pseudo-locale to test right-to-left layout:

```js
FolderViewPlusI18n.usePseudoLocale('ar-XB')
```

Restore the Unraid-selected locale with:

```js
FolderViewPlusI18n.restoreLocale()
```

Test Docker, VMs, Dashboard, Settings Basic and Advanced, the Setup Assistant, import dialogs, diagnostics, and the modern folder editor. Look for clipping, fixed-width controls, incorrect icon placement, English strings, and broken keyboard or screen-reader labels.

The repository browser smoke run also activates `en-XA` and `ar-XB`, verifies language and direction state, and saves full-page screenshots for expansion and RTL review.

## Regional locales

Locale names follow BCP 47. Add a regional file only when the language actually differs, such as `pt-BR`, `pt-PT`, `zh-Hans`, or `zh-Hant`. The loader resolves the most specific available locale, then its base language, then English.

FolderView Plus currently distinguishes `pt-BR`, `pt-PT`, and `zh-Hans`. Traditional Chinese requests deliberately fall back to English until a reviewed `zh-Hant` catalog exists; they must never silently receive Simplified Chinese text.

## Review workflow

1. Update the English source and increment the catalog version.
2. Run the guards and review newly missing translations.
3. Translate with UI context or screenshots available.
4. Use machine translation only as a draft.
5. Have a human reviewer verify terminology, plural forms, layout, and potentially destructive actions.
6. Update locale metadata and registry status only after review.

The repository is prepared for a Weblate project using the component masks and review controls in [TRANSLATION_PLATFORM.md](TRANSLATION_PLATFORM.md). JSON pull requests remain supported so the project is not dependent on an external translation service.

## Coverage and extraction debt

Diagnostics reports legacy and modern namespace coverage separately, whether a locale was reviewed against the current English source, and the count of translations that may be stale. It also reports the heuristic hard-coded UI candidate count from `langs/extraction-report.json`. Catalog coverage and extraction coverage are different: a locale can translate every catalog key while untranslated hard-coded UI still remains. The guards reject stale extraction-report totals and any new hard-coded-string regression.
