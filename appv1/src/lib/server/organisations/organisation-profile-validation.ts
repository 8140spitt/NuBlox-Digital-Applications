export type OrganisationProfileValues = {
	legalName: string;
	tradingName?: string | null;
	defaultTimezone?: string | null;
	defaultCurrencyCode?: string | null;
};

export type NormalisedOrganisationProfile = {
	legalName: string;
	tradingName: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
};

export type OrganisationProfileDefaults = {
	defaultTimezone?: string;
	defaultCurrencyCode?: string;
};

type ValidationFailure = (message: string) => never;

export function normaliseOrganisationProfile(
	input: OrganisationProfileValues,
	fail: ValidationFailure,
	defaults: OrganisationProfileDefaults = {}
): NormalisedOrganisationProfile {
	const legalName = input.legalName.trim();
	if (!legalName || legalName.length > 255) {
		fail('Legal name must be between 1 and 255 characters.');
	}

	const tradingNameValue = input.tradingName?.trim() ?? '';
	if (tradingNameValue.length > 255) {
		fail('Trading name must not exceed 255 characters.');
	}

	const defaultTimezone = input.defaultTimezone?.trim() || defaults.defaultTimezone?.trim() || '';
	if (!defaultTimezone || defaultTimezone.length > 64) {
		fail('A valid IANA timezone is required.');
	}
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: defaultTimezone }).format(new Date());
	} catch {
		fail('A valid IANA timezone is required.');
	}

	const defaultCurrencyCode = (
		input.defaultCurrencyCode?.trim() ||
		defaults.defaultCurrencyCode?.trim() ||
		''
	).toUpperCase();
	if (!/^[A-Z]{3}$/.test(defaultCurrencyCode)) {
		fail('Currency code must be a three-letter ISO code.');
	}

	return {
		legalName,
		tradingName: tradingNameValue || null,
		defaultTimezone,
		defaultCurrencyCode
	};
}
