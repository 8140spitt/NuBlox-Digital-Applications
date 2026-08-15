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

The headings inside the specifications retain their original handoff-document numbers (21-27) for traceability. The **package number** is the filename prefix in this directory.

Package 007 contains two ordered SQL stages because the second stage records integrity hardening discovered during design validation. Both files are one logical Package 007. When the production migration framework is selected, the development team may consolidate them into one migration if that framework and review process make doing so safe.

Planned next packages:

- 008 — Site Operations, Quality and Safety
- 009 — Commercial Cost Control
- 010 — Assets and Maintenance
