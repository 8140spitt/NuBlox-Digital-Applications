from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def path(name: str) -> Path:
    return ROOT / name


def read(name: str) -> str:
    return path(name).read_text()


def write(name: str, text: str) -> None:
    path(name).write_text(text)


def replace_once(name: str, old: str, new: str) -> None:
    text = read(name)
    if new in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f"Expected one anchor in {name}: {old[:100]!r}")
    write(name, text.replace(old, new, 1))


def regex_once(name: str, pattern: str, replacement: str) -> None:
    text = read(name)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one regex anchor in {name}: {pattern[:100]!r}")
    write(name, updated)


period = "app/src/lib/server/finance/accounting-period-service.ts"
replace_once(
    period,
    "import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';\nimport {\n",
    "import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';\n"
    "import { unreconciledSupplierPaymentJournalCount } from './bank-reconciliation-service';\n"
    "import {\n",
)
replace_once(
    period,
    "\t\t\tunexportedJournalCount: number;\n\t\t}>;\n",
    "\t\t\tunexportedJournalCount: number;\n"
    "\t\t\tunreconciledSupplierPaymentCount: number;\n"
    "\t\t}>;\n",
)
replace_once(
    period,
    "\t\t\t\t\t\tunexportedJournalCount: await unexportedJournalCount(\n"
    "\t\t\t\t\t\t\tthis.db,\n"
    "\t\t\t\t\t\t\tactor.organisationId,\n"
    "\t\t\t\t\t\t\tperiod.startsOn,\n"
    "\t\t\t\t\t\t\tperiod.endsOn\n"
    "\t\t\t\t\t\t)\n",
    "\t\t\t\t\t\tunexportedJournalCount: await unexportedJournalCount(\n"
    "\t\t\t\t\t\t\tthis.db,\n"
    "\t\t\t\t\t\t\tactor.organisationId,\n"
    "\t\t\t\t\t\t\tperiod.startsOn,\n"
    "\t\t\t\t\t\t\tperiod.endsOn\n"
    "\t\t\t\t\t\t),\n"
    "\t\t\t\t\t\tunreconciledSupplierPaymentCount: await unreconciledSupplierPaymentJournalCount(\n"
    "\t\t\t\t\t\t\tthis.db,\n"
    "\t\t\t\t\t\t\tactor.organisationId,\n"
    "\t\t\t\t\t\t\tperiod.startsOn,\n"
    "\t\t\t\t\t\t\tperiod.endsOn\n"
    "\t\t\t\t\t\t)\n",
)
replace_once(
    period,
    "\t\t\t\tif (missing > 0) {\n"
    "\t\t\t\t\tthrow new FinanceValidationError(\n"
    "\t\t\t\t\t\t`Hard close is blocked until ${missing} journal${missing === 1 ? '' : 's'} have active accounting export evidence.`\n"
    "\t\t\t\t\t);\n"
    "\t\t\t\t}\n",
    "\t\t\t\tif (missing > 0) {\n"
    "\t\t\t\t\tthrow new FinanceValidationError(\n"
    "\t\t\t\t\t\t`Hard close is blocked until ${missing} journal${missing === 1 ? '' : 's'} have active accounting export evidence.`\n"
    "\t\t\t\t\t);\n"
    "\t\t\t\t}\n"
    "\t\t\t\tconst unreconciledSupplierPayments = await unreconciledSupplierPaymentJournalCount(\n"
    "\t\t\t\t\ttrx,\n"
    "\t\t\t\t\tactor.organisationId,\n"
    "\t\t\t\t\tperiod.startsOn,\n"
    "\t\t\t\t\tperiod.endsOn\n"
    "\t\t\t\t);\n"
    "\t\t\t\tif (unreconciledSupplierPayments > 0) {\n"
    "\t\t\t\t\tthrow new FinanceValidationError(\n"
    "\t\t\t\t\t\t`Hard close is blocked until ${unreconciledSupplierPayments} supplier payment${unreconciledSupplierPayments === 1 ? '' : 's'} have active bank settlement evidence.`\n"
    "\t\t\t\t\t);\n"
    "\t\t\t\t}\n",
)

