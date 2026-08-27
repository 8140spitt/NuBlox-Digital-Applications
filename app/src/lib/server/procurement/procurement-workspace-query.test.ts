import { describe, expect, it } from 'vitest';

import type { RfqVersionSummary } from '$lib/server/procurement/procurement-repository';
import { latestRfqVersionsByRfq } from '$lib/server/procurement/procurement-workspace-query';

function version(
	rfqId: string,
	versionNumber: number,
	overrides: Partial<RfqVersionSummary> = {}
): RfqVersionSummary {
	return {
		id: `${rfqId}-${versionNumber}`,
		rfqId,
		versionNumber,
		title: `RFQ ${rfqId} V${versionNumber}`,
		currencyCode: 'GBP',
		responseDeadlineAt: null,
		status: versionNumber === 1 ? 'issued' : 'draft',
		lockedAt: null,
		...overrides
	};
}

describe('latestRfqVersionsByRfq', () => {
	it('keeps only the highest version for each RFQ regardless of row order', () => {
		const latest = latestRfqVersionsByRfq([
			version('101', 2),
			version('202', 1),
			version('101', 1),
			version('202', 3),
			version('202', 2)
		]);

		expect([...latest.keys()]).toEqual(['101', '202']);
		expect(latest.get('101')?.versionNumber).toBe(2);
		expect(latest.get('202')?.versionNumber).toBe(3);
	});

	it('returns an empty map when no RFQ versions are present', () => {
		expect(latestRfqVersionsByRfq([]).size).toBe(0);
	});
});
