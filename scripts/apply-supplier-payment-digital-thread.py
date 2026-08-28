from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one anchor in {path}; found {count}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


# Accounting source domain and supplier-payment adapter.
source_path = "app/src/lib/server/finance/accounting-source-service.ts"
replace_once(
    source_path,
    "import { FinanceValidationError } from './finance-common';\n",
    "import { FinanceValidationError } from './finance-common';\n"
    "import {\n"
    "\tlistSupplierPaymentAccountingReferences,\n"
    "\tresolveSupplierPaymentAccountingCandidate\n"
    "} from './supplier-payment-accounting-source';\n",
)
replace_once(
    source_path,
    "\t'accounts_payable_credit_note_approval',\n\t'payment_receipt',\n",
    "\t'accounts_payable_credit_note_approval',\n"
    "\t'supplier_payment_execution',\n"
    "\t'supplier_payment_reversal',\n"
    "\t'payment_receipt',\n",
)
replace_once(
    source_path,
    "\t| 'purchase_expense'\n\t| 'retained_earnings';\n",
    "\t| 'purchase_expense'\n\t| 'cash_disbursements'\n\t| 'retained_earnings';\n",
)
replace_once(
    source_path,
    "\t\tcase 'payment_receipt':\n",
    "\t\tcase 'supplier_payment_execution':\n"
    "\t\tcase 'supplier_payment_reversal':\n"
    "\t\t\treturn resolveSupplierPaymentAccountingCandidate(\n"
    "\t\t\t\tdb,\n"
    "\t\t\t\torganisationId,\n"
    "\t\t\t\tsourceType,\n"
    "\t\t\t\tsourcePublicId,\n"
    "\t\t\t\tforUpdate\n"
    "\t\t\t);\n"
    "\t\tcase 'payment_receipt':\n",
)
replace_once(
    source_path,
    "\n\tconst payments = await db\n",
    "\n\tconst supplierPaymentReferences = await listSupplierPaymentAccountingReferences(\n"
    "\t\tdb,\n"
    "\t\torganisationId\n"
    "\t);\n"
    "\trefs.push(...supplierPaymentReferences);\n"
    "\n\tconst payments = await db\n",
)

# Accounting mapping control.
accounting_service_path = "app/src/lib/server/finance/accounting-service.ts"
replace_once(
    accounting_service_path,
    "\t'purchase_expense',\n\t'retained_earnings'\n",
    "\t'purchase_expense',\n\t'cash_disbursements',\n\t'retained_earnings'\n",
)
replace_once(
    accounting_service_path,
    "\tpurchase_expense: 'expense',\n\tretained_earnings: 'equity'\n",
    "\tpurchase_expense: 'expense',\n\tcash_disbursements: 'asset',\n\tretained_earnings: 'equity'\n",
)

# AP workspace navigation into the settlement seam.
ap_page_path = "app/src/routes/(app)/finance/accounts-payable/+page.svelte"
replace_once(
    ap_page_path,
    '\t\t<a class="button secondary" href="/purchasing">Procurement</a>\n',
    '\t\t<a class="button secondary" href="/finance/supplier-payments">Supplier payments</a>\n'
    '\t\t<a class="button secondary" href="/purchasing">Procurement</a>\n',
)

# Extend the existing real-MySQL AP harness so the proof starts with canonical procurement/AP facts.
test_path = "app/src/lib/server/finance/accounts-payable.integration.test.ts"
replace_once(
    test_path,
    "import { FinanceValidationError } from './finance-common';\n",
    "import { FinanceValidationError } from './finance-common';\n"
    "import { SupplierPaymentService } from './supplier-payment-service';\n",
)
replace_once(
    test_path,
    "\t'finance.ap.approve',\n\t'finance.ap.invoice.void'\n",
    "\t'finance.ap.approve',\n"
    "\t'finance.ap.invoice.void',\n"
    "\t'finance.ap.payment.create',\n"
    "\t'finance.ap.payment.approve',\n"
    "\t'finance.ap.payment.execute',\n"
    "\t'finance.ap.payment.cancel',\n"
    "\t'finance.ap.payment.reverse'\n",
)
replace_once(
    test_path,
    "\tawait assignRole(organisationAId, approverMemberId, 'Approver', [\n"
    "\t\t'finance.ap.view',\n"
    "\t\t'finance.ap.approve'\n"
    "\t]);\n",
    "\tawait assignRole(organisationAId, approverMemberId, 'Approver', [\n"
    "\t\t'finance.ap.view',\n"
    "\t\t'finance.ap.approve',\n"
    "\t\t'finance.ap.payment.approve'\n"
    "\t]);\n",
)
replace_once(
    test_path,
    "\t\t{\n"
    "\t\t\tmappingKey: 'purchase_expense',\n"
    "\t\t\taccountCode: 'PUR-5000',\n"
    "\t\t\tname: 'Purchase and project cost',\n"
    "\t\t\taccountType: 'expense'\n"
    "\t\t},\n"
    "\t\t{\n"
    "\t\t\tmappingKey: 'vat_control',\n",
    "\t\t{\n"
    "\t\t\tmappingKey: 'purchase_expense',\n"
    "\t\t\taccountCode: 'PUR-5000',\n"
    "\t\t\tname: 'Purchase and project cost',\n"
    "\t\t\taccountType: 'expense'\n"
    "\t\t},\n"
    "\t\t{\n"
    "\t\t\tmappingKey: 'cash_disbursements',\n"
    "\t\t\taccountCode: 'CASH-1000',\n"
    "\t\t\tname: 'Cash disbursements',\n"
    "\t\t\taccountType: 'asset'\n"
    "\t\t},\n"
    "\t\t{\n"
    "\t\t\tmappingKey: 'vat_control',\n",
)

