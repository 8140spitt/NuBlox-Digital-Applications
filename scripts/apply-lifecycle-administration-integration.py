from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {text.count(old)}")
    file.write_text(text.replace(old, new, 1))


# Route contract: expose lifecycle administration as a canonical internal route.
path = "appv2/src/lib/routing/route-contract.ts"
replace_once(
    path,
    "export type AppDesignSystemPath = `/${string}/app/design-system`;\n",
    "export type AppDesignSystemPath = `/${string}/app/design-system`;\n"
    "export type AppLifecyclePath = `/${string}/app/lifecycle`;\n"
    "export type AppLifecycleTemplatePath = `/${string}/app/lifecycle/${string}`;\n",
)
replace_once(
    path,
    "\tdesignSystem: (tenant: string): AppDesignSystemPath =>\n\t\tappPath(tenant, 'design-system') as AppDesignSystemPath,\n",
    "\tdesignSystem: (tenant: string): AppDesignSystemPath =>\n\t\tappPath(tenant, 'design-system') as AppDesignSystemPath,\n"
    "\tlifecycle: (tenant: string): AppLifecyclePath =>\n\t\tappPath(tenant, 'lifecycle') as AppLifecyclePath,\n"
    "\tlifecycleTemplate: (tenant: string, templatePublicId: string): AppLifecycleTemplatePath =>\n"
    "\t\t`${appPath(tenant, 'lifecycle')}/${requiredSegment(templatePublicId, 'Lifecycle template')}` as AppLifecycleTemplatePath,\n",
)

# Protected shell: expose lifecycle administration only to authorised users.
path = "appv2/src/routes/[tenant]/app/(protected)/+layout.server.ts"
replace_once(
    path,
    "import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';\n",
    "import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';\n"
    "import { decidePermissions } from '$lib/server/auth/permission-service';\n",
)
replace_once(
    path,
    "\treturn {\n\t\ttenant: {\n",
    "\tconst toolPermissions = await decidePermissions({\n"
    "\t\torganisationId: access.organisationId,\n"
    "\t\tmemberId: access.memberId,\n"
    "\t\tpermissionKeys: ['lifecycle.view']\n"
    "\t});\n\n"
    "\treturn {\n\t\ttenant: {\n",
)
replace_once(
    path,
    "\t\tuser: {\n\t\t\tid: session.user.id,\n\t\t\tname: session.user.name,\n\t\t\temail: session.user.email\n\t\t}\n",
    "\t\tuser: {\n\t\t\tid: session.user.id,\n\t\t\tname: session.user.name,\n\t\t\temail: session.user.email\n\t\t},\n"
    "\t\ttoolAccess: {\n"
    "\t\t\tlifecycle: toolPermissions.get('lifecycle.view')?.allowed === true\n"
    "\t\t}\n",
)

path = "appv2/src/routes/[tenant]/app/(protected)/+layout.svelte"
replace_once(
    path,
    "<ApplicationShell tenant={data.tenant} user={data.user}>\n",
    "<ApplicationShell tenant={data.tenant} user={data.user} toolAccess={data.toolAccess}>\n",
)

path = "appv2/src/lib/components/shell/ApplicationShell.svelte"
replace_once(
    path,
    "\t\ttenant,\n\t\tuser,\n\t\tchildren\n\t}: {\n\t\ttenant: { slug: string; displayName: string };\n\t\tuser: { name: string; email: string };\n\t\tchildren: Snippet;\n",
    "\t\ttenant,\n\t\tuser,\n\t\ttoolAccess,\n\t\tchildren\n\t}: {\n\t\ttenant: { slug: string; displayName: string };\n\t\tuser: { name: string; email: string };\n\t\ttoolAccess: { lifecycle: boolean };\n\t\tchildren: Snippet;\n",
)
replace_once(
    path,
    "\t\t{\n\t\t\tlabel: 'Tools',\n\t\t\titems: [{ label: 'Design system', href: routes.designSystem(tenant.slug), icon: 'system' }]\n\t\t}\n",
    "\t\t{\n\t\t\tlabel: 'Tools',\n\t\t\titems: [\n"
    "\t\t\t\t...(toolAccess.lifecycle\n"
    "\t\t\t\t\t? [{ label: 'Lifecycle administration', href: routes.lifecycle(tenant.slug), icon: 'system' as const }]\n"
    "\t\t\t\t\t: []),\n"
    "\t\t\t\t{ label: 'Design system', href: routes.designSystem(tenant.slug), icon: 'system' }\n"
    "\t\t\t]\n\t\t}\n",
)

