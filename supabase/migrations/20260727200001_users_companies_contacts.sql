-- 0001_users_companies_contacts.sql
-- Core entities: who works at Yuno, who the prospects are, who the people are.

create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  role        text not null check (role in ('admin', 'member')),
  created_at  timestamptz not null default now()
);
-- Role is a plain CHECK, not a separate roles table: only two fixed values,
-- no attributes of their own. A lookup table would be overengineering here.

create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text unique,
  -- domain is nullable: a company can exist without a resolved email domain
  -- (e.g. created manually from a phone lead), but when present it must be
  -- unique — it is the primary key used by the ingestion resolver to match
  -- an incoming email to an existing company.
  created_at  timestamptz not null default now()
);

create table contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete restrict,
  -- ON DELETE RESTRICT, not CASCADE: a company should never be deletable
  -- while it still has contacts/history attached. Deletion must be a
  -- deliberate, explicit action (e.g. archiving), not a side effect.
  email       text not null unique,
  name        text,
  title       text,
  created_at  timestamptz not null default now()
);

comment on table companies is
  'A prospect company. Distinct from "prospect" (see 0002): a company can '
  'have zero, one, or several prospect deals over time (e.g. lost in March, '
  'a new opportunity opened in September).';
