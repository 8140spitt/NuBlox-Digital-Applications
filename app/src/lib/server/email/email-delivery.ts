import { env } from '$env/dynamic/private';

export type TransactionalEmail = {
	to: string;
	subject: string;
	text: string;
};

export type EmailDelivery = {
	send(message: TransactionalEmail): Promise<void>;
};

class ConsoleEmailDelivery implements EmailDelivery {
	async send(message: TransactionalEmail): Promise<void> {
		console.info('[NuBlox email]', {
			to: message.to,
			subject: message.subject,
			text: message.text
		});
	}
}

/**
 * Provider-neutral transactional email boundary.
 *
 * `console` is intentionally suitable only for development/integration testing.
 * Production must select and configure a real provider adapter in a later ADR.
 * Unsupported/unconfigured modes fail at service construction so invitation state
 * is never committed before discovering that delivery is unavailable.
 */
export function getEmailDelivery(): EmailDelivery {
	const mode = env.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
	if (mode === 'console') return new ConsoleEmailDelivery();

	throw new Error(
		'Transactional email delivery is not configured. Set EMAIL_DELIVERY_MODE=console for local/test use or install a production provider adapter.'
	);
}
