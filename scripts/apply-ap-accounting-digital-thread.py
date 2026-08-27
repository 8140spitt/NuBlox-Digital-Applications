from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one replacement in {path}, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


def insert_before_once(path: str, marker: str, insertion: str) -> None:
    replace_once(path, marker, insertion + marker)


source_path = "app/src/lib/server/finance/accounting-source-service.ts"
replace_once(
    source_path,
    "\t'credit_note_issue',\n\t'payment_receipt',",
    "\t'credit_note_issue',\n\t'accounts_payable_invoice_approval',\n\t'accounts_payable_credit_note_approval',\n\t'payment_receipt',",
)
replace_once(
    source_path,
    "\t| 'bad_debt_recovery_income'\n\t| 'retained_earnings';",
    "\t| 'bad_debt_recovery_income'\n\t| 'accounts_payable'\n\t| 'purchase_expense'\n\t| 'retained_earnings';",
)

ap_candidate = r'''
async function accountsPayableDocumentCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'accounts_payable_invoice_approval' | 'accounts_payable_credit_note_approval',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('accounts_payable_documents')
		.select([
			'public_id as publicId',
			'document_type as documentType',
			'supplier_document_number as supplierDocumentNumber',
			'currency_code as currencyCode',
			'lifecycle_status as lifecycleStatus',
			'net_amount as netAmount',
			'tax_amount as taxAmount',
			'gross_amount as grossAmount',
			'approved_at as approvedAt'
		])
		.where('organisation_id', '=', organisationId)
		.where('public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const document = await query.executeTakeFirst();
	if (!document || document.lifecycleStatus !== 'approved' || !document.approvedAt) {
		throw new RecordNotFoundError('Approved supplier document source not found.');
	}
	if (
		(sourceType === 'accounts_payable_invoice_approval' && document.documentType !== 'invoice') ||
		(sourceType === 'accounts_payable_credit_note_approval' &&
			document.documentType !== 'credit_note')
	) {
		throw new RecordNotFoundError('Approved supplier document source not found.');
	}
	if (money(document.grossAmount) <= 0n) {
		throw new FinanceValidationError('Approved supplier document total must be positive to post.');
	}

	const number = document.supplierDocumentNumber || document.publicId;
	const reversePurchase = document.documentType === 'credit_note';
	const lines: AccountingCandidateLine[] = [];
	if (reversePurchase) {
		lines.push(
			line('accounts_payable', `${number} payable reduction`, 'debit', document.grossAmount)
		);
		if (money(document.netAmount) > 0n) {
			lines.push(
				line('purchase_expense', `${number} purchase cost reversal`, 'credit', document.netAmount)
			);
		}
		if (money(document.taxAmount) > 0n) {
			lines.push(line('vat_control', `${number} input VAT reversal`, 'credit', document.taxAmount));
		}
	} else {
		if (money(document.netAmount) > 0n) {
			lines.push(line('purchase_expense', `${number} purchase cost`, 'debit', document.netAmount));
		}
		if (money(document.taxAmount) > 0n) {
			lines.push(line('vat_control', `${number} input VAT`, 'debit', document.taxAmount));
		}
		lines.push(line('accounts_payable', `${number} trade payable`, 'credit', document.grossAmount));
	}

	return finish({
		sourceType,
		sourcePublicId: document.publicId,
		sourceLabel: `${reversePurchase ? 'Supplier credit note' : 'Supplier invoice'} ${number}`,
		sourceEventAt: document.approvedAt,
		currencyCode: document.currencyCode,
		sourceAmount: document.grossAmount,
		memo: `${reversePurchase ? 'Post approved supplier credit note' : 'Post approved supplier invoice'} ${number}`,
		lines
	});
}
'''
insert_before_once(source_path, "\nasync function paymentCandidate(", ap_candidate)
replace_once(
    source_path,
    "\t\tcase 'payment_receipt':\n\t\tcase 'payment_reversal':",
    "\t\tcase 'accounts_payable_invoice_approval':\n\t\tcase 'accounts_payable_credit_note_approval':\n\t\t\treturn accountsPayableDocumentCandidate(\n\t\t\t\tdb,\n\t\t\t\torganisationId,\n\t\t\t\tsourceType,\n\t\t\t\tsourcePublicId,\n\t\t\t\tforUpdate\n\t\t\t);\n\t\tcase 'payment_receipt':\n\t\tcase 'payment_reversal':",
)

