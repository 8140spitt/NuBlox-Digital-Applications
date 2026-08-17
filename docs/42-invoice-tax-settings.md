# 42 — Invoice Tax Settings

## 1. Purpose

This hotfix closes the operational gap where invoice lines required a tenant tax category but a newly created organisation could have no tax categories to select.

The correction keeps the existing Package 003/004 tax model authoritative:

```text
Organisation
    ↓
Tax Category
    ↓
Effective-Dated Tax Rate
    ↓
Draft Invoice Line Tax Selection
    ↓
Issue-Time Rate Refresh
    ↓
Immutable Issued Tax Evidence
```

It does not introduce a second tax ledger or store mutable invoice totals.

## 2. Application surfaces

```text
/finance/tax
/finance/invoices/[invoicePublicId]
```

`/finance/tax` exposes organisation-owned tax categories and effective-dated rate history.

The invoice workspace exposes a direct Tax settings link and requires an explicit tax selection before a draft line can be added. A blank required selector is never treated as a usable configuration state.

## 3. Authority

Tax configuration reuses the existing finance boundary:

```text
finance.view             → view tax settings
finance.billing.manage   → create tax category / append effective rate
finance.invoice.draft.manage → add or remove invoice lines
```

No new permission key is introduced by this hotfix.

## 4. Starter UK catalogue

Existing organisations receive the starter catalogue through:

```text
database/migrations/20260817180500_default_uk_tax_categories.sql
```

Fresh/future organisations can self-provision the same starter catalogue through the server tax-default helper when invoice/tax settings are first used.

Starter categories:

```text
VAT_STANDARD   VAT standard rate   taxable       20.0000%
VAT_REDUCED    VAT reduced rate    taxable        5.0000%
VAT_ZERO       VAT zero rate       zero           0.0000%
VAT_EXEMPT     VAT exempt          exempt         no percentage rate
OUTSIDE_SCOPE  Outside scope       outside_scope  no percentage rate
```

The migration and runtime helper are idempotent. If a tenant already owns a matching category code, the category is preserved. If that category already has any rate history, the starter helper does not add or replace a rate.

This preserves tenant-owned configuration and avoids overlapping effective periods.

## 5. Effective dating

Percentage rates remain stored in `tax_category_rates`.

When a new rate is added through Tax settings:

1. the category is locked in the tenant transaction;
2. the new start must be later than the latest existing rate start;
3. an existing open-ended latest rate is closed on the calendar day before the new rate starts;
4. a new open-ended rate row is appended;
5. an audit event records the new rate and effective date.

Issued financial-document tax evidence is never rewritten by later rate changes.

## 6. Draft and issue behaviour

Invoice line creation requires an explicit `taxCategoryPublicId`.

Draft calculation uses the selected category/rate that is effective while the draft is being prepared. The resulting draft tax remains provisional.

At controlled invoice issue, NuBlox refreshes every invoice line tax against the rate effective at the actual issue date and stores the applied rate/taxable amount/tax amount with the issued financial-document evidence.

Therefore:

```text
Tax configuration changes
    ≠ mutation of already issued invoices
```

## 7. Treatment semantics

Supported database treatments remain:

```text
taxable
zero
exempt
outside_scope
```

`taxable` categories require a percentage rate.

`zero` categories use a 0% percentage rate.

`exempt` and `outside_scope` categories do not require a percentage-rate row.

## 8. Construction domestic reverse charge

The construction domestic reverse charge is deliberately **not** represented by the starter catalogue as an ordinary zero-rated category.

A dedicated future implementation must model the reverse-charge invoice treatment and required invoice presentation/evidence explicitly. Until that workflow exists, NuBlox must not claim domestic reverse-charge support merely because a 0% category exists.

## 9. Audit actions

The settings service emits:

```text
finance.tax_category.created
finance.tax_rate.created
```

These record tenant, actor/member, subject public ID, correlation ID and the configuration facts changed.

## 10. Validation

Dedicated real-MySQL coverage proves:

- a tenant with no tax setup receives the five starter categories;
- standard/reduced/zero rates resolve as 20% / 5% / 0%;
- delegated billing authority can create a custom category and append a later rate;
- appending a rate closes the previous open period without rewriting it;
- finance read access alone cannot mutate tax configuration;
- existing tenant-owned matching category/rate history is preserved.

The hotfix is data-only at the migration layer, so the validated structural schema remains:

```text
356 base tables
789 foreign keys
459 CHECK constraints
```
