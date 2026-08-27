# NuBlox Documentation

NuBlox documentation is organised around a **World-Class product authority plus bottom-up engineering architecture**. Permanent documentation describes enduring product outcomes, primitives, records, invariants, controls, services, processes, capability and sector composition. Delivery history belongs in Git commits, pull requests and issues.

## Product invariant

**NuBlox: Digital Applications for the Construction and the Built Environment is one complete application suite.**

Customers do not assemble it by selecting ERP, PLM, PDM, BIM, CDE, PMIS, HCM, SCM, EAM, CMMS, IWMS or other core modules. Those labels are coverage benchmarks. Relevant capability is native and included; the application adapts what users see through context, permissions and configuration.

See [`architecture/bottom-up/platform-coverage-contract.md`](architecture/bottom-up/platform-coverage-contract.md).

## Start here

Use these four entry points and ignore older sequencing documents unless you are researching history:

1. **[`world-class/README.md`](world-class/README.md)** — governing product strategy, operating model, value streams, reference journeys, maturity baseline and delivery governance.
2. **[`architecture/bottom-up/README.md`](architecture/bottom-up/README.md)** — governing engineering architecture method and reading order.
3. **[`architecture/bottom-up/platform-coverage-contract.md`](architecture/bottom-up/platform-coverage-contract.md)** — target-state complete-product coverage contract.
4. **[`architecture/taxonomy/README.md`](architecture/taxonomy/README.md)** — enterprise-function completeness catalogue; not a feature backlog.

The bottom-up architecture is constructed in this sequence:

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
2. **World-Class product suite** in [`world-class/`](world-class/) governs product North Star, enterprise operating model, value streams, Built Environment specialisation, digital thread, experience standard, reference journeys, implementation maturity and delivery governance.
3. **Bottom-up architecture** in [`architecture/bottom-up/`](architecture/bottom-up/) governs architectural semantics and design method.
4. **Complete platform coverage contract** in [`architecture/bottom-up/platform-coverage-contract.md`](architecture/bottom-up/platform-coverage-contract.md) governs the target-state one-product ERP/PLM/PDM/CDE/EAM/etc. breadth requirement; it is not an implementation-completeness claim.
5. **[`construction-and-built-environment.md`](construction-and-built-environment.md)** governs the Construction & Built Environment sector/lifecycle overlay (Layer 7).
6. **Security/privacy requirements** in [`11-security-privacy-compliance.md`](11-security-privacy-compliance.md) supplement the Layer 2 trust model.
7. **ADRs** in [`adr/`](adr/) record accepted technical decisions and explicit exceptions.
8. **Enterprise taxonomy** in [`architecture/taxonomy/`](architecture/taxonomy/) catalogues work enterprises perform; it is mapped to, not substituted for, capability domains or delivery sequencing.
9. **Database package docs** in [`../database/docs/`](../database/docs/) explain implementation intent; migrations win if implementation has advanced.
10. **Older product/functional requirement documents** remain reference material where they do not conflict with the authorities above; they do not independently govern post-rebaseline sequencing.

## Governing product set

- [`world-class/README.md`](world-class/README.md) — World-Class product authority and reading order.
- [`world-class/01-product-north-star.md`](world-class/01-product-north-star.md) — enterprise operating-system proposition.
- [`world-class/02-enterprise-operating-model.md`](world-class/02-enterprise-operating-model.md) — enterprise functions, native domains, value streams and workspaces.
- [`world-class/03-enterprise-value-streams.md`](world-class/03-enterprise-value-streams.md) — nine end-to-end value streams.
- [`world-class/04-built-environment-specialisation.md`](world-class/04-built-environment-specialisation.md) — dual enterprise/sector depth standard.
- [`world-class/05-digital-thread.md`](world-class/05-digital-thread.md) — governed enterprise/project/asset continuity.
- [`world-class/06-world-class-experience.md`](world-class/06-world-class-experience.md) — experience standard.
- [`world-class/07-world-class-baseline.md`](world-class/07-world-class-baseline.md) — evidence-led current-state baseline.
- [`world-class/08-reference-journeys.md`](world-class/08-reference-journeys.md) — three golden product journeys.
- [`world-class/09-delivery-governance.md`](world-class/09-delivery-governance.md) — scorecard and definition of done.
- [`world-class/10-capability-control-matrix.md`](world-class/10-capability-control-matrix.md) — implementation maturity/evidence control matrix.
- [`world-class/11-sap-benchmark-coverage.md`](world-class/11-sap-benchmark-coverage.md) — SAP benchmark interpretation; benchmark, not architecture.

