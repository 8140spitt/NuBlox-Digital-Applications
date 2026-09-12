# NuBlox Network — External Access Kernel Implementation

**Status:** implementation evidence  
**Date:** 12 September 2026  
**Governing architecture:** `docs/architecture/external-access-network.md`

## Delivered foundation

This slice turns the governing NuBlox Network architecture into an executable platform boundary.

- `external_access_invitations` provides generic external transaction invitations.
- `external_access_grants` provides explicit, deny-by-default access for an authenticated identity.
- `external_work_items` provides the cross-domain external action inbox.
- `external_delivery_messages` provides durable invitation delivery state and idempotency.
- typed link tables preserve domain referential integrity instead of putting internal sequential IDs into public tokens.
- existing active person-level project collaborations are backfilled into explicit `project.view` grants without creating tenant membership.

## First domain adapter — Procurement RFQ

The first live domain adapter is supplier RFQ response.

Internal user flow:

1. procurement user issues an RFQ to an eligible supplier from the Purchasing workflow;
2. the authoritative RFQ version is issued once and may invite multiple suppliers;
3. each supplier receives its own `rfq_invitations` row plus a generic Network invitation;
4. an email delivery message is committed in the same database transaction;
5. delivery is attempted after commit and its result remains durable.

External user flow:

1. supplier opens `/network/invite/<opaque-token>`;
2. token proves invitation possession only and is stored as SHA-256, not plaintext;
3. new users create and verify a personal NuBlox identity without becoming a tenant member;
4. existing users accept using the invited verified email;
5. acceptance creates an explicit `procurement.rfq.respond` grant and `submit_quote` work item;
6. `/portal` presents the work item in the NuBlox Network inbox;
7. the supplier quotation page validates every RFQ line and persists canonical `supplier_returns` / `supplier_return_items` records transactionally;
8. the work item and RFQ invitation complete in the same transaction and external audit evidence is appended.

## Security invariants implemented

- No external identity receives owner-tenant organisation membership.
- Invitation email is used for bootstrap validation; post-acceptance authorisation uses auth identity plus explicit grant.
- External work cannot be opened or mutated by guessing another work-item UUID.
- RFQ submission rechecks domain state, RFQ deadline and exact line coverage server-side.
- Grant revocation/validity is evaluated on every Network inbox and RFQ request.
- Sensitive public routes contain public UUIDs/opaque invitation tokens only.
- Audit records distinguish external authenticated actors from internal organisation members.
- Delivery is not represented by `channel='portal'` alone; a durable message row exists with attempt and failure state.

## Compatibility

The existing project-external-collaboration boundary remains valid. NuBlox Network now aggregates those shared projects with generic external work items. Existing tenant-member RFI, submittal and instruction collaboration actions remain operational while future slices migrate those actions to the common kernel.

## Next adapters after this slice

1. external project RFI/submittal/instruction actions;
2. customer quotation review and acceptance;
3. finance invoice/statement/dispute interactions;
4. field service, quality, HSE and facilities work.

No workflow may be marked Network-complete until invitation/access, explicit grants, external action execution, audit and cross-identity denial are proven end to end.
