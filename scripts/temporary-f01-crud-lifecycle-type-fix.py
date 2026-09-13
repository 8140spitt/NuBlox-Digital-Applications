from pathlib import Path

path = Path('appv2/src/lib/server/strategy/f01-record-management-service.ts')
text = path.read_text()
text = text.replace('params: readonly unknown[]', 'params: unknown[]')
text = text.replace('input.targetRecordType?.trim()', 'input.targetRecordType?.trim() ?? null')
text = text.replace('input.targetPublicId?.trim()', 'input.targetPublicId?.trim() ?? null')
while '?? null ?? null' in text:
    text = text.replace('?? null ?? null', '?? null')
path.write_text(text)
print('F01 lifecycle type fixes applied')
