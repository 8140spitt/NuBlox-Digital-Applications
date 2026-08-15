-- NuBlox: Digital Applications
-- Schema package 008: Site Operations, Quality and Safety — integrity stage
-- Depends on: 008-site-quality-safety.sql
-- Target: MySQL 8.4 / InnoDB
-- Generated: 2026-08-15
--
-- This is an ordered integrity stage of logical Package 008, not a separate package.
-- It hardens cross-domain candidate keys and removes avoidable transitive duplication
-- identified during package validation.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- 1. Diary attendance must prove it belongs to the same worker and tenant.
-- -----------------------------------------------------------------------------

ALTER TABLE attendance_records
    ADD UNIQUE KEY uq_attendance_records_id_worker_org (
        id, worker_id, organisation_id
    );

ALTER TABLE site_diary_worker_entries
    DROP FOREIGN KEY fk_site_diary_worker_attendance,
    ADD CONSTRAINT fk_site_diary_worker_attendance
        FOREIGN KEY (attendance_record_id, worker_id, owning_organisation_id)
        REFERENCES attendance_records (id, worker_id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 2. Inspection findings derive project from their parent inspection.
--    Remove the transitive project_id copy to keep the final relation in 3NF.
--    Also strengthen optional response linkage to the same inspection.
-- -----------------------------------------------------------------------------

ALTER TABLE quality_inspection_responses
    ADD UNIQUE KEY uq_quality_responses_id_inspection (
        id, quality_inspection_id
    );

ALTER TABLE quality_inspection_findings
    DROP FOREIGN KEY fk_quality_findings_response,
    DROP COLUMN project_id,
    ADD CONSTRAINT fk_quality_findings_response
        FOREIGN KEY (quality_inspection_response_id, quality_inspection_id)
        REFERENCES quality_inspection_responses (id, quality_inspection_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 3. Inspection templates are exact versioned definitions.
--    Published/retired versions retain publication evidence and every inspection
--    references one exact version. An "ad hoc" inspection is represented by an
--    appropriate published ad-hoc template version rather than a NULL definition.
-- -----------------------------------------------------------------------------

ALTER TABLE quality_inspection_template_versions
    DROP CHECK ck_quality_template_versions_published,
    ADD CONSTRAINT ck_quality_template_versions_published
        CHECK (
            (status IN ('draft', 'cancelled')
                AND published_at IS NULL
                AND published_by_member_id IS NULL)
            OR
            (status IN ('published', 'retired')
                AND published_at IS NOT NULL
                AND published_by_member_id IS NOT NULL)
        );

ALTER TABLE quality_inspections
    MODIFY COLUMN quality_inspection_template_version_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Delivery accepted/rejected quantities cannot exceed the recorded quantity.
-- -----------------------------------------------------------------------------

ALTER TABLE site_delivery_items
    ADD CONSTRAINT ck_site_delivery_items_allocation
        CHECK (
            (quantity IS NULL
                AND accepted_quantity IS NULL
                AND rejected_quantity IS NULL)
            OR
            (quantity IS NOT NULL
                AND COALESCE(accepted_quantity, 0) + COALESCE(rejected_quantity, 0) <= quantity)
        );

-- -----------------------------------------------------------------------------
-- 5. RAMS approval must tie together RAMS record, its stable information container,
--    the exact information version, and the actual deciding organisation/member.
-- -----------------------------------------------------------------------------

ALTER TABLE rams_records
    ADD UNIQUE KEY uq_rams_records_approval_context (
        id, information_container_id, owning_organisation_id
    );

ALTER TABLE rams_approval_events
    DROP FOREIGN KEY fk_rams_approval_events_version,
    DROP FOREIGN KEY fk_rams_approval_events_member,
    ADD COLUMN information_container_id BIGINT UNSIGNED NOT NULL
        AFTER information_container_version_id,
    ADD COLUMN deciding_organisation_id BIGINT UNSIGNED NOT NULL
        AFTER decision,
    ADD CONSTRAINT fk_rams_approval_events_rams_context
        FOREIGN KEY (
            rams_record_id,
            information_container_id,
            owning_organisation_id
        ) REFERENCES rams_records (
            id,
            information_container_id,
            owning_organisation_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT fk_rams_approval_events_version
        FOREIGN KEY (
            information_container_version_id,
            owning_organisation_id,
            information_container_id
        ) REFERENCES information_container_versions (
            id,
            owning_organisation_id,
            information_container_id
        ) ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT fk_rams_approval_events_member
        FOREIGN KEY (decided_by_member_id, deciding_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT;

-- The domain layer additionally checks that deciding_organisation_id is a valid project
-- participant for the RAMS project and has effective RAMS approval permission.

-- -----------------------------------------------------------------------------
-- 6. Cross-organisation corrective actions must preserve the actual completing actor.
-- -----------------------------------------------------------------------------

ALTER TABLE defect_actions
    DROP FOREIGN KEY fk_defect_actions_completed_by,
    DROP CHECK ck_defect_actions_completed,
    ADD COLUMN completed_by_organisation_id BIGINT UNSIGNED NULL
        AFTER completed_by_member_id,
    ADD CONSTRAINT fk_defect_actions_completed_by
        FOREIGN KEY (completed_by_member_id, completed_by_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT ck_defect_actions_completed
        CHECK (
            (completed_at IS NULL
                AND completed_by_member_id IS NULL
                AND completed_by_organisation_id IS NULL)
            OR
            (completed_at IS NOT NULL
                AND completed_by_member_id IS NOT NULL
                AND completed_by_organisation_id IS NOT NULL)
        );

ALTER TABLE ncr_actions
    DROP FOREIGN KEY fk_ncr_actions_completed_by,
    DROP CHECK ck_ncr_actions_completed,
    ADD COLUMN completed_by_organisation_id BIGINT UNSIGNED NULL
        AFTER completed_by_member_id,
    ADD CONSTRAINT fk_ncr_actions_completed_by
        FOREIGN KEY (completed_by_member_id, completed_by_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT ck_ncr_actions_completed
        CHECK (
            (completed_at IS NULL
                AND completed_by_member_id IS NULL
                AND completed_by_organisation_id IS NULL)
            OR
            (completed_at IS NOT NULL
                AND completed_by_member_id IS NOT NULL
                AND completed_by_organisation_id IS NOT NULL)
        );

ALTER TABLE safety_actions
    DROP FOREIGN KEY fk_safety_actions_completed_by,
    DROP CHECK ck_safety_actions_completed,
    ADD COLUMN completed_by_organisation_id BIGINT UNSIGNED NULL
        AFTER completed_by_member_id,
    ADD CONSTRAINT fk_safety_actions_completed_by
        FOREIGN KEY (completed_by_member_id, completed_by_organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT ck_safety_actions_completed
        CHECK (
            (completed_at IS NULL
                AND completed_by_member_id IS NULL
                AND completed_by_organisation_id IS NULL)
            OR
            (completed_at IS NOT NULL
                AND completed_by_member_id IS NOT NULL
                AND completed_by_organisation_id IS NOT NULL)
        );

-- -----------------------------------------------------------------------------
-- 7. Additional required domain invariants retained after relational hardening.
-- -----------------------------------------------------------------------------
-- A. Inspections may only start from a published (or policy-approved retired) exact
--    template version; the NOT NULL FK proves identity, while status is domain policy.
-- B. RAMS deciding organisation must participate in the same project.
-- C. Defect/NCR/safety-action responsible and completing organisations must be valid
--    project participants for the parent record and authorised for the transition.
-- D. Safety briefing attendees, permit authorised persons and safety-event people whose
--    worker belongs to another organisation require project-sharing/privacy permission.
-- E. Visitor person_party_id must reference a person subtype when populated.
-- F. Safety event injury fields are valid only under incident-specific policy.
-- G. All Package 008 information-version links must remain within the same project and
--    effective visibility scope, even though their FK proves only stable revision identity.
