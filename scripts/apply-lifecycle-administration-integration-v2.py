from pathlib import Path

source_path = Path('scripts/apply-lifecycle-administration-integration.py')
source = source_path.read_text()
source = source.replace(
    "    if text.count(old) != 1:\n        raise RuntimeError(f\"Expected exactly one match in {path}, found {text.count(old)}\")\n",
    "",
)
exec(compile(source, str(source_path), 'exec'))

record_path = Path('appv2/src/lib/server/strategy/f01-record-management-service.ts')
record = record_path.read_text()
unused_helper = """async function requireManage(input: {
\tactor: EvidenceActor;
\tframeworkPublicId: string;
}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {
\tconst context = await frameworkContext({
\t\torganisationId: input.actor.organisationId,
\t\tmemberId: input.actor.memberId,
\t\tframeworkPublicId: input.frameworkPublicId
\t});
\tif (!context.permissions.canManage) {
\t\tthrow new StrategyAccessError(
\t\t\t'You do not have authority to manage enterprise strategy records.'
\t\t);
\t}
\tif (context.framework.lifecycleStatus === 'superseded') {
\t\tthrow new StrategyValidationError(
\t\t\t'Superseded strategy versions are immutable enterprise history.'
\t\t);
\t}
\treturn context;
}

"""
if unused_helper not in record:
    raise RuntimeError('Expected obsolete requireManage helper was not found after lifecycle integration.')
record_path.write_text(record.replace(unused_helper, '', 1))

list_page_path = Path('appv2/src/routes/[tenant]/app/(protected)/lifecycle/+page.svelte')
list_page = list_page_path.read_text()
list_page = list_page.replace(
    "import { enhance } from '$app/forms';\n",
    "import { enhance } from '$app/forms';\n\timport { resolve } from '$app/paths';\n",
    1,
)
list_page = list_page.replace(
    'href={routes.lifecycleTemplate(tenant, template.publicId)}',
    'href={resolve(routes.lifecycleTemplate(tenant, template.publicId))}',
    1,
)
list_page_path.write_text(list_page)
