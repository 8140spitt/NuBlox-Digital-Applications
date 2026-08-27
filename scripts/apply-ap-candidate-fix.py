from pathlib import Path

source_path = Path('app/src/lib/server/finance/accounting-source-service.ts')
source = source_path.read_text()

if "import { sql } from 'kysely';" not in source:
    anchor = "import { createHash } from 'node:crypto';\n\n"
    replacement = "import { createHash } from 'node:crypto';\n\nimport { sql } from 'kysely';\n\n"
    if anchor not in source:
        raise SystemExit('accounting-source import anchor not found')
    source = source.replace(anchor, replacement, 1)

query_anchor = """\tconst supplierDocuments = await db
\t\t.selectFrom('accounts_payable_documents')
\t\t.select(['public_id as publicId', 'document_type as documentType', 'approved_at as approvedAt'])
\t\t.where('organisation_id', '=', organisationId)
\t\t.where('lifecycle_status', '=', 'approved')
\t\t.where('approved_at', 'is not', null)
\t\t.orderBy('approved_at', 'desc')
\t\t.limit(100)
\t\t.execute();
"""

query_replacement = """\tconst supplierDocuments = await db
\t\t.selectFrom('accounts_payable_documents')
\t\t.select(['public_id as publicId', 'document_type as documentType', 'approved_at as approvedAt'])
\t\t.where('organisation_id', '=', organisationId)
\t\t.where('lifecycle_status', '=', 'approved')
\t\t.where('approved_at', 'is not', null)
\t\t.where(
\t\t\tsql<boolean>`not exists (
\t\t\t\tselect 1
\t\t\t\tfrom accounting_journal_entries as journal
\t\t\t\tleft join accounting_journal_entry_reversals as reversal
\t\t\t\t\ton reversal.journal_entry_id = journal.id
\t\t\t\t\tand reversal.organisation_id = journal.organisation_id
\t\t\t\twhere journal.organisation_id = ${organisationId}
\t\t\t\t\tand journal.source_public_id = accounts_payable_documents.public_id
\t\t\t\t\tand journal.source_type = case
\t\t\t\t\t\twhen accounts_payable_documents.document_type = 'credit_note'
\t\t\t\t\t\t\tthen 'accounts_payable_credit_note_approval'
\t\t\t\t\t\telse 'accounts_payable_invoice_approval'
\t\t\t\t\tend
\t\t\t\t\tand reversal.journal_entry_id is null
\t\t\t)`
\t\t)
\t\t.orderBy('approved_at', 'desc')
\t\t.limit(100)
\t\t.execute();
"""

if query_replacement not in source:
    if query_anchor not in source:
        raise SystemExit('supplier-document query anchor not found')
    source = source.replace(query_anchor, query_replacement, 1)
source_path.write_text(source)

test_path = Path('app/src/lib/server/finance/accounts-payable.integration.test.ts')
test = test_path.read_text()
marker = 'keeps an older unposted approved AP document visible beyond the 100-row candidate limit'

if marker not in test:
    regression = """

\tit('keeps an older unposted approved AP document visible beyond the 100-row candidate limit', async () => {
\t\tconst approvalBase = new Date('2026-08-21T10:00:00.000Z').getTime();
\t\tconst documents = Array.from({ length: 101 }, (_, index) => ({
\t\t\torganisation_id: organisationAId,
\t\t\tpublic_id: randomUUID(),
\t\t\tdocument_type: 'invoice',
\t\t\tsupplier_party_id: supplierPartyId,
\t\t\tproject_id: null,
\t\t\tpurchase_order_id: null,
\t\t\tsupplier_document_number: `AP-SCALE-${index}-${randomUUID().slice(0, 8)}`,
\t\t\tinvoice_date: new Date('2026-08-21T00:00:00.000Z'),
\t\t\ttax_date: null,
\t\t\tdue_date: null,
\t\t\tcurrency_code: 'GBP',
\t\t\tlifecycle_status: 'approved',
\t\t\tnet_amount: '1.0000',
\t\t\ttax_amount: '0.0000',
\t\t\tgross_amount: '1.0000',
\t\t\tcreated_by_member_id: makerMemberId,
\t\t\tsubmitted_at: new Date(approvalBase + index * 60_000 - 1_000),
\t\t\tapproved_at: new Date(approvalBase + index * 60_000)
\t\t}));
\t\tawait db.insertInto('accounts_payable_documents').values(documents).execute();

\t\tconst oldestUnposted = documents[0]!;
\t\tawait db
\t\t\t.insertInto('accounting_journal_entries')
\t\t\t.values(
\t\t\t\tdocuments.slice(1).map((document, index) => ({
\t\t\t\t\torganisation_id: organisationAId,
\t\t\t\t\tpublic_id: randomUUID(),
\t\t\t\t\tjournal_number: `AP-SCALE-JRN-${String(index + 1).padStart(3, '0')}`,
\t\t\t\t\tsource_type: 'accounts_payable_invoice_approval',
\t\t\t\t\tsource_public_id: document.public_id,
\t\t\t\t\tsource_event_at: document.approved_at,
\t\t\t\t\tsource_amount: '1.0000',
\t\t\t\t\tsource_fingerprint: String(index + 1).padStart(64, '0'),
\t\t\t\t\taccounting_date: new Date('2026-08-21T00:00:00.000Z'),
\t\t\t\t\tcurrency_code: 'GBP',
\t\t\t\t\tmemo: 'Scale regression posted AP source',
\t\t\t\t\tposted_by_member_id: makerMemberId,
\t\t\t\t\tposted_at: document.approved_at
\t\t\t\t}))
\t\t\t)
\t\t\t.execute();

\t\tconst workspace = await new AccountingService(db).getWorkspace(actorMaker);
\t\texpect(
\t\t\tworkspace.candidates.some(
\t\t\t\t(candidate) =>
\t\t\t\t\tcandidate.sourceType === 'accounts_payable_invoice_approval' &&
\t\t\t\t\tcandidate.sourcePublicId === oldestUnposted.public_id
\t\t\t)
\t\t).toBe(true);
\t});
"""
    head, sep, tail = test.rpartition('\n});\n')
    if not sep:
        raise SystemExit('accounts-payable test closing describe not found')
    test_path.write_text(head + regression + '\n});\n' + tail)
