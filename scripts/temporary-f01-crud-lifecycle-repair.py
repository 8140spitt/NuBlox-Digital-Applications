from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def insert_manage_link(path: str, start_marker: str, link: str) -> None:
    text = read(path)
    if link.strip() in text:
        return
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"Start marker not found in {path}: {start_marker}")
    close = text.find("</article>", start)
    if close < 0:
        raise SystemExit(f"Article close not found after {start_marker} in {path}")
    text = text[:close] + link + "\n\t\t\t\t\t" + text[close:]
    write(path, text)


# Route contract: one canonical management URL for every F01 record.
route = "appv2/src/lib/routing/route-contract.ts"
replace_once(
    route,
    "export type AppStrategyFrameworkPath = `/${string}/app/functions/f01/strategies/${string}`;\nexport type AppStrategyAnalysisPath",
    "export type AppStrategyFrameworkPath = `/${string}/app/functions/f01/strategies/${string}`;\nexport type AppStrategyManagePath =\n\t`/${string}/app/functions/f01/strategies/${string}/manage/${string}/${string}`;\nexport type StrategyManageRecordKind =\n\t| 'framework'\n\t| 'evidence'\n\t| 'factor'\n\t| 'assumption'\n\t| 'option'\n\t| 'theme'\n\t| 'objective'\n\t| 'plan'\n\t| 'initiative'\n\t| 'requirement'\n\t| 'handoff'\n\t| 'kpi'\n\t| 'review'\n\t| 'decision';\nexport type AppStrategyAnalysisPath"
)
replace_once(
    route,
    "\tstrategyFramework: (tenant: string, strategyPublicId: string): AppStrategyFrameworkPath =>\n\t\tstrategyBase(tenant, strategyPublicId) as AppStrategyFrameworkPath,\n\tstrategyAnalysis:",
    "\tstrategyFramework: (tenant: string, strategyPublicId: string): AppStrategyFrameworkPath =>\n\t\tstrategyBase(tenant, strategyPublicId) as AppStrategyFrameworkPath,\n\tstrategyManage: (\n\t\ttenant: string,\n\t\tstrategyPublicId: string,\n\t\trecordKind: StrategyManageRecordKind,\n\t\trecordPublicId: string\n\t): AppStrategyManagePath =>\n\t\t`${strategyBase(tenant, strategyPublicId)}/manage/${requiredSegment(recordKind, 'Record kind')}/${requiredSegment(recordPublicId, 'Record')}` as AppStrategyManagePath,\n\tstrategyAnalysis:"
)

# Strategy approval: an approved predecessor is superseded only when its controlled revision is approved.
approval = "appv2/src/lib/server/strategy/approval-service.ts"
replace_once(
    approval,
    "\ttitle: string;\n\tlifecycleStatus: 'draft' | 'approved' | 'superseded';\n};",
    "\ttitle: string;\n\tlifecycleStatus: 'draft' | 'approved' | 'superseded';\n\tsupersedesFrameworkId: string | number | null;\n};"
)
replace_once(
    approval,
    "\t\t        title,\n\t\t        lifecycle_status AS lifecycleStatus\n\t\t FROM strategy_frameworks",
    "\t\t        title,\n\t\t        lifecycle_status AS lifecycleStatus,\n\t\t        supersedes_strategy_framework_id AS supersedesFrameworkId\n\t\t FROM strategy_frameworks"
)
start = read(approval).index("async function findOtherApprovedFramework(")
end = read(approval).index("\nexport async function approveStrategyFramework", start)
text = read(approval)
replacement = '''async function findOtherApprovedFramework(
\tconnection: PoolConnection,
\torganisationId: string,
\tframeworkId: string
): Promise<{ id: string; publicId: string; code: string } | null> {
\tconst [rows] = await connection.execute<
\t\t(RowDataPacket & { id: string | number; publicId: string; code: string })[]
\t>(
\t\t`SELECT id, public_id AS publicId, framework_code AS code
\t\t FROM strategy_frameworks
\t\t WHERE organisation_id = ?
\t\t   AND lifecycle_status = 'approved'
\t\t   AND id <> ?
\t\t ORDER BY approved_at DESC, id DESC
\t\t LIMIT 1
\t\t FOR UPDATE`,
\t\t[organisationId, frameworkId]
\t);
\tconst row = rows[0];
\treturn row ? { id: row.id.toString(), publicId: row.publicId, code: row.code } : null;
}
'''
write(approval, text[:start] + replacement + text[end:])
text = read(approval).replace(",\n\ttype StrategyFrameworkSummary", "")
write(approval, text)
replace_once(
    approval,
    "\t\tif (existingApproved) {\n\t\t\tthrow new StrategyValidationError(\n\t\t\t\t`An approved strategy (${existingApproved.code}) already exists. Create a controlled revision rather than approving a parallel current strategy.`\n\t\t\t);\n\t\t}\n\n\t\tconst [activationResult]",
    "\t\tif (existingApproved) {\n\t\t\tif (framework.supersedesFrameworkId?.toString() !== existingApproved.id) {\n\t\t\t\tthrow new StrategyValidationError(\n\t\t\t\t\t`An approved strategy (${existingApproved.code}) already exists. Only its controlled revision can replace the current enterprise direction.`\n\t\t\t\t);\n\t\t\t}\n\t\t\tawait connection.execute(\n\t\t\t\t`UPDATE strategy_frameworks\n\t\t\t\t SET lifecycle_status = 'superseded'\n\t\t\t\t WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,\n\t\t\t\t[input.actor.organisationId, existingApproved.id]\n\t\t\t);\n\t\t} else if (framework.supersedesFrameworkId) {\n\t\t\tthrow new StrategyValidationError(\n\t\t\t\t'The strategy revision is stale because its predecessor is no longer the current approved strategy.'\n\t\t\t);\n\t\t}\n\n\t\tconst [activationResult]"
)
replace_once(
    approval,
    "\t\t\t\tactivatedDraftObjectiveCount: activationResult.affectedRows\n\t\t\t},",
    "\t\t\t\tactivatedDraftObjectiveCount: activationResult.affectedRows,\n\t\t\t\tsupersededFrameworkPublicId: existingApproved?.publicId ?? null\n\t\t\t},"
)

