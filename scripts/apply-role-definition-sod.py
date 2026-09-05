from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} marker not found")
    return text.replace(old, new, 1)


conflict = Path('app/src/lib/server/organisations/access-conflict-policy.ts')
text = conflict.read_text()
marker = "export function accessConflictViolationMessage(\n"
helper = """export async function listMemberAccessConflictEvaluationInstants(
\tdb: DatabaseExecutor,
\tactor: TenantActorContext,
\tnow = new Date()
): Promise<Date[]> {
\tconst [roleWindows, overrideWindows] = await Promise.all([
\t\tdb
\t\t\t.selectFrom('member_role_access_windows')
\t\t\t.select(['effective_from', 'expires_at'])
\t\t\t.where('organisation_id', '=', actor.organisationId)
\t\t\t.where('organisation_member_id', '=', actor.memberId)
\t\t\t.execute(),
\t\tdb
\t\t\t.selectFrom('member_permission_override_access_windows')
\t\t\t.select(['effective_from', 'expires_at'])
\t\t\t.where('organisation_id', '=', actor.organisationId)
\t\t\t.where('organisation_member_id', '=', actor.memberId)
\t\t\t.execute()
\t]);

\tconst instants = new Map<number, Date>([[now.getTime(), now]]);
\tconst addInstant = (value: Date | null) => {
\t\tif (value !== null && value.getTime() >= now.getTime()) {
\t\t\tinstants.set(value.getTime(), value);
\t\t}
\t};
\tfor (const window of [...roleWindows, ...overrideWindows]) {
\t\taddInstant(window.effective_from);
\t\taddInstant(window.expires_at);
\t}

\treturn [...instants.values()].sort((left, right) => left.getTime() - right.getTime());
}

"""
if 'listMemberAccessConflictEvaluationInstants' not in text:
    text = replace_once(text, marker, helper + marker, 'conflict helper')
conflict.write_text(text)

repository = Path('app/src/lib/server/organisations/organisation-admin-repository.ts')
text = repository.read_text()
marker = "\n\tasync updateMemberStatus(\n"
method = """
\tasync listActiveMembersAssignedToRole(
\t\torganisationId: string,
\t\troleId: string
\t): Promise<Array<{ id: string; userId: string }>> {
\t\treturn this.db
\t\t\t.selectFrom('member_roles as assignment')
\t\t\t.innerJoin('organisation_members as member', (join) =>
\t\t\t\tjoin
\t\t\t\t\t.onRef('member.id', '=', 'assignment.organisation_member_id')
\t\t\t\t\t.onRef('member.organisation_id', '=', 'assignment.organisation_id')
\t\t\t)
\t\t\t.select(['member.id as id', 'member.user_id as userId'])
\t\t\t.where('assignment.organisation_id', '=', organisationId)
\t\t\t.where('assignment.organisation_role_id', '=', roleId)
\t\t\t.where('member.status', '=', 'active')
\t\t\t.execute();
\t}
"""
if 'listActiveMembersAssignedToRole' not in text:
    text = replace_once(text, marker, method + marker, 'assignee query')
old = "\t\t\t.where('is_active', '=', 1)\n\t\t\t.execute();\n\t\treturn rows.map((row) => row.id);\n\t}\n\n\tasync replaceMemberRoles("
new = "\t\t\t.where('is_active', '=', 1)\n\t\t\t.forUpdate()\n\t\t\t.execute();\n\t\treturn rows.map((row) => row.id);\n\t}\n\n\tasync replaceMemberRoles("
segment = text[text.find('async findActiveRoleIdsByPublicIds'):text.find('async replaceMemberRoles')]
if '.forUpdate()' not in segment:
    text = replace_once(text, old, new, 'role row lock')
repository.write_text(text)

service = Path('app/src/lib/server/organisations/organisation-admin-service.ts')
text = service.read_text()
old = "\taccessConflictViolationMessage,\n\tevaluateMemberAccessConflicts\n} from './access-conflict-policy';"
new = "\taccessConflictViolationMessage,\n\tevaluateMemberAccessConflicts,\n\tlistMemberAccessConflictEvaluationInstants\n} from './access-conflict-policy';"
if 'listMemberAccessConflictEvaluationInstants' not in text:
    text = replace_once(text, old, new, 'service import')
