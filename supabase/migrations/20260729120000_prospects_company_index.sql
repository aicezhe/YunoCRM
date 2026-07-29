-- 0009_prospects_company_index.sql
-- Search screen: every company card picks "the one prospect representing
-- this company" via a lateral join on prospects.company_id. That column had
-- no index, so the planner ran a sequential scan of prospects once per
-- company — O(companies × prospects). At 76 companies it still finished in
-- ~1 ms, but the brief requires tens of thousands of prospects not to
-- degrade, where the same plan would be quadratic.
--
-- The sort keys are included so the lateral's ORDER BY ... LIMIT 1 can be
-- answered from the index instead of sorting each company's prospects:
-- open-before-closed first, then newest.
create index idx_prospects_company_chosen
  on prospects (company_id, (current_stage not in ('Won', 'Lost')) desc, created_at desc);
