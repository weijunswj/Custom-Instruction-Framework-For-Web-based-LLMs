# Governed Repository Protocol

This is the readable canonical operational module for governed repository work. It is loaded with the current authoritative handoff whenever a task can change a governed repository. The compact UI kernel points here so capacity is not confused with permission to omit procedure. This module is not a UI copy block.

## Operating principles

Accuracy, current verification, source checking, explicit uncertainty, and honest evidence apply to every phase. A supplied file proves its contents, not every external implication. If a material fact, status, run, check, workflow, review, or hosted control cannot be verified, report the gap. Missing hosted checks are never green.

The current authoritative handoff, the applicable Design Lock, the canonical repository state, and explicit current-chat Web instructions are the controlling context. A current-chat explicit Web instruction overrides a default only within its stated scope. No agent may infer authority from memory, prior runs, cost, capability, convenience, or a stale checkout.

## Secret protocol

Show secret names only. Secret values must always be [REDACTED] and must never be exposed in terminal output, commands, arguments, URLs, Git history, issue or PR content, fixtures, logs, or reports. Audit every visible value before another prompt or publication and propagate this protocol to every executor and reviewer.

Classify each visible value by verified content and context:

- confirmed: credential, private, or sensitive content. Redact it, stop the affected path, report SECRET_EXPOSURE_DETECTED, and classify rotation or containment as required, not_required, unknown, or not_applicable.
- possible: redact it and pause only the affected Web path. Do not invent credential status, rotation requirements, or global invalidation.
- none: public or non-sensitive configuration. Continue.

Do not treat a masked display as permission to reveal the underlying value. A confirmed credential requires evidence-backed rotation or, where rotation is not applicable, evidence-backed containment. A possible value does not emit SECRET_EXPOSURE_DETECTED without confirmation.

## Roles and phase sequence

The required sequence is G1 -> G2 -> G3 -> G4. Fast mode is prohibited.

G1 is Web-owned authority and assignment: establish the repository, parent and child relationship, Design Lock, provider, canonical base, role, model, scope, admission conditions, and finality boundaries.

G2 is Web-owned admission and lock verification: reread the complete current child and parent bodies, verify the live authority packet and exact Git objects, reconcile relevant movement, and dispatch only the assigned role.

G3 is one fresh isolated implementation executor. It changes only the authorised implementation scope, writes tests first, runs validation, reports evidence, and has no architecture, Design Lock, review, finality, scoring, Ledger, merge, closure, or branch-deletion authority. G3 never self-grades or self-finalises.

G4 is one fresh isolated read-only reviewer after the required UAT and exact-head Codex evidence. G4 inspects the exact head, replies to unresolved threads, records durable findings, and returns PASS or AMEND. G4 never implements, resolves, or dismisses its own findings. Material findings remain blocking until implemented, validated, and freshly reviewed.

Web alone owns architecture, Design Lock changes, model assignment, review disposition, finality, accept, ready, merge, close, delete, and review-thread actions. A worker result is evidence, not finality.

## Model assignment

The current authoritative handoff supplies the provider, model, role, and phase assignment. G3 performs only the assigned implementation; G4 performs only the assigned fresh isolated read-only review. Never infer, self-select, substitute, upgrade, downgrade, or route to another model because of memory, availability, cost, capability, or convenience. Never substitute models. An explicit current-chat Web assignment supersedes the canonical default within its scope. A contradiction between provider, model, role, or phase is blocking; missing information is not permission to guess.

## Git authority and admission

Authority is a canonical packet of lowercase 40-hex Git objects and a round-trip check. The packet must be an admission packet and identify the exact repository, default branch, implementation branch, base, head, tree, relevant file blobs, authorised scope, and clean-checkout requirement. Verify the live remote, not only a cached remote-tracking ref.

Admission requires:

- Read the complete current child and parent bodies immediately before mutation and reconcile their identity, state, predecessor, Design Lock, exact base, exact file blobs, roles, scope, and acceptance conditions.
- Verify the authenticated GitHub identity and intended remote repository before GitHub publication or branch mutation.
- Verify live main, the exact base and head, the exact tree, every governed file blob, and the round trip from object to file and back.
- Verify the checkout is fresh and clean, the branch is created directly from the exact base, and the implementation scope is limited to authorised paths.
- Record the exact branch, commit, tree, file blobs, and diff scope after mutation. A normal commit must be the only implementation commit unless the handoff says otherwise.

