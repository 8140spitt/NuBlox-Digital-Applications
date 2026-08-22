import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from './membership-repository';
import { OrganisationRepository, type OrganisationSummary } from './organisation-repository';

export type OrganisationProfileInput = {
	legalName: string;
	tradingName?: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
};

export class OrganisationProfileValidationError extends Error {
	readonly code = 'ORGANISATION_PROFILE_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'OrganisationProfileValidationError';
	}
}

function validateProfile(input: OrganisationProfileInput): Required<OrganisationProfileInput> {
	const legalName = input.legalName.trim();
	if (!legalName || legalName.length > 255) {
		throw new OrganisationProfileValidationError(
			'Legal name must be between 1 and 255 characters.'
		);
	}

	const tradingNameValue = input.tradingName?.trim() ?? '';
	if (tradingNameValue.length > 255) {
		throw new OrganisationProfileValidationError('Trading name must not exceed 255 characters.');
	}

	const defaultTimezone = input.defaultTimezone.trim();
	if (!defaultTimezone || defaultTimezone.length > 64) {
		throw new OrganisationProfileValidationError('A valid IANA timezone is required.');
	}
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: defaultTimezone }).format(new Date());
	} catch {
		throw new OrganisationProfileValidationError('A valid IANA timezone is required.');
	}

	const defaultCurrencyCode = input.defaultCurrencyCode.trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(defaultCurrencyCode)) {
		throw new OrganisationProfileValidationError(
			'Currency code must be a three-letter ISO code.'
		);
	}

	return {
		legalName,
		tradingName: tradingNameValue || null,
		defaultTimezone,
		defaultCurrencyCode
	};
}

export class OrganisationService {
	constructor(private readonly db: Database = getDatabase()) {}

	async getCurrentOrganisation(actor: TenantActorContext): Promise<OrganisationSummary> {
		const membershipRepository = new OrganisationMembershipRepository(this.db);
		const organisationRepository = new OrganisationRepository(this.db);

		const membership = await membershipRepository.findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();

		const organisation = await organisationRepository.findActiveById(actor.organisationId);
		if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

		return organisation;
	}

	async updateCurrentOrganisationProfile(
		actor: TenantActorContext,
		input: OrganisationProfileInput
	): Promise<OrganisationSummary> {
		const profile = validateProfile(input);

		return this.db.transaction().execute(async (trx) => {
			const membershipRepository = new OrganisationMembershipRepository(trx);
			const membership = await membershipRepository.findActiveActorMembership(actor);
			if (!membership) throw new TenantAccessError();

			const decision = await new PermissionService(trx).decide(actor, 'organisation.manage');
			if (!decision.allowed) {
				throw new TenantAccessError('Organisation profile management is not permitted.');
			}

			const repository = new OrganisationRepository(trx);
			const current = await repository.findActiveForUpdate(actor.organisationId);
			if (!current) throw new TenantAccessError('The requested organisation is not active.');

			const changed =
				current.legalName !== profile.legalName ||
				current.tradingName !== profile.tradingName ||
				current.defaultTimezone !== profile.defaultTimezone ||
				current.defaultCurrencyCode !== profile.defaultCurrencyCode;
			if (!changed) return current;

			await repository.updateProfile(actor.organisationId, profile);
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'organisation.profile.update',
				subjectType: 'organisation',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					from: {
						legalName: current.legalName,
						tradingName: current.tradingName,
						defaultTimezone: current.defaultTimezone,
						defaultCurrencyCode: current.defaultCurrencyCode
					},
					to: profile
				}
			});

			return {
				...current,
				...profile
			};
		});
	}
}