period_page = "app/src/routes/(app)/finance/accounting/periods/+page.svelte"
replace_once(
    period_page,
    '\t<a class="secondary" href="/finance/accounting">Accounting workspace</a>\n',
    '\t<div class="heading-actions">\n'
    '\t\t<a class="secondary" href="/finance/bank-reconciliation">Bank reconciliation</a>\n'
    '\t\t<a class="secondary" href="/finance/accounting">Accounting workspace</a>\n'
    '\t</div>\n',
)
replace_once(
    period_page,
    "\t\t>Journal posting and reversal require an open period. Export requires an exact soft-closed or\n"
    "\t\thard-closed period. Hard close is blocked until every journal in the period has active export\n"
    "\t\tevidence.</span\n",
    "\t\t>Journal posting and reversal require an open period. Export requires an exact soft-closed or\n"
    "\t\thard-closed period. Hard close is blocked until every journal has active export evidence and\n"
    "\t\tevery active supplier-payment cash journal has bank settlement evidence.</span\n",
)
regex_once(
    period_page,
    r"(<th>Unexported journals</th>)\s*<th\s*>\s*Action</th>",
    r"\1<th>Unreconciled supplier payments</th><th>Action</th>",
)
replace_once(
    period_page,
    "<td>{period.unexportedJournalCount}</td>",
    "<td>{period.unexportedJournalCount}</td><td>{period.unreconciledSupplierPaymentCount}</td>",
)
replace_once(
    period_page,
    "\t.secondary {\n\t\tfont-weight: 700;\n\t\tcolor: #344054;\n\t}\n",
    "\t.heading-actions {\n\t\tdisplay: flex;\n\t\tgap: 0.75rem;\n\t\tflex-wrap: wrap;\n\t}\n"
    "\t.secondary {\n\t\tfont-weight: 700;\n\t\tcolor: #344054;\n\t}\n",
)

supplier_page = "app/src/routes/(app)/finance/supplier-payments/+page.svelte"
replace_once(
    supplier_page,
    '\t\t<a class="button secondary" href="/finance/accounts-payable">Accounts Payable</a>\n'
    '\t\t<a class="button secondary" href="/finance/accounting">Accounting</a>\n',
    '\t\t<a class="button secondary" href="/finance/accounts-payable">Accounts Payable</a>\n'
    '\t\t<a class="button secondary" href="/finance/bank-reconciliation">Bank reconciliation</a>\n'
    '\t\t<a class="button secondary" href="/finance/accounting">Accounting</a>\n',
)

registry = "app/src/lib/navigation/capability-registry.ts"
replace_once(
    registry,
    "\t\tmaturityNote:\n\t\t\t'Core accounting and receivables are native; complete AP, banking, fixed assets and localisation remain.',\n",
    "\t\tmaturityNote:\n\t\t\t'Core accounting, receivables, native AP, governed supplier payments and bank reconciliation are native; fixed assets, deeper treasury and localisation remain.',\n",
)
replace_once(
    registry,
    "\t\t\t{ label: 'Accounting', href: '/finance/accounting', anyPermissionNamespaces: ['finance.'] },\n"
    "\t\t\t{ label: 'Invoices', href: '/finance/invoices', anyPermissionNamespaces: ['finance.'] },\n",
    "\t\t\t{ label: 'Accounting', href: '/finance/accounting', anyPermissionNamespaces: ['finance.'] },\n"
    "\t\t\t{ label: 'Accounts Payable', href: '/finance/accounts-payable', anyPermissionNamespaces: ['finance.'] },\n"
    "\t\t\t{ label: 'Supplier payments', href: '/finance/supplier-payments', anyPermissionNamespaces: ['finance.'] },\n"
    "\t\t\t{ label: 'Bank reconciliation', href: '/finance/bank-reconciliation', anyPermissionNamespaces: ['finance.'] },\n"
    "\t\t\t{ label: 'Invoices', href: '/finance/invoices', anyPermissionNamespaces: ['finance.'] },\n",
)

bank_service = "app/src/lib/server/finance/bank-reconciliation-service.ts"
replace_once(
    bank_service,
    "\t\t\t.where('line.organisation_id', '=', actor.organisationId)\n\t\t\t.orderBy('line.booked_on', 'desc')\n",
    "\t\t\t.where('line.organisation_id', '=', actor.organisationId)\n"
    "\t\t\t.where(\n"
    "\t\t\t\tsql<boolean>`not exists (\n"
    "\t\t\t\t\tselect 1 from bank_reconciliation_matches as active_match\n"
    "\t\t\t\t\tleft join bank_reconciliation_match_reversals as active_reversal\n"
    "\t\t\t\t\t\ton active_reversal.bank_reconciliation_match_id = active_match.id\n"
    "\t\t\t\t\t\tand active_reversal.organisation_id = active_match.organisation_id\n"
    "\t\t\t\t\twhere active_match.organisation_id = ${actor.organisationId}\n"
    "\t\t\t\t\t\tand active_match.bank_statement_line_id = line.id\n"
    "\t\t\t\t\t\tand active_reversal.bank_reconciliation_match_id is null\n"
    "\t\t\t\t)`\n"
    "\t\t\t)\n"
    "\t\t\t.orderBy('line.booked_on', 'desc')\n",
)
text = read(bank_service)
text, count = re.subn(
    r"\n\t\tconst activeLineIds = new Set\(.*?\n\t\t\);\n\t\tconst activePaymentIds = new Set\(.*?\n\t\t\);\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Expected active match classification block")