ap_references = r'''
	const supplierDocuments = await db
		.selectFrom('accounts_payable_documents')
		.select([
			'public_id as publicId',
			'document_type as documentType',
			'approved_at as approvedAt'
		])
		.where('organisation_id', '=', organisationId)
		.where('lifecycle_status', '=', 'approved')
		.where('approved_at', 'is not', null)
		.orderBy('approved_at', 'desc')
		.limit(100)
		.execute();
	for (const document of supplierDocuments) {
		references.push({
			sourceType:
				document.documentType === 'credit_note'
					? 'accounts_payable_credit_note_approval'
					: 'accounts_payable_invoice_approval',
			sourcePublicId: document.publicId
		});
	}
'''
insert_before_once(source_path, "\n\tconst payments = await db", ap_references)

accounting_path = "app/src/lib/server/finance/accounting-service.ts"
replace_once(
    accounting_path,
    "\t'bad_debt_recovery_income',\n\t'retained_earnings'",
    "\t'bad_debt_recovery_income',\n\t'accounts_payable',\n\t'purchase_expense',\n\t'retained_earnings'",
)
replace_once(
    accounting_path,
    "\tbad_debt_recovery_income: 'revenue',\n\tretained_earnings: 'equity'",
    "\tbad_debt_recovery_income: 'revenue',\n\taccounts_payable: 'liability',\n\tpurchase_expense: 'expense',\n\tretained_earnings: 'equity'",
)

ui_path = "app/src/routes/(app)/finance/accounting/+page.svelte"
replace_once(
    ui_path,
    "\t\tbad_debt_recovery_income: 'Bad-debt recovery income'\n\t};",
    "\t\tbad_debt_recovery_income: 'Bad-debt recovery income',\n\t\taccounts_payable: 'Accounts payable',\n\t\tpurchase_expense: 'Purchase expense'\n\t};",
)
replace_once(
    ui_path,
    "Journal debit/credit roles and amounts are derived from operational finance events.",
    "Journal debit/credit roles and amounts are derived from operational finance events, including approved supplier documents.",
)

ap_test_path = "app/src/lib/server/finance/accounts-payable.integration.test.ts"
replace_once(
    ap_test_path,
    "import { AccountsPayableRepository } from './accounts-payable-repository';\nimport { AccountsPayableService } from './accounts-payable-service';",
    "import { AccountingPeriodService } from './accounting-period-service';\nimport { AccountingService } from './accounting-service';\nimport { AccountsPayableRepository } from './accounts-payable-repository';\nimport { AccountsPayableService } from './accounts-payable-service';",
)
replace_once(
    ap_test_path,
    "\t\t'project.manage',\n\t\t...PROCUREMENT_PERMISSIONS,",
    "\t\t'project.manage',\n\t\t'finance.view',\n\t\t'finance.manage',\n\t\t...PROCUREMENT_PERMISSIONS,",
)

