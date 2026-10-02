# Localization repair coverage

This repair covers English and all 26 supported translated locales. The source inventory in `localization-source-inventory.json` records the second audit against development commit `d5dc0645`; it distinguishes UI text from technical identifiers and user data. It is an audit record, not a substitute for executable coverage.

The reviewed surfaces include Settings, Docker, VMs, Dashboard, folder editing, icon selection and upload, appearance, rules, start order, setup, import/export, recovery, update guidance, diagnostics, and packaged plugin descriptions. Conditional UI strings supplement markup extraction through `scripts/lib/i18n_additional_surfaces.json`. Its source anchors are checked during catalog generation. Ambiguous parameter boundaries have explicit translation calls.

The extraction audit exposes 1,432 existing conditional phrases that the old extractor did not count. The migration guard now freezes 3,089 legacy surface keys (1,657 detected directly plus those 1,432 audited phrases) and requires at least 1,432 semantic keys. This records previously hidden translation debt; future UI additions still require semantic keys. The repair fixture also pins 263 concrete source bindings and their parameters.

Native prompts and confirmations, CSS-generated empty states, accessibility text, migration summaries, server responses, and selected date/number formatters have separate regression coverage. Count and confirmation tests exercise zero, one, two, five, and twenty-one, including cancellation paths. Manual sorting remains distinct from manually assigned membership.

Catalog generation validates parameter occurrences before accepting a translation response. Reviewed terminology and confirmation tables override ambiguous generated wording. Tests also detect untranslated sentence blocks and verify source bindings independently of catalog completeness. Browser cases configure a nominal 100% coverage report deliberately, so a green completeness indicator cannot hide broken runtime bindings.

Technical commands, paths, identifiers, user-entered names, and original server diagnostics retain their values. The server attaches translation keys and opaque parameters; clients validate them against the original message before translating display text. External plugin and Unraid-owned strings are outside this plugin's catalog ownership.

Automated fixture results establish behavior and parameter integrity. They do not certify every sentence as native-speaker reviewed. Real Unraid verification remains a manual owner/tester check after publication, including navigation, refresh, mobile layout, and the original failing workflows.
