# Enterprise Payment Terms Engine

## Purpose

NuBlox payment terms are governed commercial rules, not free-text invoice labels. The production authority remains the SQL migration stream. `payment_terms` continues to be the organisation-owned operational assignment boundary used by customer billing settings and invoices; the enterprise engine extends it through normalized support tables.

## Model

| Table | Purpose |
| --- | --- |
| `payment_term_templates` | Canonical NuBlox catalogue of standard commercial terms. |
| `payment_terms` | Organisation-owned operational terms already used by billing and invoices. |
| `payment_term_rules` | One-to-one extended execution metadata for an organisation payment term. |
| `payment_term_schedule_lines` | Percentage-based staged, milestone, deposit and retention schedules. |
| `payment_term_discounts` | Ordered early-payment / settlement discount rules. |

Stable commercial semantics remain relational. No payment-rule JSON/EAV structure is used.

## Canonical calculation bases

The engine recognizes:

- `invoice_date`
- `invoice_receipt_date`
- `order_date`
- `shipment_date`
- `delivery_date`
- `goods_receipt_date`
- `acceptance_date`
- `service_completion_date`
- `billing_period_start`
- `billing_period_end`
- `milestone_date`
- `completion_date`
- `end_of_month`
- `manual`

Every rule retains the simple public contract:

```json
{
  "name": "Net 30",
  "calculation_basis": "invoice_date",
  "days_offset": 30
}
```

Additional rule metadata controls calendar/business-day counting, month offsets, fixed payment days and business-day adjustment conventions.

## Date execution

`payment-term-engine.ts` executes a rule against explicit reference dates. It never substitutes a different event when the required reference date is absent. For example, a `goods_receipt_date` term requires an actual goods-receipt date; an invoice date is not silently treated as equivalent.

Supported date behavior includes:

1. calendar-day offsets;
2. business-day offsets;
3. invoice-month end;
4. following-month offsets;
5. fixed day of month with month-end clamping;
6. following, preceding and modified-following business-day conventions;
7. explicit manual due dates.

The default business calendar treats Monday-Friday as business days. Jurisdiction/organisation holiday calendars can be injected into the engine without changing term definitions.

## Staged payments

Schedule lines support deposits, milestone payments, progress payments, instalments and retention releases. Each line has its own percentage and date rule. Runtime validation requires:

- unique positive line numbers;
- each percentage greater than zero and no more than 100%;
- total schedule percentage = 100%;
- a valid calculation basis and date rule for every line.

Example:

```text
30% on order
70% on delivery
```

is represented as two relational schedule lines rather than text parsing.

## Early-payment discounts

Discount rules are separate from the contractual final due date. This supports terms such as `2/10 Net 30` without overloading the main `days_offset` field.

A discount records:

- sequence;
- discount percentage;
- eligibility calculation basis;
- eligibility days;
- calendar or business-day counting.

## Operational compatibility

The current accounts-receivable invoice lifecycle natively executes `invoice_date`, `end_of_month` and `manual` operational terms. The canonical catalogue contains a broader enterprise vocabulary, but only templates marked `is_invoice_compatible = 1` can be provisioned into the current invoice lifecycle from Billing Settings.

This guard is intentional: event-based terms such as goods receipt, delivery, acceptance or milestones must not be activated against invoices until the relevant governed event/date is available to the document lifecycle.

The full calculation engine already supports those bases for consumers that supply the required reference dates.

## Tenant provisioning

Billing Settings exposes the canonical catalogue and an idempotent **Install standard invoice terms** action. Provisioning:

1. requires `finance.billing.manage` (or the `finance.manage` umbrella);
2. locks the organisation during catalogue reconciliation;
3. creates only missing invoice-compatible terms;
4. does not overwrite an organisation's current default term;
5. records source-template metadata in `payment_term_rules`;
6. appends audit evidence for created terms and the catalogue reconciliation.

## Canonical catalogue

The migration seeds immediate, advance/order/shipment/delivery/acceptance/completion, Net 7-180, receipt-based, goods-receipt, delivery, acceptance, service-completion, EOM, following-month fixed-day, business-day, recurring, milestone, progress, retention and manual definitions.

The template table is the canonical machine-readable source for the requested `name`, `calculation_basis`, `days_offset` triplets.

## Safety invariants

- Existing organisation terms remain backward compatible.
- Existing invoice calculations are not silently reinterpreted.
- Missing event evidence causes calculation failure rather than fallback.
- Payment schedules must equal exactly 100% within numeric tolerance.
- Manual terms cannot carry hidden date offsets.
- Canonical templates are additive and idempotent.
- Released commercial records are not destructively rewritten by the migration down path.
