from pathlib import Path

path = Path('appv2/src/lib/server/strategy/f01-record-management-service.ts')
text = path.read_text()
text = text.replace('params: readonly unknown[]', 'params: unknown[]')
text = text.replace('input.targetRecordType?.trim()', 'input.targetRecordType?.trim() ?? null')
text = text.replace('input.targetPublicId?.trim()', 'input.targetPublicId?.trim() ?? null')
# The validation predicate must remain boolean; only SQL-bound optional values need null coercion.
text = text.replace('!input.targetRecordType?.trim() ?? null', '!input.targetRecordType?.trim()')
text = text.replace('!input.targetPublicId?.trim() ?? null', '!input.targetPublicId?.trim()')
while '?? null ?? null' in text:
    text = text.replace('?? null ?? null', '?? null')
path.write_text(text)
print('F01 lifecycle type fixes applied')