# F01 managed records: resolve tenant lifecycle bindings while retaining code-backed fallbacks.
path = "appv2/src/lib/server/strategy/f01-record-management-service.ts"
replace_once(
    path,
    "import {\n\tassertLifecycleTransition,\n\tcanDeleteF01Record,\n\tcanEditF01Record,\n\tcanReviseF01Record,\n\tlifecycleTransitions,\n\ttype F01LifecycleTransition,\n\ttype F01ManagedRecordKind\n} from './f01-lifecycle';\n",
    "import type { F01LifecycleTransition, F01ManagedRecordKind } from './f01-lifecycle';\n"
    "import {\n"
    "\tassertF01LifecycleTransition,\n"
    "\tcanF01LifecycleOperation,\n"
    "\tdecideF01LifecyclePermission,\n"
    "\tf01LifecycleTransitions\n"
    "} from './f01-lifecycle-resolver';\n",
)
replace_once(
    path,
    "function permissionFilteredTransitions(\n\tkind: F01ManagedRecordKind,\n\tstatus: string,\n\tpermissions: StrategyPermissionFlags\n): readonly F01LifecycleTransition[] {\n\treturn lifecycleTransitions(kind, status).filter((transition) => {\n\t\tif (\n\t\t\ttransition.to === 'approved' ||\n\t\t\t(kind === 'option' && ['selected', 'rejected'].includes(transition.to))\n\t\t) {\n\t\t\treturn permissions.canApprove;\n\t\t}\n\t\treturn permissions.canManage;\n\t});\n}\n",
    "async function permissionFilteredTransitions(\n"
    "\torganisationId: string,\n"
    "\tmemberId: string,\n"
    "\tkind: F01ManagedRecordKind,\n"
    "\tstatus: string\n"
    "): Promise<readonly F01LifecycleTransition[]> {\n"
    "\tconst transitions = await f01LifecycleTransitions(organisationId, kind, status);\n"
    "\tconst decisions = await Promise.all(\n"
    "\t\ttransitions.map(async (transition) => {\n"
    "\t\t\tconst requiredPermissionKey =\n"
    "\t\t\t\ttransition.requiredPermissionKey ??\n"
    "\t\t\t\t(transition.to === 'approved' ||\n"
    "\t\t\t\t(kind === 'option' && ['selected', 'rejected'].includes(transition.to))\n"
    "\t\t\t\t\t? 'strategy.approve'\n"
    "\t\t\t\t\t: 'strategy.manage');\n"
    "\t\t\tconst decision = await decideF01LifecyclePermission({\n"
    "\t\t\t\torganisationId,\n"
    "\t\t\t\tmemberId,\n"
    "\t\t\t\tkind,\n"
    "\t\t\t\tstate: status,\n"
    "\t\t\t\tpermissionKey: requiredPermissionKey\n"
    "\t\t\t});\n"
    "\t\t\treturn decision.allowed ? transition : null;\n"
    "\t\t})\n"
    "\t);\n"
    "\treturn decisions.filter((transition): transition is F01LifecycleTransition => transition !== null);\n"
    "}\n",
)
replace_once(
    path,
    "\treturn {\n\t\tkind: input.kind,\n",
    "\tconst manageAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId,\n"
    "\t\tmemberId: input.memberId,\n"
    "\t\tkind: input.kind,\n"
    "\t\tstate: status,\n"
    "\t\tpermissionKey: 'strategy.manage'\n"
    "\t});\n"
    "\tconst [policyCanEdit, policyCanDelete, policyCanRevise, permittedTransitions] = await Promise.all([\n"
    "\t\tcanF01LifecycleOperation(organisationId, input.kind, status, 'edit'),\n"
    "\t\tcanF01LifecycleOperation(organisationId, input.kind, status, 'delete'),\n"
    "\t\tcanF01LifecycleOperation(organisationId, input.kind, status, 'revise'),\n"
    "\t\tpermissionFilteredTransitions(organisationId, input.memberId, input.kind, status)\n"
    "\t]);\n\n"
    "\treturn {\n\t\tkind: input.kind,\n",
)
replace_once(
    path,
    "\t\tcanEdit: permissions.canManage && strategyAllowsEditing && canEditF01Record(input.kind, status),\n\t\tcanDelete:\n\t\t\tpermissions.canManage && strategyAllowsEditing && canDeleteF01Record(input.kind, status),\n\t\tcanRevise: permissions.canManage && canReviseF01Record(input.kind, status),\n\t\ttransitions: permissionFilteredTransitions(input.kind, status, permissions).filter(() => {\n",
    "\t\tcanEdit: manageAuthority.allowed && strategyAllowsEditing && policyCanEdit,\n"
    "\t\tcanDelete: manageAuthority.allowed && strategyAllowsEditing && policyCanDelete,\n"
    "\t\tcanRevise: manageAuthority.allowed && policyCanRevise,\n"
    "\t\ttransitions: permittedTransitions.filter(() => {\n",
)

