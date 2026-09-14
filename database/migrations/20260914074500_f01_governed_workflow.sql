-- NuBlox governed workflow bridge for lifecycle-controlled business records.
-- Keeps lifecycle state and workflow state separate while using the canonical Work Kernel.
-- migrate:up transaction:false

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE workflow_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    workflow_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_domain VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_type VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_from_state VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lifecycle_to_state VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    transition_label VARCHAR(160) NOT NULL,
    required_permission_key VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    active_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
    work_item_id BIGINT UNSIGNED NOT NULL,
    submitted_by_member_id BIGINT UNSIGNED NOT NULL,
    submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    submission_note TEXT NULL,
    due_at DATETIME(6) NULL,
    decided_by_member_id BIGINT UNSIGNED NULL,
    decided_at DATETIME(6) NULL,
    decision_note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_request_public (organisation_id, public_id),
    UNIQUE KEY uq_workflow_request_work_item (organisation_id, work_item_id),
    UNIQUE KEY uq_workflow_request_active (organisation_id, active_key),
    KEY ix_workflow_request_source (organisation_id, source_domain, source_type, source_public_id, created_at),
    KEY ix_workflow_request_context (organisation_id, context_public_id, status, created_at),
    KEY ix_workflow_request_assignee_gate (organisation_id, status, required_permission_key, due_at),

    CONSTRAINT fk_workflow_request_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_workflow_request_work_item
        FOREIGN KEY (work_item_id, organisation_id)
        REFERENCES work_items (id, owning_organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_workflow_request_submitted_by
        FOREIGN KEY (submitted_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_workflow_request_decided_by
        FOREIGN KEY (decided_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_workflow_request_status
        CHECK (status IN ('pending', 'approved', 'returned', 'rejected', 'withdrawn', 'stale')),
    CONSTRAINT ck_workflow_request_active
        CHECK (
            (status = 'pending' AND active_key IS NOT NULL)
            OR (status <> 'pending' AND active_key IS NULL)
        ),
    CONSTRAINT ck_workflow_request_decision
        CHECK (
            (status = 'pending' AND decided_by_member_id IS NULL AND decided_at IS NULL)
            OR (status <> 'pending' AND decided_at IS NOT NULL)
        )
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
-- Workflow/audit evidence is forward-only in released environments.
SELECT 1;
