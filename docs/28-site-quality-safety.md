# 28 — Site Operations, Quality and Safety

The canonical Package 008 specification has moved to:

- [`database/docs/008-site-quality-safety.md`](../database/docs/008-site-quality-safety.md)

Executable SQL is under `database/schema/` and is applied as one logical Package 008 in this order:

1. `008-site-quality-safety.sql`
2. `008-site-quality-safety-integrity.sql`
