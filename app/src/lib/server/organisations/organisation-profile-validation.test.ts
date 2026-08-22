import { describe, expect, it } from 'vitest';

import { normaliseOrganisationProfile } from './organisation-profile-validation';

function fail(message: string): never {
	throw new Error(message);
}

describe('canonical organisation profile validation', () => {
	it('normalises canonical organisation profile values', () => {
		expect(
			normaliseOrganisationProfile(
				{
					legalName: '  NuBlox Ltd  ',
					tradingName: '  NuBlox  ',
					defaultTimezone: ' Europe/London ',
					defaultCurrencyCode: ' gbp '
				},
				fail
			)
		).toEqual({
			legalName: 'NuBlox Ltd',
			tradingName: 'NuBlox',
			defaultTimezone: 'Europe/London',
			defaultCurrencyCode: 'GBP'
		});
	});

	it('supports explicit bootstrap defaults without weakening validation', () => {
		expect(
			normaliseOrganisationProfile(
				{ legalName: 'NuBlox Ltd' },
				fail,
				{ defaultTimezone: 'Europe/London', defaultCurrencyCode: 'GBP' }
			)
		).toEqual({
			legalName: 'NuBlox Ltd',
			tradingName: null,
			defaultTimezone: 'Europe/London',
			defaultCurrencyCode: 'GBP'
		});
	});

	it.each([
		[{ legalName: '', defaultTimezone: 'Europe/London', defaultCurrencyCode: 'GBP' }, 'Legal name'],
		[
			{ legalName: 'NuBlox Ltd', defaultTimezone: 'Not/AZone', defaultCurrencyCode: 'GBP' },
			'A valid IANA timezone'
		],
		[
			{ legalName: 'NuBlox Ltd', defaultTimezone: 'Europe/London', defaultCurrencyCode: 'GB' },
			'Currency code'
		]
	])('rejects invalid canonical profile input', (input, message) => {
		expect(() => normaliseOrganisationProfile(input, fail)).toThrow(message);
	});
});
