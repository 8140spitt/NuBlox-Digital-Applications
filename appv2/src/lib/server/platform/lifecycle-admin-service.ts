import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';
import {
	appendGovernedVersion,
	listGovernedVersionHistory,
	markPublishedVersionHistorical,
	markWorkingVersionDiscarded,
	type GovernedVersionHistoryItem
} from './governed-versioning';

const KEY = /^[a-z][a-z0-9.-]{1,127}$/;
const STATE = /^[a-z][a-z0-9_-]{0,63}$/;
const ROLE = /^[a-z][a-z0-9._-]{1,95}$/;
const OBJECT_TYPE = /^[A-Za-z][A-Za-z0-9._-]{1,127}$/;
const PERMISSION = /^[a-z][a-z0-9._-]{1,159}$/;

export class LifecycleAdministrationAccessError extends Error {}
export class LifecycleAdministrationValidationError extends Error {}

export type LifecycleTemplateSummary = {
	publicId: string;
	templateKey: string;
	name: string;
	description: string | null;
	objectType: string;
	mode: 'basic' | 'advanced';
	initialState: string;
	status: 'draft' | 'published' | 'superseded';
	versionLabel: string;
	phaseCount: number;
	transitionCount: number;
	isActiveBinding: boolean;
	updatedAt: string;
};

export type LifecyclePhaseAdmin = {
	phaseKey: string;
	label: string;
	displayOrder: number;
	editable: boolean;
	deletable: boolean;
	revisable: boolean;
};

export type LifecycleRoleAdmin = {
	roleKey: string;
	label: string;
	description: string | null;
	organisationRoles: Array<{ publicId: string; name: string }>;
};

export type LifecycleAccessRuleAdmin = {
	id: number;
	phaseKey: string;
	roleKey: string;
	permissionKey: string;
};

export type LifecycleTransitionAdmin = {
	publicId: string;
	fromState: string;
	toState: string;
	label: string;
	requiresNote: boolean;
	requiresTargetReference: boolean;
	tone: 'default' | 'danger';
	requiredPermissionKey: string | null;
	workflowKey: string | null;
};

export type LifecycleTemplateDetail = LifecycleTemplateSummary & {
	phases: LifecyclePhaseAdmin[];
	roles: LifecycleRoleAdmin[];
	accessRules: LifecycleAccessRuleAdmin[];
	transitions: LifecycleTransitionAdmin[];
	versionHistory: GovernedVersionHistoryItem[];
	canManage: boolean;
	canPublish: boolean;
};

export type LifecycleReferenceData = {
	permissions: Array<{ key: string; name: string }>;
	organisationRoles: Array<{ publicId: string; name: string }>;
};

type TemplateRow = RowDataPacket & {
	id: number | string;
	publicId: string;
	templateKey: string;
	versionNumber: number | string;
	minorVersionNumber: number | string;
	name: string;
	description: string | null;
	objectType: string;
	mode: 'basic' | 'advanced';
	initialState: string;
	status: 'draft' | 'published' | 'superseded';
	supersedesId: number | string | null;
	updatedAt: Date | string;
};

function bool(value: unknown): boolean {
	return value === true || Number(value) === 1;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : String(value);
}

function versionLabel(
	row: Pick<TemplateRow, 'status' | 'versionNumber' | 'minorVersionNumber'>
): string {
	const major = Number(row.versionNumber);
	const minor = Number(row.minorVersionNumber);
	return row.status === 'draft' ? `${Math.max(0, major - 1)}.${Math.max(1, minor)}` : `${major}.0`;
}

function requiredText(value: string | undefined, label: string, max: number): string {
	const normalized = value?.trim() ?? '';
	if (!normalized || normalized.length > max) {
		throw new LifecycleAdministrationValidationError(
			`${label} must be between 1 and ${max} characters.`
		);
	}
	return normalized;
}

function optionalText(value: string | undefined, max: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max) {
		throw new LifecycleAdministrationValidationError(`Text must not exceed ${max} characters.`);
	}
	return normalized;
}

function key(value: string | undefined): string {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!KEY.test(normalized)) {
		throw new LifecycleAdministrationValidationError(
			'Template key must start with a letter and use lowercase letters, numbers, dots or hyphens.'
		);
	}
	return normalized;
}

function stateKey(value: string | undefined, label = 'State key'): string {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!STATE.test(normalized)) {
		throw new LifecycleAdministrationValidationError(
			`${label} must use lowercase letters, numbers, underscores or hyphens.`
		);
	}
	return normalized;
}

function roleKey(value: string | undefined): string {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!ROLE.test(normalized)) {
		throw new LifecycleAdministrationValidationError(
			'Lifecycle role key must start with a letter and use lowercase letters, numbers, dots, underscores or hyphens.'
		);
	}
	return normalized;
}

function objectType(value: string | undefined): string {
	const normalized = value?.trim() ?? '';
	if (!OBJECT_TYPE.test(normalized)) {
		throw new LifecycleAdministrationValidationError(
			'Object type must start with a letter and use letters, numbers, dots, underscores or hyphens.'
		);
	}
	return normalized;
}

function permissionKey(value: string | undefined, required = false): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized && !required) return null;
	if (!PERMISSION.test(normalized)) {
		throw new LifecycleAdministrationValidationError('Permission key is invalid.');
	}
	return normalized;
}

