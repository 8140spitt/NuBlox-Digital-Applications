import type { RowDataPacket } from 'mysql2/promise';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import {
	defineLifecycleTemplate,
	type LifecyclePhase,
	type LifecycleTemplate,
	type LifecycleTransition
} from './lifecycle-kernel';

export type ResolvedLifecycleTemplate = {
	template: LifecycleTemplate;
	persistedTemplateId: number | null;
	persistedTemplatePublicId: string | null;
	source: 'binding' | 'fallback';
};

export type LifecycleAuthorityDecision = {
	allowed: boolean;
	source: 'member-deny' | 'central-authority' | 'phase-role-grant' | 'default-deny';
};

type TemplateRow = RowDataPacket & {
	id: number | string;
	publicId: string;
	templateKey: string;
	versionNumber: number | string;
	mode: 'basic' | 'advanced';
	objectType: string;
	initialState: string;
};

type PhaseRow = RowDataPacket & {
	state: string;
	label: string;
	editable: number | boolean;
	deletable: number | boolean;
	revisable: number | boolean;
};

type AccessRow = RowDataPacket & {
	phaseKey: string;
	roleKey: string;
	permissionKey: string;
};

type TransitionRow = RowDataPacket & {
	toState: string;
	fromState: string;
	label: string;
	requiresNote: number | boolean;
	requiresTargetReference: number | boolean;
	tone: 'default' | 'danger';
	requiredPermissionKey: string | null;
	workflowKey: string | null;
};

function flag(value: number | boolean): boolean {
	return value === true || Number(value) === 1;
}

async function loadPersistedTemplate(input: {
	organisationId: string;
	objectType: string;
}): Promise<ResolvedLifecycleTemplate | null> {
	const pool = getPool();
	const [templateRows] = await pool.execute<TemplateRow[]>(
		`SELECT template.id,
		        template.public_id AS publicId,
		        template.template_key AS templateKey,
		        template.version_number AS versionNumber,
		        template.mode,
		        template.object_type AS objectType,
		        template.initial_state AS initialState
		 FROM lifecycle_object_bindings binding
		 JOIN lifecycle_templates template
		   ON template.id = binding.lifecycle_template_id
		  AND template.organisation_id = binding.organisation_id
		  AND template.lifecycle_status = 'published'
		 WHERE binding.organisation_id = ?
		   AND binding.object_type = ?
		 LIMIT 1`,
		[input.organisationId, input.objectType]
	);
	const row = templateRows[0];
	if (!row) return null;
	const templateId = Number(row.id);

	const [phaseRows] = await pool.execute<PhaseRow[]>(
		`SELECT phase_key AS state,
		        label,
		        is_editable AS editable,
		        is_deletable AS deletable,
		        is_revisable AS revisable
		 FROM lifecycle_template_phases
		 WHERE organisation_id = ?
		   AND lifecycle_template_id = ?
		 ORDER BY display_order, id`,
		[input.organisationId, templateId]
	);
	const [accessRows] = await pool.execute<AccessRow[]>(
		`SELECT phase_key AS phaseKey,
		        role_key AS roleKey,
		        permission_key AS permissionKey
		 FROM lifecycle_template_phase_access_rules
		 WHERE organisation_id = ?
		   AND lifecycle_template_id = ?
		 ORDER BY phase_key, role_key, permission_key`,
		[input.organisationId, templateId]
	);
	const [transitionRows] = await pool.execute<TransitionRow[]>(
		`SELECT from_state AS fromState,
		        to_state AS toState,
		        label,
		        requires_note AS requiresNote,
		        requires_target_reference AS requiresTargetReference,
		        tone,
		        required_permission_key AS requiredPermissionKey,
		        workflow_key AS workflowKey
		 FROM lifecycle_template_transitions
		 WHERE organisation_id = ?
		   AND lifecycle_template_id = ?
		 ORDER BY from_state, id`,
		[input.organisationId, templateId]
	);

	const phases: Record<string, LifecyclePhase> = {};
	for (const phase of phaseRows) {
		const rules = accessRows.filter((rule) => rule.phaseKey === phase.state);
		const rulesByRole = new Map<string, string[]>();
		for (const rule of rules) {
			const permissionKeys = rulesByRole.get(rule.roleKey) ?? [];
			permissionKeys.push(rule.permissionKey);
			rulesByRole.set(rule.roleKey, permissionKeys);
		}
		phases[phase.state] = {
			state: phase.state,
			label: phase.label,
			editable: flag(phase.editable),
			deletable: flag(phase.deletable),
			revisable: flag(phase.revisable),
			accessRules:
				row.mode === 'advanced'
					? [...rulesByRole.entries()].map(([roleKey, permissionKeys]) => ({
							roleKey,
							permissionKeys: [...new Set(permissionKeys)].sort()
						}))
					: undefined
		};
	}

	const transitions: Record<string, LifecycleTransition[]> = {};
	for (const transition of transitionRows) {
		(transitions[transition.fromState] ??= []).push({
			to: transition.toState,
			label: transition.label,
			requiresNote: flag(transition.requiresNote),
			requiresTargetReference: flag(transition.requiresTargetReference),
			tone: transition.tone,
			requiredPermissionKey: transition.requiredPermissionKey ?? undefined,
			workflowKey: transition.workflowKey ?? undefined
		});
	}
	for (const phase of phaseRows) transitions[phase.state] ??= [];

	const template = defineLifecycleTemplate({
		key: row.templateKey,
		version: `${Number(row.versionNumber)}.0`,
		mode: row.mode,
		enabled: true,
		objectType: row.objectType,
		initialState: row.initialState,
		phases,
		transitions
	});
	return {
		template,
		persistedTemplateId: templateId,
		persistedTemplatePublicId: row.publicId,
		source: 'binding'
	};
}

