-- Record WHICH company a human picked when resolving a quarantine item.
--
-- The quarantine actions deliberately create only the company and contact,
-- and leave the prospect, interaction and stage history to the resolver on
-- its next run — the human decides "which company", the pipeline does the
-- rest. But the resolver identified the company by the sender's email
-- domain, which is exactly the inference quarantine exists to avoid: these
-- are the records where the domain is meaningless.
--
-- Observed on real data: an operator resolved a mail from
-- andrea.romano@libero.it into a new company, and linked another one to
-- "Autotrasporti Fumagalli". A later `npm run resolve` matched both by
-- domain, created a company literally named "libero.it", and moved both
-- interactions onto it — silently overruling two human decisions.
--
-- `resolution` already stores what happened, but as display text; matching a
-- company by parsing its name out of a sentence would be worse than the bug.
-- This column is the machine-readable half of the same fact.
--
-- Nullable: `Discarded` resolves to no company at all, and rows resolved
-- before this migration have no recorded choice.
alter table quarantine_items
  add column resolved_company_id uuid references companies(id) on delete set null;

comment on column quarantine_items.resolved_company_id is
  'Company the human chose when resolving. The resolver uses this instead of '
  'inferring one from the sender domain, so re-running the pipeline cannot '
  'overrule the decision. Null for discarded items.';
