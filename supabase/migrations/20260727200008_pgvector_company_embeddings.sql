-- 0008_pgvector_company_embeddings.sql
-- Adds semantic search over companies (Smart search on /search): an
-- embedding computed once per company from its name, domain, and its most
-- recent/active prospect's channel and stage (there is no "industry" field
-- in this schema or the seed dataset — checked both, neither has one), then
-- queried with cosine distance via pgvector's <=> operator.

create extension if not exists vector;

-- voyage-3-lite's default output dimension (scripts/embed-companies.ts).
alter table companies add column embedding vector(512);

-- The dataset today only has a few dozen companies, where a plain
-- sequential scan is actually faster and exact (ivfflat is approximate and
-- needs a reasonable rows-per-list ratio to have good recall). The index is
-- added anyway so the query plan holds up as the table grows toward the
-- brief's reference scale — `lists` should be re-tuned upward once there's
-- real row-count data to size it from.
create index idx_companies_embedding_cosine on companies
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