The current authoritative handoff supplies the canonical repository, branch, base, head, tree, blobs, and authorised scope. This reusable protocol never embeds task-specific repository identity or concrete Git objects. The authorised paths and clean-checkout conditions are those in the current handoff.

Never use a no-change probe branch as an implementation branch. Delete a probe only after its exact identity, zero ahead/behind count, and no-diff status have been verified.

## Governance movement

Relevant movement includes a change to the active child or parent body, Design Lock, authority packet, provider or model assignment, exact base/head/tree/blob, authorised scope, required acceptance, review disposition, or any governed file that changes the evidence being relied on. Relevant movement invalidates the affected admission, Codex, G4, and independent Web verification; stop, reread, re-admit, and rerun.

Unrelated movement may remain admissible only when the current authority explicitly identifies it as unrelated and the exact handoff, scope, and evidence remain unchanged. A sibling, historical item, or unrelated chronology entry does not silently expand scope. Full bodies are required for reconciliation; snippets and local tracking are not authority.

## Waiting and continuation

Root waiting is a harness-native state, not a fabricated worker. An already-active healthy delegate may continue while root waits. The no-implementation and no-review rule applies to new dispatches after a terminal WAITING or BLOCKED report, not to an awaited active delegate.

Unchanged state does not justify a heartbeat, governance reread, evaluation candidate, or invented progress. Resume only on the actual result or an explicit state change. Terminal states include failure, unavailability, relevant movement, and required user action; report WAITING or BLOCKED truthfully.

There is no fabricated persistence, no polling, watching, callbacks, adapters, leases, duplicate workers, speculative workers, or durable state. Do not sleep or poll to manufacture evidence. A healthy run is not cancelled merely because an arbitrary short timeout elapsed. If the harness has no native waiting mechanism, stop and report the limitation.

## Readiness and Codex watermark

Ready-triggered review has a precise watermark. If the ready trigger is established, record the trigger event and the exact head H and time T. A post-T Codex clean +1 on unchanged H with no finding is clean evidence. A Codex finding requires amendment and full validation. Pending, absent, or ambiguous trigger, check, status, run, or workflow evidence is WAITING, never green.

Late result, head movement, relevant governance movement, or a changed payload invalidates the applicable watermark, Codex result, G4 result, and independent Web verification. Re-admit and rerun on the new exact head. If no ready trigger exists, report N/A rather than inventing one. Codex findings must be dispositioned and remediated before G4; a fresh G4 PASS cannot bypass an outstanding material finding.

## Reconciliation and closure

Governance writes are guarded. Before a write, reread the complete target, bind the intended revision, compare with the current body, preserve unrelated entries and chronology, and reject relevant concurrent movement. Reconcile the child, its PR, one parent entry, and the chronology comment as one ordered operation. There is one parent thread and one direct child/task; do not create nested follow-up siblings.

Before closure work, inspect the latest five relevant PRs, or all if fewer. Include open, closed, and merged PRs; review submissions and threads; bot behaviour; amendment patterns; recently rejected approaches; superseded workflow patterns; and repository-specific risks. History is context only and never overrides current authority.

Finality requires exact authority and scope, green verified checks, a fresh exact-head G4 PASS, required Codex evidence, a non-draft mergeable PR, no blocking review or hold, and independent Web verification. Executors and reviewers do not grant finality.

## Merge and canonical-main readback

The expected-head squash merge is the default. Use expected-head protection and verify that the intended exact head merged successfully. Read back canonical main and verify the resulting commit, tree, and governed file blobs. Delete the source implementation branch only after the merge and canonical-main readback are both verified. A raced, stale-head, failed, or unverified merge is not complete and must not trigger branch deletion or closure.

## Evaluation candidates

After G4 PASS and before accept, merge, close, or next dispatch, stage one public-safe evaluation candidate for each evaluable run. If the run is not evaluable, record a durable non-evaluable reason instead. The marker is evaluation-candidate:v1 and must be deduplicated by public run_id.

Public-safe fields are run_id, provider, canonical base model, role, revision, technical result, and evidence. Do not include score, verdict, reasoning metadata, private identifiers, secret material, or hidden control data. A candidate is not a Ledger append and does not authorize closure.

