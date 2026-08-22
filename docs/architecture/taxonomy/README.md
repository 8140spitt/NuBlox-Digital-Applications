# NuBlox Enterprise Function Taxonomy

**Status:** Architecture working dataset  
**Purpose:** provide the machine-readable enterprise operating-model taxonomy beneath [`docs/construction-and-built-environment.md`](../../construction-and-built-environment.md).

## Structure

The taxonomy uses the hierarchy:

**L1 Function → L2 Sub-function → L3 Activity → future L4 Task / Procedure**

The current dataset contains:

- 29 enterprise functions;
- 353 sub-functions;
- 1,510 source activities;
- an 18-stage generic enterprise activity lifecycle.

## Repository source files

The complete taxonomy is split into diffable JSON shards:

- `taxonomy-f01-f08.json`
- `taxonomy-f09-f15.json`
- `taxonomy-f16-f22.json`
- `taxonomy-f23-f29.json`
- `lifecycle-stages.json`

Together the four taxonomy shards contain every F01–F29 function, its sub-functions and its source activity list. The lifecycle file provides the normalised enterprise action lifecycle used when activities are classified for workflow design.

Spreadsheet/CSV exports are derived review artefacts rather than the canonical Git source.

## Governing distinction

This taxonomy answers **what work an enterprise performs**.

[`construction-and-built-environment.md`](../../construction-and-built-environment.md) answers **what Construction and Built Environment capability NuBlox must own, the canonical sector concepts it must model, and how those capabilities work across the asset lifecycle**.

The 29 enterprise functions and the 19 NuBlox capability domains are therefore orthogonal taxonomies. They must not be forced into a one-to-one mapping.

## Mapping layer

Each enterprise activity may be deliberately mapped to:

- Construction and Built Environment lifecycle stage;
- one or more of the 19 NuBlox native capability domains;
- inputs and outputs;
- canonical data objects;
- organisation/project roles and responsibilities;
- granular permissions;
- Work Kernel execution patterns;
- policies and controls;
- risks and compliance obligations;
- audit evidence;
- KPIs and measurable outcomes.

Those mappings must be governed additions. NuBlox must not invent unsupported relationships simply to fill a matrix.

## Sector extension rule

The generic enterprise taxonomy is not sufficient on its own. Construction and built-environment processes — including design/information management, estimating, project controls, commercial management, site production, temporary works, QHSE, commissioning, handover, asset management, facilities and whole-life operation — remain first-class requirements under the governing sector model.