# Business-plan approval: revision approval supersedes predecessor atomically.
plan_approval = "appv2/src/lib/server/strategy/business-plan-approval-service.ts"
replace_once(
    plan_approval,
    "\tcode: string;\n\tlifecycleStatus: 'draft' | 'approved' | 'superseded';",
    "\tcode: string;\n\tlifecycleStatus: 'draft' | 'approved' | 'superseded';\n\tsupersedesBusinessPlanId: string | number | null;"
)
replace_once(
    plan_approval,
    "\t\t        plan.plan_code AS code,\n\t\t        plan.lifecycle_status AS lifecycleStatus,",
    "\t\t        plan.plan_code AS code,\n\t\t        plan.lifecycle_status AS lifecycleStatus,\n\t\t        plan.supersedes_business_plan_id AS supersedesBusinessPlanId,"
)
replace_once(
    plan_approval,
    "\t\tif (Number(plan.orphanRequirementCount) > 0) {\n\t\t\tthrow new StrategyValidationError(\n\t\t\t\t'Every identified resource requirement must be handed to its authoritative business function before the business plan can be approved.'\n\t\t\t);\n\t\t}\n\n\t\tawait connection.execute(",
    "\t\tif (Number(plan.orphanRequirementCount) > 0) {\n\t\t\tthrow new StrategyValidationError(\n\t\t\t\t'Every identified resource requirement must be handed to its authoritative business function before the business plan can be approved.'\n\t\t\t);\n\t\t}\n\n\t\tconst [approvedRows] = await connection.execute<\n\t\t\t(RowDataPacket & { id: string | number; publicId: string })[]\n\t\t>(\n\t\t\t`SELECT id, public_id AS publicId\n\t\t\t FROM strategy_business_plans\n\t\t\t WHERE organisation_id = ?\n\t\t\t   AND strategy_framework_id = (SELECT strategy_framework_id FROM strategy_business_plans WHERE id = ?)\n\t\t\t   AND plan_code = ?\n\t\t\t   AND lifecycle_status = 'approved'\n\t\t\t   AND id <> ?\n\t\t\t LIMIT 1 FOR UPDATE`,\n\t\t\t[input.actor.organisationId, plan.id, plan.code, plan.id]\n\t\t);\n\t\tconst previousApproved = approvedRows[0] ?? null;\n\t\tif (previousApproved) {\n\t\t\tif (plan.supersedesBusinessPlanId?.toString() !== previousApproved.id.toString()) {\n\t\t\t\tthrow new StrategyValidationError(\n\t\t\t\t\t'An approved version of this business plan already exists. Approve only a controlled revision of the current version.'\n\t\t\t\t);\n\t\t\t}\n\t\t\tawait connection.execute(\n\t\t\t\t`UPDATE strategy_business_plans SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,\n\t\t\t\t[input.actor.organisationId, previousApproved.id]\n\t\t\t);\n\t\t} else if (plan.supersedesBusinessPlanId) {\n\t\t\tthrow new StrategyValidationError(\n\t\t\t\t'The business-plan revision is stale because its predecessor is no longer the current approved version.'\n\t\t\t);\n\t\t}\n\n\t\tawait connection.execute("
)
replace_once(
    plan_approval,
    "\t\t\t\torphanRequirementCount: 0\n\t\t\t},",
    "\t\t\t\torphanRequirementCount: 0,\n\t\t\t\tsupersededBusinessPlanPublicId: previousApproved?.publicId ?? null\n\t\t\t},"
)

