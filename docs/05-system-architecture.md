# System Architecture

**Status:** Compatibility reference  
**Canonical architecture:** [`architecture/bottom-up/README.md`](architecture/bottom-up/README.md)

NuBlox uses a modular monolith with explicit domain boundaries, MySQL/InnoDB as the transactional authority, SvelteKit for application delivery, Better Auth for authentication and Kysely/mysql2 for runtime SQL access.

The architecture is now governed **bottom up** rather than from modules/screens downward:

**primitives → canonical records → trust/permissions → state/work/events → domain services → business processes → capability domains → Construction & Built Environment overlays → workspaces → validation**.

Do not extend this compatibility document with new domain architecture. Add enduring architecture to the appropriate layer under [`architecture/bottom-up/`](architecture/bottom-up/) and record material technical choices as ADRs.