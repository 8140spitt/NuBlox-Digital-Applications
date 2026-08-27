-- NuBlox AP-to-accounting digital-thread integration
-- Makes approved supplier invoices and credit notes canonical accounting sources without duplicating AP records.
-- Posting remains controlled by finance.accounting.post and the existing accounting-period / immutable-journal engine.
-- migrate:up transaction:false

ALTER TABLE accounting_account_mappings
    DROP CHECK ck_accounting_account_mappings_key;

ALTER TABLE accounting_account_mappings
    ADD CONSTRAINT ck_accounting_account_mappings_key
        CHECK (mapping_key IN (
            'accounts_receivable',
            'sales_revenue',
            'vat_control',
            'cash_receipts',
            'customer_unapplied_cash',
            'bad_debt_expense',
            'bad_debt_recovery_income',
            'accounts_payable',
            'purchase_expense',
            'retained_earnings'
        ));

ALTER TABLE accounting_journal_entries
    DROP CHECK ck_accounting_journal_entries_source_type;

ALTER TABLE accounting_journal_entries
    ADD CONSTRAINT ck_accounting_journal_entries_source_type
        CHECK (source_type IN (
            'invoice_issue',
            'invoice_void',
            'credit_note_issue',
            'accounts_payable_invoice_approval',
            'accounts_payable_credit_note_approval',
            'payment_receipt',
            'payment_allocation',
            'payment_allocation_reversal',
            'payment_reversal',
            'bad_debt_write_off',
            'bad_debt_write_off_reversal',
            'bad_debt_recovery',
            'bad_debt_recovery_reversal',
            'vat_relief_posting',
            'vat_relief_posting_reversal',
            'journal_reversal',
            'year_end_close'
        ));

-- migrate:down transaction:false
-- Forward-only accounting source semantics; existing journals may reference these source types.
SELECT 1;
