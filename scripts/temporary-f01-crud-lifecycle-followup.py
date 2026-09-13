from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# A controlled strategy revision must not treat its own approved predecessor as a conflict.
readiness = 'appv2/src/lib/server/strategy/approval-readiness-service.ts'
replace_once(
    readiness,
    "\tid: string | number;\n\tlifecycleStatus: 'draft' | 'approved' | 'superseded';\n};",
    "\tid: string | number;\n\tlifecycleStatus: 'draft' | 'approved' | 'superseded';\n\tsupersedesFrameworkId: string | number | null;\n};"
)
replace_once(
    readiness,
    "`SELECT id, lifecycle_status AS lifecycleStatus\n\t\t FROM strategy_frameworks",
    "`SELECT id, lifecycle_status AS lifecycleStatus,\n\t\t        supersedes_strategy_framework_id AS supersedesFrameworkId\n\t\t FROM strategy_frameworks"
)
replace_once(
    readiness,
    "\t\t   AND lifecycle_status = 'approved'\n\t\t   AND id <> ?\n\t\t ORDER BY approved_at DESC, id DESC\n\t\t LIMIT 1`,\n\t\t[input.organisationId, frameworkId]",
    "\t\t   AND lifecycle_status = 'approved'\n\t\t   AND id <> ?\n\t\t   AND (? IS NULL OR id <> ?)\n\t\t ORDER BY approved_at DESC, id DESC\n\t\t LIMIT 1`,\n\t\t[\n\t\t\tinput.organisationId,\n\t\t\tframeworkId,\n\t\t\tframework.supersedesFrameworkId,\n\t\t\tframework.supersedesFrameworkId\n\t\t]"
)

# Hide execution records belonging only to superseded plan versions from the current execution thread.
execution = 'appv2/src/lib/server/strategy/execution-review-service.ts'
text = Path(execution).read_text()
text = text.replace(
    "\t\t WHERE plan.strategy_framework_id = ?\n\t\t ORDER BY initiative.priority_rank, initiative.start_date, initiative.initiative_code`,",
    "\t\t WHERE plan.strategy_framework_id = ?\n\t\t   AND plan.lifecycle_status <> 'superseded'\n\t\t ORDER BY initiative.priority_rank, initiative.start_date, initiative.initiative_code`,",
    1,
)
text = text.replace(
    "\t\t WHERE plan.strategy_framework_id = ?\n\t\t ORDER BY requirement.need_by, requirement.created_at`,",
    "\t\t WHERE plan.strategy_framework_id = ?\n\t\t   AND plan.lifecycle_status <> 'superseded'\n\t\t ORDER BY requirement.need_by, requirement.created_at`,",
    1,
)
text = text.replace(
    "\t\t WHERE plan.strategy_framework_id = ?\n\t\t ORDER BY handoff.requested_at DESC`,",
    "\t\t WHERE plan.strategy_framework_id = ?\n\t\t   AND plan.lifecycle_status <> 'superseded'\n\t\t ORDER BY handoff.requested_at DESC`,",
    1,
)
Path(execution).write_text(text)

# Enforce strategy phase on lifecycle transitions as well as on direct edits.
management = 'appv2/src/lib/server/strategy/f01-record-management-service.ts'
replace_once(
    management,
    "\t\ttransitions: permissionFilteredTransitions(input.kind, status, permissions),",
    "\t\ttransitions: permissionFilteredTransitions(input.kind, status, permissions).filter(() => {\n\t\t\tif (framework.lifecycleStatus === 'superseded') return false;\n\t\t\tif (['evidence', 'factor', 'option', 'theme'].includes(input.kind)) {\n\t\t\t\treturn framework.lifecycleStatus === 'draft';\n\t\t\t}\n\t\t\tif (input.kind === 'objective') return framework.lifecycleStatus === 'approved';\n\t\t\tif (input.kind === 'framework') return framework.lifecycleStatus === 'draft';\n\t\t\tif (['plan', 'initiative', 'requirement', 'handoff', 'kpi', 'review', 'decision'].includes(input.kind)) {\n\t\t\t\treturn framework.lifecycleStatus === 'approved';\n\t\t\t}\n\t\t\treturn true;\n\t\t}),"
)
p = Path(management)
text = p.read_text()
needle = "\tconst transition = assertLifecycleTransition(input.kind, currentStatus, input.targetStatus);"
if needle not in text:
    raise SystemExit('Lifecycle transition assertion not found')
