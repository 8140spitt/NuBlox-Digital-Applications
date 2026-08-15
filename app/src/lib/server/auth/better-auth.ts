import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { createPool } from 'mysql2/promise';

function requireEnv(name: 'DATABASE_URL' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

export const auth = betterAuth({
	appName: 'NuBlox',
	baseURL: requireEnv('BETTER_AUTH_URL'),
	basePath: '/api/auth',
	secret: requireEnv('BETTER_AUTH_SECRET'),
	database: createPool({
		uri: requireEnv('DATABASE_URL'),
		waitForConnections: true,
		connectionLimit: 5,
		queueLimit: 0,
		timezone: 'Z',
		supportBigNumbers: true,
		bigNumberStrings: true,
		decimalNumbers: false,
		multipleStatements: false
	}),
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
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: true,
		minPasswordLength: 12,
		maxPasswordLength: 128,
		autoSignIn: false,
		revokeSessionsOnPasswordReset: true
	},
	advanced: {
		cookiePrefix: 'nublox',
		database: {
			generateId: 'uuid'
		}
	}
});
