# Content Security Policy readiness

FolderView Plus runs inside web documents owned by the Unraid webGUI. It cannot safely
set an enforced page-wide Content Security Policy by itself: that header would also
govern Unraid and every other plugin loaded into the same document.

The repository therefore uses a staged, report-only approach:

1. Plugin-owned inline event attributes are prohibited. UI actions use
   `folderviewplus.csp-events.js`, which accepts only an explicit function allowlist
   and a restricted argument grammar. It does not use `eval()` or `Function`.
2. Managed theme CSS rejects executable legacy CSS, `@import`, external network
   URLs, and HTML data URLs before storage or rendering.
3. `scripts/csp_readiness_guard.mjs` inventories remaining inline scripts, styles,
   dynamic script creation, and HTML string sinks. Its deterministic output is
   stored in `docs/security/csp-readiness.json`.
4. CI rejects any return of inline handlers, `eval()`, or the `Function`
   constructor, and rejects a stale readiness report.

Regenerate and verify the report with:

```bash
node scripts/csp_readiness_guard.mjs --write
node scripts/csp_readiness_guard.mjs
```

The report includes a candidate report-only policy. It is documentation for
host-level testing, not a header emitted by the plugin. Enforced CSP should only be
considered after Unraid exposes a plugin-safe nonce/hash mechanism or after a
host-level report confirms that Unraid and installed peer plugins remain compatible.
