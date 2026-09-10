-- F02 Corporate Governance
-- Canonical governance constitution, bodies, business delegation of authority, meetings,
-- decisions/actions, policy governance and ethics/conflict evidence.
-- Corporate governance authority is deliberately separate from NuBlox access-role delegation.
-- migrate:up transaction:false

CREATE TABLE governance_frameworks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    framework_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    purpose_text TEXT NOT NULL,
    principles_text TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    supersedes_governance_framework_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_framework_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_framework_version (organisation_id, framework_code, version_number),
    KEY ix_governance_framework_status (organisation_id, framework_code, lifecycle_status),
    CONSTRAINT fk_governance_framework_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_framework_supersedes
        FOREIGN KEY (supersedes_governance_framework_id) REFERENCES governance_frameworks(id),
    CONSTRAINT fk_governance_framework_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_framework_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_framework_approved_by
        FOREIGN KEY (approved_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_framework_version CHECK (version_number >= 1),
    CONSTRAINT chk_governance_framework_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT chk_governance_framework_status CHECK (lifecycle_status IN ('draft', 'approved', 'superseded'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_bodies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    body_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    body_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    mandate_text TEXT NOT NULL,
    quorum_count INT UNSIGNED NOT NULL,
    chair_member_id BIGINT UNSIGNED NULL,
    secretary_member_id BIGINT UNSIGNED NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_body_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_body_code (governance_framework_id, body_code),
    KEY ix_governance_body_type (governance_framework_id, body_type, lifecycle_status),
    CONSTRAINT fk_governance_body_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_body_framework
        FOREIGN KEY (governance_framework_id) REFERENCES governance_frameworks(id),
    CONSTRAINT fk_governance_body_chair
        FOREIGN KEY (chair_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_body_secretary
        FOREIGN KEY (secretary_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_body_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_body_type CHECK (body_type IN ('board', 'executive', 'committee')),
    CONSTRAINT chk_governance_body_quorum CHECK (quorum_count >= 1),
    CONSTRAINT chk_governance_body_status CHECK (lifecycle_status IN ('active', 'inactive'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_body_memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_body_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    governance_role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    voting_rights TINYINT(1) NOT NULL DEFAULT 1,
    appointed_on DATE NOT NULL,
    term_ends_on DATE NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_body_membership_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_body_member_appointment (governance_body_id, organisation_member_id, appointed_on),
    KEY ix_governance_body_membership_active (governance_body_id, lifecycle_status, organisation_member_id),
    CONSTRAINT fk_governance_body_membership_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_body_membership_body
        FOREIGN KEY (governance_body_id) REFERENCES governance_bodies(id),
    CONSTRAINT fk_governance_body_membership_member
        FOREIGN KEY (organisation_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_body_membership_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_body_membership_role CHECK (governance_role IN ('chair', 'member', 'secretary', 'executive')),
    CONSTRAINT chk_governance_body_membership_voting CHECK (voting_rights IN (0, 1)),
    CONSTRAINT chk_governance_body_membership_dates CHECK (term_ends_on IS NULL OR term_ends_on >= appointed_on),
    CONSTRAINT chk_governance_body_membership_status CHECK (lifecycle_status IN ('active', 'ended'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_authority_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_framework_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    authority_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject_domain VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description TEXT NOT NULL,
    min_amount DECIMAL(19,4) NULL,
    max_amount DECIMAL(19,4) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    authority_body_id BIGINT UNSIGNED NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_authority_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_authority_code (governance_framework_id, authority_code),
    KEY ix_governance_authority_lookup (governance_framework_id, authority_body_id, subject_domain, action_key, lifecycle_status),
    CONSTRAINT fk_governance_authority_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_authority_framework
        FOREIGN KEY (governance_framework_id) REFERENCES governance_frameworks(id),
    CONSTRAINT fk_governance_authority_body
        FOREIGN KEY (authority_body_id) REFERENCES governance_bodies(id),
    CONSTRAINT fk_governance_authority_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_authority_amounts_nonnegative CHECK (
        (min_amount IS NULL OR min_amount >= 0) AND (max_amount IS NULL OR max_amount >= 0)
    ),
    CONSTRAINT chk_governance_authority_range CHECK (
        min_amount IS NULL OR max_amount IS NULL OR max_amount >= min_amount
    ),
    CONSTRAINT chk_governance_authority_currency CHECK (
        ((min_amount IS NULL AND max_amount IS NULL) AND currency_code IS NULL)
        OR ((min_amount IS NOT NULL OR max_amount IS NOT NULL) AND currency_code IS NOT NULL)
    ),
    CONSTRAINT chk_governance_authority_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT chk_governance_authority_status CHECK (lifecycle_status IN ('active', 'inactive'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_meetings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_body_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    meeting_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    meeting_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'scheduled',
    title VARCHAR(255) NOT NULL,
    scheduled_at DATETIME(6) NOT NULL,
    location_text VARCHAR(500) NULL,
    quorum_required_count INT UNSIGNED NOT NULL,
    quorum_met TINYINT(1) NOT NULL DEFAULT 0,
    chaired_by_member_id BIGINT UNSIGNED NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    minutes_text MEDIUMTEXT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    closed_by_member_id BIGINT UNSIGNED NULL,
    closed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_meeting_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_meeting_code (governance_body_id, meeting_code),
    KEY ix_governance_meeting_status (governance_body_id, lifecycle_status, scheduled_at),
    CONSTRAINT fk_governance_meeting_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_meeting_body
        FOREIGN KEY (governance_body_id) REFERENCES governance_bodies(id),
    CONSTRAINT fk_governance_meeting_chair
        FOREIGN KEY (chaired_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_meeting_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_meeting_closed_by
        FOREIGN KEY (closed_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_meeting_type CHECK (meeting_type IN ('scheduled', 'special', 'written_resolution')),
    CONSTRAINT chk_governance_meeting_quorum_required CHECK (quorum_required_count >= 1),
    CONSTRAINT chk_governance_meeting_quorum_met CHECK (quorum_met IN (0, 1)),
    CONSTRAINT chk_governance_meeting_status CHECK (lifecycle_status IN ('draft', 'convened', 'closed', 'cancelled'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_meeting_attendees (
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_meeting_id BIGINT UNSIGNED NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    attendance_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    voting_eligible TINYINT(1) NOT NULL DEFAULT 0,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (governance_meeting_id, organisation_member_id),
    KEY ix_governance_meeting_attendee_status (governance_meeting_id, attendance_status, voting_eligible),
    CONSTRAINT fk_governance_meeting_attendee_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_meeting_attendee_meeting
        FOREIGN KEY (governance_meeting_id) REFERENCES governance_meetings(id),
    CONSTRAINT fk_governance_meeting_attendee_member
        FOREIGN KEY (organisation_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_meeting_attendee_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_meeting_attendance CHECK (attendance_status IN ('present', 'apology', 'absent')),
    CONSTRAINT chk_governance_meeting_attendee_voting CHECK (voting_eligible IN (0, 1))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_agenda_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_meeting_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    agenda_number INT UNSIGNED NOT NULL,
    item_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    source_domain VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    source_record_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    source_public_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
    authority_action_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    decision_amount DECIMAL(19,4) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_agenda_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_agenda_number (governance_meeting_id, agenda_number),
    CONSTRAINT fk_governance_agenda_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_agenda_meeting
        FOREIGN KEY (governance_meeting_id) REFERENCES governance_meetings(id),
    CONSTRAINT fk_governance_agenda_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_agenda_number CHECK (agenda_number >= 1),
    CONSTRAINT chk_governance_agenda_type CHECK (item_type IN ('decision', 'information', 'review', 'policy', 'ethics')),
    CONSTRAINT chk_governance_agenda_source_reference CHECK (
        (source_domain IS NULL AND source_record_type IS NULL AND source_public_id IS NULL)
        OR (source_domain IS NOT NULL AND source_record_type IS NOT NULL AND source_public_id IS NOT NULL)
    ),
    CONSTRAINT chk_governance_agenda_amount CHECK (decision_amount IS NULL OR decision_amount >= 0),
    CONSTRAINT chk_governance_agenda_currency CHECK (
        (decision_amount IS NULL AND currency_code IS NULL)
        OR (decision_amount IS NOT NULL AND currency_code IS NOT NULL)
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_decisions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_meeting_id BIGINT UNSIGNED NOT NULL,
    governance_agenda_item_id BIGINT UNSIGNED NOT NULL,
    governance_authority_rule_id BIGINT UNSIGNED NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision_outcome VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resolution_text MEDIUMTEXT NOT NULL,
    decision_amount DECIMAL(19,4) NULL,
    currency_code CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NULL,
    supersedes_governance_decision_id BIGINT UNSIGNED NULL,
    recorded_by_member_id BIGINT UNSIGNED NOT NULL,
    decided_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_decision_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_decision_code (organisation_id, decision_code),
    UNIQUE KEY uq_governance_decision_agenda (governance_agenda_item_id),
    KEY ix_governance_decision_meeting (governance_meeting_id, decided_at),
    CONSTRAINT fk_governance_decision_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_decision_meeting
        FOREIGN KEY (governance_meeting_id) REFERENCES governance_meetings(id),
    CONSTRAINT fk_governance_decision_agenda
        FOREIGN KEY (governance_agenda_item_id) REFERENCES governance_agenda_items(id),
    CONSTRAINT fk_governance_decision_authority
        FOREIGN KEY (governance_authority_rule_id) REFERENCES governance_authority_rules(id),
    CONSTRAINT fk_governance_decision_supersedes
        FOREIGN KEY (supersedes_governance_decision_id) REFERENCES governance_decisions(id),
    CONSTRAINT fk_governance_decision_recorded_by
        FOREIGN KEY (recorded_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_decision_outcome CHECK (decision_outcome IN ('approved', 'rejected', 'deferred', 'noted')),
    CONSTRAINT chk_governance_decision_amount CHECK (decision_amount IS NULL OR decision_amount >= 0),
    CONSTRAINT chk_governance_decision_currency CHECK (
        (decision_amount IS NULL AND currency_code IS NULL)
        OR (decision_amount IS NOT NULL AND currency_code IS NOT NULL)
    )
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_decision_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    owner_member_id BIGINT UNSIGNED NOT NULL,
    due_date DATE NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    source_domain VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    source_record_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    source_public_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
    completion_evidence TEXT NULL,
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_action_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_action_code (organisation_id, action_code),
    KEY ix_governance_action_status (organisation_id, lifecycle_status, due_date),
    CONSTRAINT fk_governance_action_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_action_decision
        FOREIGN KEY (governance_decision_id) REFERENCES governance_decisions(id),
    CONSTRAINT fk_governance_action_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_action_completed_by
        FOREIGN KEY (completed_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_action_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_action_status CHECK (lifecycle_status IN ('open', 'in_progress', 'completed', 'cancelled'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_policies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_framework_id BIGINT UNSIGNED NOT NULL,
    approval_body_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    policy_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    policy_category VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    scope_text TEXT NOT NULL,
    policy_text MEDIUMTEXT NOT NULL,
    effective_from DATE NOT NULL,
    review_due_on DATE NOT NULL,
    lifecycle_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    supersedes_governance_policy_id BIGINT UNSIGNED NULL,
    owner_member_id BIGINT UNSIGNED NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    approved_by_member_id BIGINT UNSIGNED NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_policy_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_policy_version (organisation_id, policy_code, version_number),
    KEY ix_governance_policy_status (organisation_id, policy_code, lifecycle_status),
    CONSTRAINT fk_governance_policy_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_policy_framework
        FOREIGN KEY (governance_framework_id) REFERENCES governance_frameworks(id),
    CONSTRAINT fk_governance_policy_approval_body
        FOREIGN KEY (approval_body_id) REFERENCES governance_bodies(id),
    CONSTRAINT fk_governance_policy_supersedes
        FOREIGN KEY (supersedes_governance_policy_id) REFERENCES governance_policies(id),
    CONSTRAINT fk_governance_policy_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_policy_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_policy_approved_by
        FOREIGN KEY (approved_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_policy_version CHECK (version_number >= 1),
    CONSTRAINT chk_governance_policy_category CHECK (policy_category IN ('corporate', 'finance', 'people', 'safety', 'information', 'ethics', 'other')),
    CONSTRAINT chk_governance_policy_dates CHECK (review_due_on >= effective_from),
    CONSTRAINT chk_governance_policy_status CHECK (lifecycle_status IN ('draft', 'approved', 'superseded', 'retired'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_policy_attestations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    governance_policy_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    attestation_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    commentary TEXT NULL,
    attested_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_policy_attestation_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_policy_attestation_member (governance_policy_id, organisation_member_id),
    CONSTRAINT fk_governance_policy_attestation_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_policy_attestation_policy
        FOREIGN KEY (governance_policy_id) REFERENCES governance_policies(id),
    CONSTRAINT fk_governance_policy_attestation_member
        FOREIGN KEY (organisation_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_policy_attestation_status CHECK (attestation_status IN ('acknowledged', 'declined'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_conflict_declarations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    organisation_member_id BIGINT UNSIGNED NOT NULL,
    governance_policy_id BIGINT UNSIGNED NULL,
    declaration_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject_text VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    declared_on DATE NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    reviewer_member_id BIGINT UNSIGNED NULL,
    review_outcome TEXT NULL,
    management_action TEXT NULL,
    reviewed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_conflict_public (organisation_id, public_id),
    KEY ix_governance_conflict_status (organisation_id, lifecycle_status, declared_on),
    CONSTRAINT fk_governance_conflict_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_conflict_member
        FOREIGN KEY (organisation_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_conflict_policy
        FOREIGN KEY (governance_policy_id) REFERENCES governance_policies(id),
    CONSTRAINT fk_governance_conflict_reviewer
        FOREIGN KEY (reviewer_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_conflict_type CHECK (declaration_type IN ('actual', 'potential', 'perceived')),
    CONSTRAINT chk_governance_conflict_status CHECK (lifecycle_status IN ('open', 'reviewed', 'managed', 'closed'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE governance_ethics_cases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    case_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    governance_policy_id BIGINT UNSIGNED NULL,
    reporter_member_id BIGINT UNSIGNED NULL,
    subject_text VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    owner_member_id BIGINT UNSIGNED NULL,
    resolution_text TEXT NULL,
    resolved_by_member_id BIGINT UNSIGNED NULL,
    resolved_at DATETIME(6) NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governance_ethics_case_public (organisation_id, public_id),
    UNIQUE KEY uq_governance_ethics_case_code (organisation_id, case_code),
    KEY ix_governance_ethics_case_status (organisation_id, lifecycle_status, severity),
    CONSTRAINT fk_governance_ethics_case_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governance_ethics_case_policy
        FOREIGN KEY (governance_policy_id) REFERENCES governance_policies(id),
    CONSTRAINT fk_governance_ethics_case_reporter
        FOREIGN KEY (reporter_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_ethics_case_owner
        FOREIGN KEY (owner_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_ethics_case_resolved_by
        FOREIGN KEY (resolved_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governance_ethics_case_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governance_ethics_case_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_governance_ethics_case_status CHECK (lifecycle_status IN ('open', 'investigating', 'resolved', 'closed'))
)
ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'governance.view', 'View corporate governance', 'View governance frameworks, bodies, authority, meetings, decisions, actions and policies.', TRUE),
    (NULL, 'governance.manage', 'Manage corporate governance', 'Create and manage governance frameworks, bodies, authority rules, meetings, decisions, actions and policies.', TRUE),
    (NULL, 'governance.approve', 'Approve corporate governance', 'Approve governance frameworks and governed policy versions.', TRUE),
    (NULL, 'governance.ethics.view', 'View ethics governance', 'View conflict declarations and ethics-case evidence.', TRUE),
    (NULL, 'governance.ethics.manage', 'Manage ethics governance', 'Review conflicts and investigate or resolve ethics cases.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

INSERT IGNORE INTO role_permissions (
    organisation_id,
    organisation_role_id,
    permission_id
)
SELECT
    role.organisation_id,
    role.id,
    permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON (
        (
            role.name IN ('Owner', 'Administrator')
            AND permission.permission_key IN (
                'governance.view',
                'governance.manage',
                'governance.approve',
                'governance.ethics.view',
                'governance.ethics.manage'
            )
        )
        OR (
            role.name = 'Manager'
            AND permission.permission_key IN (
                'governance.view',
                'governance.manage',
                'governance.approve',
                'governance.ethics.view'
            )
        )
        OR (
            role.name IN ('Finance/Commercial', 'Member/Professional', 'Field Worker', 'Read Only')
            AND permission.permission_key = 'governance.view'
        )
    )
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- migrate:down transaction:false
-- Approved governance, policy, decision and ethics evidence is forward-only. Non-production
-- environments are rebuilt rather than destructively rolling back attributable governance records.
SELECT 1;
