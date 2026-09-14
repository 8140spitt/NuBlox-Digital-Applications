import { describe, expect, it } from 'vitest';
import {
	getJobArchitectureCoverage,
	getJobProfileDetail,
	jobProfileContainsFunctionalRole,
	listFunctionalRoles,
	listJobFamilies,
	listJobProfiles
} from './job-architecture-catalogue';

describe('job architecture catalogue', () => {
	it('keeps the generated F01-F29 coverage intact inside V2', () => {
		const coverage = getJobArchitectureCoverage();
		expect(listJobFamilies()).toHaveLength(29);
		expect(listFunctionalRoles()).toHaveLength(353);
		expect(listJobProfiles()).toHaveLength(382);
		expect(coverage.source).toEqual({ functions: 29, subfunctions: 353, activities: 1510 });
		expect(coverage.coverage.allFunctionsCovered).toBe(true);
		expect(coverage.coverage.allSubfunctionsCovered).toBe(true);
	});

	it('resolves a job profile to its family and functional roles', () => {
		const detail = getJobProfileDetail('JP-F01-FUNCTION-LEAD');
		expect(detail?.family.id).toBe('JF-F01');
		expect(detail?.primaryRoles.map((role) => role.id)).toContain('FR-F01.01');
		expect(jobProfileContainsFunctionalRole('JP-F01-FUNCTION-LEAD', 'FR-F01.01')).toBe(true);
		expect(jobProfileContainsFunctionalRole('JP-F01-FUNCTION-LEAD', 'FR-F09.04')).toBe(false);
	});

	it('filters profiles by source family and search text without changing canonical data', () => {
		const procurement = listJobProfiles({ jobFamilyId: 'JF-F09' });
		expect(procurement.length).toBeGreaterThan(1);
		expect(procurement.every((profile) => profile.jobFamilyId === 'JF-F09')).toBe(true);
		expect(
			listJobProfiles({ query: 'Strategic Analysis Specialist' }).map((profile) => profile.id)
		).toContain('JP-F01.02-PROFESSIONAL');
	});
});
