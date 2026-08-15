-- NuBlox: Digital Applications
-- Schema package 001a: Platform-kernel tenant-key hardening
-- Depends on: 001-platform-kernel.sql
-- Must run before: 002-crm-parties.sql and later packages
-- Target: MySQL 8.4 / InnoDB
-- Generated: 2026-08-15
--
-- Several downstream tables deliberately use tenant-scoped composite foreign keys
-- to projects as (project_id, organisation_id). MySQL 8.4 requires an explicit
-- unique/primary candidate key for the complete referenced column list.

ALTER TABLE projects
    ADD UNIQUE KEY uq_projects_id_organisation (id, owning_organisation_id);
