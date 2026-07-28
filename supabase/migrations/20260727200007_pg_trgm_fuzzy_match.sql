-- 0007_pg_trgm_fuzzy_match.sql
-- Enables trigram-based fuzzy matching for quarantine enrichment
-- (DECISIONS.md §7.1): before any AI call, ambiguous quarantine items are
-- matched against known company names with pg_trgm similarity — a
-- database-native, zero-network, deterministic first tier.

create extension if not exists pg_trgm;

-- Serves word_similarity() lookups from scripts/enrich-quarantine.ts:
-- "which known company name best matches this ambiguous text".
create index idx_companies_name_trgm on companies using gin (name gin_trgm_ops);
