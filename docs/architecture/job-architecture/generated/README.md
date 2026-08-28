# Generated Job Architecture Artifacts

This directory is populated by:

```bash
node scripts/generate-job-architecture.mjs
```

The generator reads the four canonical enterprise taxonomy shards and writes:

- `job-families.generated.json`
- `functional-roles.generated.json`
- `job-profiles.generated.json`
- `coverage.generated.json`
- `job-descriptions.generated.md`

Expected source coverage from the current taxonomy baseline:

- 29 job families;
- 353 candidate functional roles;
- 382 candidate job profiles (353 specialist profiles + 29 function-lead profiles);
- all 353 source sub-functions represented;
- all 1,510 source activities inherited into role responsibility evidence.

Generation v2 applies an explicit enterprise-function skill baseline first, then only permits heuristic skill augmentation from rules scoped to the relevant function. This prevents cross-function leakage from incidental substrings or generic activity language. The generator also contains regression assertions for previously observed leakage cases and writes deterministic coverage metadata so CI can regenerate these files and fail on drift.

Generated records are intentionally marked `candidate`. Curated canonical jobs should be reviewed for market-facing title, role composition, level, qualifications, professional standards and career mappings before promotion to `approved`.