# KPI approval: version revisions replace the previous approved KPI without overwriting evidence.
execution = "appv2/src/lib/server/strategy/execution-review-service.ts"
replace_once(
    execution,
    "\t\t\t(RowDataPacket & { id: string | number; code: string; lifecycleStatus: KpiStatus })[]",
    "\t\t\t(RowDataPacket & {\n\t\t\t\tid: string | number;\n\t\t\t\tcode: string;\n\t\t\t\tlifecycleStatus: KpiStatus;\n\t\t\t\tsupersedesKpiId: string | number | null;\n\t\t\t})[]"
)
replace_once(
    execution,
    "\t\t\t`SELECT id, kpi_code AS code, lifecycle_status AS lifecycleStatus\n\t\t\t FROM strategy_kpis",
    "\t\t\t`SELECT id, kpi_code AS code, lifecycle_status AS lifecycleStatus,\n\t\t\t        supersedes_strategy_kpi_id AS supersedesKpiId\n\t\t\t FROM strategy_kpis"
)
replace_once(
    execution,
    "\t\tif (kpi.lifecycleStatus !== 'draft')\n\t\t\tthrow new StrategyValidationError('Only a draft KPI can be approved.');\n\t\tawait connection.execute(",
    "\t\tif (kpi.lifecycleStatus !== 'draft')\n\t\t\tthrow new StrategyValidationError('Only a draft KPI can be approved.');\n\t\tconst [approvedRows] = await connection.execute<\n\t\t\t(RowDataPacket & { id: string | number; publicId: string })[]\n\t\t>(\n\t\t\t`SELECT id, public_id AS publicId FROM strategy_kpis\n\t\t\t WHERE organisation_id = ? AND strategy_framework_id = ? AND kpi_code = ?\n\t\t\t   AND lifecycle_status = 'approved' AND id <> ?\n\t\t\t LIMIT 1 FOR UPDATE`,\n\t\t\t[input.actor.organisationId, framework.id, kpi.code, kpi.id]\n\t\t);\n\t\tconst previousApproved = approvedRows[0] ?? null;\n\t\tif (previousApproved) {\n\t\t\tif (kpi.supersedesKpiId?.toString() !== previousApproved.id.toString()) {\n\t\t\t\tthrow new StrategyValidationError(\n\t\t\t\t\t'An approved version of this KPI already exists. Approve only a controlled revision of the current definition.'\n\t\t\t\t);\n\t\t\t}\n\t\t\tawait connection.execute(\n\t\t\t\t`UPDATE strategy_kpis SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,\n\t\t\t\t[input.actor.organisationId, previousApproved.id]\n\t\t\t);\n\t\t} else if (kpi.supersedesKpiId) {\n\t\t\tthrow new StrategyValidationError(\n\t\t\t\t'The KPI revision is stale because its predecessor is no longer the current approved definition.'\n\t\t\t);\n\t\t}\n\t\tawait connection.execute("
)
replace_once(
    execution,
    "\t\t\tchangeSummary: { kpiCode: kpi.code, lifecycleStatus: 'approved' },",
    "\t\t\tchangeSummary: {\n\t\t\t\tkpiCode: kpi.code,\n\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\tsupersededKpiPublicId: previousApproved?.publicId ?? null\n\t\t\t},"
)