export async function resolveLifecycleTemplate(input: {
	organisationId: string;
	objectType: string;
	fallback: LifecycleTemplate;
}): Promise<ResolvedLifecycleTemplate> {
	const persisted = await loadPersistedTemplate({
		organisationId: input.organisationId,
		objectType: input.objectType
	});
	if (persisted) return persisted;
	return {
		template: input.fallback,
		persistedTemplateId: null,
		persistedTemplatePublicId: null,
		source: 'fallback'
	};
}

export async function decideLifecyclePermission(input: {
	organisationId: string;
	memberId: string;
	resolved: ResolvedLifecycleTemplate;
	state: string;
	permissionKey: string;
	at?: Date;
}): Promise<LifecycleAuthorityDecision> {
	const decisions = await decidePermissions({
		organisationId: input.organisationId,
		memberId: input.memberId,
		permissionKeys: [input.permissionKey],
		at: input.at
	});
	const central = decisions.get(input.permissionKey);
	if (central?.reason === 'member-deny') return { allowed: false, source: 'member-deny' };
	if (central?.allowed) return { allowed: true, source: 'central-authority' };
	if (input.resolved.template.mode !== 'advanced' || input.resolved.persistedTemplateId === null) {
		return { allowed: false, source: 'default-deny' };
	}

	const at = input.at ?? new Date();
	const [rows] = await getPool().execute<RowDataPacket[]>(
		`SELECT rule.id
		 FROM lifecycle_template_phase_access_rules rule
		 JOIN lifecycle_role_bindings binding
		   ON binding.organisation_id = rule.organisation_id
		  AND binding.lifecycle_template_id = rule.lifecycle_template_id
		  AND binding.lifecycle_role_key = rule.role_key
		 JOIN member_roles member_role
		   ON member_role.organisation_id = binding.organisation_id
		  AND member_role.organisation_role_id = binding.organisation_role_id
		  AND member_role.organisation_member_id = ?
		 JOIN organisation_roles organisation_role
		   ON organisation_role.id = member_role.organisation_role_id
		  AND organisation_role.organisation_id = member_role.organisation_id
		  AND organisation_role.is_active = 1
		 LEFT JOIN member_role_access_windows access_window
		   ON access_window.organisation_id = member_role.organisation_id
		  AND access_window.organisation_member_id = member_role.organisation_member_id
		  AND access_window.organisation_role_id = member_role.organisation_role_id
		 WHERE rule.organisation_id = ?
		   AND rule.lifecycle_template_id = ?
		   AND rule.phase_key = ?
		   AND rule.permission_key = ?
		   AND (access_window.effective_from IS NULL OR access_window.effective_from <= ?)
		   AND (access_window.expires_at IS NULL OR access_window.expires_at > ?)
		 LIMIT 1`,
		[
			input.memberId,
			input.organisationId,
			input.resolved.persistedTemplateId,
			input.state,
			input.permissionKey,
			at,
			at
		]
	);
	return rows.length > 0
		? { allowed: true, source: 'phase-role-grant' }
		: { allowed: false, source: 'default-deny' };
}
