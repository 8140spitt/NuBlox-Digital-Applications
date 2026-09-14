from pathlib import Path

source_path = Path('scripts/apply-lifecycle-administration-integration.py')
source = source_path.read_text()
source = source.replace(
    "    if text.count(old) != 1:\n        raise RuntimeError(f\"Expected exactly one match in {path}, found {text.count(old)}\")\n",
    "",
)
exec(compile(source, str(source_path), 'exec'))


def replace_required(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) < count:
        raise RuntimeError(f"Expected text not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, count))


# Remove the obsolete central-only helper after lifecycle-aware authority is wired into managed records.
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

# Navigation lint and StatusBadge tone compatibility.
list_page_path = Path('appv2/src/routes/[tenant]/app/(protected)/lifecycle/+page.svelte')
list_page = list_page_path.read_text()
list_page = list_page.replace(
    "import { enhance } from '$app/forms';\n",
    "import { enhance } from '$app/forms';\n\timport { resolve } from '$app/paths';\n",
    1,
)
list_page = list_page.replace(
    "function tone(status: string): 'success' | 'info' | 'warning' | 'default' {",
    "function tone(status: string): 'success' | 'info' | 'warning' | 'neutral' {",
    1,
)
list_page = list_page.replace("\t\treturn 'default';", "\t\treturn 'neutral';", 1)
list_page = list_page.replace(
    'href={routes.lifecycleTemplate(tenant, template.publicId)}',
    'href={resolve(routes.lifecycleTemplate(tenant, template.publicId))}',
    1,
)
list_page_path.write_text(list_page)

detail_page_path = Path('appv2/src/routes/[tenant]/app/(protected)/lifecycle/[template]/+page.svelte')
detail_page = detail_page_path.read_text()
detail_page = detail_page.replace(
    "function statusTone(status: string): 'success' | 'info' | 'warning' | 'default' {",
    "function statusTone(status: string): 'success' | 'info' | 'warning' | 'neutral' {",
    1,
)
detail_page = detail_page.replace("\t\treturn 'default';", "\t\treturn 'neutral';", 1)
detail_page = detail_page.replace(
    "tone={advanced ? 'info' : 'default'}",
    "tone={advanced ? 'info' : 'neutral'}",
    1,
)
detail_page_path.write_text(detail_page)

# F01 resolver fails closed if an administrator binds a persisted lifecycle containing states
# the authoritative F01 object cannot store or interpret.
resolver_path = 'appv2/src/lib/server/strategy/f01-lifecycle-resolver.ts'
replace_required(
    resolver_path,
    "async function resolved(organisationId: string, kind: F01ManagedRecordKind) {\n\treturn resolveLifecycleTemplate({\n\t\torganisationId,\n\t\tobjectType: f01LifecycleObjectType(kind),\n\t\tfallback: lifecycleTemplate(kind)\n\t});\n}\n",
    "async function resolved(organisationId: string, kind: F01ManagedRecordKind) {\n"
    "\tconst fallback = lifecycleTemplate(kind);\n"
    "\tconst lifecycle = await resolveLifecycleTemplate({\n"
    "\t\torganisationId,\n"
    "\t\tobjectType: f01LifecycleObjectType(kind),\n"
    "\t\tfallback\n"
    "\t});\n"
    "\tif (lifecycle.source === 'binding') {\n"
    "\t\tconst unsupported = Object.keys(lifecycle.template.phases).filter((state) => !fallback.phases[state]);\n"
    "\t\tif (unsupported.length > 0) {\n"
    "\t\t\tthrow new Error(\n"
    "\t\t\t\t`Lifecycle binding ${lifecycle.persistedTemplatePublicId ?? lifecycle.template.key} contains unsupported ${f01LifecycleObjectType(kind)} states: ${unsupported.join(', ')}.`\n"
    "\t\t\t);\n"
    "\t\t}\n"
    "\t}\n"
    "\treturn lifecycle;\n"
    "}\n",
)

# Approval readiness must reflect lifecycle-scoped approval authority, including explicit-deny precedence.
readiness_path = 'appv2/src/lib/server/strategy/approval-readiness-service.ts'
replace_required(
    readiness_path,
    "import { getStrategyWorkspace, StrategyAccessError } from './f01-service';\n",
    "import { getStrategyWorkspace, StrategyAccessError } from './f01-service';\n"
    "import { assertF01LifecycleTransition, decideF01LifecyclePermission } from './f01-lifecycle-resolver';\n",
)
replace_required(
    readiness_path,
    "\tconst isDraft = framework.lifecycleStatus === 'draft';\n\tconst canApprove = workspace.permissions.canApprove;\n",
    "\tconst isDraft = framework.lifecycleStatus === 'draft';\n"
    "\tlet canApprove = false;\n"
    "\tif (isDraft) {\n"
    "\t\ttry {\n"
    "\t\t\tconst transition = await assertF01LifecycleTransition(\n"
    "\t\t\t\tinput.organisationId,\n"
    "\t\t\t\t'framework',\n"
    "\t\t\t\t'draft',\n"
    "\t\t\t\t'approved'\n"
    "\t\t\t);\n"
    "\t\t\tconst authority = await decideF01LifecyclePermission({\n"
    "\t\t\t\torganisationId: input.organisationId,\n"
    "\t\t\t\tmemberId: input.memberId,\n"
    "\t\t\t\tkind: 'framework',\n"
    "\t\t\t\tstate: 'draft',\n"
    "\t\t\t\tpermissionKey: transition.requiredPermissionKey ?? 'strategy.approve'\n"
    "\t\t\t});\n"
    "\t\t\tcanApprove = authority.allowed;\n"
    "\t\t} catch {\n"
    "\t\t\tcanApprove = false;\n"
    "\t\t}\n"
    "\t}\n",
)

# Direct strategy approval uses the same legal transition and effective authority as the generic lifecycle surface.
approval_path = 'appv2/src/lib/server/strategy/approval-service.ts'
replace_required(
    approval_path,
    "import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';\n",
    "import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';\n"
    "import { assertF01LifecycleTransition, decideF01LifecyclePermission } from './f01-lifecycle-resolver';\n",
)
replace_required(
    approval_path,
    "\tconst workspace = await getStrategyWorkspace({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId\n"
    "\t});\n"
    "\tif (!workspace.permissions.canApprove) {\n"
    "\t\tthrow new StrategyAccessError('You do not have authority to approve enterprise strategy.');\n"
    "\t}\n"
    "\tconst visibleFramework = workspace.frameworks.find(\n"
    "\t\t(framework) => framework.publicId === input.frameworkPublicId\n"
    "\t);\n"
    "\tif (!visibleFramework) {\n"
    "\t\tthrow new StrategyAccessError('Strategy cycle was not found in the active organisation.');\n"
    "\t}\n"
    "\tif (visibleFramework.lifecycleStatus !== 'draft') {\n"
    "\t\tthrow new StrategyValidationError('Only a draft strategy version can be approved.');\n"
    "\t}\n",
    "\tconst workspace = await getStrategyWorkspace({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId\n"
    "\t});\n"
    "\tconst visibleFramework = workspace.frameworks.find(\n"
    "\t\t(framework) => framework.publicId === input.frameworkPublicId\n"
    "\t);\n"
    "\tif (!visibleFramework) {\n"
    "\t\tthrow new StrategyAccessError('Strategy cycle was not found in the active organisation.');\n"
    "\t}\n"
    "\tif (visibleFramework.lifecycleStatus !== 'draft') {\n"
    "\t\tthrow new StrategyValidationError('Only a draft strategy version can be approved.');\n"
    "\t}\n"
    "\tconst transition = await assertF01LifecycleTransition(\n"
    "\t\tinput.actor.organisationId,\n"
    "\t\t'framework',\n"
    "\t\t'draft',\n"
    "\t\t'approved'\n"
    "\t);\n"
    "\tconst approvalAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: 'framework',\n"
    "\t\tstate: 'draft',\n"
    "\t\tpermissionKey: transition.requiredPermissionKey ?? 'strategy.approve'\n"
    "\t});\n"
    "\tif (!approvalAuthority.allowed) {\n"
    "\t\tthrow new StrategyAccessError('You do not have authority to approve enterprise strategy.');\n"
    "\t}\n",
)

# Business-plan approval is lifecycle-authorised and cannot jump a tenant-defined transition graph.
plan_path = 'appv2/src/lib/server/strategy/business-plan-approval-service.ts'
replace_required(
    plan_path,
    "import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';\n",
    "import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';\n"
    "import { assertF01LifecycleTransition, decideF01LifecyclePermission } from './f01-lifecycle-resolver';\n",
)
replace_required(
    plan_path,
    "\tif (!workspace.permissions.canApprove) {\n"
    "\t\tthrow new StrategyAccessError(\n"
    "\t\t\t'You do not have authority to approve enterprise business plans.'\n"
    "\t\t);\n"
    "\t}\n",
    "\tconst transition = await assertF01LifecycleTransition(\n"
    "\t\tinput.actor.organisationId,\n"
    "\t\t'plan',\n"
    "\t\t'draft',\n"
    "\t\t'approved'\n"
    "\t);\n"
    "\tconst approvalAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: 'plan',\n"
    "\t\tstate: 'draft',\n"
    "\t\tpermissionKey: transition.requiredPermissionKey ?? 'strategy.approve'\n"
    "\t});\n"
    "\tif (!approvalAuthority.allowed) {\n"
    "\t\tthrow new StrategyAccessError(\n"
    "\t\t\t'You do not have authority to approve enterprise business plans.'\n"
    "\t\t);\n"
    "\t}\n",
)

# KPI and review approvals share a lifecycle-aware approval guard.
execution_path = 'appv2/src/lib/server/strategy/execution-review-service.ts'
replace_required(
    execution_path,
    "} from './f01-service';\n",
    "} from './f01-service';\n"
    "import { assertF01LifecycleTransition, decideF01LifecyclePermission } from './f01-lifecycle-resolver';\n",
)
replace_required(
    execution_path,
    "async function requireApprove(input: {\n"
    "\torganisationId: string;\n"
    "\tmemberId: string;\n"
    "\tframeworkPublicId: string;\n"
    "}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {\n"
    "\tconst context = await requireWorkspace(input);\n"
    "\tif (!context.permissions.canApprove) {\n"
    "\t\tthrow new StrategyAccessError(\n"
    "\t\t\t'You do not have authority to approve enterprise planning records.'\n"
    "\t\t);\n"
    "\t}\n"
    "\tif (context.framework.lifecycleStatus !== 'approved') {\n"
    "\t\tthrow new StrategyValidationError(\n"
    "\t\t\t'Approval actions require an approved governing strategy version.'\n"
    "\t\t);\n"
    "\t}\n"
    "\treturn context;\n"
    "}\n",
    "async function requireApprove(input: {\n"
    "\torganisationId: string;\n"
    "\tmemberId: string;\n"
    "\tframeworkPublicId: string;\n"
    "\tkind: 'kpi' | 'review';\n"
    "}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {\n"
    "\tconst context = await requireWorkspace(input);\n"
    "\tif (context.framework.lifecycleStatus !== 'approved') {\n"
    "\t\tthrow new StrategyValidationError(\n"
    "\t\t\t'Approval actions require an approved governing strategy version.'\n"
    "\t\t);\n"
    "\t}\n"
    "\tconst transition = await assertF01LifecycleTransition(\n"
    "\t\tinput.organisationId,\n"
    "\t\tinput.kind,\n"
    "\t\t'draft',\n"
    "\t\t'approved'\n"
    "\t);\n"
    "\tconst authority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.organisationId,\n"
    "\t\tmemberId: input.memberId,\n"
    "\t\tkind: input.kind,\n"
    "\t\tstate: 'draft',\n"
    "\t\tpermissionKey: transition.requiredPermissionKey ?? 'strategy.approve'\n"
    "\t});\n"
    "\tif (!authority.allowed) {\n"
    "\t\tthrow new StrategyAccessError(\n"
    "\t\t\t'You do not have authority to approve enterprise planning records.'\n"
    "\t\t);\n"
    "\t}\n"
    "\treturn context;\n"
    "}\n",
)
replace_required(
    execution_path,
    "\tawait requireApprove({\n\t\torganisationId: input.actor.organisationId,\n\t\tmemberId: input.actor.memberId,\n\t\tframeworkPublicId: input.frameworkPublicId\n\t});\n",
    "\tawait requireApprove({\n\t\torganisationId: input.actor.organisationId,\n\t\tmemberId: input.actor.memberId,\n\t\tframeworkPublicId: input.frameworkPublicId,\n\t\tkind: 'kpi'\n\t});\n",
    1,
)
# The remaining requireApprove call belongs to review approval.
replace_required(
    execution_path,
    "\tawait requireApprove({\n\t\torganisationId: input.actor.organisationId,\n\t\tmemberId: input.actor.memberId,\n\t\tframeworkPublicId: input.frameworkPublicId\n\t});\n",
    "\tawait requireApprove({\n\t\torganisationId: input.actor.organisationId,\n\t\tmemberId: input.actor.memberId,\n\t\tframeworkPublicId: input.frameworkPublicId,\n\t\tkind: 'review'\n\t});\n",
    1,
)

# Option decisions are approval transitions, not generic edit operations.
analysis_path = 'appv2/src/lib/server/strategy/analysis-planning-service.ts'
replace_required(
    analysis_path,
    "} from './f01-service';\n",
    "} from './f01-service';\n"
    "import { assertF01LifecycleTransition, decideF01LifecyclePermission } from './f01-lifecycle-resolver';\n",
)
replace_required(
    analysis_path,
    "}): Promise<void> {\n"
    "\tawait requireManage({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tframeworkPublicId: input.frameworkPublicId\n"
    "\t});\n"
    "\tif (!['selected', 'rejected'].includes(input.decisionStatus)) {\n",
    "}): Promise<void> {\n"
    "\tconst { framework } = await requireWorkspace({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tframeworkPublicId: input.frameworkPublicId\n"
    "\t});\n"
    "\tif (framework.lifecycleStatus !== 'draft') {\n"
    "\t\tthrow new StrategyValidationError(\n"
    "\t\t\t'Approved or superseded strategy is immutable. Create a controlled revision before changing it.'\n"
    "\t\t);\n"
    "\t}\n"
    "\tif (!['selected', 'rejected'].includes(input.decisionStatus)) {\n",
    1,
)
replace_required(
    analysis_path,
    "\tconst decisionRationale = requiredText(input.decisionRationale, 'Decision rationale', 20_000);\n"
    "\tconst connection = await getPool().getConnection();\n",
    "\tconst decisionRationale = requiredText(input.decisionRationale, 'Decision rationale', 20_000);\n"
    "\tconst [optionRows] = await getPool().execute<\n"
    "\t\tArray<RowDataPacket & { decisionStatus: OptionDecisionStatus }>\n"
    "\t>(\n"
    "\t\t`SELECT option_record.decision_status AS decisionStatus\n"
    "\t\t FROM strategy_options option_record\n"
    "\t\t JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id\n"
    "\t\t WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.public_id = ?\n"
    "\t\t LIMIT 1`,\n"
    "\t\t[input.actor.organisationId, input.frameworkPublicId, input.optionPublicId]\n"
    "\t);\n"
    "\tconst option = optionRows[0];\n"
    "\tif (!option) throw new StrategyValidationError('Strategic option is not available in this strategy cycle.');\n"
    "\tconst transition = await assertF01LifecycleTransition(\n"
    "\t\tinput.actor.organisationId,\n"
    "\t\t'option',\n"
    "\t\toption.decisionStatus,\n"
    "\t\tinput.decisionStatus\n"
    "\t);\n"
    "\tconst authority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: 'option',\n"
    "\t\tstate: option.decisionStatus,\n"
    "\t\tpermissionKey: transition.requiredPermissionKey ?? 'strategy.approve'\n"
    "\t});\n"
    "\tif (!authority.allowed) {\n"
    "\t\tthrow new StrategyAccessError('You do not have authority to decide strategic options.');\n"
    "\t}\n"
    "\tconst connection = await getPool().getConnection();\n",
    1,
)

# Direct F01.04 strategy-approval shortcut follows contextual lifecycle authority rather than central-only UI flags.
business_page_path = 'appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/business-planning/+page.svelte'
replace_required(
    business_page_path,
    "{#if data.permissions.canApprove && data.framework.lifecycleStatus === 'draft'}",
    "{#if data.approvalReadiness.canApprove && data.framework.lifecycleStatus === 'draft'}",
    1,
)
