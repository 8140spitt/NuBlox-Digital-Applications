# 06 — World-Class Experience Standard

**Status:** Governing experience standard  
**Effective:** 27 August 2026

## 1. Experience is part of capability completeness

NuBlox must combine enterprise-grade control with an experience that people can use continuously without excessive navigation, form friction or loss of context.

A technically correct workflow is not world-class if everyday users experience it as slow, repetitive or confusing.

## 2. Experience hierarchy

Users should experience NuBlox in this order:

```text
My responsibilities and exceptions
→ current business context
→ task or decision
→ supporting evidence and related records
→ deeper capability when required
```

They should not have to understand internal domains, table boundaries or software-market categories.

## 3. Context-first work

Primary contexts include:

- organisation;
- customer/supplier;
- opportunity/bid;
- programme/project;
- contract;
- site/location;
- property/building/space;
- asset/system;
- service case/work order;
- information container.

Opening a context should preserve it while the user moves through relevant workstreams.

## 4. Command centre standard

Home should become an operational command centre, not primarily a directory of available workspaces.

It should prioritise:

- work due today / overdue;
- approvals and decisions;
- exceptions and risk signals;
- forecast and performance variance;
- important recent changes;
- project/asset/customer contexts needing attention;
- role-relevant quick actions;
- drill-through to authoritative evidence.

Capability and workspace discovery remain available but secondary.

## 5. Interaction principles

1. **Progressively enhance high-frequency actions.** Keep server authority while avoiding unnecessary full-page cycles.
2. **Preserve user context.** Do not return users to the top of a large workspace after every micro-action.
3. **Task-focused surfaces.** Large multi-form pages should be decomposed into clear phases, panels or focused interactions.
4. **Inline state and feedback.** Pending, success, validation and conflict feedback should be local to the action.
5. **Defaults from context.** Reuse known project, party, location, currency, date, role and classification context.
6. **Minimise duplicate entry.** If NuBlox already governs the fact, select or derive it rather than ask again.
7. **Explain controlled transitions.** Approval, rejection, issue, posting, withdrawal and correction should make consequences clear.
8. **Search business records, not just workspaces.** Search must resolve authoritative records under permission.
9. **Responsive by default.** Core work must remain effective from laptop to tablet and appropriate mobile form factors.
10. **Accessibility.** WCAG 2.2 AA remains the minimum product target.

## 6. Office versus field experience

### Office / management

Optimise for:

- comparison and analysis;
- dense but readable data;
- approvals and exceptions;
- multi-record planning;
- drill-through reporting;
- keyboard efficiency;
- retained filters/context.

### Site / field / service

Optimise for:

- rapid capture;
- clear next action;
- minimal typing;
- photos/scanning/location where useful;
- large touch targets;
- intermittent connectivity tolerance where business risk requires it;
- safe local draft/retry semantics;
- immediate visibility of competence, permit or asset constraints.

## 7. World-class workflow pattern

```mermaid
flowchart LR
    C[Open context] --> T[See work / exception]
    T --> A[Take action]
    A --> V[Server validates authority & invariants]
    V --> E[Record state + evidence]
    E --> U[Update only affected experience]
    U --> N[Next best action / consequence]
```

The user should remain oriented throughout this loop.

## 8. Experience quality measures

Track at least:

- time from action to visible result;
- full-page navigations per completed workflow;
- clicks/inputs per core task;
- duplicate data-entry events;
- error recovery without context loss;
- task completion time;
- mobile completion success for field journeys;
- accessibility failures;
- support/user-reported friction by workflow.

## 9. Experience debt rule

When a feature adds significant workflow or governance depth, its usability debt must be assessed in the same tranche. Repeatedly adding controlled forms to an already overloaded workspace is not neutral technical debt; it actively weakens the product proposition.

The current friction backlog in `docs/architecture/bottom-up/ux-friction-remediation.md` should be treated as an input to delivery planning, not an optional polish phase.
