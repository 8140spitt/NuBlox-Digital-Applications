-- F05 Product, Service & Innovation Management — database-enforced tenant graph integrity
-- Every organisation-owned relationship is constrained against the same organisation_id.
-- migrate:up transaction:false

ALTER TABLE product_service_portfolios
    ADD UNIQUE KEY uq_ps_portfolio_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_portfolio_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_portfolio_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_offerings
    ADD UNIQUE KEY uq_ps_offering_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_offering_portfolio_org FOREIGN KEY (portfolio_id, organisation_id) REFERENCES product_service_portfolios(id, organisation_id),
    ADD CONSTRAINT fk_ps_offering_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_offering_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_needs
    ADD UNIQUE KEY uq_ps_need_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_need_portfolio_org FOREIGN KEY (portfolio_id, organisation_id) REFERENCES product_service_portfolios(id, organisation_id),
    ADD CONSTRAINT fk_ps_need_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_need_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_ideas
    ADD UNIQUE KEY uq_ps_idea_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_idea_portfolio_org FOREIGN KEY (portfolio_id, organisation_id) REFERENCES product_service_portfolios(id, organisation_id),
    ADD CONSTRAINT fk_ps_idea_need_org FOREIGN KEY (need_id, organisation_id) REFERENCES product_service_needs(id, organisation_id),
    ADD CONSTRAINT fk_ps_idea_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_idea_decider_org FOREIGN KEY (decided_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_idea_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);
ALTER TABLE product_service_ideas
    ADD CONSTRAINT fk_ps_idea_duplicate_org FOREIGN KEY (duplicate_of_idea_id, organisation_id) REFERENCES product_service_ideas(id, organisation_id);

ALTER TABLE product_service_business_cases
    ADD UNIQUE KEY uq_ps_business_case_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_business_case_idea_org FOREIGN KEY (idea_id, organisation_id) REFERENCES product_service_ideas(id, organisation_id),
    ADD CONSTRAINT fk_ps_business_case_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_business_case_approver_org FOREIGN KEY (approved_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_business_case_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);
ALTER TABLE product_service_business_cases
    ADD CONSTRAINT fk_ps_business_case_previous_org FOREIGN KEY (supersedes_business_case_id, organisation_id) REFERENCES product_service_business_cases(id, organisation_id);

ALTER TABLE product_service_business_case_assumptions
    ADD UNIQUE KEY uq_ps_bc_assumption_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_bc_assumption_case_org FOREIGN KEY (business_case_id, organisation_id) REFERENCES product_service_business_cases(id, organisation_id),
    ADD CONSTRAINT fk_ps_bc_assumption_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_business_case_scenarios
    ADD UNIQUE KEY uq_ps_bc_scenario_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_bc_scenario_case_org FOREIGN KEY (business_case_id, organisation_id) REFERENCES product_service_business_cases(id, organisation_id),
    ADD CONSTRAINT fk_ps_bc_scenario_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_designs
    ADD UNIQUE KEY uq_ps_design_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_design_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_design_business_case_org FOREIGN KEY (business_case_id, organisation_id) REFERENCES product_service_business_cases(id, organisation_id),
    ADD CONSTRAINT fk_ps_design_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_design_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_design_approver_org FOREIGN KEY (approved_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);
ALTER TABLE product_service_designs
    ADD CONSTRAINT fk_ps_design_previous_org FOREIGN KEY (supersedes_design_id, organisation_id) REFERENCES product_service_designs(id, organisation_id);

ALTER TABLE product_service_design_reviews
    ADD UNIQUE KEY uq_ps_design_review_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_design_review_design_org FOREIGN KEY (design_id, organisation_id) REFERENCES product_service_designs(id, organisation_id),
    ADD CONSTRAINT fk_ps_design_review_reviewer_org FOREIGN KEY (reviewer_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_design_review_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_development_plans
    ADD UNIQUE KEY uq_ps_development_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_development_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_development_design_org FOREIGN KEY (design_id, organisation_id) REFERENCES product_service_designs(id, organisation_id),
    ADD CONSTRAINT fk_ps_development_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_development_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_development_completer_org FOREIGN KEY (completed_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_launch_plans
    ADD UNIQUE KEY uq_ps_launch_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_launch_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_launch_development_org FOREIGN KEY (development_plan_id, organisation_id) REFERENCES product_service_development_plans(id, organisation_id),
    ADD CONSTRAINT fk_ps_launch_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_launch_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_launch_approver_org FOREIGN KEY (approved_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_lifecycle_reviews
    ADD UNIQUE KEY uq_ps_lifecycle_review_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_lifecycle_review_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_lifecycle_review_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_lifecycle_review_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_retirement_plans
    ADD UNIQUE KEY uq_ps_retirement_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_retirement_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_retirement_review_org FOREIGN KEY (lifecycle_review_id, organisation_id) REFERENCES product_service_lifecycle_reviews(id, organisation_id),
    ADD CONSTRAINT fk_ps_retirement_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_retirement_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_retirement_approver_org FOREIGN KEY (approved_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

ALTER TABLE product_service_innovation_experiments
    ADD UNIQUE KEY uq_ps_experiment_id_org (id, organisation_id),
    ADD CONSTRAINT fk_ps_experiment_portfolio_org FOREIGN KEY (portfolio_id, organisation_id) REFERENCES product_service_portfolios(id, organisation_id),
    ADD CONSTRAINT fk_ps_experiment_idea_org FOREIGN KEY (idea_id, organisation_id) REFERENCES product_service_ideas(id, organisation_id),
    ADD CONSTRAINT fk_ps_experiment_offering_org FOREIGN KEY (offering_id, organisation_id) REFERENCES product_service_offerings(id, organisation_id),
    ADD CONSTRAINT fk_ps_experiment_owner_org FOREIGN KEY (owner_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_experiment_creator_org FOREIGN KEY (created_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id),
    ADD CONSTRAINT fk_ps_experiment_closer_org FOREIGN KEY (closed_by_member_id, organisation_id) REFERENCES organisation_members(id, organisation_id);

-- migrate:down
SELECT 1;
