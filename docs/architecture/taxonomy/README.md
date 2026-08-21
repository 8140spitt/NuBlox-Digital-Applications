# NuBlox Enterprise Function Taxonomy

**Status:** Architecture working dataset  
**Purpose:** provide a machine-readable enterprise operating-model taxonomy beneath the governing world-class native ERP architecture in `docs/57-world-class-native-erp-architecture.md`.

## Structure

The taxonomy uses the hierarchy:

**L1 Function → L2 Sub-function → L3 Activity → future L4 Task / Procedure**

The current dataset contains:

- 29 enterprise functions;
- 353 sub-functions;
- 1,510 individually identified activities;
- an 18-stage generic enterprise activity lifecycle.

The activity dataset is structured to support future mapping of:

- inputs and outputs;
- roles and responsibilities;
- NuBlox systems/capabilities;
- canonical data objects;
- policies and controls;
- risks;
- KPIs;
- workflow and permission design.

Blank governance columns in the workbook/CSV are intentional: the source taxonomy proposes those fields but does not provide authoritative row-level mappings, so NuBlox must populate them deliberately rather than inventing relationships.

## Files

- `NuBlox_Enterprise_Function_Taxonomy.json` — machine-readable hierarchical source.
- `NuBlox_Enterprise_Function_Taxonomy_Activities.csv` — normalized activity-level dataset.
- `NuBlox_Enterprise_Function_Taxonomy.xlsx` — human review and analysis workbook.

## Architectural role

This taxonomy complements, rather than replaces, the 19 ERP capability domains in `docs/57-world-class-native-erp-architecture.md`.

The ERP domains answer **what native capability NuBlox must own**. This taxonomy answers **what work an enterprise performs**. The next architecture layer maps enterprise activities to NuBlox capabilities, canonical data objects, permissions, controls, workflows, roles and measurable outcomes.

The cross-industry taxonomy must also be extended with construction and built-environment-specific value-chain processes; those sector processes remain first-class NuBlox requirements.
