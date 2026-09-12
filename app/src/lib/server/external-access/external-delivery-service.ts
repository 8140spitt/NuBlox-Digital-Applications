import { getDatabase, type Database } from '$lib/server/db/database';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';

export class ExternalDeliveryService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly emailDelivery: EmailDelivery = getEmailDelivery(),
		private readonly now: () => Date = () => new Date()
	) {}

	async dispatchByPublicId(publicId: string): Promise<void> {
		const message = await this.db
			.selectFrom('external_delivery_messages')
			.select([
				'id',
				'channel',
				'recipient',
				'subject',
				'body_text as bodyText',
				'idempotency_key as idempotencyKey',
				'delivery_status as deliveryStatus',
				'available_at as availableAt'
			])
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		if (!message || message.deliveryStatus === 'sent') return;
		if (message.availableAt > this.now()) return;
		if (message.channel !== 'email') throw new Error('Unsupported external delivery channel.');

		const attemptedAt = this.now();
		await this.db
			.updateTable('external_delivery_messages')
			.set((eb) => ({
				attempt_count: eb('attempt_count', '+', 1),
				last_attempt_at: attemptedAt,
				last_error: null
			}))
			.where('id', '=', message.id)
			.executeTakeFirst();

		try {
			await this.emailDelivery.send({
				to: message.recipient,
				subject: message.subject,
				text: message.bodyText,
				idempotencyKey: message.idempotencyKey
			});
			await this.db
				.updateTable('external_delivery_messages')
				.set({ delivery_status: 'sent', sent_at: this.now(), last_error: null })
				.where('id', '=', message.id)
				.executeTakeFirst();
		} catch (cause) {
			const lastError = cause instanceof Error ? cause.message.slice(0, 1000) : 'Delivery failed.';
			await this.db
				.updateTable('external_delivery_messages')
				.set({ delivery_status: 'failed', last_error: lastError })
				.where('id', '=', message.id)
				.executeTakeFirst();
			throw cause;
		}
	}
}
