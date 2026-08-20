from pathlib import Path

repo = Path('app/src/lib/server/assets/assets-maintenance-repository.ts')
text = repo.read_text()
start = text.index('export type EvidenceVersionSummary = {')
end = text.index('\n\nexport class AssetsMaintenanceRepository', start)
text = text[:start] + '''export type EvidenceVersionSummary = {
\tid: string;
\tpublicId: string;
\tprojectId: string;
\tcontainerNumber: string;
\ttitle: string;
\trevisionCode: string;
\tversionStatus: string;
};''' + text[end:]
start = text.index('\tasync listEvidenceVersions(')
end = text.rfind('\n}')
methods = '''\tasync listEvidenceVersions(
\t\torganisationId: string,
\t\tprojectIds: readonly string[]
\t): Promise<EvidenceVersionSummary[]> {
\t\tif (projectIds.length === 0) return [];
\t\treturn this.db
\t\t\t.selectFrom('information_container_versions as version')
\t\t\t.innerJoin('information_containers as container', 'container.id', 'version.information_container_id')
\t\t\t.select([
\t\t\t\t'version.id as id',
\t\t\t\t'version.public_id as publicId',
\t\t\t\t'version.project_id as projectId',
\t\t\t\t'container.container_number as containerNumber',
\t\t\t\t'container.title as title',
\t\t\t\t'version.revision_code as revisionCode',
\t\t\t\t'version.version_status as versionStatus'
\t\t\t])
\t\t\t.where('version.project_id', 'in', [...projectIds])
\t\t\t.where('version.owning_organisation_id', '=', organisationId)
\t\t\t.where('version.version_status', 'in', ['issued', 'superseded'])
\t\t\t.orderBy('container.container_number')
\t\t\t.orderBy('version.version_sequence', 'desc')
\t\t\t.execute();
\t}

\tasync findEvidenceVersionByPublicId(
\t\torganisationId: string,
\t\tprojectIds: readonly string[],
\t\tpublicId: string
\t) {
\t\tif (projectIds.length === 0) return null;
\t\treturn (
\t\t\t(await this.db
\t\t\t\t.selectFrom('information_container_versions')
\t\t\t\t.select(['id', 'public_id as publicId', 'project_id as projectId'])
\t\t\t\t.where('project_id', 'in', [...projectIds])
\t\t\t\t.where('owning_organisation_id', '=', organisationId)
\t\t\t\t.where('public_id', '=', publicId)
\t\t\t\t.where('version_status', 'in', ['issued', 'superseded'])
\t\t\t\t.executeTakeFirst()) ?? null
\t\t);
\t}
'''
text = text[:start] + methods + text[end:]
repo.write_text(text)

route = Path('app/src/routes/(app)/assets/+page.server.ts')
text = route.read_text()
text = text.replace(
    "\tif (!actor) return new AssetsMaintenanceService(getDatabase()).getWorkspace({ organisationId: '', userId: '', memberId: '', correlationId: locals.correlationId });",
    "\tif (!actor) throw redirect(303, '/signin');"
)
route.write_text(text)

service = Path('app/src/lib/server/assets/assets-maintenance-service.ts')
text = service.read_text()
marker = '\n\tasync createBuilding(actor: TenantActorContext, input: CreateBuildingInput): Promise<string> {'
method = '''
\n\tasync linkFacilityProject(
\t\tactor: TenantActorContext,
\t\tfacilityPublicIdInput: string,
\t\tprojectPublicIdInput: string,
\t\tlinkRoleInput: string
\t): Promise<void> {
\t\tawait this.assertActiveActor(actor);
\t\tawait this.requirePermission(actor, 'facilities.manage');
\t\tconst facility = await this.requireFacility(actor, facilityPublicIdInput);
\t\tconst project = await new ProjectRepository(this.db).findForMemberByPublicId(
\t\t\tactor.organisationId,
\t\t\tactor.memberId,
\t\t\tpublicId(projectPublicIdInput, 'Project')
\t\t);
\t\tif (!project) throw new TenantAccessError('Project is outside your effective project scope.');
\t\tconst roles = ['construction', 'handover', 'fit_out', 'refurbishment', 'maintenance', 'replacement', 'decommissioning', 'other'] as const;
\t\tif (!roles.includes(linkRoleInput as (typeof roles)[number])) {
\t\t\tthrow new AssetsMaintenanceValidationError('Facility-project link role is invalid.');
\t\t}
\t\tawait this.db.transaction().execute(async (trx) => {
\t\t\tawait trx.insertInto('facility_project_links').ignore().values({
\t\t\t\torganisation_id: actor.organisationId,
\t\t\t\tfacility_id: facility.id,
\t\t\t\tproject_id: project.id,
\t\t\t\tlink_role: linkRoleInput as (typeof roles)[number],
\t\t\t\tlinked_on: dayOf(this.now()),
\t\t\t\tended_on: null,
\t\t\t\tlinked_by_member_id: actor.memberId
\t\t\t}).execute();
\t\t\tawait this.audit(trx, actor, 'facilities.project.link', 'facility', facility.public_id, { projectPublicId: project.publicId, linkRole: linkRoleInput }, project.id);
\t\t});
\t}
'''
if 'async linkFacilityProject(' not in text:
    if marker not in text:
        raise SystemExit('createBuilding marker missing')
    text = text.replace(marker, method + marker)