# Update: lifecycle phase capability and phase-scoped strategy.manage authority.
replace_once(
    path,
    "\tconst { framework } = await requireManage(input);\n\tawait ensureFrameworkPhase(framework, input.kind);\n\tconst currentStatus = await statusFor({\n",
    "\tconst { framework } = await frameworkContext({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tframeworkPublicId: input.frameworkPublicId\n"
    "\t});\n"
    "\tif (framework.lifecycleStatus === 'superseded') {\n"
    "\t\tthrow new StrategyValidationError('Superseded strategy versions are immutable enterprise history.');\n"
    "\t}\n"
    "\tawait ensureFrameworkPhase(framework, input.kind);\n\tconst currentStatus = await statusFor({\n",
)
replace_once(
    path,
    "\tif (!canEditF01Record(input.kind, currentStatus)) {\n\t\tthrow new StrategyValidationError(\n\t\t\t`The ${input.kind} record cannot be edited while it is ${currentStatus}.`\n\t\t);\n\t}\n\tconst connection = await getPool().getConnection();\n",
    "\tconst manageAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: input.kind,\n"
    "\t\tstate: currentStatus,\n"
    "\t\tpermissionKey: 'strategy.manage'\n"
    "\t});\n"
    "\tif (!manageAuthority.allowed) {\n"
    "\t\tthrow new StrategyAccessError('You do not have authority to edit this record in its current lifecycle phase.');\n"
    "\t}\n"
    "\tif (!(await canF01LifecycleOperation(input.actor.organisationId, input.kind, currentStatus, 'edit'))) {\n"
    "\t\tthrow new StrategyValidationError(\n\t\t\t`The ${input.kind} record cannot be edited while it is ${currentStatus}.`\n\t\t);\n\t}\n\tconst connection = await getPool().getConnection();\n",
)

# Delete: separate governed delete capability and authority from editability.
replace_once(
    path,
    "\tconst { framework } = await requireManage(input);\n\tawait ensureFrameworkPhase(framework, input.kind);\n\tconst currentStatus = await statusFor({\n",
    "\tconst { framework } = await frameworkContext({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tframeworkPublicId: input.frameworkPublicId\n"
    "\t});\n"
    "\tif (framework.lifecycleStatus === 'superseded') {\n"
    "\t\tthrow new StrategyValidationError('Superseded strategy versions are immutable enterprise history.');\n"
    "\t}\n"
    "\tawait ensureFrameworkPhase(framework, input.kind);\n\tconst currentStatus = await statusFor({\n",
)
replace_once(
    path,
    "\tif (!canDeleteF01Record(input.kind, currentStatus))\n\t\tthrow new StrategyValidationError(\n\t\t\t`The ${input.kind} record cannot be deleted while it is ${currentStatus}. Use its lifecycle action instead.`\n\t\t);\n\tconst connection = await getPool().getConnection();\n",
    "\tconst manageAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: input.kind,\n"
    "\t\tstate: currentStatus,\n"
    "\t\tpermissionKey: 'strategy.manage'\n"
    "\t});\n"
    "\tif (!manageAuthority.allowed) {\n"
    "\t\tthrow new StrategyAccessError('You do not have authority to delete this record in its current lifecycle phase.');\n"
    "\t}\n"
    "\tif (!(await canF01LifecycleOperation(input.actor.organisationId, input.kind, currentStatus, 'delete')))\n"
    "\t\tthrow new StrategyValidationError(\n\t\t\t`The ${input.kind} record cannot be deleted while it is ${currentStatus}. Use its lifecycle action instead.`\n\t\t);\n\tconst connection = await getPool().getConnection();\n",
)