async function requirePermission(actor: EvidenceActor, permissionKeyValue: string): Promise<void> {
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys: [permissionKeyValue]
	});
	if (!decisions.get(permissionKeyValue)?.allowed) {
		throw new LifecycleAdministrationAccessError(
			`You do not have ${permissionKeyValue} authority in this organisation.`
		);
	}
}

async function permissionFlags(
	actor: EvidenceActor
): Promise<{ canManage: boolean; canPublish: boolean }> {
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys: ['lifecycle.manage', 'lifecycle.publish']
	});
	return {
		canManage: decisions.get('lifecycle.manage')?.allowed === true,
		canPublish: decisions.get('lifecycle.publish')?.allowed === true
	};
}

async function templateRow(
	connection: PoolConnection,
	actor: EvidenceActor,
	publicId: string,
	forUpdate = false
): Promise<TemplateRow> {
	const [rows] = await connection.execute<TemplateRow[]>(
		`SELECT id,
		        public_id AS publicId,
		        template_key AS templateKey,
		        version_number AS versionNumber,
		        minor_version_number AS minorVersionNumber,
		        name,
		        description,
		        object_type AS objectType,
		        mode,
		        initial_state AS initialState,
		        lifecycle_status AS status,
		        supersedes_lifecycle_template_id AS supersedesId,
		        updated_at AS updatedAt
		 FROM lifecycle_templates
		 WHERE organisation_id = ? AND public_id = ?
		 LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
		[actor.organisationId, publicId]
	);
	const row = rows[0];
	if (!row) throw new LifecycleAdministrationValidationError('Lifecycle template was not found.');
	return row;
}

async function snapshot(connection: PoolConnection, actor: EvidenceActor, templateId: number) {
	const [templates] = await connection.execute<TemplateRow[]>(
		`SELECT id, public_id AS publicId, template_key AS templateKey, version_number AS versionNumber,
		        minor_version_number AS minorVersionNumber, name, description, object_type AS objectType,
		        mode, initial_state AS initialState, lifecycle_status AS status,
		        supersedes_lifecycle_template_id AS supersedesId, updated_at AS updatedAt
		 FROM lifecycle_templates WHERE organisation_id = ? AND id = ? LIMIT 1`,
		[actor.organisationId, templateId]
	);
	const template = templates[0];
	if (!template)
		throw new LifecycleAdministrationValidationError('Lifecycle template was not found.');
	const [phases] = await connection.execute<RowDataPacket[]>(
		`SELECT phase_key AS phaseKey, label, display_order AS displayOrder, is_editable AS editable,
		        is_deletable AS deletable, is_revisable AS revisable
		 FROM lifecycle_template_phases
		 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY display_order, id`,
		[actor.organisationId, templateId]
	);
	const [roles] = await connection.execute<RowDataPacket[]>(
		`SELECT role_key AS roleKey, label, description
		 FROM lifecycle_template_roles
		 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY role_key`,
		[actor.organisationId, templateId]
	);
	const [rules] = await connection.execute<RowDataPacket[]>(
		`SELECT phase_key AS phaseKey, role_key AS roleKey, permission_key AS permissionKey
		 FROM lifecycle_template_phase_access_rules
		 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY phase_key, role_key, permission_key`,
		[actor.organisationId, templateId]
	);
	const [transitions] = await connection.execute<RowDataPacket[]>(
		`SELECT from_state AS fromState, to_state AS toState, label, requires_note AS requiresNote,
		        requires_target_reference AS requiresTargetReference, tone,
		        required_permission_key AS requiredPermissionKey, workflow_key AS workflowKey
		 FROM lifecycle_template_transitions
		 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY from_state, id`,
		[actor.organisationId, templateId]
	);
	return {
		templateKey: template.templateKey,
		name: template.name,
		description: template.description,
		objectType: template.objectType,
		mode: template.mode,
		initialState: template.initialState,
		lifecycleStatus: template.status,
		phases: phases.map((row) => ({
			...row,
			editable: bool(row.editable),
			deletable: bool(row.deletable),
			revisable: bool(row.revisable)
		})),
		roles,
		accessRules: rules,
		transitions: transitions.map((row) => ({
			...row,
			requiresNote: bool(row.requiresNote),
			requiresTargetReference: bool(row.requiresTargetReference)
		}))
	};
}

async function appendTemplateVersion(
	connection: PoolConnection,
	actor: EvidenceActor,
	row: TemplateRow,
	changeNote: string,
	published = false
): Promise<void> {
	await appendGovernedVersion(connection, {
		actor,
		domainCode: 'PLATFORM',
		recordType: 'lifecycle_template',
		lineageKey: row.templateKey,
		recordPublicId: row.publicId,
		versionNumber: Number(row.versionNumber),
		minorVersionNumber: Number(row.minorVersionNumber),
		lifecycleStatus: published ? 'approved' : 'draft',
		snapshot: await snapshot(connection, actor, Number(row.id)),
		changeNote,
		published
	});
}

async function bumpDraft(
	connection: PoolConnection,
	actor: EvidenceActor,
	row: TemplateRow,
	changeNote: string
): Promise<void> {
	if (row.status !== 'draft') {
		throw new LifecycleAdministrationValidationError(
			'Published lifecycle templates are immutable. Create a controlled revision to amend them.'
		);
	}
	await connection.execute(
		`UPDATE lifecycle_templates
		 SET minor_version_number = minor_version_number + 1
		 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
		[actor.organisationId, row.id]
	);
	const refreshed = await templateRow(connection, actor, row.publicId, true);
	await appendTemplateVersion(connection, actor, refreshed, changeNote);
}