replacements = {
"const subject = await trx.selectFrom('assets').select(['id']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Asset not found.');": "const subject = await trx.selectFrom('assets').select(['id', 'facility_id as facilityId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Asset not found.'); await this.requireFacilityProjectEvidenceLink(trx, actor, subject.facilityId, version.projectId);",
"const subject = await trx.selectFrom('work_orders').select(['id']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Work order not found.');": "const subject = await trx.selectFrom('work_orders').select(['id', 'facility_id as facilityId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Work order not found.'); await this.requireFacilityProjectEvidenceLink(trx, actor, subject.facilityId, version.projectId);",
"const subject = await trx.selectFrom('asset_service_events').select(['id']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Service event not found.');": "const subject = await trx.selectFrom('asset_service_events as event').innerJoin('assets as asset', (join) => join.onRef('asset.id', '=', 'event.asset_id').onRef('asset.organisation_id', '=', 'event.organisation_id')).select(['event.id as id', 'asset.facility_id as facilityId']).where('event.organisation_id', '=', actor.organisationId).where('event.public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Service event not found.'); await this.requireFacilityProjectEvidenceLink(trx, actor, subject.facilityId, version.projectId);",
"const subject = await trx.selectFrom('compliance_events').select(['id']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Compliance event not found.');": "const subject = await trx.selectFrom('compliance_events as event').innerJoin('asset_compliance_assignments as assignment', (join) => join.onRef('assignment.id', '=', 'event.asset_compliance_assignment_id').onRef('assignment.organisation_id', '=', 'event.organisation_id')).innerJoin('assets as asset', (join) => join.onRef('asset.id', '=', 'assignment.asset_id').onRef('asset.organisation_id', '=', 'event.organisation_id')).select(['event.id as id', 'asset.facility_id as facilityId']).where('event.organisation_id', '=', actor.organisationId).where('event.public_id', '=', subjectId).executeTakeFirst(); if (!subject) throw new TenantAccessError('Compliance event not found.'); await this.requireFacilityProjectEvidenceLink(trx, actor, subject.facilityId, version.projectId);"
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
    elif 'requireFacilityProjectEvidenceLink(trx, actor' not in text:
        raise SystemExit(f'evidence patch marker missing: {old[:100]}')

audit_marker = '\n\tprivate async audit(db: DatabaseExecutor, actor: TenantActorContext, actionKey: string, subjectType: string, subjectPublicId: string, changeSummary: Record<string, unknown>): Promise<void> {'
helper = '''
\n\tprivate async requireFacilityProjectEvidenceLink(
\t\tdb: DatabaseExecutor,
\t\tactor: TenantActorContext,
\t\tfacilityId: string,
\t\tprojectId: string
\t): Promise<void> {
\t\tconst link = await db.selectFrom('facility_project_links').select('facility_id')
\t\t\t.where('organisation_id', '=', actor.organisationId)
\t\t\t.where('facility_id', '=', facilityId)
\t\t\t.where('project_id', '=', projectId)
\t\t\t.where('ended_on', 'is', null)
\t\t\t.executeTakeFirst();
\t\tif (!link) throw new AssetsMaintenanceValidationError('Evidence project is not linked to the subject facility.');
\t}
'''
if 'private async requireFacilityProjectEvidenceLink(' not in text:
    if audit_marker not in text:
        raise SystemExit('audit marker missing')
    text = text.replace(audit_marker, helper + '\n\tprivate async audit(db: DatabaseExecutor, actor: TenantActorContext, actionKey: string, subjectType: string, subjectPublicId: string, changeSummary: Record<string, unknown>, projectId: string | null = null): Promise<void> {')
    text = text.replace('\n\t\t\tprojectId: null, actionKey, subjectType, subjectPublicId, correlationId:', '\n\t\t\tprojectId, actionKey, subjectType, subjectPublicId, correlationId:')
service.write_text(text)

nav = Path('app/src/lib/navigation/app-navigation.ts')
text = nav.read_text()
if "id: 'assets'" not in text:
    site_pos = text.index("id: 'site'")
    marker = "\t\t\t}\n\t\t]\n\t},\n\t{\n\t\tid: 'finance'"
    pos = text.index(marker, site_pos)
    assets_item = '''\t\t\t},
\t\t\t{
\t\t\t\tid: 'assets',
\t\t\t\tlabel: 'Assets / Facilities',
\t\t\t\thref: '/assets',
\t\t\t\tanyPermissionNamespaces: ['assets.', 'facilities.', 'maintenance.', 'compliance.'],
\t\t\t\tchildren: [
\t\t\t\t\t{ id: 'asset-register', label: 'Asset register', href: '/assets#asset-register', anyPermissionNamespaces: ['assets.'] },
\t\t\t\t\t{ id: 'maintenance-work-orders', label: 'Work orders', href: '/assets#work-order-register', anyPermissionNamespaces: ['maintenance.'] },
\t\t\t\t\t{ id: 'asset-compliance', label: 'Compliance', href: '/assets#compliance-register', anyPermissionNamespaces: ['compliance.'] }
\t\t\t\t]
'''
    text = text[:pos] + assets_item + text[pos + len('\t\t\t'):]
if "id: 'new-asset'" not in text:
    q = text.index('const quickActions:')
    end = text.index('\n];', q)
    quick = '''
\t{
\t\tid: 'new-asset',
\t\tlabel: 'Asset',
\t\thref: '/assets#create-asset',
\t\tdescription: 'Register a maintainable operational asset.',
\t\tanyPermissions: ['assets.manage']
\t},
\t{
\t\tid: 'new-maintenance-request',
\t\tlabel: 'Maintenance request',
\t\thref: '/assets#create-maintenance-request',
\t\tdescription: 'Report a reactive asset or facility issue.',
\t\tanyPermissions: ['maintenance.request.manage']
\t},
\t{
\t\tid: 'new-maintenance-plan',
\t\tlabel: 'Maintenance plan',
\t\thref: '/assets#create-maintenance-plan',
\t\tdescription: 'Create planned maintenance for an asset.',
\t\tanyPermissions: ['maintenance.plan.manage']
\t},'''
    text = text[:end] + ',\n' + quick + text[end:]
nav.write_text(text)

auth = Path('app/e2e/authenticated-workspaces.e2e.ts')
text = auth.read_text()
if "name: 'Assets / Facilities'" not in text:
    text = text.replace("\tawait expect(primaryNavigation.getByRole('link', { name: 'Site', exact: true })).toBeVisible();", "\tawait expect(primaryNavigation.getByRole('link', { name: 'Site', exact: true })).toBeVisible();\n\tawait expect(primaryNavigation.getByRole('link', { name: 'Assets / Facilities', exact: true })).toBeVisible();")
    text = text.replace("\tawait page.getByLabel('Find a workspace').fill('year-end');", "\tawait page.getByLabel('Find a workspace').fill('assets');\n\tawait expect(page.locator('.search-results').getByRole('link', { name: /Assets \\/ Facilities/ }).first()).toBeVisible();\n\tawait page.getByLabel('Find a workspace').fill('year-end');")
    text = text.replace("\tawait expect(createPopover.getByRole('link', { name: /Safety observation/ })).toBeVisible();", "\tawait expect(createPopover.getByRole('link', { name: /Safety observation/ })).toBeVisible();\n\tawait expect(createPopover.getByRole('link', { name: /^Asset$/ })).toBeVisible();\n\tawait expect(createPopover.getByRole('link', { name: /Maintenance request/ })).toBeVisible();\n\tawait expect(createPopover.getByRole('link', { name: /Maintenance plan/ })).toBeVisible();")
    text = text.replace("\t\t'/site',", "\t\t'/site',\n\t\t'/assets',")
auth.write_text(text)

perms = Path('app/e2e/ui-permissions.e2e.ts')
text = perms.read_text()
if "name: 'Assets / Facilities'" not in text:
    text = text.replace("\tawait expect(primaryNavigation.getByRole('link', { name: 'Site', exact: true })).toBeVisible();", "\tawait expect(primaryNavigation.getByRole('link', { name: 'Site', exact: true })).toBeVisible();\n\tawait expect(primaryNavigation.getByRole('link', { name: 'Assets / Facilities', exact: true })).toBeVisible();")
    anchor = "\n\tawait page.goto('/finance/accounting/periods');"
    checks = '''
\n\tawait page.goto('/assets');
\tawait expect(page.getByRole('heading', { name: 'Assets & facilities', exact: true, level: 1 })).toBeVisible();
\tawait expect(page.locator('#create-facility')).toHaveCount(0);
\tawait expect(page.locator('#create-building')).toHaveCount(0);
\tawait expect(page.locator('#create-level')).toHaveCount(0);
\tawait expect(page.locator('#create-space')).toHaveCount(0);
\tawait expect(page.locator('#create-asset-type')).toHaveCount(0);
\tawait expect(page.locator('#create-asset')).toHaveCount(0);
\tawait expect(page.locator('#create-maintenance-request')).toHaveCount(0);
\tawait expect(page.locator('#create-maintenance-plan')).toHaveCount(0);
\tawait expect(page.locator('#create-service-event')).toHaveCount(0);
\tawait expect(page.locator('#create-compliance-requirement')).toHaveCount(0);
\tawait expect(page.locator('#assign-compliance')).toHaveCount(0);
\tawait expect(page.locator('#record-compliance-event')).toHaveCount(0);
\tawait expect(page.getByRole('button', { name: /Register asset|Report request|Generate work order|Assign contractor|Complete work order|Record service event|Publish version 1|Assign requirement|Record compliance event|Update lifecycle/ })).toHaveCount(0);
'''
    text = text.replace(anchor, checks + anchor)
perms.write_text(text)
