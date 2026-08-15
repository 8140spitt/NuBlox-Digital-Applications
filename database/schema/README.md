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
009-commercial-cost-control.sql
010-assets-maintenance.sql
```

The two `007-...` files are **one logical Package 007** and are applied in the order shown. The integrity stage contains the review-assignment, shared-site and transmittal-recipient hardening discovered during Package 007 validation.

The two `008-...` files are **one logical Package 008** and are applied in the order shown. The integrity stage hardens worker/attendance linkage, inspection-response integrity, published template evidence, delivery quantities, RAMS approval context and cross-organisation action completion attribution.

Package `009-commercial-cost-control.sql` is one logical SQL stage. It strengthens the two prerequisite tenant-safe source keys required by commercial allocation FKs before creating cost-code, budget, variation, valuation and forecast structures.

Package `010-assets-maintenance.sql` is one logical SQL stage. It creates the facilities/buildings/spaces/systems/assets hierarchy, handover evidence, maintenance requests/plans/work orders, asset service history and operational compliance structures while reusing source domains for documents, workers, procurement and inspections.

The former `001a` no-op checkpoint has been removed. Integrity stages are named with the same package number rather than presented as separate `a` packages.

## Baseline validation

The planned **001–010 schema-domain baseline is complete and validated on MySQL 8.4.11** using `../validation/validate-baseline.sh` and the repository GitHub Actions workflow.

Two independent clean builds of the complete ordered chain each produced:

- **337 base tables**
- **739 foreign keys**
- **427 `CHECK` constraints**
- InnoDB throughout
- `utf8mb4_0900_ai_ci` throughout
- a primary key on every base table

Keep the clean-build validation running on every future schema change. Before production release, adopt the validated chain into the selected migration/query system and add tenant-isolation plus lifecycle/invariant integration tests.

See `../docs/README.md` for the package specifications and `../validation/README.md` for validation gates and results.