old = "\t\t\tconst currentRole = currentRoles.find((candidate) => candidate.publicId === role.publicId);\n\t\t\tconst couldRemoveManagerGrant ="
new = "\t\t\tconst currentRole = currentRoles.find((candidate) => candidate.publicId === role.publicId);\n\t\t\tconst addedPermissionKeys = permissionKeys.filter(\n\t\t\t\t(permissionKey) => !currentRole?.permissionKeys.includes(permissionKey)\n\t\t\t);\n\t\t\tconst accessMayIncrease =\n\t\t\t\tinput.isActive && (!role.isActive || addedPermissionKeys.length > 0);\n\t\t\tconst couldRemoveManagerGrant ="
if 'const accessMayIncrease =' not in text:
    text = replace_once(text, old, new, 'access increase detection')
old = "\t\t\tawait repository.replaceRolePermissions(actor.organisationId, role.id, permissionIds);\n\n\t\t\tif (couldRemoveManagerGrant) await this.requireActiveOrganisationManager(trx, actor);"
new = "\t\t\tawait repository.replaceRolePermissions(actor.organisationId, role.id, permissionIds);\n\n\t\t\tif (accessMayIncrease) {\n\t\t\t\tconst affectedMembers = await repository.listActiveMembersAssignedToRole(\n\t\t\t\t\tactor.organisationId,\n\t\t\t\t\trole.id\n\t\t\t\t);\n\t\t\t\tfor (const member of affectedMembers) {\n\t\t\t\t\tconst memberActor = {\n\t\t\t\t\t\torganisationId: actor.organisationId,\n\t\t\t\t\t\tuserId: member.userId,\n\t\t\t\t\t\tmemberId: member.id,\n\t\t\t\t\t\tcorrelationId: actor.correlationId\n\t\t\t\t\t};\n\t\t\t\t\tconst instants = await listMemberAccessConflictEvaluationInstants(\n\t\t\t\t\t\ttrx,\n\t\t\t\t\t\tmemberActor\n\t\t\t\t\t);\n\t\t\t\t\tfor (const at of instants) {\n\t\t\t\t\t\tawait this.requireNoAccessConflicts(trx, actor, member, at);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tif (couldRemoveManagerGrant) await this.requireActiveOrganisationManager(trx, actor);"
if 'const affectedMembers = await repository.listActiveMembersAssignedToRole' not in text:
    text = replace_once(text, old, new, 'role definition enforcement')
service.write_text(text)

tests = Path('app/src/lib/server/organisations/access-conflict-policy.integration.test.ts')
text = tests.read_text()
old = "let customManagerRoleId: string;\nlet customManagerRolePublicId: string;\nlet organisationManagePermissionId: string;"
new = "let customManagerRoleId: string;\nlet customManagerRolePublicId: string;\nlet customFinanceRoleId: string;\nlet customFinanceRolePublicId: string;\nlet organisationManagePermissionId: string;\nlet financeManagePermissionId: string;"
if 'let customFinanceRoleId: string;' not in text:
    text = replace_once(text, old, new, 'test variables')
old = "\tawait db\n\t\t.deleteFrom('member_roles')\n\t\t.where('organisation_id', '=', organisationId)\n\t\t.where('organisation_member_id', '=', targetMemberId)\n\t\t.execute();\n\tawait db.deleteFrom('outbox_events').where('organisation_id', '=', organisationId).execute();"
new = "\tawait db\n\t\t.deleteFrom('member_roles')\n\t\t.where('organisation_id', '=', organisationId)\n\t\t.where('organisation_member_id', '=', targetMemberId)\n\t\t.execute();\n\tif (customFinanceRoleId) {\n\t\tawait db\n\t\t\t.deleteFrom('role_permissions')\n\t\t\t.where('organisation_id', '=', organisationId)\n\t\t\t.where('organisation_role_id', '=', customFinanceRoleId)\n\t\t\t.execute();\n\t\tawait db\n\t\t\t.updateTable('organisation_roles')\n\t\t\t.set({ is_active: 1 })\n\t\t\t.where('organisation_id', '=', organisationId)\n\t\t\t.where('id', '=', customFinanceRoleId)\n\t\t\t.execute();\n\t}\n\tawait db.deleteFrom('outbox_events').where('organisation_id', '=', organisationId).execute();"
if 'if (customFinanceRoleId)' not in text:
    text = replace_once(text, old, new, 'test reset')
