import { describe, expect, it } from 'vitest';
import { governedVersionCoordinates, nextMinorVersion } from './governed-versioning';

describe('governed versioning', () => {
	it('labels an initial working draft as 0.1', () => {
		expect(
			governedVersionCoordinates({
				versionNumber: 1,
				minorVersionNumber: 1,
				lifecycleStatus: 'draft'
			})
		).toMatchObject({ major: 0, minor: 1, label: '0.1', status: 'draft' });
	});

	it('labels a revision of major version 1 as 1.1', () => {
		expect(
			governedVersionCoordinates({
				versionNumber: 2,
				minorVersionNumber: 1,
				lifecycleStatus: 'draft'
			})
		).toMatchObject({ major: 1, minor: 1, label: '1.1', status: 'draft' });
	});

	it('labels an approved record as a published major version', () => {
		expect(
			governedVersionCoordinates({
				versionNumber: 2,
				minorVersionNumber: 0,
				lifecycleStatus: 'approved'
			})
		).toMatchObject({ major: 2, minor: 0, label: '2.0', status: 'published' });
	});

	it('treats superseded records as historical major versions', () => {
		expect(
			governedVersionCoordinates({
				versionNumber: 1,
				minorVersionNumber: 0,
				lifecycleStatus: 'superseded'
			})
		).toMatchObject({ major: 1, minor: 0, label: '1.0', status: 'historical' });
	});

	it('increments only the working minor coordinate between meaningful saves', () => {
		expect(nextMinorVersion(1)).toBe(2);
		expect(nextMinorVersion(4)).toBe(5);
	});

	it('keeps draft, published and historical coordinates distinct from discarded history', () => {
		expect(
			governedVersionCoordinates({
				versionNumber: 3,
				minorVersionNumber: 2,
				lifecycleStatus: 'draft'
			})
		).toMatchObject({ label: '2.2', status: 'draft' });
	});
});
