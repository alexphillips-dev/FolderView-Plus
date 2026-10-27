# Rules and membership contracts

The browser core is `scripts/folderviewplus.rules-engine.js`. Its PHP counterpart is
`server/lib.rules-engine.php`. Both are pure evaluation modules: storage, inventory
collection, confirmation, backups, and mutations belong to their callers.

The existing `FolderViewPlusUtils` rule, conflict, and action-planning APIs remain
available. The utility facade delegates matching and membership to the core.

## Evaluation

Rules retain their saved array order and existing fields. The first matching enabled
rule decides automatic inclusion or exclusion. An include targeting a missing
folder is skipped and reported; an exclude remains global when its old target is
missing. Invalid predicates are reported by compilation.

Automatic regex rules use Unicode code-point matching. JavaScript uses Unicode
mode; PHP translates JavaScript Unicode escapes and evaluates UTF-8. A pattern
such as `^..$` therefore counts two code points, rather than two UTF-16 code units.
Literal label contains/starts-with operators use Unicode simple case folding and
escape regex punctuation.

Supported regex syntax is the intersection accepted by JavaScript Unicode mode
and the PHP compiler. This is not a claim of full ECMAScript/PCRE equivalence.
Legacy folder regexes retain their separate compatibility behavior. Previously
accepted identity escapes that are invalid in Unicode mode need correction when
editing an automatic rule. Cross-language fixtures characterize ordinary
predicates, Unicode escapes, escaped literals, character classes and rule order.

## Snapshot projections

`buildMembershipSnapshot` compiles predicates once and evaluates item decisions
before constructing folder membership. The snapshot owns its matching facts and
returns immutable browser data.

| Field | Contract |
| --- | --- |
| `manualMembers` | Stored references, including temporarily unavailable resources. |
| `members` | Effective membership with the compatibility API's missing-reference behavior. |
| `liveMembers` | Effective members present in the current inventory. |
| `reasonsByName` | Contributing membership sources. |
| `displayMembers` | Live members for which this folder is the primary display owner. |
| `primaryOwnerByName` | First eligible owner in the explicit display order. |
| `matchCache` | Compatibility buckets for existing renderers. |
| `issues` | Invalid predicates, missing targets, and invalid legacy regexes. |

Native folders retain additive manual, legacy regex, label, and managed-rule
membership. Exclusion suppresses the managed-rule contribution; it does not
subtract manual, legacy regex, or label membership.

Migrated FolderView3 folders retain explicit ownership before a valid label owner,
then converted rules. Definition order resolves their historical ownership ties.
Display order is separate: `displayFolderIds` can change primary rendering without
changing effective membership or FolderView3 policy.

The branch helper deduplicates descendant members, detects repeated traversal,
and rejects a missing root. Callers choose the projection appropriate to editing,
display, diagnostics, or actions.

## Identity and compatibility

Membership signatures include rule order, folder definitions and policy, display
order, stable resource identities, image facts and relevant labels. Runtime
status, WebUI values, and unrelated icon labels do not invalidate membership.
Action eligibility still reads current runtime state separately.

The browser signature is a local cache identity, not a security token.
The server provides a SHA-256 identity for authoritative rule inputs.

Compatibility wrappers preserve explicit native folder arguments, restricted
name lists, null-fact fallback, and the unknown-target behavior of calls that
omit a complete folder map. New consumers should provide complete normalized
inputs and reuse one snapshot for a configuration/inventory generation.

The new modules own the extracted evaluation responsibilities. The utility-rules
module's line budget is reduced from 533 to 250; the new focused module has its
own budget. Existing file-size ratchets are not increased.

## Verification

`tests/rule-engine-contract.test.mjs` executes the browser APIs and isolated PHP
fixtures. It covers shared predicate results, ordering, orphan targets,
confirmation freshness, FolderView3/native membership, immutable snapshots,
display order, branch scopes, optional legacy arguments, and regex construction
counts. Architecture and include-order guards cover all five page loaders.

Rendered browser acceptance and live Unraid acceptance are separate from these
source and fixture checks.

## Preview and apply boundary

The simulator reads its plan from server/rule_preview.php. GET reads canonical
configuration without migration, recovery, metadata repair or backups. Missing,
corrupt or noncanonical configuration requires Settings initialization first.
The response binds the plan to configuration bytes and current matching facts.

POST accepts the reviewed digest, rather than browser-supplied assignments.
Under the existing configuration lock it reads complete inventory again,
recomputes the plan and rejects changed inputs before creating a backup or
running the existing bulk assignment transaction. A no-op plan creates no backup.
Browser guards also reject local edits and superseded preview responses.

Apply is an explicit authoring action: it materializes raw automatic include
decisions into manual assignments. This preserves the prior simulator behavior,
including an intentional move from a FolderView3 explicit or label owner to the
previewed rule target. Ordinary evaluation, rendering and actions continue to use
FolderView3 effective ownership. Native label/regex membership stays additive;
materializing a rule does not promise exclusive effective ownership.

Docker, VM and Dashboard caches adapt the shared snapshot to existing rendering
buckets. Docker action scope owns the accepted snapshot generation; stale Command
renders cannot replace it. Authoritative label maps replace prior labels, and
image/compose/label changes trigger the existing coalesced membership refresh.
Docker startup order uses the same display projection while retaining its
separate native autostart persistence and concurrency checks.


The historical PHP diagnosticsFirstMatchingRule function remains as a compatibility
shim. Internal diagnostics use snapshots; the unused-helper inventory records the
intentional shim, and the facade tests verify it is still published.