# Strategy overview: show current workflow, not Superseded as an upcoming stage.
overview = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/+page.svelte"
text = read(overview)
old_start = text.index("\tconst lifecycle = $derived(")
old_end = text.index("\n\tconst areas = $derived", old_start)
new_lifecycle = '''\tconst lifecycle = $derived(
\t\tframework.lifecycleStatus === 'draft'
\t\t\t? [
\t\t\t\t\t{ label: 'Draft', state: 'current' as const },
\t\t\t\t\t{ label: 'Approval', state: 'upcoming' as const }
\t\t\t\t]
\t\t\t: framework.lifecycleStatus === 'approved'
\t\t\t\t? [
\t\t\t\t\t\t{ label: 'Draft', state: 'complete' as const },
\t\t\t\t\t\t{ label: 'Approved · current', state: 'current' as const }
\t\t\t\t\t]
\t\t\t\t: [
\t\t\t\t\t\t{ label: 'Draft', state: 'complete' as const },
\t\t\t\t\t\t{ label: 'Approved', state: 'complete' as const },
\t\t\t\t\t\t{ label: 'Historical', state: 'current' as const }
\t\t\t\t\t]
\t);
'''
write(overview, text[:old_start] + new_lifecycle + text[old_end:])
replace_once(
    overview,
    "\t\t<LifecycleStrip steps={lifecycle} label=\"Strategy version lifecycle\" />",
    "\t\t<div class=\"lifecycle-controls\">\n\t\t\t<LifecycleStrip steps={lifecycle} label=\"Strategy version lifecycle\" />\n\t\t\t<LinkButton\n\t\t\t\thref={routes.strategyManage(data.tenant.slug, framework.publicId, 'framework', framework.publicId)}\n\t\t\t\tvariant=\"secondary\">Manage / lifecycle</LinkButton\n\t\t\t>\n\t\t</div>"
)
replace_once(
    overview,
    "\t.workspace-actions {",
    "\t.lifecycle-controls {\n\t\tdisplay: grid;\n\t\tgap: var(--nb-space-4);\n\t}\n\t.lifecycle-controls :global(a) {\n\t\tjustify-self: end;\n\t}\n\n\t.workspace-actions {"
)

# Manage links from every currently visible F01 record card.
analysis = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/analysis/+page.svelte"
insert_manage_link(analysis, "{#each data.evidence as evidence", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'evidence', evidence.publicId)} variant=\"quiet\">Manage</LinkButton>")
insert_manage_link(analysis, "{#each data.factors as factor", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'factor', factor.publicId)} variant=\"quiet\">Manage</LinkButton>")
insert_manage_link(analysis, "{#each data.assumptions as assumption", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'assumption', assumption.publicId)} variant=\"quiet\">Manage</LinkButton>")

planning = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/planning/+page.svelte"
insert_manage_link(planning, "{#each data.options as option", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'option', option.publicId)} variant=\"quiet\">Manage</LinkButton>")
insert_manage_link(planning, "{#each data.themes as theme", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'theme', theme.publicId)} variant=\"quiet\">Manage</LinkButton>")
insert_manage_link(planning, "{#each data.objectives as objective", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'objective', objective.publicId)} variant=\"quiet\">Manage</LinkButton>")

business = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/business-planning/+page.svelte"
insert_manage_link(business, "{#each data.plans as plan", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'plan', plan.publicId)} variant=\"quiet\">Manage / lifecycle</LinkButton>")
insert_manage_link(business, "{#each data.initiatives as initiative", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'initiative', initiative.publicId)} variant=\"quiet\">Manage / lifecycle</LinkButton>")
insert_manage_link(business, "{#each data.resourceRequirements as requirement", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'requirement', requirement.publicId)} variant=\"quiet\">Manage</LinkButton>")
insert_manage_link(business, "{#each data.handoffs as handoff", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'handoff', handoff.publicId)} variant=\"quiet\">Manage / lifecycle</LinkButton>")

performance = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/performance/+page.svelte"
insert_manage_link(performance, "{#each data.kpis as kpi", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'kpi', kpi.publicId)} variant=\"quiet\">Manage / lifecycle</LinkButton>")

review = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/review/+page.svelte"
insert_manage_link(review, "{#each data.reviews as review", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'review', review.publicId)} variant=\"quiet\">Manage / lifecycle</LinkButton>")
insert_manage_link(review, "{#each data.decisions as decision", "\n\t\t\t\t\t\t<LinkButton href={routes.strategyManage(data.tenant.slug, data.framework.publicId, 'decision', decision.publicId)} variant=\"quiet\">Manage / lifecycle</LinkButton>")

print('F01 CRUD/lifecycle patches applied')
