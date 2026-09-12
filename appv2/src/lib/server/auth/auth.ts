import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { createPool, type RowDataPacket } from 'mysql2/promise';

type AuthUserVerificationRow = RowDataPacket & {
	email_verified: number | boolean;
};

function requireEnv(name: 'DATABASE_URL' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function createNuBloxAuth() {
	const betterAuthUrl = requireEnv('BETTER_AUTH_URL');
	const pool = createPool({
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
				if (ctx.path !== '/sign-in/email') return;
				const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim() : '';
				if (!email) return;

				const [rows] = await pool.execute<AuthUserVerificationRow[]>(
					'SELECT email_verified FROM auth_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
					[email]
				);
				if (rows[0] && !Boolean(rows[0].email_verified)) {
					throw new APIError('FORBIDDEN', {
						message: 'This account is not ready to sign in.'
					});
				}
			})
		},
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			minPasswordLength: 12,
			maxPasswordLength: 128
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
