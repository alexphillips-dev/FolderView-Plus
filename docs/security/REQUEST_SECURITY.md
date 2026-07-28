# Request security and abuse controls

FolderView Plus layers its own request controls over the authenticated Unraid
webGUI session. These controls do not replace Unraid authentication.

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
