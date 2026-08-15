-- NuBlox: Digital Applications
-- Schema package 003a: Sales/quotations FK hardening
-- Depends on: 003-sales-quotes.sql
-- Target: MySQL 8.4 / InnoDB
-- Generated: 2026-08-15
--
-- MySQL 8.4 defaults restrict_fk_on_non_standard_key=ON, so every referenced
-- composite key must be explicitly UNIQUE/PRIMARY rather than merely a prefix
-- of a larger index. This candidate key supports the quotation source-estimate
-- foreign key using (estimate_item_id, organisation_id).

ALTER TABLE estimate_items
    ADD UNIQUE KEY uq_estimate_items_id_organisation (id, organisation_id);