## Governing architecture set

- [`architecture/bottom-up/README.md`](architecture/bottom-up/README.md) — architecture method and layer index.
- [`architecture/bottom-up/layer-0-primitives-and-invariants.md`](architecture/bottom-up/layer-0-primitives-and-invariants.md)
- [`architecture/bottom-up/layer-1-canonical-records.md`](architecture/bottom-up/layer-1-canonical-records.md)
- [`architecture/bottom-up/layer-2-trust-tenancy-authorisation.md`](architecture/bottom-up/layer-2-trust-tenancy-authorisation.md)
- [`architecture/bottom-up/layer-3-state-work-events-evidence.md`](architecture/bottom-up/layer-3-state-work-events-evidence.md)
- [`architecture/bottom-up/layer-4-domain-services-boundaries.md`](architecture/bottom-up/layer-4-domain-services-boundaries.md)
- [`architecture/bottom-up/layer-5-business-processes.md`](architecture/bottom-up/layer-5-business-processes.md)
- [`architecture/bottom-up/layer-6-capability-domains.md`](architecture/bottom-up/layer-6-capability-domains.md)
- [`architecture/bottom-up/platform-coverage-contract.md`](architecture/bottom-up/platform-coverage-contract.md) — one-product world-class software-category coverage.
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

## Reference requirements and controls

These remain useful source/reference material but do not override the World-Class product suite or bottom-up architecture:

- [`00-executive-summary.md`](00-executive-summary.md)
- [`01-product-requirements-document.md`](01-product-requirements-document.md)
- [`02-functional-requirements.md`](02-functional-requirements.md)
- [`10-non-functional-requirements.md`](10-non-functional-requirements.md)
- [`11-security-privacy-compliance.md`](11-security-privacy-compliance.md)
- [`12-devops-environments-testing.md`](12-devops-environments-testing.md)
- [`19-risks-and-dependencies.md`](19-risks-and-dependencies.md)
- [`16-glossary.md`](16-glossary.md)

## Compatibility and historical noise

Legacy numbered paths such as `05`, `06`, `07`, `09`, `20` and `57` are retained only where older references benefit from compatibility. They are **not independent architecture authorities** and should not receive new product design or delivery sequencing.

Superseded delivery plans, feature-slice sequencing and closed PR branches belong to Git history rather than the active product compass. Do not revive them merely because they still exist in history or as a remote branch.

## Documentation rules

- Design new capability from the World-Class outcome and Layer 0 upward before designing its screen.
- Treat NuBlox as one complete product; do not create market-category modules as parallel architecture.
- Reuse canonical records; do not create module-local copies of enterprise identities.
- Put material lifecycle and security rules in the lower layers, not only in UX documentation.
- Keep delivery status, package numbers, release counts and temporary sequencing out of governing architecture.
- Record deliberate architectural exceptions as ADRs.
- Treat external standards/classifications as versioned overlays/reference data.
- Keep **Career ≠ Organisation Role ≠ Project Role ≠ Permission** explicit.
- Require upward and downward traceability for every material capability.
- Treat a route, table or historical PR as evidence only; implementation maturity is governed by the World-Class baseline/control matrix and executable validation.
