from pathlib import Path

path = Path('app/src/lib/server/finance/accounting-source-service.ts')
text = path.read_text()
old = """\tfor (const document of supplierDocuments) {\n\t\treferences.push({\n\t\t\tsourceType:\n\t\t\t\tdocument.documentType === 'credit_note'\n\t\t\t\t\t? 'accounts_payable_credit_note_approval'\n\t\t\t\t\t: 'accounts_payable_invoice_approval',\n\t\t\tsourcePublicId: document.publicId\n\t\t});\n\t}\n"""
new = """\tfor (const document of supplierDocuments) {\n\t\tif (!document.approvedAt) continue;\n\t\trefs.push({\n\t\t\tsourceType:\n\t\t\t\tdocument.documentType === 'credit_note'\n\t\t\t\t\t? 'accounts_payable_credit_note_approval'\n\t\t\t\t\t: 'accounts_payable_invoice_approval',\n\t\t\tsourcePublicId: document.publicId,\n\t\t\tat: document.approvedAt\n\t\t});\n\t}\n"""
if text.count(old) != 1:
    raise RuntimeError('Expected exactly one AP source-reference block to correct.')
path.write_text(text.replace(old, new, 1))
print('Corrected AP source-reference collection.')