guard = """\tif (framework.lifecycleStatus === 'superseded') {
\t\tthrow new StrategyValidationError('Superseded strategy history cannot be changed.');
\t}
\tif (
\t\t['evidence', 'factor', 'option', 'theme'].includes(input.kind) &&
\t\tframework.lifecycleStatus !== 'draft'
\t) {
\t\tthrow new StrategyValidationError(
\t\t\t'This strategic-intent record is immutable after strategy approval. Create a controlled strategy revision.'
\t\t);
\t}
\tif (input.kind === 'objective' && framework.lifecycleStatus !== 'approved') {
\t\tthrow new StrategyValidationError(
\t\t\t'Objective outcome transitions apply only after strategy approval.'
\t\t);
\t}
\tif (
\t\t['plan', 'initiative', 'requirement', 'handoff', 'kpi', 'review', 'decision'].includes(
\t\t\tinput.kind
\t\t) &&
\t\tframework.lifecycleStatus !== 'approved'
\t) {
\t\tthrow new StrategyValidationError(
\t\t\t'Execution and review lifecycle transitions require the current approved strategy.'
\t\t);
\t}
"""
text = text.replace(needle, guard + needle, 1)
# The source service has a legacy one-line superseded check after authoritative approval dispatches.
# The early guard above owns this rule and must run before every dispatch path.
legacy_guard = "\tif (framework.lifecycleStatus === 'superseded') throw new StrategyValidationError('Superseded strategy history cannot be changed.');\n"
text = text.replace(legacy_guard, '', 1)
p.write_text(text)

# Keep automatic carry-forward selections reactive without capturing derived data in $state initialisers.
business = Path('appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/business-planning/new/[record]/+page.svelte')
text = business.read_text()
text = text.replace(
    "\tlet selectedPlanPublicId = $state(\n\t\tfieldValue('planPublicId', draftPlans.length === 1 ? (draftPlans[0]?.publicId ?? '') : '')\n\t);\n\tlet selectedObjectivePublicId = $state(fieldValue('objectivePublicId'));\n\tlet selectedInitiativePublicId = $state(\n\t\tfieldValue(\n\t\t\t'initiativePublicId',\n\t\t\topenInitiatives.length === 1 ? (openInitiatives[0]?.publicId ?? '') : ''\n\t\t)\n\t);",
    "\tlet selectedPlanPublicId = $state(fieldValue('planPublicId'));\n\tlet selectedObjectivePublicId = $state(fieldValue('objectivePublicId'));\n\tlet selectedInitiativePublicId = $state(fieldValue('initiativePublicId'));"
)
text = text.replace(
    "\t$effect(() => {\n\t\tif (!selectedPlan) {",
    "\t$effect(() => {\n\t\tif (!selectedPlanPublicId && draftPlans.length === 1) {\n\t\t\tselectedPlanPublicId = draftPlans[0]?.publicId ?? '';\n\t\t}\n\t\tif (!selectedInitiativePublicId && openInitiatives.length === 1) {\n\t\t\tselectedInitiativePublicId = openInitiatives[0]?.publicId ?? '';\n\t\t}\n\t\tif (!selectedPlan) {"
)
business.write_text(text)

performance = Path('appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/performance/new/[record]/+page.svelte')
text = performance.read_text()
text = text.replace(
    "\tlet selectedObjectivePublicId = $state(\n\t\tfieldValue(\n\t\t\t'objectivePublicId',\n\t\t\tdata.objectives.length === 1 ? (data.objectives[0]?.publicId ?? '') : ''\n\t\t)\n\t);",
    "\tlet selectedObjectivePublicId = $state(fieldValue('objectivePublicId'));"
)
text = text.replace(
    "\tconst contributingInitiatives = $derived(\n\t\tselectedObjective\n\t\t\t? data.initiatives.filter(\n\t\t\t\t\t(initiative) => initiative.objectivePublicId === selectedObjective.publicId\n\t\t\t\t)\n\t\t\t: []\n\t);",
    "\tconst contributingInitiatives = $derived(\n\t\tselectedObjective\n\t\t\t? data.initiatives.filter(\n\t\t\t\t\t(initiative) => initiative.objectivePublicId === selectedObjective.publicId\n\t\t\t\t)\n\t\t\t: []\n\t);\n\n\t$effect(() => {\n\t\tif (!selectedObjectivePublicId && data.objectives.length === 1) {\n\t\t\tselectedObjectivePublicId = data.objectives[0]?.publicId ?? '';\n\t\t}\n\t});"
)
performance.write_text(text)

review = Path('appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/review/new/[record]/+page.svelte')
text = review.read_text()
text = text.replace(
    "\tlet selectedReviewPublicId = $state(\n\t\tfieldValue('reviewPublicId', draftReviews.length === 1 ? (draftReviews[0]?.publicId ?? '') : '')\n\t);",
    "\tlet selectedReviewPublicId = $state(fieldValue('reviewPublicId'));"
)
anchor = "\tconst selectedReview = $derived(\n\t\tdraftReviews.find((review) => review.publicId === selectedReviewPublicId) ?? null\n\t);"
if anchor in text:
    text = text.replace(
        anchor,
        anchor + "\n\n\t$effect(() => {\n\t\tif (!selectedReviewPublicId && draftReviews.length === 1) {\n\t\t\tselectedReviewPublicId = draftReviews[0]?.publicId ?? '';\n\t\t}\n\t});",
        1,
    )
else:
    state_line = "\tlet selectedReviewPublicId = $state(fieldValue('reviewPublicId'));"
    text = text.replace(
        state_line,
        state_line + "\n\n\t$effect(() => {\n\t\tif (!selectedReviewPublicId && draftReviews.length === 1) {\n\t\t\tselectedReviewPublicId = draftReviews[0]?.publicId ?? '';\n\t\t}\n\t});",
        1,
    )
review.write_text(text)

print('F01 revision/lifecycle follow-up patches applied')
