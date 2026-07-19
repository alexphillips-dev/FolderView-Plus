# Privacy Guide

FolderView Plus provides two separate privacy systems:

1. **Runtime privacy mode** visually masks selected fields while using the Unraid interface.
2. **Support-bundle sanitization** transforms or omits sensitive troubleshooting values before export.

Runtime masking is useful for screenshots and screen sharing. It is not access control, encryption, or a substitute for restricting access to the Unraid web interface.

## Docker runtime privacy

The Docker page header includes a Privacy toggle and an adjacent options button. The toggle enables or disables masking. The options button selects what is hidden while Privacy is enabled.

The saved options are:

| Option | What it masks |
| --- | --- |
| Mask names and icons | Container names, folder/member labels, and identifying icons in native rows and collapsed previews. |
| Mask LAN IPs | The IP portion of values in the Docker `LAN IP:PORT` column. |
| Mask ports | Port values, including the port portion of `LAN IP:PORT`. |
| Mask volume paths | Container and host paths shown in volume mappings. |
| Mask image registries | Image repository or registry identifiers exposed by FolderView Plus surfaces. |
| Mask public IPs | Publicly routable IP addresses found in covered runtime text. |
| Mask network interfaces | Network-interface identifiers exposed by covered runtime surfaces. |
| Mask external URLs | External URL values exposed by covered runtime surfaces. |

LAN IP and port masks are independent. If `Mask LAN IPs` is disabled but `Mask ports` is enabled, the IP portion remains visible while the port remains masked.

The Docker quick controls and Settings edit the same saved preference model. The browser applies the change immediately and reconciles it with the server-backed preference. The enabled state persists across page refreshes and navigation.

## VM and Dashboard privacy

Settings provides privacy choices for VM and Dashboard rendering where the corresponding information is available:

| Option | What it masks |
| --- | --- |
| Mask names and icons | VM or folder labels and identifying icons. |
| Mask disk paths | VM disk paths. |
| Mask MAC addresses | VM network hardware addresses. |
| Mask public IPs | Publicly routable addresses exposed by covered surfaces. |
| Mask network interfaces | Network-interface identifiers. |
| Mask external URLs | External URLs exposed by covered surfaces. |

A mask can only affect information that FolderView Plus can identify on that surface. Native content inserted later by Unraid or another plugin may require the next runtime reconciliation before the mask is applied.

## What runtime privacy does not do

Runtime privacy mode does not:

- Change Docker or VM configuration.
- Remove data from Unraid APIs or browser developer tools.
- Prevent a user with server access from disabling the mask.
- Sanitize exported configuration files.
- Automatically sanitize screenshots taken before the mask finished applying.
- Guarantee that third-party plugin UI is masked.

Before publishing a screenshot, visually inspect the complete image, including the browser address bar, notifications, terminal output, developer tools, and third-party panels.

## Support-bundle sanitization

Open `Settings -> FolderView Plus -> Advanced -> Diagnostics` and review the support-bundle preview before exporting.

The sanitized export is designed for public issue reports. Depending on the field, sensitive values are hashed, masked, omitted, truncated, or replaced with a structural summary. Covered categories include names, filesystem paths, request metadata, URLs, IP addresses, and user-agent information. The bundle includes a redaction manifest that records how sanitization was applied.

The sanitized bundle preserves troubleshooting structure such as:

- Plugin and package identity.
- Schema and configuration counts.
- Health and integrity summaries.
- Runtime state totals without requiring raw names.
- Recent bounded activity and error telemetry.
- Loaded asset identity and version queries.
- Localization, theme, storage, performance, and host-integration diagnostics.

Sanitization is intentionally conservative, but no automated export can understand every user-supplied string. Review the preview before downloading and inspect the JSON before posting it publicly.

## Full support exports

Use a full or unsanitized export only when a maintainer explicitly needs raw fields and you understand what will be included. Share it privately. Do not attach an unsanitized bundle to a public GitHub issue or forum post.

Configuration exports and support bundles serve different purposes:

- A **configuration export** is intended for backup, migration, and restoration and can contain real folder settings.
- A **support bundle** is intended for troubleshooting and should normally be sanitized.

Do not use a public issue as storage for either type of sensitive export.

## Reporting a privacy problem

If a selected mask does not work:

1. Record the affected surface and column or field.
2. Confirm Privacy is enabled, not only that the individual mask is selected.
3. Toggle the specific mask off and on once.
4. Refresh and verify whether the enabled state persisted.
5. Capture a screenshot with the sensitive value manually covered.
6. Export a sanitized support bundle.
7. Report the browser, Unraid version, plugin version, and exact mask name.

Never include the unmasked value merely to prove that masking failed. A description such as “the IP portion of LAN IP:PORT remained visible” is sufficient.
