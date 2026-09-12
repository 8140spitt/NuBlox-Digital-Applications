import { env } from '$env/dynamic/private';

export type TransactionalEmail = {
	to: string;
	subject: string;
	text: string;
	/** Stable business-message key that production adapters should pass to providers supporting idempotent send semantics. */
	idempotencyKey?: string;
};

export type EmailDelivery = {
	send(message: TransactionalEmail): Promise<void>;
};

function redactSensitiveEmailText(text: string): string {
	return text
		.replace(/([?&](?:token|code|key|secret|signature)=)[^&\s]+/gi, '$1[REDACTED]')
		.replace(/(\/(?:invite|collaborate)\/)[^/?#\s]+/gi, '$1[REDACTED]');
}

function includeSensitiveConsoleEmailBody(): boolean {
	// Interactive local development must expose one-time links so invitation,
	// verification, collaboration and recovery flows can be exercised manually.
	// Validation/test/CI/production environments remain redacted by default.
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

/**
 * Provider-neutral transactional email boundary.
 *
 * `console` is intentionally suitable only for development/integration testing.
 * Production must select and configure a real provider adapter in a later ADR.
 * Unsupported/unconfigured modes fail at service construction so invitation state
 * is never committed before discovering that delivery is unavailable.
 *
 * Interactive local development prints full console email bodies so one-time links
 * can be exercised manually. Test, validation, CI and production environments redact
 * secret-bearing URL components by default before writing message bodies to logs.
 * Non-development environments may explicitly opt in with
 * `EMAIL_CONSOLE_INCLUDE_SECRETS=true` for deliberate manual testing only.
 *
 * Callers that may retry an externally visible business message should supply a
 * stable `idempotencyKey`. A production adapter must use that key when its provider
 * supports idempotent delivery; this narrows duplicate-send risk around process or
 * transaction failure without claiming impossible exactly-once email semantics.
 */
export function getEmailDelivery(): EmailDelivery {
	const mode = env.EMAIL_DELIVERY_MODE?.trim().toLowerCase();
	if (mode === 'console') return new ConsoleEmailDelivery();

	throw new Error(
		'Transactional email delivery is not configured. Set EMAIL_DELIVERY_MODE=console for local/test use or install a production provider adapter.'
	);
}
