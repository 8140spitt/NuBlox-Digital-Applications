-- NuBlox: Digital Applications
-- Schema package 007a: Project Information integrity hardening
-- Depends on: 007-project-information-documents.sql
-- Target: MySQL 8.4 / InnoDB
-- Generated: 2026-08-15
--
-- Pre-development companion patch. Consolidate into Package 007 when the production
-- migration baseline is frozen.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- 1. Project sites are shared project context, not owned document context.
--    Any valid project participant's information container may reference a site.
-- -----------------------------------------------------------------------------

ALTER TABLE project_sites
    ADD UNIQUE KEY uq_project_sites_id_project (id, project_id);

ALTER TABLE information_containers
    DROP FOREIGN KEY fk_information_containers_site,
    ADD CONSTRAINT fk_information_containers_site
        FOREIGN KEY (project_site_id, project_id)
        REFERENCES project_sites (id, project_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 2. Review-assignment identity and 3NF decision linkage are now consolidated
--    into 007-project-information-documents.sql so the base package is valid
--    before this integrity stage is applied.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 3. External transmittal recipients use the issuing tenant's private Party record.
--    Do not allow a transmittal to reference another tenant's CRM party namespace.
-- -----------------------------------------------------------------------------

ALTER TABLE transmittal_recipients
    DROP FOREIGN KEY fk_transmittal_recipients_party,
    DROP CHECK ck_transmittal_recipients_source,
    DROP COLUMN source_party_owner_organisation_id,
    ADD CONSTRAINT fk_transmittal_recipients_party
        FOREIGN KEY (source_party_id, issuing_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    ADD CONSTRAINT ck_transmittal_recipients_source
        CHECK (
            (recipient_project_organisation_id IS NOT NULL AND source_party_id IS NULL)
            OR
            (recipient_project_organisation_id IS NULL AND source_party_id IS NOT NULL)
            OR
            (recipient_project_organisation_id IS NULL AND source_party_id IS NULL)
        );

-- Required application invariant retained:
-- information_review_step_reviewers.project_id must match the project of its workflow.
-- This is intentionally tested in the domain/integration layer in addition to the
-- project_organisations FK used for reviewer participation.
