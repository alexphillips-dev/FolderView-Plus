# API endpoint contract

`server/api-endpoints.json` is the canonical registry for every public FolderView Plus PHP endpoint. Each effective endpoint or action contract declares its allowed methods, read-only or mutation classification, mutation-guard requirement, accepted request content types, maximum request size, required parameters, response representation and content types, and audit category.

The shared `lib.api-contract.php` runtime resolves the current endpoint and action before the handler runs. `fvplus_json_try()` performs this automatically for standard JSON endpoints. Legacy text, streaming, and binary endpoints call the same enforcer explicitly. Mutation contracts are routed through `requireMutationRequestGuard()`, so adding an endpoint to the registry without adding a one-off guard inside that endpoint cannot bypass the common protection.

`scripts/api_contract_guard.mjs` consumes the same registry in CI and during release/install checks. It fails when:

- a public endpoint is absent from the registry or a stale registry entry has no file;
- a contract is incomplete or internally inconsistent;
- a mutation does not request the shared mutation guard;
- an endpoint does not load and invoke the shared contract runtime; or
- a declared JSON response has no JSON response implementation.

When adding an endpoint or action, update the registry first, use `fvplus_json_try()` where possible, add endpoint-specific behavioral tests, and run `bash scripts/api_contract_guard.sh`.

