-- NuBlox workflow runtime execution bridge.
-- Pins the published workflow definition to each request and records step-by-step canonical Work execution.
-- migrate:up transaction:false

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE workflow_requests
    ADD COLUMN workflow_definition JSON NULL AFTER workflow_key,
    ADD COLUMN current_node_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER workflow_definition,
    ADD COLUMN current_node_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER current_node_key,
    ADD COLUMN workflow_state VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'running' AFTER current_node_type,
    ADD COLUMN step_number INT UNSIGNED NOT NULL DEFAULT 1 AFTER workflow_state,
    ADD UNIQUE KEY uq_workflow_request_id_org (id, organisation_id),
    ADD CONSTRAINT ck_workflow_request_runtime_state
        CHECK (workflow_state IN ('running', 'completed', 'terminated', 'aborted'));

UPDATE workflow_requests
SET workflow_state = CASE
    WHEN status = 'pending' THEN 'running'
    WHEN status = 'withdrawn' THEN 'terminated'
    ELSE 'completed'
END;

CREATE TABLE workflow_request_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    workflow_request_id BIGINT UNSIGNED NOT NULL,
    step_number INT UNSIGNED NOT NULL,
    node_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    node_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    work_item_id BIGINT UNSIGNED NULL,
    step_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    outcome VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completed_by_member_id BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    completion_note TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_request_step (organisation_id, workflow_request_id, step_number),
    KEY ix_workflow_request_step_active (organisation_id, workflow_request_id, step_status, step_number),
    KEY ix_workflow_request_step_work (work_item_id, organisation_id),
    CONSTRAINT fk_workflow_request_step_request
        FOREIGN KEY (workflow_request_id, organisation_id)
        REFERENCES workflow_requests(id, organisation_id),
    CONSTRAINT fk_workflow_request_step_work
        FOREIGN KEY (work_item_id, organisation_id)
        REFERENCES work_items(id, owning_organisation_id),
    CONSTRAINT fk_workflow_request_step_completed_by
        FOREIGN KEY (completed_by_member_id, organisation_id)
        REFERENCES organisation_members(id, organisation_id),
    CONSTRAINT ck_workflow_request_step_status
        CHECK (step_status IN ('open', 'completed', 'skipped', 'failed')),
    CONSTRAINT ck_workflow_request_step_outcome
        CHECK (outcome IS NULL OR outcome IN ('approved', 'returned', 'rejected', 'completed', 'automatic')),
    CONSTRAINT ck_workflow_request_step_completion
        CHECK (
            (step_status = 'open' AND completed_at IS NULL AND completed_by_member_id IS NULL)
            OR (step_status <> 'open' AND completed_at IS NOT NULL)
        )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
-- Workflow execution evidence is forward-only in released environments.
SELECT 1;