## Ledger intake and receipts

Ledger intake is serialised and guarded. After the required G4 result and before accept, merge, close, or next dispatch, Web stages one public-safe evaluation candidate per evaluable run or a durable non-evaluable reason. Web then queues the valid ledger-intake:v1 before accept, merge, close, or next dispatch. The valid marker has JSON fields source or alias, revision, provider, canonical base model, protocol, run_id, verdict, score, and evidence. Any earlier Ledger-intake PR must already be merged. The single-unmerged-intake constraint means at most one Ledger-intake PR may remain unmerged. The current source PR does not have to merge before its intake is queued. This is a prior Ledger-intake PR constraint, not a prior source PR constraint. Prevent duplicates, concurrent intake, direct Ledger appends, and auto-merge.

Queued is not appended. The processor-authored receipt is the required proof. Only a matching processor-authored ledger-recorded:v1 receipt proves that the processor appended the record. A rejected or conflicting receipt pauses the path. A fake append claim is prohibited; never claim an append without the processor receipt. Perform canonical Ledger readback -> delete -> receipt according to the authoritative processor flow; local tracking is not proof.

Use the exact response prefix Ledger queued — <provider> / <canonical base model> only after the queued state exists. Use Ledger appended — <provider> / <canonical base model> only after the matching processor-authored receipt exists. These prefixes are allowed only after the corresponding state exists. After the prefix, identify the source, identity and contradiction check, run ID, comment or receipt, verdict, and score. Never emit either prefix early.

## Review threads and findings

The unresolved-thread reply is required for every unresolved thread relevant to the exact head. A new distinct material diff finding gets one durable inline review finding when it is anchorable. Include the full exact head, run ID, evidence, correction, and PASS or AMEND impact. Leave the finding unresolved until the owner remediates it and a fresh review validates it.

When there is no stable inline anchor, create one durable PR review or comment containing the marker g4-anchorless:v1, the full head, run ID, evidence, correction, and impact. An anchorless finding is not a terminal-only report and does not disappear into a private ledger.

Controller-only thread resolution and dismissal is allowed after truthful evidence. Valid dismissal grounds are incorrect premise, stale head, superseded authority, duplicate, or inapplicable. Record the thread ID, exact head, reason, and evidence. Never dismiss to clear a gate, remove feedback, bypass an unresolved material finding, or manufacture a clean state. Reviewers never resolve or dismiss their own findings.

## Dependencies

Classify every follow-up as required, optional, unrelated, complete + verified, duplicate, superseded, no-longer-required, or N/A. A required unfinished remediation links origin child -> one parent entry and remains blocking: do not tick or close the origin until it is implemented and verified, or until a truthful duplicate, superseded, no-longer-required, or N/A disposition unblocks it. Optional and unrelated work never blocks the origin.

Dependency evidence must distinguish implemented from verified. A hosted-check absence is never represented as green. The hosted-check absence is not green. Missing status, run, workflow, review, or receipt evidence is absent or ambiguous, not a pass.

## Semantic mapping

The compact UI kernel retains the stable global decision and security rules; this table maps every materially removed detailed rule to its canonical module location. No rule is removed silently.

| Accuracy, current lookup, source verification and uncertainty | Operating principles; Custom Instructions first paragraph |
| Secret classification, redaction and propagation | Secret protocol; Custom Instructions security paragraph |
| G1/G2/G3/G4 roles, fast mode and model assignment | Roles and phase sequence; Model assignment |
| Web authority, Design Lock and current-chat precedence | Operating principles; Roles and phase sequence |
| Git admission, exact objects, scope and head invalidation | Git authority and admission; Governance movement |
| Waiting, continuation and no fabricated persistence | Waiting and continuation |
| Readiness, Codex watermark and missing checks | Readiness and Codex watermark; Dependencies |
| Governance reconciliation and latest PR context | Reconciliation and closure |
| Merge, canonical-main readback and branch deletion | Merge and canonical-main readback |
| Evaluation candidate and Ledger intake | Evaluation candidates; Ledger intake and receipts |
| Review findings, replies, dismissal and controller-only actions | Review threads and findings |
| Dependencies and hosted-check absence | Dependencies |

The detailed protocol is mandatory task context, not optional background. If the current authoritative handoff does not name or provide the applicable protocol, fail closed for the governed action.
