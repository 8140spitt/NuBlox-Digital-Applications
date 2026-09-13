# NuBlox UI components

This directory is the shared V2 design-system boundary.

Business-function routes should compose these components and semantic tokens before introducing local UI conventions.

## Rules

- Use semantic HTML first.
- Use semantic design tokens from `src/app.css`; do not hard-code product colours in function pages.
- Prefer business-neutral component names and behaviours.
- Keep validation, permissions, lifecycle rules and business invariants on the server/domain side.
- Use SvelteKit form actions for normal mutations and progressively enhance them with `use:enhance` where useful.
- Add a shared component when the same interaction pattern is likely to recur across functions.
- Do not add function-specific wrappers merely to restyle an existing shared primitive.
- Use `ReadinessChecklist` for governed transitions with prerequisites. It must explain what is ready, what remains blocked, and provide direct actions where the user can resolve a missing prerequisite. The server remains authoritative and must re-check the transition inside the transaction.

The protected `/{tenant}/app/design-system` route is the component laboratory and interaction reference.
