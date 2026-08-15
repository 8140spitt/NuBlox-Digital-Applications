# NuBlox Database Package Documentation

This directory is the canonical home for implementation-level database package specifications.

Each numbered specification maps to the matching SQL package under `../schema/`.

| Package | Specification | SQL |
|---|---|---|
| 001 | `001-platform-kernel.md` | `../schema/001-platform-kernel.sql` |
| 002 | `002-crm-parties.md` | `../schema/002-crm-parties.sql` |
| 003 | `003-sales-estimates-quotations.md` | `../schema/003-sales-quotes.sql` |
| 004 | `004-contracts-finance.md` | `../schema/004-contracts-finance.sql` |
| 005 | `005-procurement.md` | `../schema/005-procurement.sql` |
| 006 | `006-workforce-time-scheduling.md` | `../schema/006-workforce-time-scheduling.sql` |
| 007 | `007-project-information-documents.md` | `../schema/007-project-information-documents.sql`, then `../schema/007-project-information-integrity.sql` |
| 008 | `008-site-quality-safety.md` | `../schema/008-site-quality-safety.sql`, then `../schema/008-site-quality-safety-integrity.sql` |
| 009 | `009-commercial-cost-control.md` | `../schema/009-commercial-cost-control.sql` |
| 010 | `010-assets-maintenance.md` | `../schema/010-assets-maintenance.sql` |

The headings inside the specifications retain their original handoff-document numbers (21-30) for traceability. The **package number** is the filename prefix in this directory.

Package 007 contains two ordered SQL stages because the second stage records integrity hardening discovered during design validation. Both files are one logical Package 007. When the production migration framework is selected, the development team may consolidate them into one migration if that framework and review process make doing so safe.

Package 008 follows the same pattern. Its integrity stage hardens worker/attendance identity, inspection-response linkage, published template evidence, delivery quantities, RAMS approval context and cross-organisation completion attribution. Both SQL files are one logical Package 008.

Package 009 is one SQL stage. It keeps budget/forecast/variation records distinct from procurement, workforce and finance source facts and uses explicit cost/value allocation tables rather than a duplicate project ledger.

Package 010 is one SQL stage. It establishes long-lived facilities and asset registers, project-to-facility links, physical hierarchy, handover, planned/reactive maintenance, service history and versioned operational compliance without duplicating document, labour, procurement or inspection source facts.

The planned **001–010 implementation-level domain baseline is complete**. The next database activity is executable full-chain validation and migration-tool adoption before any production migration baseline is frozen.
