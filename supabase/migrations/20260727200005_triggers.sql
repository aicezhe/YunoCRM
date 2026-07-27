-- 0005_triggers.sql
-- Keeps the two denormalized columns on `prospects` (current_stage,
-- last_interaction_at) consistent with their source-of-truth tables
-- automatically, at the database level — not something the application
-- code has to remember to do on every write path.

create or replace function sync_prospect_current_stage()
returns trigger as $$
begin
  update prospects
  set current_stage = new.to_stage
  where id = new.prospect_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_current_stage
after insert on stage_transitions
for each row execute function sync_prospect_current_stage();

create or replace function sync_prospect_last_interaction()
returns trigger as $$
begin
  update prospects
  set last_interaction_at = new.occurred_at
  where id = new.prospect_id
    and (last_interaction_at is null or last_interaction_at < new.occurred_at);
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_last_interaction
after insert on interactions
for each row execute function sync_prospect_last_interaction();

comment on function sync_prospect_current_stage() is
  'Keeps prospects.current_stage authoritative-but-cached: '
  'stage_transitions remains the source of truth (full history), this '
  'trigger guarantees the cached column can never drift out of sync, '
  'without relying on application code to remember the update.';
