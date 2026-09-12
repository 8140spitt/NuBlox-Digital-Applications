import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { getEmailDelivery } from '$lib/server/email/email-delivery';
import {
	activateVerifiedTenantBootstrap,
	provisionTenantBootstrapSignup,
	TENANT_BOOTSTRAP_COOKIE,
	TenantBootstrapAccessError,
	validateTenantBootstrapSignup
} from './tenant-bootstrap';

type AuthUserVerificationRow = RowDataPacket & {
	email_verified: number | boolean;
};

function requireEnv(name: 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function createNuBloxAuth() {
	const betterAuthUrl = requireEnv('BETTER_AUTH_URL');
	const pool = getPool();

	return betterAuth({
		appName: 'NuBlox',
		baseURL: betterAuthUrl,
		basePath: '/api/auth',
		secret: requireEnv('BETTER_AUTH_SECRET'),
		trustedOrigins: dev
			? [betterAuthUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']
			: [betterAuthUrl],
		database: pool,
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
			cookieCache: { enabled: false }
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
				if (ctx.path === '/sign-up/email') {
					const bootstrapToken = ctx.getCookie(TENANT_BOOTSTRAP_COOKIE)?.trim() ?? '';
					const email = typeof ctx.body?.email === 'string' ? ctx.body.email : '';
					if (!bootstrapToken) {
						throw new APIError('FORBIDDEN', {
							message: 'A valid NuBlox tenant registration request is required.'
						});
					}
					try {
						await validateTenantBootstrapSignup(bootstrapToken, email);
					} catch (cause) {
						if (cause instanceof TenantBootstrapAccessError) {
							throw new APIError('FORBIDDEN', {
								message: 'A valid NuBlox tenant registration request is required.'
							});
						}
						throw cause;
					}
					return;
				}

				if (ctx.path !== '/sign-in/email') return;
				const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim() : '';
				if (!email) return;

				const [rows] = await pool.execute<AuthUserVerificationRow[]>(
					'SELECT email_verified FROM auth_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
					[email]
				);
				if (rows[0] && !rows[0].email_verified) {
					throw new APIError('FORBIDDEN', {
						message: 'Verify your email address before signing in.'
					});
				}
			})
		},
		databaseHooks: {
			user: {
				create: {
					after: async (user, ctx) => {
						if (ctx?.path !== '/sign-up/email') return;
						const bootstrapToken = ctx.getCookie(TENANT_BOOTSTRAP_COOKIE)?.trim() ?? '';
						if (!bootstrapToken) throw new TenantBootstrapAccessError();
						await provisionTenantBootstrapSignup({
							rawToken: bootstrapToken,
							authUserId: user.id,
							email: user.email,
							displayName: user.name
						});
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
				void Promise.resolve()
					.then(() =>
						getEmailDelivery().send({
							to: user.email,
							subject: 'Verify your NuBlox email address',
							text: `Verify your NuBlox email address by opening this link:\n\n${url}\n\nThe link expires in one hour.`
						})
					)
					.catch((cause) => {
						console.error('[NuBlox email] Verification delivery failed.', cause);
					});
			},
			afterEmailVerification: async (user) => {
				await activateVerifiedTenantBootstrap({ authUserId: user.id, email: user.email });
			}
		},
		emailAndPassword: {
			enabled: true,
			disableSignUp: false,
			requireEmailVerification: true,
			autoSignIn: false,
			minPasswordLength: 12,
			maxPasswordLength: 128,
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
			database: { generateId: 'uuid' }
		}
	});
}

let authInstance: ReturnType<typeof createNuBloxAuth> | undefined;

export function getAuth(): ReturnType<typeof createNuBloxAuth> {
	authInstance ??= createNuBloxAuth();
	return authInstance;
}