accounting_setup = r'''
	const accounting = new AccountingService(db);
	for (const accountDefinition of [
		{
			mappingKey: 'accounts_payable',
			accountCode: 'AP-2100',
			name: 'Trade payables',
			accountType: 'liability'
		},
		{
			mappingKey: 'purchase_expense',
			accountCode: 'PUR-5000',
			name: 'Purchase and project cost',
			accountType: 'expense'
		},
		{
			mappingKey: 'vat_control',
			accountCode: 'VAT-2200',
			name: 'VAT control',
			accountType: 'liability'
		}
	] as const) {
		const account = await accounting.createAccount(actorMaker, {
			accountCode: accountDefinition.accountCode,
			name: accountDefinition.name,
			accountType: accountDefinition.accountType
		});
		await accounting.assignMapping(actorMaker, {
			mappingKey: accountDefinition.mappingKey,
			accountPublicId: account.publicId,
			reason: 'AP accounting digital-thread integration test mapping.'
		});
	}
	const periodService = new AccountingPeriodService(db);
	const year = await periodService.createFinancialYear(actorMaker, {
		yearCode: 'AP-FY26',
		name: 'AP integration financial year',
		startsOn: '2026-01-01',
		endsOn: '2026-12-31'
	});
	await periodService.createPeriod(actorMaker, {
		financialYearPublicId: year.publicId,
		periodNumber: 8,
		name: 'August 2026',
		startsOn: '2026-08-01',
		endsOn: '2026-08-31'
	});
'''
insert_before_once(
    ap_test_path,
    "\n\tconst project = await new ProjectWorkspaceService(db).createProject(actorMaker, {",
    accounting_setup,
)

posting_assertion = r'''

		const accounting = new AccountingService(db);
		const accountingWorkspace = await accounting.getWorkspace(actorMaker);
		const accountingCandidate = accountingWorkspace.candidates.find(
			(candidate) =>
				candidate.sourceType === 'accounts_payable_invoice_approval' &&
				candidate.sourcePublicId === documentPublicId
		);
		expect(accountingCandidate).toMatchObject({
			sourceAmount: '500.0000',
			missingMappings: []
		});
		expect(accountingCandidate?.lines).toEqual([
			expect.objectContaining({
				mappingKey: 'purchase_expense',
				debitAmount: '500.0000',
				creditAmount: '0.0000'
			}),
			expect.objectContaining({
				mappingKey: 'accounts_payable',
				debitAmount: '0.0000',
				creditAmount: '500.0000'
			})
		]);
		const posted = await accounting.postSource(actorMaker, {
			sourceType: 'accounts_payable_invoice_approval',
			sourcePublicId: documentPublicId
		});
		const journal = await db
			.selectFrom('accounting_journal_entries')
			.select(['id', 'source_type as sourceType', 'source_public_id as sourcePublicId'])
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', posted.publicId)
			.executeTakeFirstOrThrow();
		expect(journal).toMatchObject({
			sourceType: 'accounts_payable_invoice_approval',
			sourcePublicId: documentPublicId
		});
		const journalLines = await db
			.selectFrom('accounting_journal_lines as line')
			.innerJoin('accounting_accounts as account', (join) =>
				join
					.onRef('account.id', '=', 'line.accounting_account_id')
					.onRef('account.organisation_id', '=', 'line.organisation_id')
			)
			.select([
				'account.account_code as accountCode',
				'line.debit_amount as debitAmount',
				'line.credit_amount as creditAmount'
			])
			.where('line.organisation_id', '=', organisationAId)
			.where('line.journal_entry_id', '=', journal.id)
			.orderBy('line.line_number')
			.execute();
		expect(journalLines).toEqual([
			{ accountCode: 'PUR-5000', debitAmount: '500.0000', creditAmount: '0.0000' },
			{ accountCode: 'AP-2100', debitAmount: '0.0000', creditAmount: '500.0000' }
		]);
		await expect(
			accounting.postSource(actorMaker, {
				sourceType: 'accounts_payable_invoice_approval',
				sourcePublicId: documentPublicId
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
'''
insert_before_once(
    ap_test_path,
    "\n\t\tawait expect(service.voidDocument(actorMaker, documentPublicId)).rejects.toBeInstanceOf(",
    posting_assertion,
)

migration = r'''-- NuBlox AP-to-accounting digital-thread integration
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
'''
Path("database/migrations/20260827165000_ap_accounting_digital_thread.sql").write_text(migration)

print("Applied AP accounting digital-thread patch.")
