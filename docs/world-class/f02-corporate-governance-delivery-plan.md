# F02 — Corporate Governance delivery plan

**Status:** Delivery programme active.

## Function outcome

Govern the enterprise through explicit authority, bodies, policy, decisions, ethics and accountable actions without conflating business governance with NuBlox access-control roles.

## Canonical sub-functions

- F02.01 Board governance
- F02.02 Governance framework
- F02.03 Delegation of authority
- F02.04 Executive management
- F02.05 Committee governance
- F02.06 Policy governance
- F02.07 Ethics governance

## Native-domain composition

- D1 Enterprise, identity and master data — organisation membership/accountability context
- D19 Data, workflow, analytics, search and intelligence — decision/action evidence and digital thread
- D14 Quality, health, safety, environment and compliance — policy/ethics/compliance adjacency
- D8 Management accounting, planning, treasury and enterprise performance — executive management/strategy adjacency
- D6 Design, engineering, BIM and information management — governed policy-document adjacency

## Value streams

Primary: VS3 Strategy-to-performance and VS9 Risk-to-assurance.

## Governing ownership rules

1. **Corporate governance authority is not access authority.** F02 delegation-of-authority records govern business decisions and approval limits. They do not grant NuBlox permissions, access roles or runtime capability.
2. **Organisation membership is canonical.** Chairs, members, secretaries, executives, policy owners and decision/action owners reference active organisation members.
3. **Governance owns decision evidence, not source-domain transactions.** A governance decision may reference a strategy, contract, project, finance, people, safety or other canonical record, but does not duplicate that record.
4. **Approved governance-framework and policy versions are immutable.** Change proceeds by attributable superseding revision.
5. **Meeting decisions create attributable actions and authority evidence.** Decisions must retain the approving body, meeting, authority basis, resolution text and downstream record reference where applicable.

## Delivery tranches

### Tranche A — Governance constitution, bodies and authority

Covers F02.01, F02.02, F02.03 and the structural foundation of F02.04/F02.05:

- versioned governance framework / constitutional model;
- board, executive and committee bodies with mandates, quorum and active-member appointments;
- business delegation-of-authority rules with subject/action, financial limits, currency, authority body and effective dates;
- controlled approval/revision of the governance framework;
- explicit separation from access-control delegation;
- attributable audit/outbox evidence.

### Tranche B — Meetings, decisions and executive/committee governance

Completes F02.01, F02.04 and F02.05:

- governed meetings, agenda items, attendance/quorum evidence;
- decisions/resolutions with canonical source-domain references;
- decision authority evaluation against approved DoA rules;
- actions, owners, due dates and closure evidence;
- board/executive/committee decision history and drill-through.

### Tranche C — Policy and ethics governance

Completes F02.06 and F02.07:

- versioned governed policies with owner, scope, effective/review dates and controlled approval;
- policy acknowledgement/attestation evidence;
- conflict-of-interest declarations and review outcomes;
- ethics cases/concerns with controlled status and resolution evidence;
- links from decisions/actions to relevant policy/ethics evidence.

## Continuous enterprise thread

`Governance framework → Board/Executive/Committee mandate → Delegated authority → Meeting/Agenda → Decision/Resolution → Action → Policy obligation → Ethics/conflict evidence → Review/closure`

The thread must also support canonical downstream/source references without duplicating records.

## Completion gate

F02 is complete only when:

1. all seven sub-functions have explicit canonical records and owner services;
2. governance authority remains distinct from access-control permissions/delegation;
3. approved governance/policy evidence is immutable and revision-controlled;
4. board/executive/committee meetings and decisions prove quorum/authority and action follow-through;
5. policy and ethics evidence is attributable and reviewable;
6. organisation scope, permissions, audit and outbox evidence fail closed;
7. real-MySQL integration proof and browser E2E execute the continuous F02 thread;
8. the F02 function-capability map and SAP GRC benchmark evidence are updated; and
9. exact-head and merged-main Complete System Validation are green before F02 is closed.

Do not start F03 until F02 is closed or an explicit programme decision records an intentional deferral.
