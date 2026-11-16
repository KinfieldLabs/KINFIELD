-- The apprentice trading on its own: its own simulated account, its model, and a
-- log of every scheduled run. Additive: the live release keeps working until the
-- new one is deployed.

-- Accounts are either the person's ("human") or their agent's ("agent")
alter table sim_accounts add column kind text not null default 'human' check (kind in ('human', 'agent'));
drop index sim_accounts_one_active;
create unique index sim_accounts_one_active on sim_accounts(user_id, kind) where archived_at is null;

-- The agent's confidence (probability of "long") when it opened a position
alter table positions add column agent_p double precision;

-- Agent positions are closed after a maximum holding time
alter table positions drop constraint positions_exit_reason_check;
alter table positions add constraint positions_exit_reason_check
  check (exit_reason in ('manual', 'take_profit', 'stop_loss', 'liquidation', 'time_stop'));

create table agents (
  user_id      uuid primary key references users(id) on delete cascade,
  paused       boolean not null default false,
  model        jsonb,           -- logistic regression trained on the person's closed trades
  trained_at   timestamptz,
  trained_on   int not null default 0,
  started_at   timestamptz,     -- first time it traded on its own
  last_run_at  timestamptz,
  last_note    text,            -- what it did (or why it didn't) on the last run
  created_at   timestamptz not null default now()
);

create table agent_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  agents      int,
  opened      int,
  closed      int,
  error       text
);
