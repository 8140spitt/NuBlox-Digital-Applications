import type { DatabaseExecutor } from '$lib/server/db/executor';
import { normaliseRouteSlug, portalDashboardPath } from '$lib/routing/route-contract';

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
		return row.companyTradingName?.trim() || row.companyLegalName?.trim() || 'External organisation';
	}
	return (
		[row.preferredName?.trim() || row.givenNames?.trim(), row.familyName?.trim()]
			.filter(Boolean)
			.join(' ') || 'External contact'
	);
}

async function availableOrganisationSlug(
	db: DatabaseExecutor,
	candidate: string
): Promise<boolean> {
	const row = await db
		.selectFrom('organisations')
		.select('id')
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
		.selectFrom('parties')
		.select('id')
		.where('organisation_id', '=', organisationId)
		.where('route_slug', '=', candidate)
		.executeTakeFirst();
	return !row;
}

export async function allocateOrganisationRouteSlug(
	db: DatabaseExecutor,
	name: string
): Promise<string> {
	const base = normaliseRouteSlug(name, 'tenant');
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
	const base = normaliseRouteSlug(name, 'party');
	if (await availablePartySlug(db, organisationId, base)) return base;
	for (let suffix = 2; suffix <= 9999; suffix += 1) {
		const candidate = `${base.slice(0, 90)}-${suffix}`;
		if (await availablePartySlug(db, organisationId, candidate)) return candidate;
	}
	throw new Error('Unable to allocate a unique CRM party route slug.');
}

export class RouteContextService {
	constructor(private readonly db: DatabaseExecutor) {}

	async findTenantBySlug(tenantSlug: string): Promise<TenantRouteContext | null> {
		const row = await this.db
			.selectFrom('organisations')
			.select([
				'id as organisationId',
				'public_id as organisationPublicId',
				'route_slug as tenantSlug',
				'legal_name as legalName',
				'trading_name as tradingName'
			])
			.where('route_slug', '=', tenantSlug)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row?.tenantSlug) return null;
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug: row.tenantSlug,
			organisationName: organisationName(row)
		};
	}

	async findTenantByOrganisationId(organisationId: string): Promise<TenantRouteContext | null> {
		const row = await this.db
			.selectFrom('organisations')
			.select([
				'id as organisationId',
				'public_id as organisationPublicId',
				'route_slug as tenantSlug',
				'legal_name as legalName',
				'trading_name as tradingName'
			])
			.where('id', '=', organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row?.tenantSlug) return null;
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug: row.tenantSlug,
			organisationName: organisationName(row)
		};
	}

	async findPortalContext(
		authUserId: string,
		tenantSlug: string,
		partySlug: string,
		now: Date = new Date()
	): Promise<PortalRouteContext | null> {
		const row = await this.db
			.selectFrom('external_access_grants as grant')
			.innerJoin('organisations as owner', 'owner.id', 'grant.owning_organisation_id')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'grant.party_id')
					.onRef('party.organisation_id', '=', 'grant.owning_organisation_id')
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
				'owner.route_slug as tenantSlug',
				'owner.legal_name as legalName',
				'owner.trading_name as tradingName',
				'party.id as partyId',
				'party.public_id as partyPublicId',
				'party.route_slug as partySlug',
				'party.party_kind as kind',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName'
			])
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', now)
			.where((eb) => eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', now)]))
			.where('owner.route_slug', '=', tenantSlug)
			.where('owner.status', '=', 'active')
			.where('party.route_slug', '=', partySlug)
			.where('party.status', '=', 'active')
			.executeTakeFirst();
		if (!row?.tenantSlug || !row.partySlug) return null;
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug: row.tenantSlug,
			organisationName: organisationName(row),
			partyId: row.partyId,
			partyPublicId: row.partyPublicId,
			partySlug: row.partySlug,
			partyName: partyName(row)
		};
	}

	async findDefaultPortalContext(
		authUserId: string,
		now: Date = new Date()
	): Promise<PortalRouteContext | null> {
		const row = await this.db
			.selectFrom('external_access_grants as grant')
			.innerJoin('organisations as owner', 'owner.id', 'grant.owning_organisation_id')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'grant.party_id')
					.onRef('party.organisation_id', '=', 'grant.owning_organisation_id')
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
				'owner.route_slug as tenantSlug',
				'owner.legal_name as legalName',
				'owner.trading_name as tradingName',
				'party.id as partyId',
				'party.public_id as partyPublicId',
				'party.route_slug as partySlug',
				'party.party_kind as kind',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName'
			])
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.party_id', 'is not', null)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', now)
			.where((eb) => eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', now)]))
			.where('owner.status', '=', 'active')
			.where('party.status', '=', 'active')
			.orderBy('owner.legal_name', 'asc')
			.orderBy('party.route_slug', 'asc')
			.executeTakeFirst();
		if (!row?.tenantSlug || !row.partySlug) return null;
		return {
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			tenantSlug: row.tenantSlug,
			organisationName: organisationName(row),
			partyId: row.partyId,
			partyPublicId: row.partyPublicId,
			partySlug: row.partySlug,
			partyName: partyName(row)
		};
	}

	async defaultPortalDashboard(authUserId: string): Promise<string | null> {
		const context = await this.findDefaultPortalContext(authUserId);
		return context ? portalDashboardPath(context.tenantSlug, context.partySlug) : null;
	}
}