old = "\torganisationManagePermissionId = (\n\t\tawait db\n\t\t\t.selectFrom('permissions')\n\t\t\t.select('id')\n\t\t\t.where('permission_key', '=', 'organisation.manage')\n\t\t\t.executeTakeFirstOrThrow()\n\t).id;\n"
new = old + "\tfinanceManagePermissionId = (\n\t\tawait db\n\t\t\t.selectFrom('permissions')\n\t\t\t.select('id')\n\t\t\t.where('permission_key', '=', 'finance.manage')\n\t\t\t.executeTakeFirstOrThrow()\n\t).id;\n"
if 'financeManagePermissionId = (' not in text:
    text = replace_once(text, old, new, 'finance permission fixture')
old = "\tconst customManagerRole = await createRole(`${PREFIX}Custom Manager`);\n\tcustomManagerRoleId = customManagerRole.id;\n\tcustomManagerRolePublicId = customManagerRole.publicId;\n"
new = old + "\tconst customFinanceRole = await createRole(`${PREFIX}Custom Finance`);\n\tcustomFinanceRoleId = customFinanceRole.id;\n\tcustomFinanceRolePublicId = customFinanceRole.publicId;\n"
if 'const customFinanceRole =' not in text:
    text = replace_once(text, old, new, 'custom finance fixture')
old = "\t\t\t{\n\t\t\t\torganisation_id: organisationId,\n\t\t\t\torganisation_role_id: ownerRoleId,\n\t\t\t\tpermission_id: organisationManagePermissionId\n\t\t\t},\n\t\t\t{\n\t\t\t\torganisation_id: organisationId,\n\t\t\t\torganisation_role_id: customManagerRoleId,\n\t\t\t\tpermission_id: organisationManagePermissionId\n\t\t\t}"
new = "\t\t\t{\n\t\t\t\torganisation_id: organisationId,\n\t\t\t\torganisation_role_id: ownerRoleId,\n\t\t\t\tpermission_id: organisationManagePermissionId\n\t\t\t},\n\t\t\t{\n\t\t\t\torganisation_id: organisationId,\n\t\t\t\torganisation_role_id: ownerRoleId,\n\t\t\t\tpermission_id: financeManagePermissionId\n\t\t\t},\n\t\t\t{\n\t\t\t\torganisation_id: organisationId,\n\t\t\t\torganisation_role_id: customManagerRoleId,\n\t\t\t\tpermission_id: organisationManagePermissionId\n\t\t\t}"
if 'permission_id: financeManagePermissionId' not in text:
    text = replace_once(text, old, new, 'owner finance grant')
