# NuBlox Enterprise Function Taxonomy

**Status:** Architecture working dataset  
**Purpose:** provide a machine-readable enterprise operating-model taxonomy beneath the governing world-class native ERP architecture in `docs/57-world-class-native-erp-architecture.md`.

## Structure

The taxonomy uses the hierarchy:

**L1 Function → L2 Sub-function → L3 Activity → future L4 Task / Procedure**

The current dataset contains:

- 29 enterprise functions;
- 353 sub-functions;
- 1,510 source activities;
- an 18-stage generic enterprise activity lifecycle.

## Repository source files

The complete taxonomy is intentionally split into diffable JSON shards:

- `taxonomy-f01-f08.json`
- `taxonomy-f09-f15.json`
- `taxonomy-f16-f22.json`
- `taxonomy-f23-f29.json`
- `lifecycle-stages.json`

Together the four taxonomy shards contain every F01-F29 function, its sub-functions and its source activity list. The lifecycle file provides the normalized enterprise action lifecycle used when activities are later classified for workflow design.

Spreadsheet/CSV exports are derived review artefacts rather than the canonical Git source. This avoids making a binary workbook the architecture source of truth while preserving a clean path to regenerate human-review outputs.

## Planned mapping layer

The taxonomy is designed to support deliberate mapping of each activity to:

- inputs and outputs;
- roles and responsibilities;
- NuBlox native capabilities;
- canonical data objects;
- policies and controls;
- risks;
- KPIs and measurable outcomes;
- workflow states and permissions;
- audit evidence.

Those mappings are not inferred automatically from the source catalogue. They must be governed additions so NuBlox does not create unsupported relationships simply to fill a matrix.

## Architectural role

This taxonomy complements, rather than replaces, the 19 ERP capability domains in `docs/57-world-class-native-erp-architecture.md`.

The ERP domains answer **what native capability NuBlox must own**. This taxonomy answers **what work an enterprise performs**. The next architecture layer maps enterprise activities to NuBlox capabilities, canonical data objects, permissions, controls, workflows, roles and measurable outcomes.

The cross-industry taxonomy must also be extended with construction and built-environment-specific value-chain processes; those sector processes remain first-class NuBlox requirements.
