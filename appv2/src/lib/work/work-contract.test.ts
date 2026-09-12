import { describe, expect, it } from 'vitest';
import { sortWorkItems, summariseWorkQueue, type WorkItem } from './work-contract';

const items: WorkItem[] = [
	{
		id: 'normal-later',
		functionId: 'F27',
		kind: 'action',
		priority: 'normal',
		status: 'open',
		title: 'Later action',
		dueAt: '2026-09-15T09:00:00.000Z',
		context: 'Project Alpha',
		reference: { label: 'Open record', href: '/nublox/projects/alpha' }
	},
	{
		id: 'critical',
		functionId: 'F02',
		kind: 'decision',
		priority: 'critical',
		status: 'blocked',
		title: 'Critical decision',
		dueAt: '2026-09-13T09:00:00.000Z',
		context: 'Board',
		reference: { label: 'Open decision', href: '/nublox/governance/decisions/1' }
	},
	{
		id: 'normal-sooner',
		functionId: 'F09',
		kind: 'approval',
		priority: 'normal',
		status: 'open',
		title: 'Sooner approval',
		dueAt: '2026-09-14T09:00:00.000Z',
		context: 'Procurement',
		reference: { label: 'Open approval', href: '/nublox/procurement/approvals/1' }
	}
];

describe('work contract', () => {
	it('orders priority before due date', () => {
		expect(sortWorkItems(items).map((item) => item.id)).toEqual([
			'critical',
			'normal-sooner',
			'normal-later'
		]);
	});

	it('summarises urgent and blocked work', () => {
		expect(summariseWorkQueue(items, new Date('2026-09-12T12:00:00.000Z'))).toEqual({
			total: 3,
			critical: 1,
			dueSoon: 2,
			blocked: 1
		});
	});
});