marker = "\n\tit('allows a deny to neutralise a custom grant but blocks removing the deny when toxicity would reappear', async () => {"
additions = """
\tit('rolls back an access-increasing role definition that would make an existing assignee toxic', async () => {
\t\tconst admin = new OrganisationAdminService(db);
\t\tawait admin.replaceMemberRoles(actor(), targetMemberPublicId, [
\t\t\treadOnlyRolePublicId,
\t\t\tcustomFinanceRolePublicId
\t\t]);

\t\tawait expect(
\t\t\tadmin.updateRole(actor(), {
\t\t\t\trolePublicId: customFinanceRolePublicId,
\t\t\t\tname: `${PREFIX}Custom Finance`,
\t\t\t\tdescription: null,
\t\t\t\tisActive: true,
\t\t\t\tpermissionKeys: ['finance.manage']
\t\t\t})
\t\t).rejects.toBeInstanceOf(OrganisationAdminValidationError);

\t\tconst grants = await db
\t\t\t.selectFrom('role_permissions')
\t\t\t.select('permission_id')
\t\t\t.where('organisation_id', '=', organisationId)
\t\t\t.where('organisation_role_id', '=', customFinanceRoleId)
\t\t\t.execute();
\t\texpect(grants).toEqual([]);
\t});

\tit('rejects a role definition that would become toxic when a scheduled role activates', async () => {
\t\tconst admin = new OrganisationAdminService(db);
\t\tawait admin.replaceMemberRoles(actor(), targetMemberPublicId, [
\t\t\treadOnlyRolePublicId,
\t\t\tcustomFinanceRolePublicId
\t\t]);
\t\tconst effectiveFrom = new Date(Date.now() + 60 * 60 * 1000);
\t\tawait db
\t\t\t.insertInto('member_role_access_windows')
\t\t\t.values({
\t\t\t\torganisation_id: organisationId,
\t\t\t\torganisation_member_id: targetMemberId,
\t\t\t\torganisation_role_id: readOnlyRoleId,
\t\t\t\teffective_from: effectiveFrom,
\t\t\t\texpires_at: null,
\t\t\t\treason: 'Scheduled Read Only posture'
\t\t\t})
\t\t\t.execute();

\t\tawait expect(
\t\t\tadmin.updateRole(actor(), {
\t\t\t\trolePublicId: customFinanceRolePublicId,
\t\t\t\tname: `${PREFIX}Custom Finance`,
\t\t\t\tdescription: null,
\t\t\t\tisActive: true,
\t\t\t\tpermissionKeys: ['finance.manage']
\t\t\t})
\t\t).rejects.toBeInstanceOf(OrganisationAdminValidationError);
\t});

\tit('rejects a role definition that would become toxic when a temporary deny expires', async () => {
\t\tconst admin = new OrganisationAdminService(db);
\t\tawait admin.replaceMemberRoles(actor(), targetMemberPublicId, [
\t\t\treadOnlyRolePublicId,
\t\t\tcustomFinanceRolePublicId
\t\t]);
\t\tconst expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
\t\tawait new MemberPermissionOverrideService(db).setOverride(actor(), {
\t\t\tmemberPublicId: targetMemberPublicId,
\t\t\tpermissionKey: 'finance.manage',
\t\t\teffect: 'deny',
\t\t\treason: 'Temporary conflict suppression',
\t\t\texpiresAt
\t\t});

\t\tawait expect(
\t\t\tadmin.updateRole(actor(), {
\t\t\t\trolePublicId: customFinanceRolePublicId,
\t\t\t\tname: `${PREFIX}Custom Finance`,
\t\t\t\tdescription: null,
\t\t\t\tisActive: true,
\t\t\t\tpermissionKeys: ['finance.manage']
\t\t\t})
\t\t).rejects.toBeInstanceOf(OrganisationAdminValidationError);
\t});

\tit('allows a legitimate access increase when no assignee conflict exists', async () => {
\t\tconst admin = new OrganisationAdminService(db);
\t\tawait admin.replaceMemberRoles(actor(), targetMemberPublicId, [customFinanceRolePublicId]);

\t\tawait admin.updateRole(actor(), {
\t\t\trolePublicId: customFinanceRolePublicId,
\t\t\tname: `${PREFIX}Custom Finance`,
\t\t\tdescription: 'Finance administration without Read Only',
\t\t\tisActive: true,
\t\t\tpermissionKeys: ['finance.manage']
\t\t});

\t\tconst grant = await db
\t\t\t.selectFrom('role_permissions')
\t\t\t.select('permission_id')
\t\t\t.where('organisation_id', '=', organisationId)
\t\t\t.where('organisation_role_id', '=', customFinanceRoleId)
\t\t\t.where('permission_id', '=', financeManagePermissionId)
\t\t\t.executeTakeFirstOrThrow();
\t\texpect(grant.permission_id).toBe(financeManagePermissionId);
\t});
"""
if 'rolls back an access-increasing role definition' not in text:
    text = replace_once(text, marker, additions + marker, 'test cases')
tests.write_text(text)

docs = Path('docs/architecture/access-conflict-governance.md')
text = docs.read_text()
marker = "Reactivating a member is checked before the status transition commits, preventing dormant legacy assignments from becoming active if they violate current policy.\n"
paragraph = "\nAccess-increasing role-definition changes are also evaluated transactionally against every active assignee of the role. Evaluation includes the current instant plus persisted future role-assignment and permission-override lifecycle boundaries for each affected member, so a role edit cannot create toxicity at a scheduled activation or when a temporary deny expires. Access-reducing role edits are not blocked by unrelated pre-existing conflict state. Member-role replacement locks selected role rows, serialising ordinary assignment changes with concurrent role-definition mutation.\n"
if 'Access-increasing role-definition changes are also evaluated' not in text:
    text = replace_once(text, marker, marker + paragraph, 'governance documentation')
docs.write_text(text)
