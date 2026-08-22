import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from './membership-repository';
import {
	OrganisationLocationRepository,
	type OrganisationAddressInput,
	type OrganisationAddressSummary
} from './organisation-location-repository';
import { OrganisationRepository } from './organisation-repository';

export type OrganisationLocationInput = {
	name: string;
	locationType: string;
	timezone?: string | null;
	address?: {
		line1?: string | null;
		line2?: string | null;
		line3?: string | null;
		locality?: string | null;
		city?: string | null;
		region?: string | null;
		postalCode?: string | null;
		countryCode?: string | null;
	} | null;
};

export class OrganisationLocationValidationError extends Error {
	readonly code = 'ORGANISATION_LOCATION_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'OrganisationLocationValidationError';
	}
}

export class OrganisationLocationNotFoundError extends Error {
	readonly code = 'ORGANISATION_LOCATION_NOT_FOUND';

	constructor() {
		super('Organisation location not found.');
		this.name = 'OrganisationLocationNotFoundError';
	}
}

function optionalText(value: string | null | undefined, maximum: number, label: string): string | null {
	const normalised = value?.trim() ?? '';
	if (normalised.length > maximum) {
		throw new OrganisationLocationValidationError(`${label} must not exceed ${maximum} characters.`);
	}
	return normalised || null;
}

function validateTimezone(value: string | null | undefined): string | null {
	const timezone = value?.trim() ?? '';
	if (!timezone) return null;
	if (timezone.length > 64) {
		throw new OrganisationLocationValidationError('Timezone must not exceed 64 characters.');
	}
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date());
	} catch {
		throw new OrganisationLocationValidationError('A valid IANA timezone is required.');
	}
	return timezone;
}

function validateAddress(input: OrganisationLocationInput['address']): OrganisationAddressInput | null {
	if (!input) return null;
	const values = [
		input.line1,
		input.line2,
		input.line3,
		input.locality,
		input.city,
		input.region,
		input.postalCode,
		input.countryCode
	];
	if (values.every((value) => !(value?.trim() ?? ''))) return null;

	const line1 = input.line1?.trim() ?? '';
	if (!line1 || line1.length > 255) {
		throw new OrganisationLocationValidationError(
			'Address line 1 must be between 1 and 255 characters when an address is supplied.'
		);
	}
	const countryCode = input.countryCode?.trim().toUpperCase() ?? '';
	if (!/^[A-Z]{2}$/.test(countryCode)) {
		throw new OrganisationLocationValidationError(
			'Address country must be a two-letter ISO country code.'
		);
	}

	return {
		line1,
		line2: optionalText(input.line2, 255, 'Address line 2'),
		line3: optionalText(input.line3, 255, 'Address line 3'),
		locality: optionalText(input.locality, 160, 'Locality'),
		city: optionalText(input.city, 160, 'City'),
		region: optionalText(input.region, 160, 'Region'),
		postalCode: optionalText(input.postalCode, 32, 'Postal code'),
		countryCode
	};
}

function validateLocation(input: OrganisationLocationInput) {
	const name = input.name.trim();
	if (!name || name.length > 200) {
		throw new OrganisationLocationValidationError(
			'Location name must be between 1 and 200 characters.'
		);
	}
	const locationType = input.locationType.trim().toLowerCase();
	if (!/^[a-z][a-z0-9._-]{0,63}$/.test(locationType)) {
		throw new OrganisationLocationValidationError(
			'Location type must be a stable key using letters, numbers, dots, underscores or hyphens.'
		);
	}
	return {
		name,
		locationType,
		timezone: validateTimezone(input.timezone),
		address: validateAddress(input.address)
	};
}

function sameAddress(
	current: OrganisationAddressSummary | null,
	next: OrganisationAddressInput | null
): boolean {
	if (!current || !next) return current === null && next === null;
	return (
		current.line1 === next.line1 &&
		current.line2 === next.line2 &&
		current.line3 === next.line3 &&
		current.locality === next.locality &&
		current.city === next.city &&
		current.region === next.region &&
		current.postalCode === next.postalCode &&
		current.countryCode === next.countryCode
	);
}

export class OrganisationLocationService {
	constructor(private readonly db: Database = getDatabase()) {}

	async load(actor: TenantActorContext) {
		await this.requireManager(actor);
		const organisation = await new OrganisationRepository(this.db).findActiveById(actor.organisationId);
		if (!organisation) throw new TenantAccessError('The requested organisation is not active.');
		const locations = await new OrganisationLocationRepository(this.db).listLocations(
			actor.organisationId
		);
		return { organisation, locations };
	}

