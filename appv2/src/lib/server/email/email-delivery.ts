import { env } from '$env/dynamic/private';

export type TransactionalEmail = {
	to: string;
	subject: string;
	text: string;
	idempotencyKey?: string;
};

export type EmailDelivery = {
	send(message: TransactionalEmail): Promise<void>;
};

function redactSensitiveEmailText(text: string): string {
	return text
		.replace(/([?&](?:token|code|key|secret|signature)=)[^&\s]+/gi, '$1[REDACTED]')
		.replace(/(\/(?:auth\/invite|invite|collaborate)\/)[^/?#\s]+/gi, '$1[REDACTED]');
}

function includeSensitiveConsoleEmailBody(): boolean {
	if (process.env.NODE_ENV === 'development') return true;
	return env.EMAIL_CONSOLE_INCLUDE_SECRETS?.trim().toLowerCase() === 'true';
}

class ConsoleEmailDelivery implements EmailDelivery {
	async send(message: TransactionalEmail): Promise<void> {
		const includeSecrets = includeSensitiveConsoleEmailBody();
		console.info('[NuBlox email]', {
			to: message.to,
			subject: message.subject,
			text: includeSecrets ? message.text : redactSensitiveEmailText(message.text),
			secretsRedacted: !includeSecrets,
			idempotencyKey: message.idempotencyKey ?? null
		});
	}
}

export function getEmailDelivery(): EmailDelivery {
	const mode = env.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
	if (mode === 'console') return new ConsoleEmailDelivery();

	throw new Error(
		'Transactional email delivery is not configured. Set EMAIL_DELIVERY_MODE=console for local/test use or configure a production provider adapter.'
	);
}
