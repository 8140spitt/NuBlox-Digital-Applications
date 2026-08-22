# Authentication, Permissions and Multi-tenancy

**Status:** Governing security reference / compatibility path  
**Canonical trust model:** [`architecture/bottom-up/layer-2-trust-tenancy-authorisation.md`](architecture/bottom-up/layer-2-trust-tenancy-authorisation.md)

NuBlox authorisation is server-authoritative and combines authenticated identity, active organisation membership, explicit permission resolution, record/tenant scope, project scope where required, lifecycle policy, delegated authority and segregation of duties.

**Career ≠ Organisation Role ≠ Project Role ≠ Permission**

Permission precedence remains:

```text
explicit member deny
> explicit member allow
> active role grant
> default deny
```

A same-domain umbrella may resolve only an otherwise undecided granular key. Explicit granular deny wins. Umbrellas never cross domains.

Authentication alone is not tenant authority; public/internal IDs are not proof of access; project participation does not merge tenants.

Detailed capability-specific permission catalogues belong with the owning domain implementation/migrations/tests, not in this governing cross-domain document. Historical package-specific release counts and test snapshots have been removed from the architecture.