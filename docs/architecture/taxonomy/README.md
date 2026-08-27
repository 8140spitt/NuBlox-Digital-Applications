# NuBlox Enterprise Function Taxonomy

**Status:** Architecture working dataset  
**Purpose:** provide a machine-readable catalogue of work enterprises perform and map it into the bottom-up NuBlox architecture.

## Structure

**L1 Function → L2 Sub-function → L3 Activity → future L4 Task / Procedure**

Current dataset:

- 29 enterprise functions;
- 353 sub-functions;
- 1,510 source activities;
- an 18-stage generic enterprise activity lifecycle.

Canonical shards:

- `taxonomy-f01-f08.json`
- `taxonomy-f09-f15.json`
- `taxonomy-f16-f22.json`
- `taxonomy-f23-f29.json`
- `lifecycle-stages.json`

## Bottom-up role

The taxonomy sits **above business processes but beside, not inside, the capability taxonomy**.

It answers **what work an enterprise performs**. The 19 native capability domains answer **what NuBlox capability owns/supports that work**. Construction lifecycle, careers, organisation roles, project roles and permissions are separate dimensions.

Mappings from an enterprise activity should ultimately identify:

- canonical input/output records (Layer 1);
- permissions/control roles (Layer 2);
- lifecycle/work/evidence rules (Layer 3);
- owning domain service(s) (Layer 4);
- end-to-end process (Layer 5);
- NuBlox capability domains (Layer 6);
- Construction & Built Environment overlays (Layer 7);
- relevant workspaces (Layer 8);
- measurable outcomes/tests (Layer 9).

Those mappings must be governed additions. They must not be inferred simply to fill a matrix.

## World-Class rebaseline relationship

The taxonomy is a **coverage and operating-model catalogue, not the product delivery backlog**.

The governing product rebaseline in [`../../world-class/README.md`](../../world-class/README.md) uses enterprise value streams and reference journeys to sequence delivery. A taxonomy activity becomes a prioritised product requirement only when it maps to a material customer outcome, canonical records, native capability ownership and an end-to-end process.

This prevents NuBlox from confusing broad enterprise coverage with the order in which coherent product outcomes should be engineered.

The governing distinction is:

**Enterprise Function ≠ Capability Domain ≠ Value Stream ≠ Lifecycle Stage ≠ Workspace**

See [`../../world-class/02-enterprise-operating-model.md`](../../world-class/02-enterprise-operating-model.md).

See [`../bottom-up/README.md`](../bottom-up/README.md).
