import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
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
import { ensureStandardRolePermissionDefaults } from '$lib/server/organisations/standard-role-reconciliation';
import {
	ProjectExternalCollaborationAccessError,
	ProjectExternalCollaborationService
} from '$lib/server/projects/project-external-collaboration-service';
import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from './bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from './invitation-cookie';
import { PROJECT_COLLABORATION_SIGNUP_COOKIE } from './project-collaboration-cookie';
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

function collaborationService(): ProjectExternalCollaborationService {
	return new ProjectExternalCollaborationService(getDatabase());
}

type SignupProvisioningIntent =
	| { kind: 'invitation'; token: string }
	| { kind: 'organisation-bootstrap'; token: string }
	| { kind: 'project-collaboration'; token: string };

function signupProvisioningIntentFromContext(ctx: {
	getCookie(name: string): string | null | undefined;
}): SignupProvisioningIntent {
	const invitationToken = ctx.getCookie(INVITATION_SIGNUP_COOKIE)?.trim() ?? '';
	const bootstrapToken = ctx.getCookie(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE)?.trim() ?? '';
	const collaborationToken = ctx.getCookie(PROJECT_COLLABORATION_SIGNUP_COOKIE)?.trim() ?? '';
	const intentCount = [invitationToken, bootstrapToken, collaborationToken].filter(Boolean).length;
	if (intentCount > 1) {
		throw new APIError('FORBIDDEN', {
			message: 'The NuBlox account setup state is ambiguous. Start again.'
		});
	}
	if (invitationToken) return { kind: 'invitation', token: invitationToken };
	if (bootstrapToken) return { kind: 'organisation-bootstrap', token: bootstrapToken };
	if (collaborationToken) return { kind: 'project-collaboration', token: collaborationToken };
	throw new APIError('FORBIDDEN', {
		message:
			'A valid NuBlox invitation, project collaboration invitation or organisation setup request is required.'
	});
}

const betterAuthUrl = requireEnv('BETTER_AUTH_URL');
const devTrustedOrigins = Array.from(
	new Set([betterAuthUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'])
);
const runningUnderVitest = import.meta.env.MODE === 'test';

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
	baseURL: betterAuthUrl,
	basePath: '/api/auth',
	secret: requireEnv('BETTER_AUTH_SECRET'),
	trustedOrigins: dev ? devTrustedOrigins : [betterAuthUrl],
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
				} else if (intent.kind === 'organisation-bootstrap') {
					await bootstrapService().validateSignup(intent.token, email);
				} else {
					await collaborationService().validateSignup(intent.token, email);
				}
			} catch (cause) {
				if (
					cause instanceof InvitationAccessError ||
					cause instanceof OrganisationBootstrapAccessError ||
					cause instanceof ProjectExternalCollaborationAccessError
				) {
					throw new APIError('FORBIDDEN', {
						message:
							'A valid NuBlox invitation, project collaboration invitation or organisation setup request is required.'
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
					} else if (intent.kind === 'project-collaboration') {
						await collaborationService().bindSignupAuthUser(intent.token, user.email, user.id);
					} else {
						const db = getDatabase();
						const created = await new OrganisationBootstrapService(db).provisionSignup({
							rawToken: intent.token,
							authUserId: user.id,
							email: user.email,
							displayName: user.name
						});
						await ensureStandardRolePermissionDefaults(db, created.organisationId);
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
			await collaborationService().activateVerifiedAuthUser({
				authUserId: user.id,
				email: user.email,
				displayName: user.name,
				correlationId
			});
		}
	},
	emailAndPassword: {
		enabled: true,
		disableSignUp: false,
		requireEmailVerification: true,
		minPasswordLength: 12,
		maxPasswordLength: 128,
		autoSignIn: false,
		revokeSessionsOnPasswordReset: true,
		resetPasswordTokenExpiresIn: 60 * 60,
		sendResetPassword: async ({ user, url }) => {
			void Promise.resolve()
				.then(() =>
					getEmailDelivery().send({
						to: user.email,
						subject: 'Reset your NuBlox password',
						text: `Reset your NuBlox password by opening this link:\n\n${url}\n\nThe link expires in one hour.`
					})
				)
				.catch((cause) => {
					console.error('[NuBlox email] Password reset delivery failed.', cause);
				});
		}
	},
	advanced: {
		cookiePrefix: 'nublox',
		database: {
			generateId: 'uuid'
		}
	},
	// Server actions run inside a live SvelteKit request event, where this plugin is
	// required to copy Better Auth's response cookies into event.cookies. Direct
	// Vitest API tests intentionally run outside that request lifecycle and inspect
	// returned Set-Cookie headers themselves, so the request-event plugin must not run.
	plugins: runningUnderVitest ? [] : [sveltekitCookies(getRequestEvent)]
});
