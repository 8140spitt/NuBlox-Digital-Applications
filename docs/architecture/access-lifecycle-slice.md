# Access lifecycle implementation slice

This slice adds synchronous, time-bounded organisation access without coupling security to NuBlox job/work architecture.

## Implemented

- role-assignment lifecycle metadata in `member_role_access_windows`;
- member permission-exception lifecycle metadata in `member_permission_override_access_windows`;
- half-open `[effective_from, expires_at)` evaluation semantics;
- deterministic permission evaluation at an explicit instant;
- lifecycle-aware Owner delegation;
- temporary permission-exception administration with UTC activation/expiry input;
- audit/outbox evidence carrying lifecycle bounds;
- integration coverage for activation, expiry, override precedence and Owner governance;
- database CHECK constraints for invalid temporal ranges.

## Compatibility

No lifecycle row means indefinite access, preserving existing assignments and permission exceptions. The lifecycle tables are dependent metadata and cascade when their parent assignment/override is removed.

## Boundary

Enterprise functions, functional roles, job profiles, careers, organisation positions and project business roles remain outside access-control assignment semantics.
