import { isTenantRouteSlug, portalDashboardPath, portalPath } from '$lib/routing/route-contract';
import type { DatabaseExecutor } from '$lib/server/db/executor';

export type TenantRouteContext = {
	organisationId: string;
	organisationPublicId: string;
	tenantSlug: string;
	organisationName: string;
};

export type PortalRouteContext = TenantRouteContext & {
	partyId: string;
	partyPublicId: string;
	partySlug: string;
	partyName: string;
};

export type PortalWorkSummary = {
	publicId: string;
	owningOrganisationId: string;
	owningOrganisationName: string;
	domainKey: string;
	sourceType: string;
	sourcePublicId: string;
	actionType: string;
	title: string;
	summary: string | null;
	state: string;
	dueAt: Date | null;
	completedAt: Date | null;
	href: string | null;
};

export type PortalProjectSummary = {
	collaboratorPublicId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	projectStatus: string;
	owningOrganisationName: string;
	crmOrganisationName: string | null;
	roles: string[];
};

function organisationName(row: { legalName: string; tradingName: string | null }): string {
	return row.tradingName?.trim() || row.legalName;
}

function partyName(row: {
	kind: string;
	companyLegalName: string | null;
	companyTradingName: string | null;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
}): string {
	if (row.kind === 'organisation') {
		return (
			row.companyTradingName?.trim() || row.companyLegalName?.trim() || 'External organisation'
		);
	}
	return (
		[row.preferredName?.trim() || row.givenNames?.trim(), row.familyName?.trim()]
			.filter(Boolean)
			.join(' ') || 'External contact'
	);
}

function normaliseStoredRouteSlug(value: string, fallback: string): string {
	const normalised = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 80);
	return (
		normalised ||
		fallback
			.replace(/[^a-z0-9]+/gi, '')
			.toLowerCase()
			.slice(0, 80) ||
		'context'
	);
}

async function availableOrganisationSlug(
	db: DatabaseExecutor,
	candidate: string
): Promise<boolean> {
	const row = await db
		.selectFrom('tenant_route_contexts')
		.select('organisation_id')
		.where('route_slug', '=', candidate)
		.executeTakeFirst();
	return !row;
}

async function availablePartySlug(
	db: DatabaseExecutor,
	organisationId: string,
	candidate: string
): Promise<boolean> {
	const row = await db
		.selectFrom('party_route_contexts')
		.select('party_id')
		.where('organisation_id', '=', organisationId)
		.where('route_slug', '=', candidate)
		.executeTakeFirst();
	return !row;
}

export async function allocateOrganisationRouteSlug(
	db: DatabaseExecutor,
	name: string
): Promise<string> {
	let base = normaliseStoredRouteSlug(name, 'tenant');
	if (!isTenantRouteSlug(base)) base = `tenant-${base}`.slice(0, 80);
	if (await availableOrganisationSlug(db, base)) return base;
	for (let suffix = 2; suffix <= 9999; suffix += 1) {
		const candidate = `${base.slice(0, 90)}-${suffix}`;
		if (await availableOrganisationSlug(db, candidate)) return candidate;
	}
	throw new Error('Unable to allocate a unique tenant route slug.');
}

export async function allocatePartyRouteSlug(
	db: DatabaseExecutor,
	organisationId: string,
	name: string
): Promise<string> {
	const base = normaliseStoredRouteSlug(name, 'party');
	if (await availablePartySlug(db, organisationId, base)) return base;
	for (let suffix = 2; suffix <= 9999; suffix += 1) {
		const candidate = `${base.slice(0, 90)}-${suffix}`;
		if (await availablePartySlug(db, organisationId, candidate)) return candidate;
	}
	throw new Error('Unable to allocate a unique CRM party route slug.');
}

export class RouteContextService {
	constructor(private readonly db: DatabaseExecutor) {}

	private async ensureOrganisationSlug(row: {
		organisationId: string;
		tenantSlug: string | null;
		legalName: string;
		tradingName: string | null;
	}): Promise<string> {
		if (row.tenantSlug) return row.tenantSlug;
		const candidate = await allocateOrganisationRouteSlug(
			this.db,
			row.tradingName?.trim() || row.legalName
		);
		await this.db
			.insertInto('tenant_route_contexts')
			.values({ organisation_id: row.organisationId, route_slug: candidate })
			.onDuplicateKeyUpdate({ route_slug: candidate })
			.executeTakeFirst();
		const current = await this.db
			.selectFrom('tenant_route_contexts')
			.select('route_slug as routeSlug')
			.where('organisation_id', '=', row.organisationId)
			.executeTakeFirstOrThrow();
		return current.routeSlug;
	}