write(bank_service, text)

payment_exists = """\t\t\t.where(\n\t\t\t\tsql<boolean>`exists (\n\t\t\t\t\tselect 1\n\t\t\t\t\tfrom accounting_journal_entries as journal\n\t\t\t\t\tleft join accounting_journal_entry_reversals as journal_reversal\n\t\t\t\t\t\ton journal_reversal.journal_entry_id = journal.id\n\t\t\t\t\t\tand journal_reversal.organisation_id = journal.organisation_id\n\t\t\t\t\twhere journal.organisation_id = ${actor.organisationId}\n\t\t\t\t\t\tand journal.source_type = 'supplier_payment_execution'\n\t\t\t\t\t\tand journal.source_public_id = payment.public_id\n\t\t\t\t\t\tand journal_reversal.journal_entry_id is null\n\t\t\t\t)`\n\t\t\t)\n"""
payment_not_matched = """\t\t\t.where(\n\t\t\t\tsql<boolean>`not exists (\n\t\t\t\t\tselect 1 from bank_reconciliation_matches as active_match\n\t\t\t\t\tleft join bank_reconciliation_match_reversals as active_reversal\n\t\t\t\t\t\ton active_reversal.bank_reconciliation_match_id = active_match.id\n\t\t\t\t\t\tand active_reversal.organisation_id = active_match.organisation_id\n\t\t\t\t\twhere active_match.organisation_id = ${actor.organisationId}\n\t\t\t\t\t\tand active_match.supplier_payment_id = payment.id\n\t\t\t\t\t\tand active_reversal.bank_reconciliation_match_id is null\n\t\t\t\t)`\n\t\t\t)\n"""
replace_once(bank_service, payment_exists, payment_exists + payment_not_matched)
replace_once(
    bank_service,
    "\t\t\tunmatchedLines: lineRows\n\t\t\t\t.filter((line) => !activeLineIds.has(line.publicId))\n\t\t\t\t.map((line) => ({ ...line, bookedOn: formatDateOnly(line.bookedOn) })),\n"
    "\t\t\tunsettledSupplierPayments: paymentRows\n\t\t\t\t.filter((payment) => !activePaymentIds.has(payment.publicId))\n\t\t\t\t.map((payment) => ({ ...payment, executedAt: payment.executedAt! })),\n",
    "\t\t\tunmatchedLines: lineRows.map((line) => ({ ...line, bookedOn: formatDateOnly(line.bookedOn) })),\n"
    "\t\t\tunsettledSupplierPayments: paymentRows.map((payment) => ({\n"
    "\t\t\t\t...payment,\n\t\t\t\texecutedAt: payment.executedAt!\n\t\t\t})),\n",
)

