-- Open dataset: each user's sharing choices, a stable public agent id, salted
-- commitments for reasons, and a record of every publish. Additive only.

-- Public, pseudonymous id for the agent's folder in the dataset
alter table users add column agent_id text unique
  default ('agent-' || substr(md5(gen_random_uuid()::text), 1, 10));
update users set agent_id = 'agent-' || substr(md5(gen_random_uuid()::text), 1, 10) where agent_id is null;
alter table users alter column agent_id set not null;

-- Sharing is opt-in: nothing is published until the user has chosen
alter table users alter column publish_data set default false;
alter table users add column publish_decided_at timestamptz;
alter table users add column show_login boolean not null default false;
-- Hash of the files last published for this agent (skip unchanged agents)
alter table users add column dataset_hash text;

-- A random salt per reason: the ledger commits to sha256(salt + reason), which
-- can't be guessed from common phrases; publishing a reason publishes its salt.
alter table positions add column rationale_salt text;
alter table orders add column rationale_salt text;

create table dataset_publishes (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  commit_sha  text,
  agents      int,
  changed     int,
  trades      int,
  error       text
);
