# F02 — Corporate Governance closure evidence

**Status:** Merge-candidate evidence. F02 remains open until PR #135 is merged, the merged `main` commit passes Complete System Validation, issue #134 is closed as completed, and repository hygiene is restored.

## Scope

This evidence covers all seven canonical F02 sub-functions:

- F02.01 Board governance
- F02.02 Governance framework
- F02.03 Delegation of authority
- F02.04 Executive management
- F02.05 Committee governance
- F02.06 Policy governance
- F02.07 Ethics governance

## Continuous enterprise thread

The governing F02 proof executes one business thread through:

`Governance framework → Board/Executive/Committee mandate → Business delegation of authority → Meeting/Attendance/Quorum → Agenda → Decision/Resolution → Action → Governed policy → Attestation → Conflict/ethics evidence → Review/closure`

The browser proof deliberately crosses these seams rather than treating governance as isolated registers.

## Authority boundary

Corporate governance authority is not NuBlox access authority.

- `governance_authority_rules` define business decision authority: subject domain, action, accountable body, financial range/currency and effective dates.
- Access roles, permissions, runtime capability, delegated access ceilings and SoD remain owned by the access-control architecture.
- A governance authority rule never grants a NuBlox permission and is not consulted as a substitute for runtime authorisation.
- Governance mutations still require explicit `governance.*` permissions through the normal server-authoritative permission service.

This separation is a governing invariant for F02.03.

## Canonical records

F02 owns versioned and attributable records for:

- governance frameworks and superseding revisions;
- board, executive and committee bodies;
- body appointments and voting rights;
- delegation-of-authority rules;
- meetings, attendance and quorum evidence;
- agenda items and cross-domain source references;
- immutable decisions/resolutions with the authority rule that justified them;
- decision actions and completion evidence;
- policy versions, approval bodies and attestations;
- conflict-of-interest declarations and review outcomes;
- ethics cases and resolutions.

Approved governance frameworks and policies are immutable. Change proceeds through explicit superseding revisions.

## Decision control

A governed approve/reject/defer decision requires:

1. an active body under an approved governance framework;
2. a convened meeting with sufficient present voting appointments for quorum;
3. the appointed chair present when one is configured;
4. the recorder to be a present member of the governance body;
5. an agenda authority action key; and
6. an approved active DoA rule matching body, source/subject domain, action, effective date, currency and financial range.

The matching authority-rule identifier is retained on the decision as evidence.

Financial authority limits are evaluated as exact `DECIMAL(19,4)` values using integer-scaled `bigint` comparison rather than IEEE-754 binary floating-point conversion. This preserves boundary correctness for large and fractional authority limits.

Governance-body appointments are evaluated against their effective appointment and term dates at the relevant governance date. Future or expired appointments cannot satisfy framework approval quorum, policy approval membership or meeting attendance eligibility.

## Policy and ethics control

Policy approval requires an effective active appointment to the policy approval body. Approved policy versions are attributable and attestable by members. Conflicts may reference an approved policy and retain reviewer outcome/management action. A conflict review is a governed one-time transition from `open`; a finalized `managed` or `closed` review cannot be overwritten through the review action.

Ethics cases may retain policy linkage, severity, accountable owner and immutable resolution evidence. Anonymous cases retain restricted server-side/audit attribution required for accountable evidence while the governance workspace payload suppresses `created_by_member_id`, preventing the anonymous reporter identity from leaking to client-visible data.

## Native-domain composition

- **D1** — organisation membership, accountable appointments and enterprise governance master context
- **D19** — workflow, evidence, audit/outbox and cross-domain reference posture
- **D14** — compliance/assurance adjacency for policy and ethics governance
- **D8** — strategy/performance adjacency for executive governance and enterprise review
- **D6** — governed-information adjacency for policy/decision evidence

Completion of F02 does not imply that every capability in D14, D8 or D6 is complete.

## SAP benchmark pressure

F02 materially advances the enterprise-governance outcomes represented by **SAP GRC** and adjacent governance expectations:

- explicit authority and approval limits;
- attributable decisions and audit evidence;
- governance body accountability;
- policy lifecycle and attestations;
- conflicts/ethics review evidence;
- separation between business authority and access authorisation.

The SAP references remain outside-in benchmark labels rather than NuBlox module boundaries. Broader enterprise risk, regulatory obligation catalogues, control testing and assurance programmes remain governed by their own functions/value streams.

## Automated proof

PR #135 merge acceptance requires its exact head to pass Complete System Validation, including formatting/lint, migration/schema validation, generated Kysely types, the full real-MySQL integration suite, Svelte/TypeScript validation, unit/component tests, production build and Playwright E2E.

The real-MySQL integration proof covers framework approval, board/body appointments, business DoA, meeting quorum, governed decisions/actions, policy approval/attestation, conflict review and ethics-case resolution with tenant/permission boundaries and attributable evidence.

The browser proof covers the same continuous thread and proves an approved financial decision is accepted only under the matching business authority rule, then carries the decision into an action, policy-linked governance evidence and ethics/conflict closure.

The F02 release-candidate hardening also proves fail-closed handling for exact financial authority boundaries, appointment-effective membership eligibility, immutable conflict-review outcomes and anonymous ethics client-data redaction through the same typed service/repository/server route path exercised by Complete System Validation.

## Closure gate

Issue #134 may be closed only after:

1. PR #135 exact-head Complete System Validation is green;
2. PR #135 is merged to `main`;
3. the merge commit's Complete System Validation is green;
4. the F02 function-capability map, capability registry and SAP GRC benchmark evidence reflect the delivered capability; and
5. repository hygiene is restored to zero open pull requests and only `main` remotely.
