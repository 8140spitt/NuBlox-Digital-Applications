import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { createPool } from 'mysql2/promise';

import { getDatabase } from '$lib/server/db/database';
import { getEmailDelivery } from '$lib/server/email/email-delivery';
import {
	OrganisationBootstrapAccessError,
	OrganisationBootstrapService
} from '$lib/server/organisations/bootstrap-service';
import {
	InvitationAccessError,
	OrganisationInvitationService
} from '$lib/server/organisations/invitation-service';
import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from './bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from './invitation-cookie';
import { assertVerifiedAuthUser } from './verified-auth-user';

function requireEnv(name: 'DATABASE_URL' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function invitationService(): OrganisationInvitationService {
	return new OrganisationInvitationService(getDatabase());
}

function bootstrapService(): OrganisationBootstrapService {
	return new OrganisationBootstrapService(getDatabase());
}

type SignupProvisioningIntent =
	| { kind: 'invitation'; token: string }
	| { kind: 'organisation-bootstrap'; token: string };

function signupProvisioningIntentFromContext(ctx: {
	getCookie(name: string): string | null | undefined;
}): SignupProvisioningIntent {
	const invitationToken = ctx.getCookie(INVITATION_SIGNUP_COOKIE)?.trim() ?? '';
	const bootstrapToken = ctx.getCookie(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE)?.trim() ?? '';
	if (invitationToken && bootstrapToken) {
		throw new APIError('FORBIDDEN', { message: 'The NuBlox account setup state is ambiguous. Start again.' });
	}
	if (invitationToken) return { kind: 'invitation', token: invitationToken };
	if (bootstrapToken) return { kind: 'organisation-bootstrap', token: bootstrapToken };
	throw new APIError('FORBIDDEN', {
		message: 'A valid NuBlox invitation or organisation setup request is required.'
	});
}

export const authPool = createPool({
	uri: requireEnv('DATABASE_URL'),
	waitForConnections: true,
	connectionLimit: 5,
	queueLimit: 0,
	timezone: 'Z',
	supportBigNumbers: true,
	bigNumberStrings: true,
	decimalNumbers: false,
	multipleStatements: false
});

export const auth = betterAuth({
	appName: 'NuBlox',
	baseURL: requireEnv('BETTER_AUTH_URL'),
	basePath: '/api/auth',
	secret: requireEnv('BETTER_AUTH_SECRET'),
	database: authPool,
	user: {
		modelName: 'auth_users',
		fields: {
			name: 'display_name',
			emailVerified: 'email_verified',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		}
	},
	session: {
		modelName: 'auth_sessions',
		fields: {
			userId: 'auth_user_id',
			expiresAt: 'expires_at',
			ipAddress: 'ip_address',
			userAgent: 'user_agent',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		},
		expiresIn: 60 * 60 * 8,
		disableSessionRefresh: true,
		cookieCache: {
			enabled: false
		}
	},
	account: {
		modelName: 'auth_accounts',
		fields: {
			userId: 'auth_user_id',
			accountId: 'provider_account_id',
			providerId: 'provider_id',
			accessToken: 'access_token',
			refreshToken: 'refresh_token',
			accessTokenExpiresAt: 'access_token_expires_at',
			refreshTokenExpiresAt: 'refresh_token_expires_at',
			idToken: 'id_token',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		},
		encryptOAuthTokens: true
	},
	verification: {
		modelName: 'auth_verifications',
		fields: {
			expiresAt: 'expires_at',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		},
		storeIdentifier: 'hashed'
	},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== '/sign-up/email') return;
			const intent = signupProvisioningIntentFromContext(ctx);
			const email = typeof ctx.body?.email === 'string' ? ctx.body.email : '';
			try {
				if (intent.kind === 'invitation') {
					await invitationService().validateSignup(intent.token, email);
				} else {
					await bootstrapService().validateSignup(intent.token, email);
				}
			} catch (cause) {
				if (cause instanceof InvitationAccessError || cause instanceof OrganisationBootstrapAccessError) {
					throw new APIError('FORBIDDEN', {
						message: 'A valid NuBlox invitation or organisation setup request is required.'
					});
				}
				throw cause;
			}
		})
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user, ctx) => {
					if (ctx?.path !== '/sign-up/email') return;
					const intent = signupProvisioningIntentFromContext(ctx);
					if (intent.kind === 'invitation') {
						await invitationService().bindSignupAuthUser(intent.token, user.email, user.id);
					} else {
						await bootstrapService().provisionSignup({
							rawToken: intent.token,
							authUserId: user.id,
							email: user.email,
							displayName: user.name
						});
					}
				}
			}
		}
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: false,
		expiresIn: 60 * 60,
		sendVerificationEmail: async ({ user, url }) => {
			await getEmailDelivery().send({
				to: user.email,
				subject: 'Verify your NuBlox email address',
				text: `Verify your NuBlox email address by opening this link:\n\n${url}\n\nThe link expires in one hour.`
			});
		},
		afterEmailVerification: async (user, request) => {
			await assertVerifiedAuthUser(getDatabase(), user.id, user.email);
			const correlationId = request?.headers.get('x-correlation-id') ?? undefined;
			await invitationService().activateVerifiedAuthUser({
				authUserId: user.id,
				email: user.email,
				displayName: user.name,
				correlationId
			});
			await bootstrapService().activateVerifiedAuthUser({
				authUserId: user.id,
				email: user.email,
				displayName: user.name,
				correlationId
			});
		}
	},
	emailAndPassword: {
		enabled: true,
		// Sign-up is enabled only because the before hook above fail-closes every
		// email sign-up without a validated invitation or organisation-bootstrap intent.
		disableSignUp: false,
		requireEmailVerification: true,
		minPasswordLength: 12,
		maxPasswordLength: 128,
		autoSignIn: false,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url }) => {
			await getEmailDelivery().send({
				to: user.email,
				subject: 'Reset your NuBlox password',
				text: `Reset your NuBlox password by opening this link:\n\n${url}`
			});
		}
	},
	advanced: {
		cookiePrefix: 'nublox',
		database: {
			generateId: 'uuid'
		}
	}
});