	async createLocation(actor: TenantActorContext, input: OrganisationLocationInput): Promise<string> {
		const location = validateLocation(input);
		const publicId = randomUUID();

		await this.db.transaction().execute(async (trx) => {
			const membership = await new OrganisationMembershipRepository(trx).findActiveActorMembership(
				actor
			);
			if (!membership) throw new TenantAccessError();
			const decision = await new PermissionService(trx).decide(actor, 'organisation.manage');
			if (!decision.allowed) {
				throw new TenantAccessError('Organisation location management is not permitted.');
			}
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new OrganisationLocationRepository(trx);
			if (await repository.findNameConflict(actor.organisationId, location.name)) {
				throw new OrganisationLocationValidationError(
					'An organisation location with this name already exists.'
				);
			}
			const addressId = location.address
				? await repository.createAddress(actor.organisationId, location.address)
				: null;
			await repository.createLocation({
				organisationId: actor.organisationId,
				publicId,
				addressId,
				name: location.name,
				locationType: location.locationType,
				timezone: location.timezone
			});

			const change = {
				locationPublicId: publicId,
				name: location.name,
				locationType: location.locationType,
				timezone: location.timezone,
				address: location.address,
				isActive: true
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'organisation.location.create',
				subjectType: 'organisation_location',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: change
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.location.created',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: change,
				correlationId: actor.correlationId
			});
		});

		return publicId;
	}

	async updateLocation(
		actor: TenantActorContext,
		publicId: string,
		input: OrganisationLocationInput & { isActive: boolean }
	): Promise<void> {
		const locationPublicId = publicId.trim();
		if (!locationPublicId) throw new OrganisationLocationValidationError('Location is required.');
		const location = validateLocation(input);

		await this.db.transaction().execute(async (trx) => {
			const membership = await new OrganisationMembershipRepository(trx).findActiveActorMembership(
				actor
			);
			if (!membership) throw new TenantAccessError();
			const decision = await new PermissionService(trx).decide(actor, 'organisation.manage');
			if (!decision.allowed) {
				throw new TenantAccessError('Organisation location management is not permitted.');
			}
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new OrganisationLocationRepository(trx);
			const current = await repository.findLocationForUpdate(actor.organisationId, locationPublicId);
			if (!current) throw new OrganisationLocationNotFoundError();
			if (
				await repository.findNameConflict(actor.organisationId, location.name, current.publicId)
			) {
				throw new OrganisationLocationValidationError(
					'An organisation location with this name already exists.'
				);
			}
			const currentAddress = current.addressId
				? await repository.findAddress(current.addressId, actor.organisationId)
				: null;
			const addressChanged = !sameAddress(currentAddress, location.address);
			const nextAddressId = addressChanged
				? location.address
					? await repository.createAddress(actor.organisationId, location.address)
					: null
				: current.addressId;
			const changed =
				current.name !== location.name ||
				current.locationType !== location.locationType ||
				current.timezone !== location.timezone ||
				current.isActive !== input.isActive ||
				addressChanged;
			if (!changed) return;

			await repository.updateLocation({
				organisationId: actor.organisationId,
				locationId: current.id,
				addressId: nextAddressId,
				name: location.name,
				locationType: location.locationType,
				timezone: location.timezone,
				isActive: input.isActive
			});

			const change = {
				locationPublicId: current.publicId,
				from: {
					name: current.name,
					locationType: current.locationType,
					timezone: current.timezone,
					address: currentAddress
						? {
								line1: currentAddress.line1,
								line2: currentAddress.line2,
								line3: currentAddress.line3,
								locality: currentAddress.locality,
								city: currentAddress.city,
								region: currentAddress.region,
								postalCode: currentAddress.postalCode,
								countryCode: currentAddress.countryCode
							}
						: null,
					isActive: current.isActive
				},
				to: {
					name: location.name,
					locationType: location.locationType,
					timezone: location.timezone,
					address: location.address,
					isActive: input.isActive
				}
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'organisation.location.update',
				subjectType: 'organisation_location',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: change
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.location.changed',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: change,
				correlationId: actor.correlationId
			});
		});
	}

	private async requireManager(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		const decision = await new PermissionService(this.db).decide(actor, 'organisation.manage');
		if (!decision.allowed) {
			throw new TenantAccessError('Organisation location management is not permitted.');
		}
	}
}
