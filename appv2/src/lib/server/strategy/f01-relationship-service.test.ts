import { describe, expect, it } from 'vitest';
import { normaliseRelationshipPublicIds } from './f01-relationship-service';

describe('F01 relationship integrity helpers', () => {
	it('normalises association selections as a stable unique set', () => {
		expect(normaliseRelationshipPublicIds([' a ', 'b', 'a', '', '  '])).toEqual(['a', 'b']);
	});
});
