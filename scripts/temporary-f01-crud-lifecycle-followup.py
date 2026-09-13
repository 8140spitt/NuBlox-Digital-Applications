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
p.write_text(text)

print('F01 revision/lifecycle follow-up patches applied')