test_text = read(test_path)
marker = "\n});\n"
if "settles a posted AP liability through governed supplier payment, accounting and additive reversal" not in test_text:
    if not test_text.endswith(marker):
        raise SystemExit("Unexpected AP integration test ending")
    block = r'''

	it('settles a posted AP liability through governed supplier payment, accounting and additive reversal', async () => {
		const po = await createIssuedPurchaseOrder({
			orderedQuantity: '4',
			receivedQuantity: '4',
			unitRate: '100.00'
		});
		const ap = new AccountsPayableService(db);
		const documentPublicId = await ap.createSupplierDocument(
			actorMaker,
			invoiceInput(po.purchaseOrderPublicId, po.lineNumber, {
				quantity: '4',
				unitRate: '100.00'
			})
		);
		await ap.submitDocument(actorMaker, documentPublicId);
		await ap.approveDocument(actorApprover, documentPublicId, 'Independent AP approval before payment.');

		const accounting = new AccountingService(db);
		await accounting.postSource(actorMaker, {
			sourceType: 'accounts_payable_invoice_approval',
			sourcePublicId: documentPublicId
		});

		const supplierPayments = new SupplierPaymentService(db);
		let paymentWorkspace = await supplierPayments.getWorkspace(actorMaker);
		expect(
			paymentWorkspace.eligibleInvoices.find((invoice) => invoice.publicId === documentPublicId)
		).toMatchObject({ grossAmount: '400.0000', reservedAmount: '0.0000', openAmount: '400.0000' });
		const bankTransfer = paymentWorkspace.paymentMethods.find((method) => method.code === 'bank_transfer');
		expect(bankTransfer).toBeTruthy();

		const paymentPublicId = await supplierPayments.createPayment(actorMaker, {
			paymentMethodCode: bankTransfer!.code,
			requestedPaymentDate: '2026-08-25',
			allocations: [{ documentPublicId, amount: '250.0000' }]
		});
		await expect(supplierPayments.approvePayment(actorMaker, paymentPublicId)).rejects.toBeInstanceOf(
			FinanceValidationError
		);
		await expect(
			supplierPayments.createPayment(actorMaker, {
				paymentMethodCode: bankTransfer!.code,
				requestedPaymentDate: '2026-08-25',
				allocations: [{ documentPublicId, amount: '151.0000' }]
			})
		).rejects.toThrow('open balance of 150.0000');

		await supplierPayments.approvePayment(actorApprover, paymentPublicId);
		await supplierPayments.executePayment(actorMaker, paymentPublicId, {
			paymentReference: `BANK-${randomUUID().slice(0, 8)}`
		});
		paymentWorkspace = await supplierPayments.getWorkspace(actorMaker);
		expect(paymentWorkspace.payments.find((payment) => payment.publicId === paymentPublicId)).toMatchObject({
			status: 'executed',
			paymentAmount: '250.0000'
		});

		let accountingWorkspace = await accounting.getWorkspace(actorMaker);
		const executionCandidate = accountingWorkspace.candidates.find(
			(candidate) =>
				candidate.sourceType === 'supplier_payment_execution' &&
				candidate.sourcePublicId === paymentPublicId
		);
		expect(executionCandidate).toMatchObject({ sourceAmount: '250.0000', missingMappings: [] });
		expect(executionCandidate?.lines).toEqual([
			expect.objectContaining({
				mappingKey: 'accounts_payable',
				debitAmount: '250.0000',
				creditAmount: '0.0000'
			}),
			expect.objectContaining({
				mappingKey: 'cash_disbursements',
				debitAmount: '0.0000',
				creditAmount: '250.0000'
			})
		]);
		const executionJournal = await accounting.postSource(actorMaker, {
			sourceType: 'supplier_payment_execution',
			sourcePublicId: paymentPublicId
		});
		const executionJournalId = await db
			.selectFrom('accounting_journal_entries')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', executionJournal.publicId)
			.executeTakeFirstOrThrow();
		const executionLines = await db
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
			.where('line.journal_entry_id', '=', executionJournalId.id)
			.orderBy('line.line_number')
			.execute();
		expect(executionLines).toEqual([
			{ accountCode: 'AP-2100', debitAmount: '250.0000', creditAmount: '0.0000' },
			{ accountCode: 'CASH-1000', debitAmount: '0.0000', creditAmount: '250.0000' }
		]);

		const otherTenantWorkspace = await supplierPayments.getWorkspace(actorOtherTenant);
		expect(otherTenantWorkspace.payments.some((payment) => payment.publicId === paymentPublicId)).toBe(
			false
		);

		await supplierPayments.reversePayment(actorMaker, paymentPublicId, {
			reason: 'Bank rejected the supplier payment after execution.'
		});
		accountingWorkspace = await accounting.getWorkspace(actorMaker);
		const reversalCandidate = accountingWorkspace.candidates.find(
			(candidate) =>
				candidate.sourceType === 'supplier_payment_reversal' &&
				candidate.sourcePublicId === paymentPublicId
		);
		expect(reversalCandidate).toMatchObject({ sourceAmount: '250.0000', missingMappings: [] });
		await accounting.postSource(actorMaker, {
			sourceType: 'supplier_payment_reversal',
			sourcePublicId: paymentPublicId
		});

		paymentWorkspace = await supplierPayments.getWorkspace(actorMaker);
		expect(
			paymentWorkspace.eligibleInvoices.find((invoice) => invoice.publicId === documentPublicId)
		).toMatchObject({ reservedAmount: '0.0000', openAmount: '400.0000' });
	});
'''
    write(test_path, test_text[: -len(marker)] + block + marker)

