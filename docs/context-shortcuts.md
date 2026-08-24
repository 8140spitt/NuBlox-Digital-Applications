# NuBlox personal context shortcuts

## Purpose

NuBlox context shortcuts provide a personal, governed way to move quickly between the canonical records a member works with most often without creating duplicate business masters.

The first supported context kinds are:

- organisation;
- project;
- property/facility;
- asset.

A facility is the current canonical NuBlox property/estate context. This slice deliberately does not introduce a separate property master that would duplicate the facilities domain.

## Persistence model

`member_context_preferences` stores only personal navigation metadata:

- active organisation and member;
- context kind;
- canonical record public ID;
- favourite flag;
- pinned flag;
- last-opened timestamp.

Names, references, statuses and destinations are never copied into the preference table. They are resolved live from canonical domain records.

Pinned implies favourite. The database enforces that invariant.

## Authority model

Context preferences do not grant access to a record.

Every read and every preference mutation resolves the target again through the actor's active tenant/member scope and effective permissions:

| Context | Canonical source | Authority gate |
| --- | --- | --- |
| Organisation | `organisations` | active tenant membership |
| Project | `projects` + project participation/member scope | `project.view` |
| Property / facility | `facilities` | `facilities.view` |
| Asset | `assets` | `assets.view` |

If permission or membership is removed, an existing preference row remains harmless personal metadata and is omitted from the context centre until the actor can resolve that canonical record again.

## UX contract

`/contexts` presents three personal shortcut views:

1. pinned contexts;
2. favourites;
3. recent contexts.

It also presents all currently authorised contexts so a member can add or remove favourite/pinned state.

Opening a context goes through `/contexts/open`, which revalidates access, records `last_opened_at`, then redirects to the canonical workspace destination. Projects deep-link to their project workspace; facilities and assets retain their public ID in the `/assets` URL and open the relevant register section.

The context centre is exposed from the More workspace alongside enterprise search. A later shell refinement can render `ContextShortcutService.listShortcuts()` directly in the top bar once the interaction pattern has enough production evidence.

## Extension boundary

New context kinds should be added only when a canonical record and server-authoritative access rule already exist. The preference table should continue to store identity and personal navigation metadata only; it must not become a shadow search index, cache of record names, or alternative source of truth.
