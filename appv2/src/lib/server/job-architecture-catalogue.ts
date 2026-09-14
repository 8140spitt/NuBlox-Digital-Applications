import jobFamiliesDocument from '../../../../docs/architecture/job-architecture/generated/job-families.generated.json';
import functionalRolesDocument from '../../../../docs/architecture/job-architecture/generated/functional-roles.generated.json';
import jobProfilesDocument from '../../../../docs/architecture/job-architecture/generated/job-profiles.generated.json';
import coverageDocument from '../../../../docs/architecture/job-architecture/generated/coverage.generated.json';

export type JobArchitectureStatus = 'candidate' | 'approved' | 'retired';

export type JobFamily = {
	id: string;
	status: JobArchitectureStatus;
	name: string;
	sourceFunctionId: string;
	purpose: string;
};

export type FunctionalRole = {
	id: string;
	status: JobArchitectureStatus;
	name: string;
	purpose: string;
	jobFamilyId: string;
	source: {
		functionId: string;
		functionName: string;
		subfunctionId: string;
		subfunctionName: string;
	};
	activities: string[];
	accountabilities: string[];
	expectedOutputs: string[];
	knowledgeAndSkills: string[];
	behaviouralCompetencies: string[];
	defaultPerformanceMeasures: string[];
};

export type JobProfile = {
	id: string;
	status: JobArchitectureStatus;
	title: string;
	jobFamilyId: string;
	level: string;
	purpose: string;
	primaryFunctionalRoleIds: string[];
	secondaryFunctionalRoleIds: string[];
	keyAccountabilities: string[];
	expectedOutputs: string[];
	knowledgeAndTechnicalSkills: string[];
	behaviouralCompetencies: string[];
	qualifications: string[];
	experience: string;
	performanceMeasures: string[];
	alternativeTitles: string[];
	sourceMappings: {
		functionIds: string[];
		subfunctionIds: string[];
	};
};

export type JobArchitectureCoverage = {
	generatorVersion: number;
	source: {
		functions: number;
		subfunctions: number;
		activities: number;
	};
	generated: {
		jobFamilies: number;
		functionalRoles: number;
		jobProfiles: number;
		functionLeadProfiles: number;
		specialistProfiles: number;
	};
	coverage: {
		functionsCovered: number;
		subfunctionsCoveredByFunctionalRoles: number;
		subfunctionsCoveredByJobProfiles: number;
		activitiesInheritedByFunctionalRoles: number;
		allFunctionsCovered: boolean;
		allSubfunctionsCovered: boolean;
	};
};

type JobFamiliesDocument = { version: number; jobFamilies: JobFamily[] };
type FunctionalRolesDocument = { version: number; functionalRoles: FunctionalRole[] };
type JobProfilesDocument = { version: number; jobProfiles: JobProfile[] };

const families = (jobFamiliesDocument as JobFamiliesDocument).jobFamilies;
const roles = (functionalRolesDocument as FunctionalRolesDocument).functionalRoles;
const profiles = (jobProfilesDocument as JobProfilesDocument).jobProfiles;
const coverage = coverageDocument as JobArchitectureCoverage;

const familyById = new Map(families.map((family) => [family.id, family]));
const roleById = new Map(roles.map((role) => [role.id, role]));
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

export function getJobArchitectureCoverage(): JobArchitectureCoverage {
	return coverage;
}

export function listJobFamilies(): JobFamily[] {
	return [...families];
}

export function getJobFamily(id: string): JobFamily | null {
	return familyById.get(id) ?? null;
}

export function listFunctionalRoles(jobFamilyId?: string): FunctionalRole[] {
	return jobFamilyId ? roles.filter((role) => role.jobFamilyId === jobFamilyId) : [...roles];
}

export function getFunctionalRole(id: string): FunctionalRole | null {
	return roleById.get(id) ?? null;
}

export function getFunctionalRoles(ids: readonly string[]): FunctionalRole[] {
	return ids.flatMap((id) => {
		const role = roleById.get(id);
		return role ? [role] : [];
	});
}

export function listJobProfiles(input?: {
	jobFamilyId?: string | null;
	level?: string | null;
	query?: string | null;
}): JobProfile[] {
	const familyId = input?.jobFamilyId?.trim() || null;
	const level = input?.level?.trim().toLowerCase() || null;
	const query = input?.query?.trim().toLowerCase() || null;

	return profiles.filter((profile) => {
		if (familyId && profile.jobFamilyId !== familyId) return false;
		if (level && profile.level.toLowerCase() !== level) return false;
		if (!query) return true;
		const family = familyById.get(profile.jobFamilyId);
		const searchable = [
			profile.id,
			profile.title,
			profile.purpose,
			profile.level,
			family?.name ?? '',
			...profile.alternativeTitles,
			...profile.sourceMappings.functionIds,
			...profile.sourceMappings.subfunctionIds
		]
			.join(' ')
			.toLowerCase();
		return searchable.includes(query);
	});
}

export function getJobProfile(id: string): JobProfile | null {
	return profileById.get(id) ?? null;
}

export function getJobProfileDetail(id: string): {
	profile: JobProfile;
	family: JobFamily;
	primaryRoles: FunctionalRole[];
	secondaryRoles: FunctionalRole[];
} | null {
	const profile = getJobProfile(id);
	if (!profile) return null;
	const family = getJobFamily(profile.jobFamilyId);
	if (!family)
		throw new Error(`Job profile ${profile.id} references unknown family ${profile.jobFamilyId}.`);
	return {
		profile,
		family,
		primaryRoles: getFunctionalRoles(profile.primaryFunctionalRoleIds),
		secondaryRoles: getFunctionalRoles(profile.secondaryFunctionalRoleIds)
	};
}

export function jobProfileContainsFunctionalRole(
	jobProfileId: string,
	functionalRoleId: string
): boolean {
	const profile = getJobProfile(jobProfileId);
	if (!profile) return false;
	return (
		profile.primaryFunctionalRoleIds.includes(functionalRoleId) ||
		profile.secondaryFunctionalRoleIds.includes(functionalRoleId)
	);
}

export function listJobProfileLevels(): string[] {
	return [...new Set(profiles.map((profile) => profile.level))].sort((a, b) => a.localeCompare(b));
}
