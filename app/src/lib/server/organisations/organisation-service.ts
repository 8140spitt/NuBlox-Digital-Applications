import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from './membership-repository';
import {
	OrganisationRepository,
	type OrganisationIdentifierSummary,
	type OrganisationSummary
} from './organisation-repository';

export type OrganisationProfileInput = {
	legalName: string;
	tradingName?: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
};

export type OrganisationIdentifierInput = {
	identifierType: string;
	identifierValue: string;
	issuingCountryCode?: string | null;
};

export class OrganisationProfileValidationError extends Error {
	readonly code = 'ORGANISATION_PROFILE_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'OrganisationProfileValidationError';
	}
}

export class OrganisationIdentifierValidationError extends Error {
	readonly code = 'ORGANISATION_IDENTIFIER_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'OrganisationIdentifierValidationError';
	}
}

export class OrganisationIdentifierNotFoundError extends Error {
	readonly code = 'ORGANISATION_IDENTIFIER_NOT_FOUND';

	constructor() {
		super('Organisation identifier not found.');
		this.name = 'OrganisationIdentifierNotFoundError';
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
		throw new OrganisationProfileValidationError('Currency code must be a three-letter ISO code.');
	}

	return {
		legalName,
		tradingName: tradingNameValue || null,
		defaultTimezone,
		defaultCurrencyCode
	};
}

function validateIdentifier(input: OrganisationIdentifierInput) {
	const identifierType = input.identifierType.trim().toLowerCase();
	if (!/^[a-z][a-z0-9._-]{0,63}$/.test(identifierType)) {
		throw new OrganisationIdentifierValidationError(
			'Identifier type must be a stable key using letters, numbers, dots, underscores or hyphens.'
		);
	}

	const identifierValue = input.identifierValue.trim();
	if (!identifierValue || identifierValue.length > 160) {
		throw new OrganisationIdentifierValidationError(
			'Identifier value must be between 1 and 160 characters.'
		);
	}

	const countryValue = input.issuingCountryCode?.trim().toUpperCase() ?? '';
	if (countryValue && !/^[A-Z]{2}$/.test(countryValue)) {
		throw new OrganisationIdentifierValidationError(
			'Issuing country must be a two-letter ISO country code.'
		);
	}

	return {
		identifierType,
		identifierValue,
		issuingCountryCode: countryValue || null
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

	async listCurrentOrganisationIdentifiers(
		actor: TenantActorContext
	): Promise<OrganisationIdentifierSummary[]> {
		const membershipRepository = new OrganisationMembershipRepository(this.db);
		if (!(await membershipRepository.findActiveActorMembership(actor)))
			throw new TenantAccessError();

		const decision = await new PermissionService(this.db).decide(actor, 'organisation.manage');
		if (!decision.allowed) {
			throw new TenantAccessError('Organisation identifier management is not permitted.');
		}

		const organisation = await new OrganisationRepository(this.db).findActiveById(
			actor.organisationId
		);
		if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

		return new OrganisationRepository(this.db).listIdentifiers(actor.organisationId);
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

	async addCurrentOrganisationIdentifier(
		actor: TenantActorContext,
		input: OrganisationIdentifierInput
	): Promise<void> {
		const identifier = validateIdentifier(input);

		await this.db.transaction().execute(async (trx) => {
			const membershipRepository = new OrganisationMembershipRepository(trx);
			const membership = await membershipRepository.findActiveActorMembership(actor);
			if (!membership) throw new TenantAccessError();

			const decision = await new PermissionService(trx).decide(actor, 'organisation.manage');
			if (!decision.allowed) {
				throw new TenantAccessError('Organisation identifier management is not permitted.');
			}

			const repository = new OrganisationRepository(trx);
			const organisation = await repository.findActiveForUpdate(actor.organisationId);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const existing = await repository.findIdentifierForUpdate(
				actor.organisationId,
				identifier.identifierType,
				identifier.identifierValue
			);
			if (existing) {
				throw new OrganisationIdentifierValidationError(
					'This identifier already exists for the organisation.'
				);
			}

			await repository.createIdentifier(actor.organisationId, identifier);
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'organisation.identifier.add',
				subjectType: 'organisation',
				subjectPublicId: organisation.publicId,
				correlationId: actor.correlationId,
				changeSummary: identifier
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.identifier.added',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: identifier,
				correlationId: actor.correlationId
			});
		});
	}

	async removeCurrentOrganisationIdentifier(
		actor: TenantActorContext,
		input: Pick<OrganisationIdentifierInput, 'identifierType' | 'identifierValue'>
	): Promise<void> {
		const identifier = validateIdentifier({
			...input,
			issuingCountryCode: null
		});

		await this.db.transaction().execute(async (trx) => {
			const membershipRepository = new OrganisationMembershipRepository(trx);
			const membership = await membershipRepository.findActiveActorMembership(actor);
			if (!membership) throw new TenantAccessError();

			const decision = await new PermissionService(trx).decide(actor, 'organisation.manage');
			if (!decision.allowed) {
				throw new TenantAccessError('Organisation identifier management is not permitted.');
			}

			const repository = new OrganisationRepository(trx);
			const organisation = await repository.findActiveForUpdate(actor.organisationId);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const existing = await repository.findIdentifierForUpdate(
				actor.organisationId,
				identifier.identifierType,
				identifier.identifierValue
			);
			if (!existing) throw new OrganisationIdentifierNotFoundError();

			await repository.deleteIdentifier(actor.organisationId, existing.id);
			const removedIdentifier = {
				identifierType: existing.identifierType,
				identifierValue: existing.identifierValue,
				issuingCountryCode: existing.issuingCountryCode
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'organisation.identifier.remove',
				subjectType: 'organisation',
				subjectPublicId: organisation.publicId,
				correlationId: actor.correlationId,
				changeSummary: removedIdentifier
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.identifier.removed',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: removedIdentifier,
				correlationId: actor.correlationId
			});
		});
	}
}
