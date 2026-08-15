# NuBlox SQL Schema Packages

Apply schema packages in numeric order.

```text
001-platform-kernel.sql
002-crm-parties.sql
003-sales-quotes.sql
004-contracts-finance.sql
005-procurement.sql
006-workforce-time-scheduling.sql
007-project-information-documents.sql
007-project-information-integrity.sql
008-site-quality-safety.sql
008-site-quality-safety-integrity.sql
```

The two `007-...` files are **one logical Package 007** and are applied in the order shown. The integrity stage contains the review-assignment, shared-site and transmittal-recipient hardening discovered during Package 007 validation.

The two `008-...` files are **one logical Package 008** and are applied in the order shown. The integrity stage hardens worker/attendance linkage, inspection-response integrity, published template evidence, delivery quantities, RAMS approval context and cross-organisation action completion attribution.

The former `001a` no-op checkpoint has been removed. Integrity stages are named with the same package number rather than presented as separate `a` packages.

Planned next packages:

```text
009-commercial-cost-control.sql
010-assets-maintenance.sql
```

See `../docs/README.md` for the package specifications.
