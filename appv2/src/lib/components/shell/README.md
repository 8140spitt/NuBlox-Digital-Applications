# NuBlox application shell

The protected internal application shell implements the governing UI/UX navigation contract for V2.

## Primary navigation

The shell exposes three stable navigation concepts only:

- **Work** — Home and My work.
- **Functions** — the enterprise-function directory and, as functions become live and authorised, canonical F-number/function-name workspaces.
- **Tools** — cross-functional utilities. During development the design-system laboratory is exposed here.

Project, customer, supplier, asset and similar business objects are contexts or function workspaces. They must not become arbitrary top-level navigation alongside Work, Functions and Tools.

## Context and identity

The shell presents the organisation trading name (with legal-name fallback supplied by the server access context). The tenant route slug is a technical routing identifier and must not be used as presentation copy.

Desktop layout uses a persistent navigation rail and context bar. Narrow layouts use a native `details`/`summary` navigation disclosure so navigation remains usable without custom JavaScript behaviour.

## Security boundary

Authentication, active tenant membership and organisation activation remain enforced by the protected server layout before the shell renders. Sign-out captures the canonical tenant-scoped sign-in destination before destroying the session.