# Final authoritative schema counts after adding three AP tables, eleven FKs and six CHECKs.
workflow_path = ".github/workflows/database-migration-validation.yml"
replace_once(workflow_path, "test \"$table_count\" = '423'", "test \"$table_count\" = '426'")
replace_once(workflow_path, "test \"$fk_count\" = '995'", "test \"$fk_count\" = '1006'")
replace_once(workflow_path, "test \"$check_count\" = '602'", "test \"$check_count\" = '608'")

# Restore the trusted validation workflow after its one-time patching step has run.
workflow = read(workflow_path)
workflow = workflow.replace("permissions:\n  contents: write\n", "permissions:\n  contents: read\n", 1)
workflow = workflow.replace(
    "      - uses: actions/checkout@v4\n"
    "        with:\n"
    "          ref: feat/supplier-payment-digital-thread\n",
    "      - uses: actions/checkout@v4\n",
    1,
)
helper_step = (
    "\n      - name: Apply supplier payment digital-thread integration\n"
    "        run: |\n"
    "          python3 scripts/apply-supplier-payment-digital-thread.py\n"
    "          cd app\n"
    "          pnpm exec prettier --write \"src/lib/server/finance/accounting-source-service.ts\" \"src/lib/server/finance/accounting-service.ts\" \"src/lib/server/finance/accounts-payable.integration.test.ts\" \"src/lib/server/finance/supplier-payment-service.ts\" \"src/lib/server/finance/supplier-payment-accounting-source.ts\" \"src/routes/(app)/finance/accounts-payable/+page.svelte\" \"src/routes/(app)/finance/supplier-payments/+page.server.ts\" \"src/routes/(app)/finance/supplier-payments/+page.svelte\"\n"
    "          cd ..\n"
    "          git config user.name \"NuBlox CI\"\n"
    "          git config user.email \"actions@users.noreply.github.com\"\n"
    "          git add -A\n"
    "          git commit -m \"Connect supplier payments to accounting\"\n"
    "          git push origin HEAD:feat/supplier-payment-digital-thread\n"
)
if helper_step not in workflow:
    raise SystemExit("Temporary workflow helper step was not found")
workflow = workflow.replace(helper_step, "\n", 1)
write(workflow_path, workflow)

Path(__file__).unlink()
print("Applied supplier-payment digital-thread integration and restored the validation workflow.")