# Transition: template transition metadata determines required permission; phase grants may satisfy it.
replace_once(
    path,
    "\tconst transition = assertLifecycleTransition(input.kind, currentStatus, input.targetStatus);\n\tconst requiresApproval =\n\t\tinput.targetStatus === 'approved' ||\n\t\t(input.kind === 'option' && ['selected', 'rejected'].includes(input.targetStatus));\n\tif (requiresApproval && !permissions.canApprove)\n\t\tthrow new StrategyAccessError(\n\t\t\t'You do not have authority to complete this approval or decision.'\n\t\t);\n\tif (!requiresApproval && !permissions.canManage)\n\t\tthrow new StrategyAccessError(\n\t\t\t'You do not have authority to move this record through its lifecycle.'\n\t\t);\n",
    "\tconst transition = await assertF01LifecycleTransition(\n"
    "\t\tinput.actor.organisationId,\n\t\tinput.kind,\n\t\tcurrentStatus,\n\t\tinput.targetStatus\n\t);\n"
    "\tconst requiredPermissionKey =\n"
    "\t\ttransition.requiredPermissionKey ??\n"
    "\t\t(input.targetStatus === 'approved' ||\n"
    "\t\t(input.kind === 'option' && ['selected', 'rejected'].includes(input.targetStatus))\n"
    "\t\t\t? 'strategy.approve'\n\t\t\t: 'strategy.manage');\n"
    "\tconst transitionAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: input.kind,\n"
    "\t\tstate: currentStatus,\n"
    "\t\tpermissionKey: requiredPermissionKey\n"
    "\t});\n"
    "\tif (!transitionAuthority.allowed) {\n"
    "\t\tthrow new StrategyAccessError(\n"
    "\t\t\t`You do not have ${requiredPermissionKey} authority for this lifecycle transition.`\n"
    "\t\t);\n"
    "\t}\n",
)
# Existing destructured permissions is now unused in transition function.
replace_once(
    path,
    "\tconst { framework, permissions } = await frameworkContext({\n\t\torganisationId: input.actor.organisationId,\n\t\tmemberId: input.actor.memberId,\n\t\tframeworkPublicId: input.frameworkPublicId\n\t});\n\tconst currentStatus = await statusFor({\n",
    "\tconst { framework } = await frameworkContext({\n\t\torganisationId: input.actor.organisationId,\n\t\tmemberId: input.actor.memberId,\n\t\tframeworkPublicId: input.frameworkPublicId\n\t});\n\tconst currentStatus = await statusFor({\n",
)

# Revise: allow contextual strategy.manage grant while retaining lifecycle revisability.
replace_once(
    path,
    "}): Promise<{ publicId: string }> {\n\tawait requireManage(input);\n\tconst currentStatus = await statusFor({\n",
    "}): Promise<{ publicId: string }> {\n"
    "\tconst { framework } = await frameworkContext({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tframeworkPublicId: input.frameworkPublicId\n"
    "\t});\n"
    "\tif (framework.lifecycleStatus === 'superseded') {\n"
    "\t\tthrow new StrategyValidationError('Superseded strategy versions are immutable enterprise history.');\n"
    "\t}\n"
    "\tconst currentStatus = await statusFor({\n",
)
replace_once(
    path,
    "\tif (!canReviseF01Record(input.kind, currentStatus))\n\t\tthrow new StrategyValidationError(`Only an approved ${input.kind} can be revised.`);\n\tconst connection = await getPool().getConnection();\n",
    "\tconst manageAuthority = await decideF01LifecyclePermission({\n"
    "\t\torganisationId: input.actor.organisationId,\n"
    "\t\tmemberId: input.actor.memberId,\n"
    "\t\tkind: input.kind,\n"
    "\t\tstate: currentStatus,\n"
    "\t\tpermissionKey: 'strategy.manage'\n"
    "\t});\n"
    "\tif (!manageAuthority.allowed) {\n"
    "\t\tthrow new StrategyAccessError('You do not have authority to revise this record in its current lifecycle phase.');\n"
    "\t}\n"
    "\tif (!(await canF01LifecycleOperation(input.actor.organisationId, input.kind, currentStatus, 'revise')))\n"
    "\t\tthrow new StrategyValidationError(`Only an approved ${input.kind} can be revised.`);\n\tconst connection = await getPool().getConnection();\n",
)

# Document the operational administration surface.
path = "docs/20-record-lifecycles.md"
text = Path(path).read_text()
append = """

## Lifecycle administration

Tenant administrators with `lifecycle.view`, `lifecycle.manage` and `lifecycle.publish` authority use the V2 Lifecycle administration workspace at `/{tenant}/app/lifecycle`.

Lifecycle definitions are governed business configuration, not mutable application constants:

- a new template begins as a working minor version (`0.1`);
- meaningful changes advance the working minor version;
- publishing produces an immutable major version (`1.0`, `2.0`, ...);
- changing a published template creates a controlled draft revision;
- publication of the successor makes the previous major historical/superseded;
- object-type bindings point only to published versions;
- Advanced lifecycle roles are mapped to existing tenant organisation roles rather than creating a second identity or RBAC model; and
- phase-scoped grants are evaluated only after explicit member denies, so a lifecycle can add contextual authority but cannot defeat an absolute deny.

F01 is the first runtime consumer. Each F01 object type resolves an active tenant binding such as `F01.framework`; if no published tenant binding exists, the code-backed F01 reference template remains the safe fallback. This allows controlled adoption without changing the semantics of existing tenants.
"""
if "## Lifecycle administration" not in text:
    Path(path).write_text(text.rstrip() + append + "\n")
