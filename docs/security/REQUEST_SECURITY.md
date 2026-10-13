# Request security and abuse controls

FolderView Plus layers its own request controls over the authenticated Unraid
webGUI session. These controls do not replace Unraid authentication.

## Unraid CSRF compatibility

The shared request client obtains Unraid's current CSRF token from the host
page's `window.csrf_token`. This token is separate from the FolderView Plus
install token, one-time nonce, and transaction ID. Missing page security
information blocks mutations and instructs the user to refresh the webGUI.
Credentials are restricted to requests on the current origin.

Normal POSTs retain Unraid's native jQuery token injection. Multipart uploads
use native XMLHttpRequest so that the host prefilter cannot turn FormData into
a string. Native uploads send both the `csrf_token` POST field and the
`X-CSRF-Token` header with the same value: the field preserves compatibility
with earlier supported Unraid versions. The browser supplies the multipart
boundary. Progress, cancellation, timeout, and plugin authorization still apply.

Docker folder saves await a nonce-protected order-sync response before leaving
the editor. Beacon acceptance is only a queued request, never proof of success.
The synchronous keepalive helper requires a previously issued nonce, sends the
CSRF field in the beacon body, and retains it with the header in a fetch fallback.
Inline icon fallback only follows an explicit unsupported-payload or no-file
refusal; empty responses, timeouts, and security failures are not replayed.

Native Unraid File Manager copy, move, and delete failures require the exact
failing endpoint and reproduction steps. FolderView Plus's Browse navigation
helper does not establish the cause of those failures.

## Mutation authorization

Every plugin-owned mutation must:

1. use `POST`;
2. carry the FolderView Plus request marker;
3. present the per-install request token;
4. pass same-origin `Origin` and `Referer` checks when those headers exist;
5. obtain a short-lived nonce from `security.php`;
6. bind that nonce to the target PHP endpoint and action;
7. consume the nonce exactly once;
8. present a unique transaction ID; and
9. remain within the API manifest's rate limit.

The browser request client performs nonce acquisition automatically. Mutation
retries remain disabled, so an uncertain response is reconciled from current
server state instead of replaying an operation.

### Reverse proxies

FolderView Plus supports a TLS-terminating reverse proxy without disabling its
same-origin guard. A proxied request can use its external authority only when
all of these headers are present as one coherent, single-valued tuple:

- `Host` and `X-Forwarded-Host` contain the same browser-facing hostname;
- `X-Forwarded-Proto` is exactly `http` or `https`;
- `X-Forwarded-Port` is a valid port from 1 through 65535; and
- an explicit port in `X-Forwarded-Host`, when present, equals
  `X-Forwarded-Port`.

The request `Origin` and `Referer`, when supplied by the browser, must match
either the direct Unraid authority or that validated forwarded authority.
Partial, comma-separated, malformed, or conflicting forwarded headers are
ignored and the request fails closed when its origin does not match directly.
The forwarded headers never replace the request marker, install token, nonce,
transaction, POST, or rate-limit controls.

The standard LinuxServer SWAG `proxy.conf` supplies the required host,
forwarded-host, forwarded-protocol, and forwarded-port headers. A custom
location must retain those settings. It does not need to inject
`X-FV-Request`; the FolderView Plus browser client supplies its own marker.

Request-security diagnostics expose only bounded reason codes such as
`valid`, `partial`, `host-mismatch`, and `port-mismatch`. Hostnames, addresses,
and header values are not included in that diagnostic section.

The unload telemetry action is the only normal replay-protection exception. It
uses `sendBeacon`, cannot synchronously request a nonce, remains protected by the
install token and same-origin checks, and has a bounded high-volume telemetry
rate limit. Every exception must include `replayExemptReason` in
`server/api-endpoints.json`; the API contract guard rejects undocumented
exceptions.

## Rate limiting

The API manifest provides a generous default mutation budget. Restore,
delete-all, recovery, repair, and similar expensive operations use tighter
action-specific budgets. A rejected request returns HTTP 429 and `Retry-After`.
Read-only hydration is not rate limited by these mutation controls.

Ephemeral nonce, transaction, and rate state lives under
`/var/run/folderview.plus/` with private permissions. It intentionally resets on
reboot and does not write high-frequency request state to the Unraid boot device.

## Security audit chain

Authorized mutations append a bounded security event containing only:

- declared endpoint, action, and audit category;
- authorization result;
- whether replay protection applied;
- random trace and transaction IDs; and
- timestamp and chain metadata.

Names, paths, addresses, URLs, payloads, request tokens, and nonces are never
stored in this ledger. Events are HMAC chained with the protected install token.
Diagnostics reports whether the retained chain verifies but does not
automatically repair or discard a failed chain.

## Compatibility

The former unauthenticated backup-download GET route has been removed. Maintained
UI downloads use the shared request client, guarded POST, a one-time nonce, and a
Blob response.