async function ensurePermissionExists(
	connection: PoolConnection,
	value: string | null
): Promise<void> {
	if (!value) return;
	const [rows] = await connection.execute<RowDataPacket[]>(
		`SELECT id FROM permissions WHERE permission_key = ? AND is_active = 1 LIMIT 1`,
		[value]
	);
	if (!rows[0]) {
		throw new LifecycleAdministrationValidationError(
			`Permission ${value} is not active in the platform catalogue.`
		);
	}
}

async function validateDraft(
	connection: PoolConnection,
	actor: EvidenceActor,
	row: TemplateRow
): Promise<void> {
	const [phaseRows] = await connection.execute<RowDataPacket[]>(
		`SELECT phase_key AS phaseKey FROM lifecycle_template_phases
		 WHERE organisation_id = ? AND lifecycle_template_id = ?`,
		[actor.organisationId, row.id]
	);
	const phases = new Set(phaseRows.map((phase) => String(phase.phaseKey)));
	if (!phases.has(row.initialState)) {
		throw new LifecycleAdministrationValidationError(
			'The initial state must reference a defined lifecycle phase.'
		);
	}
	if (row.mode === 'basic') {
		const [rules] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_template_phase_access_rules
			 WHERE organisation_id = ? AND lifecycle_template_id = ? LIMIT 1`,
			[actor.organisationId, row.id]
		);
		if (rules[0]) {
			throw new LifecycleAdministrationValidationError(
				'Basic lifecycle templates cannot contain phase-scoped access rules.'
			);
		}
	}
	const [transitionRows] = await connection.execute<
		Array<RowDataPacket & { fromState: string; toState: string; permissionKey: string | null }>
	>(
		`SELECT from_state AS fromState, to_state AS toState, required_permission_key AS permissionKey
		 FROM lifecycle_template_transitions
		 WHERE organisation_id = ? AND lifecycle_template_id = ?`,
		[actor.organisationId, row.id]
	);
	for (const transition of transitionRows) {
		if (!phases.has(transition.fromState) || !phases.has(transition.toState)) {
			throw new LifecycleAdministrationValidationError(
				'Every transition must connect two defined lifecycle phases.'
			);
		}
		await ensurePermissionExists(connection, transition.permissionKey);
	}
}

export async function listLifecycleTemplates(
	actor: EvidenceActor
): Promise<LifecycleTemplateSummary[]> {
	await requirePermission(actor, 'lifecycle.view');
	const [rows] = await getPool().execute<
		Array<
			TemplateRow & {
				phaseCount: number | string;
				transitionCount: number | string;
				isActiveBinding: number | boolean;
			}
		>
	>(
		`SELECT template.id,
		        template.public_id AS publicId,
		        template.template_key AS templateKey,
		        template.version_number AS versionNumber,
		        template.minor_version_number AS minorVersionNumber,
		        template.name,
		        template.description,
		        template.object_type AS objectType,
		        template.mode,
		        template.initial_state AS initialState,
		        template.lifecycle_status AS status,
		        template.supersedes_lifecycle_template_id AS supersedesId,
		        template.updated_at AS updatedAt,
		        (SELECT COUNT(*) FROM lifecycle_template_phases phase WHERE phase.lifecycle_template_id = template.id) AS phaseCount,
		        (SELECT COUNT(*) FROM lifecycle_template_transitions transition_record WHERE transition_record.lifecycle_template_id = template.id) AS transitionCount,
		        EXISTS(SELECT 1 FROM lifecycle_object_bindings binding WHERE binding.organisation_id = template.organisation_id AND binding.lifecycle_template_id = template.id) AS isActiveBinding
		 FROM lifecycle_templates template
		 WHERE template.organisation_id = ?
		 ORDER BY template.template_key, template.version_number DESC`,
		[actor.organisationId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		templateKey: row.templateKey,
		name: row.name,
		description: row.description,
		objectType: row.objectType,
		mode: row.mode,
		initialState: row.initialState,
		status: row.status,
		versionLabel: versionLabel(row),
		phaseCount: Number(row.phaseCount),
		transitionCount: Number(row.transitionCount),
		isActiveBinding: bool(row.isActiveBinding),
		updatedAt: iso(row.updatedAt)
	}));
}

export async function listLifecycleReferenceData(
	actor: EvidenceActor
): Promise<LifecycleReferenceData> {
	await requirePermission(actor, 'lifecycle.view');
	const [permissions] = await getPool().execute<
		Array<RowDataPacket & { key: string; name: string }>
	>(
		`SELECT permission_key AS \`key\`, name FROM permissions WHERE is_active = 1 ORDER BY permission_key`
	);
	const [roles] = await getPool().execute<
		Array<RowDataPacket & { publicId: string; name: string }>
	>(
		`SELECT public_id AS publicId, name FROM organisation_roles
		 WHERE organisation_id = ? AND is_active = 1 ORDER BY name`,
		[actor.organisationId]
	);
	return { permissions, organisationRoles: roles };
}

