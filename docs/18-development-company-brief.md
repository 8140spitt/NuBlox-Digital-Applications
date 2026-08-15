# 18 — Development Company Brief

## Purpose of engagement

Design, build, test and deploy the first production-capable version of **NuBlox: Digital Applications**, a modular multi-tenant Built Environment Business Operating System.

This repository is the baseline requirements pack.

## Fixed technical constraints

- Svelte 5
- SvelteKit
- MySQL/InnoDB
- modular monolith initial architecture
- server-side authorisation
- multi-tenant from inception

Suppliers may recommend supporting technologies/providers but must explain trade-offs.

## Required response from supplier

Please return:

1. **Understanding of product**
2. **Scope interpretation**
3. **Assumptions**
4. **Explicit exclusions**
5. **Proposed architecture**
6. **Authentication/authorisation approach**
7. **MySQL/data-model approach**
8. **File/object-storage approach**
9. **Hosting/infrastructure proposal**
10. **Security approach**
11. **Testing strategy**
12. **Accessibility approach**
13. **DevOps/CI/CD**
14. **Team composition**
15. **Delivery stages/milestones**
16. **Estimate by phase/epic**
17. **Cost model**
18. **Third-party licence/service costs**
19. **Risks/dependencies**
20. **Support/maintenance model**
21. **Warranty/defect period**
22. **Source-code/IP ownership terms**
23. **Data ownership/export/exit terms**
24. **Documentation/training deliverables**
25. **Change-control process**

## Required technical deliverables

- source code;
- database migrations;
- automated tests;
- deployment/IaC/configuration artefacts;
- API documentation;
- architecture diagrams;
- threat model;
- data model/ERD;
- ADRs;
- operational runbook;
- backup/restore runbook;
- incident runbook;
- onboarding/admin guide;
- developer setup guide;
- release notes;
- dependency/licence inventory.

## Required quality gates

The supplier must demonstrate:

- tenant isolation;
- permission enforcement;
- successful restore test;
- critical journey E2E tests;
- accessibility testing;
- security testing;
- performance testing against agreed dataset/load;
- production monitoring;
- no critical/high unresolved security issue contrary to agreed release policy.

## Pilot acceptance

At minimum, the first architecture must convincingly support:

- Quantity Surveyor;
- Electrician;
- Facilities Manager.

It must be possible to add the remaining careers through capability composition/configuration rather than separate application forks.

## Estimation format requested

For each phase/epic provide:

| Field | Required |
|---|---|
| Deliverable | Yes |
| Dependencies | Yes |
| Assumptions | Yes |
| Team/roles | Yes |
| Effort | Yes |
| Calendar duration | Yes |
| Cost | Yes |
| Third-party costs | Yes |
| Risks | Yes |
| Acceptance criteria | Yes |

Do not return a single undifferentiated project estimate.

## Commercial questions

Supplier must state:

- who owns all bespoke source code;
- access to repositories and infrastructure;
- use of subcontractors;
- location of development/support team;
- data-processing role;
- subprocessors;
- professional/cyber insurance;
- security incident obligations;
- termination/transition assistance;
- vendor lock-in points.

## Discovery expectation

A short paid discovery phase is acceptable and recommended, but it must produce concrete artefacts and a revised fixed/controlled delivery baseline rather than indefinitely extending discovery.
