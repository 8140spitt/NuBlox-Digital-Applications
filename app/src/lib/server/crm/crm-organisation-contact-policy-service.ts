import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { CrmRepository } from './crm-repository';
import { CrmValidationError } from './crm-service';

export class CrmOrganisationContactPolicyService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async requireActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async requireManage(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			'crm.contact.manage',
			'crm.manage'
		);
		if (!decision.allowed) throw new TenantAccessError('CRM contact management is not permitted.');
	}

	async endOrganisationContact(
		actor: TenantActorContext,
		organisationPartyPublicIdInput: string,
		personPartyPublicIdInput: string
	): Promise<void> {
		await this.requireActor(actor);
		await this.requireManage(actor);
		const organisationPartyPublicId = organisationPartyPublicIdInput.trim();
		const personPartyPublicId = personPartyPublicIdInput.trim();
		if (!organisationPartyPublicId || !personPartyPublicId) {
			throw new CrmValidationError('Organisation and contact are required.');
		}

		await this.db.transaction().execute(async (trx) => {
			const membership = await this.requireActor(actor, trx);
			await this.requireManage(actor, trx);
			const repository = new CrmRepository(trx);
			const organisation = await repository.findPartyByPublicId(
				actor.organisationId,
				organisationPartyPublicId
			);
			if (!organisation || organisation.kind !== 'organisation') {
				throw new RecordNotFoundError('CRM organisation not found.');
			}
			const person = await repository.findPartyByPublicId(
				actor.organisationId,
				personPartyPublicId
			);
			if (!person || person.kind !== 'person') {
				throw new RecordNotFoundError('CRM contact not found.');
			}

			const contacts = await repository.listOrganisationContacts(
				actor.organisationId,
				organisation.id
			);
			const target = contacts.find((contact) => contact.personPublicId === personPartyPublicId);
			if (!target) throw new RecordNotFoundError('CRM organisation contact not found.');
			if (contacts.length <= 1) {
				throw new CrmValidationError(
					'A CRM organisation must retain at least one active contact. Add another contact before ending this one.'
				);
			}
			if (target.isPrimaryContact) {
				throw new CrmValidationError(
					'Choose another primary contact before ending the current CRM primary contact.'
				);
			}

			const ended = await repository.endOrganisationContact({
				organisationId: actor.organisationId,
				organisationPartyId: organisation.id,
				personPartyId: person.id,
				endedOn: this.now()
			});
			if (!ended) throw new RecordNotFoundError('CRM organisation contact not found.');

			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.contact.ended',
				subjectType: 'crm_party',
				subjectPublicId: personPartyPublicId,
				correlationId: actor.correlationId,
				changeSummary: { organisationPartyPublicId }
			});
		});
	}
}
