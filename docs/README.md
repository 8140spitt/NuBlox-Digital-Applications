# NuBlox Documentation

NuBlox documentation is organised around a **bottom-up design architecture**. Permanent documentation describes enduring primitives, records, invariants, controls, services, processes, capability and sector composition. Delivery history belongs in Git commits, pull requests and issues.

## Start here

**[`architecture/bottom-up/README.md`](architecture/bottom-up/README.md)** is the governing architecture method and reading order.

The architecture is constructed in this sequence:

```text
0  Primitives & invariants
1  Canonical records & relationships
2  Trust, tenancy & authorisation
3  State, work, events & evidence
4  Domain services & boundaries
5  End-to-end business processes
6  Native capability domains
7  Construction & Built Environment overlays
8  Experience & workspaces
9  Completeness & validation
```

Higher layers compose lower layers and must not redefine them.

## Documentation authority

When sources disagree:

1. **Committed MySQL migrations** in [`../database/migrations/`](../database/migrations/) are the authority for the implemented relational schema.
2. **Bottom-up architecture** in [`architecture/bottom-up/`](architecture/bottom-up/) governs architectural semantics and design method.
3. **[`construction-and-built-environment.md`](construction-and-built-environment.md)** governs the Construction & Built Environment sector/lifecycle overlay (Layer 7).
4. **Security/privacy requirements** in [`11-security-privacy-compliance.md`](11-security-privacy-compliance.md) supplement the Layer 2 trust model.
5. **ADRs** in [`adr/`](adr/) record accepted technical decisions and explicit exceptions.
6. **Product/functional requirements** define desired outcomes where a lower-layer invariant has not already settled the design.
7. **Enterprise taxonomy** in [`architecture/taxonomy/`](architecture/taxonomy/) catalogues work enterprises perform; it is mapped to, not substituted for, capability domains.
8. **Database package docs** in [`../database/docs/`](../database/docs/) explain implementation intent; migrations win if implementation has advanced.

## Governing architecture set

- [`architecture/bottom-up/README.md`](architecture/bottom-up/README.md) — architecture method and layer index.
- [`architecture/bottom-up/layer-0-primitives-and-invariants.md`](architecture/bottom-up/layer-0-primitives-and-invariants.md)
- [`architecture/bottom-up/layer-1-canonical-records.md`](architecture/bottom-up/layer-1-canonical-records.md)
- [`architecture/bottom-up/layer-2-trust-tenancy-authorisation.md`](architecture/bottom-up/layer-2-trust-tenancy-authorisation.md)
- [`architecture/bottom-up/layer-3-state-work-events-evidence.md`](architecture/bottom-up/layer-3-state-work-events-evidence.md)
- [`architecture/bottom-up/layer-4-domain-services-boundaries.md`](architecture/bottom-up/layer-4-domain-services-boundaries.md)
- [`architecture/bottom-up/layer-5-business-processes.md`](architecture/bottom-up/layer-5-business-processes.md)
- [`architecture/bottom-up/layer-6-capability-domains.md`](architecture/bottom-up/layer-6-capability-domains.md)
- [`architecture/bottom-up/layer-7-sector-lifecycle-overlays.md`](architecture/bottom-up/layer-7-sector-lifecycle-overlays.md)
- [`architecture/bottom-up/layer-8-experience-workspaces.md`](architecture/bottom-up/layer-8-experience-workspaces.md)
- [`architecture/bottom-up/layer-9-completeness-validation.md`](architecture/bottom-up/layer-9-completeness-validation.md)

## Sector and structured references

- [`construction-and-built-environment.md`](construction-and-built-environment.md) — complete sector/lifecycle model.
- [`architecture/taxonomy/`](architecture/taxonomy/) — 29-function enterprise activity taxonomy.
- [`03-career-taxonomy.md`](03-career-taxonomy.md) and [`04-career-capability-matrix.md`](04-career-capability-matrix.md) — profession/career composition references.
- [`17-sources-and-standards.md`](17-sources-and-standards.md) — current external standards and source register.
- [`work-kernel-foundation.md`](work-kernel-foundation.md) — current Work Kernel implementation foundation.
- [`branding/`](branding/) — NuBlox brand system.

## Requirements and controls

- [`00-executive-summary.md`](00-executive-summary.md)
- [`01-product-requirements-document.md`](01-product-requirements-document.md)
- [`02-functional-requirements.md`](02-functional-requirements.md)
- [`10-non-functional-requirements.md`](10-non-functional-requirements.md)
- [`11-security-privacy-compliance.md`](11-security-privacy-compliance.md)
- [`12-devops-environments-testing.md`](12-devops-environments-testing.md)
- [`19-risks-and-dependencies.md`](19-risks-and-dependencies.md)
- [`16-glossary.md`](16-glossary.md)

Legacy numbered paths such as `05`, `06`, `07`, `09`, `20` and `57` are retained only where older references benefit from compatibility. They are no longer independent architecture authorities.

## Documentation rules

- Design new capability from Layer 0 upward before designing its screen.
- Reuse canonical records; do not create module-local copies of enterprise identities.
- Put material lifecycle and security rules in the lower layers, not only in UX documentation.
- Keep delivery status, package numbers, release counts and temporary sequencing out of governing architecture.
- Record deliberate architectural exceptions as ADRs.
- Treat external standards/classifications as versioned overlays/reference data.
- Keep **Career ≠ Organisation Role ≠ Project Role ≠ Permission** explicit.
- Require upward and downward traceability for every material capability.