ap_test = "app/src/lib/server/finance/accounts-payable.integration.test.ts"
replace_once(
    ap_test,
    "import { AccountsPayableService } from './accounts-payable-service';\nimport { FinanceValidationError } from './finance-common';\n",
    "import { AccountsPayableService } from './accounts-payable-service';\n"
    "import { BankReconciliationService } from './bank-reconciliation-service';\n"
    "import { FinanceValidationError } from './finance-common';\n",
)
text = read(ap_test)
test_name = "requires active bank settlement evidence before hard close and freezes that evidence after close"
if test_name not in text:
    if not text.endswith("\n});\n"):
        raise SystemExit("Unexpected AP integration test ending")
    test = r'''

	it('requires active bank settlement evidence before hard close and freezes that evidence after close', async () => {
		const financialYear = await db.selectFrom('accounting_financial_years').select('public_id as publicId')
			.where('organisation_id', '=', organisationAId).where('year_code', '=', 'AP-FY26').executeTakeFirstOrThrow();
		const periodService = new AccountingPeriodService(db, randomUUID, () => new Date('2026-09-30T17:00:00.000Z'));
		const september = await periodService.createPeriod(actorMaker, {
			financialYearPublicId: financialYear.publicId, periodNumber: 9, name: 'September 2026',
			startsOn: '2026-09-01', endsOn: '2026-09-30'
		});
		const po = await createIssuedPurchaseOrder({ orderedQuantity: '3', receivedQuantity: '3', unitRate: '100.00' });
		const ap = new AccountsPayableService(db);
		const documentPublicId = await ap.createSupplierDocument(actorMaker,
			invoiceInput(po.purchaseOrderPublicId, po.lineNumber, { quantity: '3', unitRate: '100.00' }));
		await ap.submitDocument(actorMaker, documentPublicId);
		await ap.approveDocument(actorApprover, documentPublicId, 'Approved for September settlement.');
		const accounting = new AccountingService(db);
		await accounting.postSource(actorMaker, { sourceType: 'accounts_payable_invoice_approval', sourcePublicId: documentPublicId });

		const paymentNow = new Date('2026-09-15T12:00:00.000Z');
		const supplierPayments = new SupplierPaymentService(db, randomUUID, () => paymentNow);
		const paymentWorkspace = await supplierPayments.getWorkspace(actorMaker);
		const bankTransfer = paymentWorkspace.paymentMethods.find((method) => method.code === 'bank_transfer');
		expect(bankTransfer).toBeTruthy();
		const paymentPublicId = await supplierPayments.createPayment(actorMaker, {
			paymentMethodCode: bankTransfer!.code, requestedPaymentDate: '2026-09-15',
			allocations: [{ documentPublicId, amount: '250.0000' }]
		});
		await supplierPayments.approvePayment(actorApprover, paymentPublicId);
		const bankReference = `BACS-${randomUUID().slice(0, 8)}`;
		await supplierPayments.executePayment(actorMaker, paymentPublicId, { paymentReference: bankReference });
		const septemberAccounting = new AccountingService(db, randomUUID, () => paymentNow);
		await septemberAccounting.postSource(actorMaker, { sourceType: 'supplier_payment_execution', sourcePublicId: paymentPublicId });
		await periodService.softClose(actorMaker, september.publicId, 'September posting complete.');
		await septemberAccounting.createExport(actorMaker, {
			periodStart: '2026-09-01', periodEnd: '2026-09-30', reason: 'September accounting export before hard close.'
		});

		let periodWorkspace = await periodService.getWorkspace(actorMaker);
		let septemberPeriod = periodWorkspace.financialYears.flatMap((year) => year.periods)
			.find((period) => period.publicId === september.publicId);
		expect(septemberPeriod).toMatchObject({ status: 'soft_closed', unexportedJournalCount: 0, unreconciledSupplierPaymentCount: 1 });
		await expect(periodService.hardClose(actorMaker, september.publicId, 'Attempt close before settlement evidence.'))
			.rejects.toThrow('active bank settlement evidence');

		const cashAccount = (await septemberAccounting.getWorkspace(actorMaker)).accounts.find((account) => account.accountCode === 'CASH-1000');
		expect(cashAccount).toBeTruthy();
		const bank = new BankReconciliationService(db, randomUUID, () => new Date('2026-09-16T09:00:00.000Z'));
		const bankAccountPublicId = await bank.createBankAccount(actorMaker, {
			accountingAccountPublicId: cashAccount!.publicId, accountName: 'Operating bank account',
			institutionName: 'NuBlox Test Bank', accountIdentifierLast4: '2609', currencyCode: 'GBP'
		});
		const externalTransactionId = `BANK-TXN-${randomUUID().slice(0, 8)}`;
		await bank.recordStatement(actorMaker, {
			bankAccountPublicId, statementReference: `SEP-${randomUUID().slice(0, 8)}`,
			periodStart: '2026-09-16', periodEnd: '2026-09-16', openingBalance: '1000.0000', closingBalance: '750.0000',
			lines: [{ externalTransactionId, bookedOn: '2026-09-16', valueOn: '2026-09-16', direction: 'debit',
				amount: '250.0000', description: 'Supplier payment settlement', bankReference }]
		});
		let bankWorkspace = await bank.getWorkspace(actorMaker);
		const statementLine = bankWorkspace.unmatchedLines.find((line) => line.externalTransactionId === externalTransactionId);
		expect(statementLine).toBeTruthy();
		expect(bankWorkspace.unsettledSupplierPayments.some((payment) => payment.publicId === paymentPublicId)).toBe(true);
		const matchPublicId = await bank.matchSupplierPayment(actorMaker, {
			statementLinePublicId: statementLine!.publicId, supplierPaymentPublicId: paymentPublicId
		});
		bankWorkspace = await bank.getWorkspace(actorMaker);
		expect(bankWorkspace.unsettledSupplierPayments.some((payment) => payment.publicId === paymentPublicId)).toBe(false);
		expect(bankWorkspace.matches.find((match) => match.publicId === matchPublicId)).toMatchObject({
			supplierPaymentPublicId: paymentPublicId, matchedAmount: '250.0000', reversalPublicId: null
		});

		periodWorkspace = await periodService.getWorkspace(actorMaker);
		septemberPeriod = periodWorkspace.financialYears.flatMap((year) => year.periods)
			.find((period) => period.publicId === september.publicId);
		expect(septemberPeriod?.unreconciledSupplierPaymentCount).toBe(0);
		await periodService.hardClose(actorMaker, september.publicId, 'All accounting and bank evidence complete.');
		await expect(bank.reverseMatch(actorMaker, matchPublicId, 'Attempt to remove settlement after hard close.'))
			.rejects.toThrow('Reopen accounting period');
	});
'''
    write(ap_test, text[:-5] + test + "\n});\n")

path(__file__).unlink()