	private async ensurePartySlug(row: {
		organisationId: string;
		partyId: string;
		partySlug: string | null;
		kind: string;
		companyLegalName: string | null;
		companyTradingName: string | null;
		preferredName: string | null;
		givenNames: string | null;
		familyName: string | null;
	}): Promise<string> {
		if (row.partySlug) return row.partySlug;
		const candidate = await allocatePartyRouteSlug(this.db, row.organisationId, partyName(row));
		await this.db
			.insertInto('party_route_contexts')
			.values({
				organisation_id: row.organisationId,
				party_id: row.partyId,
				route_slug: candidate
			})
			.onDuplicateKeyUpdate({ route_slug: candidate })
			.executeTakeFirst();
		const current = await this.db
			.selectFrom('party_route_contexts')
			.select('route_slug as routeSlug')
			.where('organisation_id', '=', row.organisationId)
			.where('party_id', '=', row.partyId)
			.executeTakeFirstOrThrow();
		return current.routeSlug;
	}

	private portalContextQuery(now: Date) {
		return this.db
			.selectFrom('routing_external_portal_access_contexts as portal_context')
			.innerJoin(
				'external_access_grants as grant',
				'grant.id',
				'portal_context.external_access_grant_id'
			)
			.innerJoin('organisations as owner', 'owner.id', 'portal_context.owning_organisation_id')
			.leftJoin('tenant_route_contexts as tenant_route', 'tenant_route.organisation_id', 'owner.id')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'portal_context.party_id')
					.onRef('party.organisation_id', '=', 'portal_context.owning_organisation_id')
			)
			.leftJoin('party_route_contexts as party_route', (join) =>
				join
					.onRef('party_route.party_id', '=', 'party.id')
					.onRef('party_route.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'owner.id as organisationId',
				'owner.public_id as organisationPublicId',
				'tenant_route.route_slug as tenantSlug',
				'owner.legal_name as legalName',
				'owner.trading_name as tradingName',
				'party.id as partyId',
				'party.public_id as partyPublicId',
				'party_route.route_slug as partySlug',
				'party.party_kind as kind',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName'
			])
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', now)
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', now)])
			)
			.where('owner.status', '=', 'active')
			.where('party.status', '=', 'active');
	}

	private async mapPortalContext(row: {
		organisationId: string;
		organisationPublicId: string;
		tenantSlug: string | null;
		legalName: string;
		tradingName: string | null;
		partyId: string;
		partyPublicId: string;
		partySlug: string | null;
		kind: string;
		companyLegalName: string | null;
		companyTradingName: string | null;
		preferredName: string | null;
		givenNames: string | null;
		familyName: string | null;
	}): Promise<PortalRouteContext> {
		const tenantSlug = await this.ensureOrganisationSlug(row);
		const routePartySlug = await this.ensurePartySlug(row);
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug,
			organisationName: organisationName(row),
			partyId: row.partyId,
			partyPublicId: row.partyPublicId,
			partySlug: routePartySlug,
			partyName: partyName(row)
		};
	}

	async findTenantBySlug(tenantSlug: string): Promise<TenantRouteContext | null> {
		const row = await this.db
			.selectFrom('tenant_route_contexts as route')
			.innerJoin('organisations as organisation', 'organisation.id', 'route.organisation_id')
			.select([
				'organisation.id as organisationId',
				'organisation.public_id as organisationPublicId',
				'route.route_slug as tenantSlug',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName'
			])
			.where('route.route_slug', '=', tenantSlug)
			.where('organisation.status', '=', 'active')
			.executeTakeFirst();
		if (!row) return null;
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug: row.tenantSlug,
			organisationName: organisationName(row)
		};
	}

	async findTenantByOrganisationId(organisationId: string): Promise<TenantRouteContext | null> {
		const row = await this.db
			.selectFrom('organisations as organisation')
			.leftJoin('tenant_route_contexts as route', 'route.organisation_id', 'organisation.id')
			.select([
				'organisation.id as organisationId',
				'organisation.public_id as organisationPublicId',
				'route.route_slug as tenantSlug',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName'
			])
			.where('organisation.id', '=', organisationId)
			.where('organisation.status', '=', 'active')
			.executeTakeFirst();
		if (!row) return null;
		const tenantSlug = await this.ensureOrganisationSlug(row);
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug,
			organisationName: organisationName(row)
		};
	}

	async findPortalContext(
		authUserId: string,
		tenantSlug: string,
		partySlug: string,
		now: Date = new Date()
	): Promise<PortalRouteContext | null> {
		const row = await this.portalContextQuery(now)
			.where('portal_context.auth_user_id', '=', authUserId)
			.where('tenant_route.route_slug', '=', tenantSlug)
			.where('party_route.route_slug', '=', partySlug)
			.executeTakeFirst();
		return row ? this.mapPortalContext(row) : null;
	}

	async findDefaultPortalContext(
		authUserId: string,
		now: Date = new Date()
	): Promise<PortalRouteContext | null> {
		const row = await this.portalContextQuery(now)
			.where('portal_context.auth_user_id', '=', authUserId)
			.orderBy('owner.legal_name', 'asc')
			.orderBy('party.public_id', 'asc')
			.executeTakeFirst();
		return row ? this.mapPortalContext(row) : null;
	}

	async findPortalContextForWorkItem(
		authUserId: string,
		workItemPublicId: string,
		now: Date = new Date()
	): Promise<PortalRouteContext | null> {
		const row = await this.portalContextQuery(now)
			.innerJoin('external_work_items as work', 'work.external_access_grant_id', 'grant.id')
			.where('portal_context.auth_user_id', '=', authUserId)
			.where('work.auth_user_id', '=', authUserId)
			.where('work.public_id', '=', workItemPublicId)
			.executeTakeFirst();
		return row ? this.mapPortalContext(row) : null;
	}

	async defaultPortalDashboard(authUserId: string): Promise<string | null> {
		const context = await this.findDefaultPortalContext(authUserId);
		return context ? portalDashboardPath(context.tenantSlug, context.partySlug) : null;
	}

	async listPortalWork(
		authUserId: string,
		context: Pick<
			PortalRouteContext,
			'organisationId' | 'partyId' | 'tenantSlug' | 'partySlug' | 'organisationName'
		>,
		options: { includeCompleted?: boolean } = {},
		now: Date = new Date()
	): Promise<PortalWorkSummary[]> {
		let query = this.db
			.selectFrom('external_work_items as work')
			.innerJoin('external_access_grants as grant', 'grant.id', 'work.external_access_grant_id')
			.innerJoin('routing_external_portal_access_contexts as portal_context', (join) =>
				join
					.onRef('portal_context.external_access_grant_id', '=', 'grant.id')
					.onRef('portal_context.auth_user_id', '=', 'grant.auth_user_id')
					.onRef('portal_context.owning_organisation_id', '=', 'grant.owning_organisation_id')
			)
			.select([
				'work.public_id as publicId',
				'work.owning_organisation_id as owningOrganisationId',
				'work.domain_key as domainKey',
				'work.source_type as sourceType',
				'work.source_public_id as sourcePublicId',
				'work.action_type as actionType',
				'work.title as title',
				'work.summary as summary',
				'work.state as state',
				'work.due_at as dueAt',
				'work.completed_at as completedAt'
			])
			.where('work.auth_user_id', '=', authUserId)
			.where('portal_context.auth_user_id', '=', authUserId)
			.where('portal_context.owning_organisation_id', '=', context.organisationId)
			.where('portal_context.party_id', '=', context.partyId)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', now)
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', now)])
			);
		query = options.includeCompleted
			? query.where('work.state', 'in', ['open', 'completed'])
			: query.where('work.state', '=', 'open');
		const rows = await query
			.orderBy('work.state', 'asc')
			.orderBy('work.due_at', 'asc')
			.orderBy('work.created_at', 'desc')
			.execute();
		return rows.map((row) => {
			let href: string | null = null;
			if (row.domainKey === 'procurement' && row.actionType === 'submit_quote') {
				href = portalPath(
					context.tenantSlug,
					context.partySlug,
					`/supplier-quotes/${encodeURIComponent(row.publicId)}`
				);
			} else if (
				row.domainKey === 'information' &&
				['respond_rfi', 'review_submittal', 'acknowledge_instruction'].includes(row.actionType)
			) {
				href = portalPath(
					context.tenantSlug,
					context.partySlug,
					`/project-actions/${encodeURIComponent(row.publicId)}`
				);
			}
			return {
				publicId: row.publicId,
				owningOrganisationId: row.owningOrganisationId,
				owningOrganisationName: context.organisationName,
				domainKey: row.domainKey,
				sourceType: row.sourceType,
				sourcePublicId: row.sourcePublicId,
				actionType: row.actionType,
				title: row.title,
				summary: row.summary,
				state: row.state,
				dueAt: row.dueAt,
				completedAt: row.completedAt,
				href
			};
		});
	}

	async listPortalProjects(
		authUserId: string,
		context: Pick<PortalRouteContext, 'organisationId' | 'partyId' | 'organisationName'>
	): Promise<PortalProjectSummary[]> {
		const rows = await this.db
			.selectFrom('project_external_collaborators as collaborator')
			.innerJoin('projects as project', 'project.id', 'collaborator.project_id')
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'collaborator.crm_organisation_party_id')
					.onRef('company.organisation_id', '=', 'collaborator.owning_organisation_id')
			)
			.select([
				'collaborator.id as collaboratorId',
				'collaborator.public_id as collaboratorPublicId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName'
			])
			.where('collaborator.auth_user_id', '=', authUserId)
			.where('collaborator.owning_organisation_id', '=', context.organisationId)
			.where('collaborator.status', '=', 'active')
			.where('project.status', 'not in', ['cancelled', 'archived'])
			.where((eb) =>
				eb.or([
					eb('collaborator.crm_organisation_party_id', '=', context.partyId),
					eb.and([
						eb('collaborator.crm_organisation_party_id', 'is', null),
						eb('collaborator.crm_person_party_id', '=', context.partyId)
					])
				])
			)
			.orderBy('project.name', 'asc')
			.execute();
		if (!rows.length) return [];
		const roleRows = await this.db
			.selectFrom('project_external_collaborator_roles as assigned')
			.innerJoin('project_role_types as role', 'role.id', 'assigned.project_role_type_id')
			.select(['assigned.project_external_collaborator_id as collaboratorId', 'role.name'])
			.where(
				'assigned.project_external_collaborator_id',
				'in',
				rows.map((row) => row.collaboratorId)
			)
			.orderBy('role.name', 'asc')
			.execute();
		const roles = new Map<string, string[]>();
		for (const row of roleRows) {
			const values = roles.get(row.collaboratorId) ?? [];
			values.push(row.name);
			roles.set(row.collaboratorId, values);
		}
		return rows.map((row) => ({
			collaboratorPublicId: row.collaboratorPublicId,
			projectPublicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			projectName: row.projectName,
			projectStatus: row.projectStatus,
			owningOrganisationName: context.organisationName,
			crmOrganisationName: row.companyLegalName
				? row.companyTradingName?.trim() || row.companyLegalName
				: null,
			roles: roles.get(row.collaboratorId) ?? []
		}));
	}

	async workItemBelongsToPortal(
		authUserId: string,
		workItemPublicId: string,
		context: Pick<PortalRouteContext, 'organisationId' | 'partyId'>,
		now: Date = new Date()
	): Promise<boolean> {
		const row = await this.db
			.selectFrom('external_work_items as work')
			.innerJoin('external_access_grants as grant', 'grant.id', 'work.external_access_grant_id')
			.innerJoin('routing_external_portal_access_contexts as portal_context', (join) =>
				join
					.onRef('portal_context.external_access_grant_id', '=', 'grant.id')
					.onRef('portal_context.auth_user_id', '=', 'grant.auth_user_id')
			)
			.select('work.id')
			.where('work.public_id', '=', workItemPublicId)
			.where('work.auth_user_id', '=', authUserId)
			.where('portal_context.owning_organisation_id', '=', context.organisationId)
			.where('portal_context.party_id', '=', context.partyId)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', now)
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', now)])
			)
			.executeTakeFirst();
		return Boolean(row);
	}
}
