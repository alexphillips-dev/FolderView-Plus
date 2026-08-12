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
3. Plugin page bootstraps are external, versioned JavaScript assets. JSON startup
   state is transported through escaped `meta` elements rather than executable
   page text.
4. Static presentation formerly expressed through `style` attributes uses scoped
   classes in `styles/csp.utilities.css`. Dynamic visual values are normalized and
   applied only through narrowly scoped CSS custom properties.
5. `scripts/csp_readiness_guard.mjs` inventories dynamic script creation and every
   first-party `innerHTML`, `outerHTML`, and `insertAdjacentHTML` sink with a source
   line, data classification, required control, and observed or explicitly reviewed
   mitigation. The guard fails when any sink lacks a control record or when a
   line-bound review becomes stale. Its deterministic output is stored in
   `docs/security/csp-readiness.json`.
6. Persisted and runtime data should be rendered with
   `scripts/folderviewplus.safe-dom.js`. The helper uses `textContent`, rejects
   event attributes, and restricts tags and attributes to an explicit allowlist.
7. Malicious fixtures cover folder names, container names, template metadata,
   imported configuration, translations, and diagnostics. The browser fixture
   also exercises the safe-DOM path with Trusted Types enabled.
8. CI rejects any return of inline handlers, inline bootstrap scripts or style
   blocks, `eval()`, or the `Function`
   constructor, and rejects a stale readiness report.

Regenerate and verify the report with:

```bash
node scripts/csp_readiness_guard.mjs --write
node scripts/csp_readiness_guard.mjs
```

The report includes a candidate report-only policy. It is documentation for
host-level testing, not a header emitted by the plugin. `script-src 'self'` is now
viable for plugin-owned page code, but Unraid and peer plugins may still require
different directives in the shared document. Dynamic CSS custom properties and
host styling also keep `style-src 'unsafe-inline'` in the report-only candidate.

Trusted Types is intentionally evaluated only in browser fixtures and report-only
planning. FolderView Plus must not impose `require-trusted-types-for 'script'` on a
production Unraid page because that directive would also govern host and peer-plugin
sinks. Production enforcement should only be considered after Unraid provides a
coordinated policy or a host-level report demonstrates compatibility.
