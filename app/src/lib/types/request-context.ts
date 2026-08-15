export type Actor = {
	id: string;
	email: string;
	roles: string[];
};

export type TenantContext = {
	organisationId: string | null;
	membershipVerified: boolean;
};

export type RequestContext = {
	actor: Actor | null;
	correlationId: string;
	tenant: TenantContext;
};
