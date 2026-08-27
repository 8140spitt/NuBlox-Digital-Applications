# NuBlox Bottom-Up Architecture

**Status:** Governing architecture method  
**Effective:** 22 August 2026  
**Purpose:** define NuBlox from authoritative primitives upward so every capability, process and workspace is traceable to controlled data, invariants and permissions.

## Core rule

NuBlox is designed **bottom up**.

```text
Layer 9  Completeness & validation
Layer 8  Experience & workspace composition
Layer 7  Construction & Built Environment overlays
Layer 6  Native capability domains
Layer 5  End-to-end business processes
Layer 4  Domain services & transaction boundaries
Layer 3  State, work, events & evidence
Layer 2  Trust, tenancy & authorisation
Layer 1  Canonical records & relationships
Layer 0  Primitives & invariants
```

Design proceeds from Layer 0 upward. Validation proceeds from Layer 9 downward and back to the implemented schema/tests.

An upper layer may compose lower layers, but it **must not redefine them**.

- A workspace cannot create authority that does not exist in Layer 2.
- A workflow cannot create a business state that is not owned by Layer 3 and a domain service.
- A process cannot invent duplicate records instead of using Layer 1.
- A capability cannot bypass Layer 4 boundaries.
- A sector overlay cannot fork the canonical enterprise model.
- A career or project role cannot become an implicit permission.
- A market category such as ERP, PLM or EAM cannot become a parallel product architecture.

## Product-scope invariant

NuBlox is **one complete Construction and Built Environment product**. ERP, PLM, PDM, CDE, BIM, PPM/PMIS, SCM, HCM, QMS/EHS, EAM/CMMS, IWMS/FM, FSM, GIS/digital-twin and related market labels are completeness benchmarks over the native domains, not products the customer assembles.

See [`platform-coverage-contract.md`](platform-coverage-contract.md).

## Implementation runtime map

For an implementation-first trace of how major process chains execute through routes, services, repositories, tables and tests, see [`runtime-process-map.md`](runtime-process-map.md).

For UX and interaction-friction reduction priorities, see [`ux-friction-remediation.md`](ux-friction-remediation.md).

## Authority

For implemented schema, committed MySQL migrations remain authoritative. The bottom-up architecture defines how new schema and services must be designed and how implemented capability is interpreted.

When an implementation conflicts with a governing invariant, the conflict must be resolved deliberately through migration/code change or an ADR; documentation must not silently describe a different system.

## Layers

| Layer | Governing reference | Question answered |
| --- | --- | --- |
| 0 | [`layer-0-primitives-and-invariants.md`](layer-0-primitives-and-invariants.md) | What are the irreducible values and rules? |
| 1 | [`layer-1-canonical-records.md`](layer-1-canonical-records.md) | What business things exist, and how do they relate? |
| 2 | [`layer-2-trust-tenancy-authorisation.md`](layer-2-trust-tenancy-authorisation.md) | Who is acting, in whose context, and what may they do? |
| 3 | [`layer-3-state-work-events-evidence.md`](layer-3-state-work-events-evidence.md) | How does controlled business state change and remain attributable? |
| 4 | [`layer-4-domain-services-boundaries.md`](layer-4-domain-services-boundaries.md) | Which service owns each invariant and transaction? |
| 5 | [`layer-5-business-processes.md`](layer-5-business-processes.md) | How are domain operations composed end to end? |
| 6 | [`layer-6-capability-domains.md`](layer-6-capability-domains.md) | What native product capability must NuBlox own? |
| 7 | [`layer-7-sector-lifecycle-overlays.md`](layer-7-sector-lifecycle-overlays.md) | How does construction and the built environment specialise the enterprise model? |
| 8 | [`layer-8-experience-workspaces.md`](layer-8-experience-workspaces.md) | How is capability composed into usable workspaces? |
| 9 | [`layer-9-completeness-validation.md`](layer-9-completeness-validation.md) | How do we prove a capability is actually complete? |

Layer 6 is supplemented by [`platform-coverage-contract.md`](platform-coverage-contract.md), which maps the broad software-market categories NuBlox must subsume into its native domains and digital thread.

## Design sequence for new work

Before creating a route, table or feature package, answer in this order:

1. Which existing primitives and invariants apply?
2. Which canonical records already represent the concept?
3. What new relationship, if any, is genuinely required?
4. What tenant/project/actor scope applies?
5. What permission and segregation-of-duties rules apply?
6. What state transition is being requested?
7. What domain service owns that transition?
8. What work, event and audit evidence must be produced?
9. Which end-to-end process uses it?
10. Which capability domain and sector overlay expose it?
11. Which market-category completeness requirement does it satisfy, if any?
12. Which workspace makes it usable?
13. What tests prove all lower layers remain correct?

If the answer begins with “create a screen” or “create a module”, the design is starting at the wrong layer.

## Cross-cutting rule

**Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

Likewise:

**Enterprise function ≠ Capability domain ≠ Lifecycle stage ≠ Workspace ≠ Market software category.**

Mappings between these dimensions are explicit, versioned and governed.
