# Data Model

**Status:** Compatibility reference  
**Canonical foundations:**

- [`architecture/bottom-up/layer-0-primitives-and-invariants.md`](architecture/bottom-up/layer-0-primitives-and-invariants.md)
- [`architecture/bottom-up/layer-1-canonical-records.md`](architecture/bottom-up/layer-1-canonical-records.md)

Committed MySQL migrations in [`../database/migrations/`](../database/migrations/) are the implemented relational-schema authority.

The governing modelling rules are relational-first, 3NF by default, explicit relationships, fixed-precision money, explicit tenant ownership, immutable/additively corrected historical facts, and deliberate rather than accidental duplication.

This compatibility path is retained because older requirements and ADRs reference it. New schema design must be derived from Layers 0–1 and the owning domain service rather than from a speculative list of tables in this document.