export async function getLifecycleTemplate(
	actor: EvidenceActor,
	publicId: string
): Promise<LifecycleTemplateDetail> {
	await requirePermission(actor, 'lifecycle.view');
	const flags = await permissionFlags(actor);
	const connection = await getPool().getConnection();
	try {
		const row = await templateRow(connection, actor, publicId);
		const templateId = Number(row.id);
		const [phaseRows] = await connection.execute<
			Array<
				RowDataPacket & {
					phaseKey: string;
					label: string;
					displayOrder: number | string;
					editable: number | boolean;
					deletable: number | boolean;
					revisable: number | boolean;
				}
			>
		>(
			`SELECT phase_key AS phaseKey, label, display_order AS displayOrder,
			        is_editable AS editable, is_deletable AS deletable, is_revisable AS revisable
			 FROM lifecycle_template_phases
			 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY display_order, id`,
			[actor.organisationId, templateId]
		);
		const [roleRows] = await connection.execute<
			Array<RowDataPacket & { roleKey: string; label: string; description: string | null }>
		>(
			`SELECT role_key AS roleKey, label, description FROM lifecycle_template_roles
			 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY role_key`,
			[actor.organisationId, templateId]
		);
		const [roleBindings] = await connection.execute<
			Array<RowDataPacket & { roleKey: string; publicId: string; name: string }>
		>(
			`SELECT binding.lifecycle_role_key AS roleKey, organisation_role.public_id AS publicId, organisation_role.name
			 FROM lifecycle_role_bindings binding
			 JOIN organisation_roles organisation_role
			   ON organisation_role.id = binding.organisation_role_id
			  AND organisation_role.organisation_id = binding.organisation_id
			 WHERE binding.organisation_id = ? AND binding.lifecycle_template_id = ?
			 ORDER BY binding.lifecycle_role_key, organisation_role.name`,
			[actor.organisationId, templateId]
		);
		const [accessRows] = await connection.execute<
			Array<
				RowDataPacket & {
					id: number | string;
					phaseKey: string;
					roleKey: string;
					permissionKey: string;
				}
			>
		>(
			`SELECT id, phase_key AS phaseKey, role_key AS roleKey, permission_key AS permissionKey
			 FROM lifecycle_template_phase_access_rules
			 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY phase_key, role_key, permission_key`,
			[actor.organisationId, templateId]
		);
		const [transitionRows] = await connection.execute<
			Array<
				RowDataPacket & {
					publicId: string;
					fromState: string;
					toState: string;
					label: string;
					requiresNote: number | boolean;
					requiresTargetReference: number | boolean;
					tone: 'default' | 'danger';
					requiredPermissionKey: string | null;
					workflowKey: string | null;
				}
			>
		>(
			`SELECT public_id AS publicId, from_state AS fromState, to_state AS toState, label,
			        requires_note AS requiresNote, requires_target_reference AS requiresTargetReference,
			        tone, required_permission_key AS requiredPermissionKey, workflow_key AS workflowKey
			 FROM lifecycle_template_transitions
			 WHERE organisation_id = ? AND lifecycle_template_id = ? ORDER BY from_state, id`,
			[actor.organisationId, templateId]
		);
		const [bindingRows] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_object_bindings WHERE organisation_id = ? AND lifecycle_template_id = ? LIMIT 1`,
			[actor.organisationId, templateId]
		);
		const history = await listGovernedVersionHistory(connection, {
			organisationId: actor.organisationId,
			domainCode: 'PLATFORM',
			recordType: 'lifecycle_template',
			lineageKey: row.templateKey,
			limit: 30
		});
		return {
			publicId: row.publicId,
			templateKey: row.templateKey,
			name: row.name,
			description: row.description,
			objectType: row.objectType,
			mode: row.mode,
			initialState: row.initialState,
			status: row.status,
			versionLabel: versionLabel(row),
			phaseCount: phaseRows.length,
			transitionCount: transitionRows.length,
			isActiveBinding: bindingRows.length > 0,
			updatedAt: iso(row.updatedAt),
			phases: phaseRows.map((phase) => ({
				phaseKey: phase.phaseKey,
				label: phase.label,
				displayOrder: Number(phase.displayOrder),
				editable: bool(phase.editable),
				deletable: bool(phase.deletable),
				revisable: bool(phase.revisable)
			})),
			roles: roleRows.map((role) => ({
				...role,
				organisationRoles: roleBindings
					.filter((binding) => binding.roleKey === role.roleKey)
					.map(({ publicId: rolePublicId, name }) => ({ publicId: rolePublicId, name }))
			})),
			accessRules: accessRows.map((rule) => ({ ...rule, id: Number(rule.id) })),
			transitions: transitionRows.map((transition) => ({
				...transition,
				requiresNote: bool(transition.requiresNote),
				requiresTargetReference: bool(transition.requiresTargetReference)
			})),
			versionHistory: history,
			...flags
		};
	} finally {
		connection.release();
	}
}

export async function createLifecycleTemplate(input: {
	actor: EvidenceActor;
	templateKey: string;
	name: string;
	description?: string;
	objectType: string;
	mode: 'basic' | 'advanced';
}): Promise<{ publicId: string }> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const templateKeyValue = key(input.templateKey);
	const name = requiredText(input.name, 'Template name', 200);
	const description = optionalText(input.description, 4000);
	const objectTypeValue = objectType(input.objectType);
	if (!['basic', 'advanced'].includes(input.mode)) {
		throw new LifecycleAdministrationValidationError('Lifecycle mode must be Basic or Advanced.');
	}
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [existing] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_templates WHERE organisation_id = ? AND template_key = ? LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, templateKeyValue]
		);
		if (existing[0]) {
			throw new LifecycleAdministrationValidationError(
				'That lifecycle template key already exists. Revise the published template instead.'
			);
		}
		const [insert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO lifecycle_templates
			 (organisation_id, public_id, template_key, version_number, minor_version_number,
			  name, description, object_type, mode, initial_state, lifecycle_status, created_by_member_id)
			 VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, 'draft', 'draft', ?)`,
			[
				input.actor.organisationId,
				publicId,
				templateKeyValue,
				name,
				description,
				objectTypeValue,
				input.mode,
				input.actor.memberId
			]
		);
		await connection.execute(
			`INSERT INTO lifecycle_template_phases
			 (organisation_id, lifecycle_template_id, phase_key, label, display_order, is_editable, is_deletable, is_revisable)
			 VALUES (?, ?, 'draft', 'Draft', 10, TRUE, TRUE, FALSE)`,
			[input.actor.organisationId, insert.insertId]
		);
		const row = await templateRow(connection, input.actor, publicId, true);
		await appendTemplateVersion(connection, input.actor, row, 'Lifecycle template created');
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'lifecycle.template.create',
			subjectType: 'lifecycle_template',
			subjectPublicId: publicId,
			changeSummary: {
				templateKey: templateKeyValue,
				objectType: objectTypeValue,
				mode: input.mode
			},
			eventMetadata: { function: 'PLATFORM', mutation: 'create' }
		});
		await connection.commit();
		return { publicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function updateLifecycleTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
	name: string;
	description?: string;
	objectType: string;
	initialState: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		const initialState = stateKey(input.initialState, 'Initial state');
		const [phaseRows] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_template_phases WHERE organisation_id = ? AND lifecycle_template_id = ? AND phase_key = ? LIMIT 1`,
			[input.actor.organisationId, row.id, initialState]
		);
		if (!phaseRows[0])
			throw new LifecycleAdministrationValidationError(
				'Initial state must reference an existing phase.'
			);
		await connection.execute(
			`UPDATE lifecycle_templates
			 SET name = ?, description = ?, object_type = ?, initial_state = ?
			 WHERE organisation_id = ? AND id = ?`,
			[
				requiredText(input.name, 'Template name', 200),
				optionalText(input.description, 4000),
				objectType(input.objectType),
				initialState,
				input.actor.organisationId,
				row.id
			]
		);
		await bumpDraft(connection, input.actor, row, 'Lifecycle template metadata updated');
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'lifecycle.template.update',
			subjectType: 'lifecycle_template',
			subjectPublicId: input.publicId,
			changeSummary: { initialState },
			eventMetadata: { function: 'PLATFORM', mutation: 'update' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addLifecyclePhase(input: {
	actor: EvidenceActor;
	publicId: string;
	phaseKey: string;
	label: string;
	displayOrder: number;
	editable: boolean;
	deletable: boolean;
	revisable: boolean;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const phaseKeyValue = stateKey(input.phaseKey, 'Phase key');
	if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0) {
		throw new LifecycleAdministrationValidationError(
			'Display order must be a non-negative whole number.'
		);
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		await connection.execute(
			`INSERT INTO lifecycle_template_phases
			 (organisation_id, lifecycle_template_id, phase_key, label, display_order, is_editable, is_deletable, is_revisable)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				phaseKeyValue,
				requiredText(input.label, 'Phase label', 120),
				input.displayOrder,
				input.editable,
				input.deletable,
				input.revisable
			]
		);
		await bumpDraft(connection, input.actor, row, `Lifecycle phase ${phaseKeyValue} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function deleteLifecyclePhase(input: {
	actor: EvidenceActor;
	publicId: string;
	phaseKey: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const phaseKeyValue = stateKey(input.phaseKey, 'Phase key');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		if (row.initialState === phaseKeyValue)
			throw new LifecycleAdministrationValidationError(
				'The initial phase cannot be deleted. Select another initial phase first.'
			);
		const [transitionRows] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_template_transitions
			 WHERE organisation_id = ? AND lifecycle_template_id = ? AND (from_state = ? OR to_state = ?) LIMIT 1`,
			[input.actor.organisationId, row.id, phaseKeyValue, phaseKeyValue]
		);
		if (transitionRows[0])
			throw new LifecycleAdministrationValidationError(
				'Remove transitions connected to this phase before deleting it.'
			);
		await connection.execute(
			`DELETE FROM lifecycle_template_phase_access_rules
			 WHERE organisation_id = ? AND lifecycle_template_id = ? AND phase_key = ?`,
			[input.actor.organisationId, row.id, phaseKeyValue]
		);
		const [result] = await connection.execute<ResultSetHeader>(
			`DELETE FROM lifecycle_template_phases
			 WHERE organisation_id = ? AND lifecycle_template_id = ? AND phase_key = ?`,
			[input.actor.organisationId, row.id, phaseKeyValue]
		);
		if (!result.affectedRows)
			throw new LifecycleAdministrationValidationError('Lifecycle phase was not found.');
		await bumpDraft(connection, input.actor, row, `Lifecycle phase ${phaseKeyValue} removed`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addLifecycleRole(input: {
	actor: EvidenceActor;
	publicId: string;
	roleKey: string;
	label: string;
	description?: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const roleKeyValue = roleKey(input.roleKey);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		if (row.mode !== 'advanced')
			throw new LifecycleAdministrationValidationError(
				'Lifecycle roles are available only on Advanced templates.'
			);
		await connection.execute(
			`INSERT INTO lifecycle_template_roles
			 (organisation_id, lifecycle_template_id, role_key, label, description)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				roleKeyValue,
				requiredText(input.label, 'Lifecycle role label', 120),
				optionalText(input.description, 2000)
			]
		);
		await bumpDraft(connection, input.actor, row, `Lifecycle role ${roleKeyValue} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function deleteLifecycleRole(input: {
	actor: EvidenceActor;
	publicId: string;
	roleKey: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const roleKeyValue = roleKey(input.roleKey);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		await connection.execute(
			`DELETE FROM lifecycle_template_phase_access_rules WHERE organisation_id = ? AND lifecycle_template_id = ? AND role_key = ?`,
			[input.actor.organisationId, row.id, roleKeyValue]
		);
		await connection.execute(
			`DELETE FROM lifecycle_role_bindings WHERE organisation_id = ? AND lifecycle_template_id = ? AND lifecycle_role_key = ?`,
			[input.actor.organisationId, row.id, roleKeyValue]
		);
		const [result] = await connection.execute<ResultSetHeader>(
			`DELETE FROM lifecycle_template_roles WHERE organisation_id = ? AND lifecycle_template_id = ? AND role_key = ?`,
			[input.actor.organisationId, row.id, roleKeyValue]
		);
		if (!result.affectedRows)
			throw new LifecycleAdministrationValidationError('Lifecycle role was not found.');
		await bumpDraft(connection, input.actor, row, `Lifecycle role ${roleKeyValue} removed`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function bindOrganisationRole(input: {
	actor: EvidenceActor;
	publicId: string;
	lifecycleRoleKey: string;
	organisationRolePublicId: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const roleKeyValue = roleKey(input.lifecycleRoleKey);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Role mappings are changed through a draft lifecycle-template revision.'
			);
		const [lifecycleRoles] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_template_roles WHERE organisation_id = ? AND lifecycle_template_id = ? AND role_key = ? LIMIT 1`,
			[input.actor.organisationId, row.id, roleKeyValue]
		);
		if (!lifecycleRoles[0])
			throw new LifecycleAdministrationValidationError('Lifecycle role was not found.');
		const [organisationRoles] = await connection.execute<
			Array<RowDataPacket & { id: number | string }>
		>(
			`SELECT id FROM organisation_roles WHERE organisation_id = ? AND public_id = ? AND is_active = 1 LIMIT 1`,
			[input.actor.organisationId, input.organisationRolePublicId]
		);
		const organisationRole = organisationRoles[0];
		if (!organisationRole)
			throw new LifecycleAdministrationValidationError('Organisation role was not found.');
		await connection.execute(
			`INSERT IGNORE INTO lifecycle_role_bindings
			 (organisation_id, lifecycle_template_id, lifecycle_role_key, organisation_role_id, bound_by_member_id)
			 VALUES (?, ?, ?, ?, ?)`,
			[input.actor.organisationId, row.id, roleKeyValue, organisationRole.id, input.actor.memberId]
		);
		await bumpDraft(
			connection,
			input.actor,
			row,
			`Organisation role mapped to lifecycle role ${roleKeyValue}`
		);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function unbindOrganisationRole(input: {
	actor: EvidenceActor;
	publicId: string;
	lifecycleRoleKey: string;
	organisationRolePublicId: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Role mappings are changed through a draft lifecycle-template revision.'
			);
		await connection.execute(
			`DELETE binding FROM lifecycle_role_bindings binding
			 JOIN organisation_roles organisation_role ON organisation_role.id = binding.organisation_role_id
			 WHERE binding.organisation_id = ? AND binding.lifecycle_template_id = ?
			   AND binding.lifecycle_role_key = ? AND organisation_role.public_id = ?`,
			[
				input.actor.organisationId,
				row.id,
				roleKey(input.lifecycleRoleKey),
				input.organisationRolePublicId
			]
		);
		await bumpDraft(
			connection,
			input.actor,
			row,
			`Organisation role mapping removed from ${input.lifecycleRoleKey}`
		);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addLifecycleAccessRule(input: {
	actor: EvidenceActor;
	publicId: string;
	phaseKey: string;
	roleKey: string;
	permissionKey: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const phaseKeyValue = stateKey(input.phaseKey, 'Phase key');
	const roleKeyValue = roleKey(input.roleKey);
	const permissionKeyValue = permissionKey(input.permissionKey, true)!;
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		if (row.mode !== 'advanced')
			throw new LifecycleAdministrationValidationError(
				'Phase-scoped access rules require an Advanced lifecycle template.'
			);
		await ensurePermissionExists(connection, permissionKeyValue);
		const [phaseRows] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_template_phases WHERE organisation_id = ? AND lifecycle_template_id = ? AND phase_key = ? LIMIT 1`,
			[input.actor.organisationId, row.id, phaseKeyValue]
		);
		const [roleRows] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_template_roles WHERE organisation_id = ? AND lifecycle_template_id = ? AND role_key = ? LIMIT 1`,
			[input.actor.organisationId, row.id, roleKeyValue]
		);
		if (!phaseRows[0] || !roleRows[0])
			throw new LifecycleAdministrationValidationError(
				'The selected phase and lifecycle role must both exist.'
			);
		await connection.execute(
			`INSERT IGNORE INTO lifecycle_template_phase_access_rules
			 (organisation_id, lifecycle_template_id, phase_key, role_key, permission_key)
			 VALUES (?, ?, ?, ?, ?)`,
			[input.actor.organisationId, row.id, phaseKeyValue, roleKeyValue, permissionKeyValue]
		);
		await bumpDraft(
			connection,
			input.actor,
			row,
			`Phase access ${roleKeyValue} → ${permissionKeyValue} added`
		);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function deleteLifecycleAccessRule(input: {
	actor: EvidenceActor;
	publicId: string;
	ruleId: number;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		await connection.execute(
			`DELETE FROM lifecycle_template_phase_access_rules WHERE organisation_id = ? AND lifecycle_template_id = ? AND id = ?`,
			[input.actor.organisationId, row.id, input.ruleId]
		);
		await bumpDraft(connection, input.actor, row, 'Phase-scoped access rule removed');
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addLifecycleTransition(input: {
	actor: EvidenceActor;
	publicId: string;
	fromState: string;
	toState: string;
	label: string;
	requiresNote: boolean;
	requiresTargetReference: boolean;
	tone: 'default' | 'danger';
	requiredPermissionKey?: string;
	workflowKey?: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const fromState = stateKey(input.fromState, 'Source state');
	const toState = stateKey(input.toState, 'Target state');
	if (fromState === toState)
		throw new LifecycleAdministrationValidationError('A lifecycle transition must change state.');
	const requiredPermissionKey = permissionKey(input.requiredPermissionKey);
	const workflowKey = optionalText(input.workflowKey, 160);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		await ensurePermissionExists(connection, requiredPermissionKey);
		const [phaseRows] = await connection.execute<RowDataPacket[]>(
			`SELECT phase_key AS phaseKey FROM lifecycle_template_phases WHERE organisation_id = ? AND lifecycle_template_id = ? AND phase_key IN (?, ?)`,
			[input.actor.organisationId, row.id, fromState, toState]
		);
		if (phaseRows.length !== 2)
			throw new LifecycleAdministrationValidationError('Source and target states must both exist.');
		await connection.execute(
			`INSERT INTO lifecycle_template_transitions
			 (organisation_id, lifecycle_template_id, public_id, from_state, to_state, label,
			  requires_note, requires_target_reference, tone, required_permission_key, workflow_key)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				randomUUID(),
				fromState,
				toState,
				requiredText(input.label, 'Transition label', 160),
				input.requiresNote,
				input.requiresTargetReference,
				input.tone,
				requiredPermissionKey,
				workflowKey
			]
		);
		await bumpDraft(connection, input.actor, row, `Transition ${fromState} → ${toState} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function deleteLifecycleTransition(input: {
	actor: EvidenceActor;
	publicId: string;
	transitionPublicId: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only draft lifecycle templates can be modified.'
			);
		await connection.execute(
			`DELETE FROM lifecycle_template_transitions WHERE organisation_id = ? AND lifecycle_template_id = ? AND public_id = ?`,
			[input.actor.organisationId, row.id, input.transitionPublicId]
		);
		await bumpDraft(connection, input.actor, row, 'Lifecycle transition removed');
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function publishLifecycleTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.publish');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Only a draft lifecycle template can be published.'
			);
		await validateDraft(connection, input.actor, row);
		const [previousRows] = await connection.execute<TemplateRow[]>(
			`SELECT id, public_id AS publicId, template_key AS templateKey, version_number AS versionNumber,
			        minor_version_number AS minorVersionNumber, name, description, object_type AS objectType,
			        mode, initial_state AS initialState, lifecycle_status AS status,
			        supersedes_lifecycle_template_id AS supersedesId, updated_at AS updatedAt
			 FROM lifecycle_templates
			 WHERE organisation_id = ? AND template_key = ? AND lifecycle_status = 'published' AND id <> ?
			 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, row.templateKey, row.id]
		);
		const previous = previousRows[0];
		if (previous) {
			await connection.execute(
				`UPDATE lifecycle_templates SET lifecycle_status = 'superseded', minor_version_number = 0
			 WHERE organisation_id = ? AND id = ?`,
				[input.actor.organisationId, previous.id]
			);
			await markPublishedVersionHistorical(connection, {
				organisationId: input.actor.organisationId,
				domainCode: 'PLATFORM',
				recordType: 'lifecycle_template',
				lineageKey: previous.templateKey,
				majorVersion: Number(previous.versionNumber)
			});
		}
		await connection.execute(
			`UPDATE lifecycle_templates
			 SET lifecycle_status = 'published', minor_version_number = 0,
			     published_by_member_id = ?, published_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ? AND id = ?`,
			[input.actor.memberId, input.actor.organisationId, row.id]
		);
		const published = await templateRow(connection, input.actor, input.publicId, true);
		await appendTemplateVersion(
			connection,
			input.actor,
			published,
			'Lifecycle template published',
			true
		);
		await connection.execute(
			`INSERT INTO lifecycle_object_bindings
			 (organisation_id, object_type, lifecycle_template_id, bound_by_member_id)
			 VALUES (?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE lifecycle_template_id = VALUES(lifecycle_template_id),
			                         bound_by_member_id = VALUES(bound_by_member_id),
			                         bound_at = CURRENT_TIMESTAMP(6)`,
			[input.actor.organisationId, published.objectType, published.id, input.actor.memberId]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'lifecycle.template.publish',
			subjectType: 'lifecycle_template',
			subjectPublicId: input.publicId,
			changeSummary: {
				templateKey: published.templateKey,
				version: `${Number(published.versionNumber)}.0`,
				objectType: published.objectType,
				supersededTemplatePublicId: previous?.publicId ?? null
			},
			eventMetadata: { function: 'PLATFORM', mutation: 'publish' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function activateLifecycleTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.publish');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'published')
			throw new LifecycleAdministrationValidationError(
				'Only a published lifecycle template can be activated.'
			);
		await connection.execute(
			`INSERT INTO lifecycle_object_bindings
			 (organisation_id, object_type, lifecycle_template_id, bound_by_member_id)
			 VALUES (?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE lifecycle_template_id = VALUES(lifecycle_template_id),
			                         bound_by_member_id = VALUES(bound_by_member_id),
			                         bound_at = CURRENT_TIMESTAMP(6)`,
			[input.actor.organisationId, row.objectType, row.id, input.actor.memberId]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'lifecycle.template.activate',
			subjectType: 'lifecycle_template',
			subjectPublicId: input.publicId,
			changeSummary: { objectType: row.objectType, templateKey: row.templateKey },
			eventMetadata: { function: 'PLATFORM', mutation: 'binding' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function reviseLifecycleTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
}): Promise<{ publicId: string }> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const source = await templateRow(connection, input.actor, input.publicId, true);
		if (source.status !== 'published')
			throw new LifecycleAdministrationValidationError(
				'Only a published lifecycle template can be revised.'
			);
		const [existingDraft] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM lifecycle_templates WHERE organisation_id = ? AND template_key = ? AND lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, source.templateKey]
		);
		if (existingDraft[0])
			throw new LifecycleAdministrationValidationError(
				'A working lifecycle-template revision already exists.'
			);
		const revisionPublicId = randomUUID();
		const [insert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO lifecycle_templates
			 (organisation_id, public_id, template_key, version_number, minor_version_number,
			  name, description, object_type, mode, initial_state, lifecycle_status,
			  supersedes_lifecycle_template_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
			[
				input.actor.organisationId,
				revisionPublicId,
				source.templateKey,
				Number(source.versionNumber) + 1,
				source.name,
				source.description,
				source.objectType,
				source.mode,
				source.initialState,
				source.id,
				input.actor.memberId
			]
		);
		const revisionId = insert.insertId;
		await connection.execute(
			`INSERT INTO lifecycle_template_phases
			 (organisation_id, lifecycle_template_id, phase_key, label, display_order, is_editable, is_deletable, is_revisable)
			 SELECT organisation_id, ?, phase_key, label, display_order, is_editable, is_deletable, is_revisable
			 FROM lifecycle_template_phases WHERE lifecycle_template_id = ?`,
			[revisionId, source.id]
		);
		await connection.execute(
			`INSERT INTO lifecycle_template_roles
			 (organisation_id, lifecycle_template_id, role_key, label, description)
			 SELECT organisation_id, ?, role_key, label, description
			 FROM lifecycle_template_roles WHERE lifecycle_template_id = ?`,
			[revisionId, source.id]
		);
		await connection.execute(
			`INSERT INTO lifecycle_template_phase_access_rules
			 (organisation_id, lifecycle_template_id, phase_key, role_key, permission_key)
			 SELECT organisation_id, ?, phase_key, role_key, permission_key
			 FROM lifecycle_template_phase_access_rules WHERE lifecycle_template_id = ?`,
			[revisionId, source.id]
		);
		await connection.execute(
			`INSERT INTO lifecycle_template_transitions
			 (organisation_id, lifecycle_template_id, public_id, from_state, to_state, label,
			  requires_note, requires_target_reference, tone, required_permission_key, workflow_key)
			 SELECT organisation_id, ?, UUID(), from_state, to_state, label,
			        requires_note, requires_target_reference, tone, required_permission_key, workflow_key
			 FROM lifecycle_template_transitions WHERE lifecycle_template_id = ?`,
			[revisionId, source.id]
		);
		await connection.execute(
			`INSERT INTO lifecycle_role_bindings
			 (organisation_id, lifecycle_template_id, lifecycle_role_key, organisation_role_id, bound_by_member_id)
			 SELECT organisation_id, ?, lifecycle_role_key, organisation_role_id, ?
			 FROM lifecycle_role_bindings WHERE lifecycle_template_id = ?`,
			[revisionId, input.actor.memberId, source.id]
		);
		const revision = await templateRow(connection, input.actor, revisionPublicId, true);
		await appendTemplateVersion(
			connection,
			input.actor,
			revision,
			'Controlled lifecycle-template revision created'
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'lifecycle.template.revise',
			subjectType: 'lifecycle_template',
			subjectPublicId: revisionPublicId,
			changeSummary: {
				templateKey: source.templateKey,
				supersedesTemplatePublicId: source.publicId
			},
			eventMetadata: { function: 'PLATFORM', mutation: 'revision' }
		});
		await connection.commit();
		return { publicId: revisionPublicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function discardLifecycleTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
}): Promise<void> {
	await requirePermission(input.actor, 'lifecycle.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new LifecycleAdministrationValidationError(
				'Published lifecycle templates cannot be discarded.'
			);
		await markWorkingVersionDiscarded(connection, {
			organisationId: input.actor.organisationId,
			domainCode: 'PLATFORM',
			recordType: 'lifecycle_template',
			recordPublicId: input.publicId
		});
		await connection.execute(
			`DELETE FROM lifecycle_templates WHERE organisation_id = ? AND id = ?`,
			[input.actor.organisationId, row.id]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'lifecycle.template.discard',
			subjectType: 'lifecycle_template',
			subjectPublicId: input.publicId,
			changeSummary: { templateKey: row.templateKey, version: versionLabel(row) },
			eventMetadata: { function: 'PLATFORM', mutation: 'discard' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
