-- Kinfield: accounts and the server-side simulated trading ledger.

create table users (
  id           uuid primary key default gen_random_uuid(),
  github_id    bigint unique not null,
  login        text not null,
  name         text,
  avatar_url   text,
  -- Publish this user's trade data (not rationale text) to the open dataset
  publish_data boolean not null default true,
  publish_rationale boolean not null default false,
  created_at   timestamptz not null default now()
);

create table sessions (
  token_hash  text primary key, -- sha256 of the cookie value; raw tokens are never stored
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index sessions_user on sessions(user_id);

-- One simulated account per agent run. A reset archives the account and opens a new one,
-- so an agent's evaluation history can never be silently erased.
create table sim_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  starting_balance double precision not null,
  cash             double precision not null,
  created_at       timestamptz not null default now(),
  archived_at      timestamptz
);
create unique index sim_accounts_one_active on sim_accounts(user_id) where archived_at is null;

create table positions (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references sim_accounts(id) on delete cascade,
  coin           text not null,
  side           text not null check (side in ('long', 'short')),
  size_usd       double precision not null check (size_usd > 0),
  leverage       double precision not null check (leverage >= 1),
  entry_px       double precision not null check (entry_px > 0),
  opened_at      timestamptz not null default now(),
  strategy       text not null,
  rationale      text not null default '',
  entry_features jsonb,
  -- closing fields (null while open)
  exit_px        double precision,
  closed_at      timestamptz,
  pnl            double precision,
  fees           double precision,
  liquidated     boolean not null default false,
  liq_checked_at timestamptz not null default now()
);
create index positions_open on positions(account_id) where closed_at is null;
create index positions_history on positions(account_id, closed_at desc) where closed_at is not null;

-- Append-only, hash-chained record of every fill. Each entry commits to the one
-- before it, so a published dataset can be checked against the server's record.
create table ledger (
  seq        bigserial primary key,
  account_id uuid not null references sim_accounts(id) on delete cascade,
  kind       text not null check (kind in ('open', 'close', 'liquidate')),
  payload    jsonb not null,
  prev_hash  text not null,
  hash       text not null unique,
  created_at timestamptz not null default now()
);
create index ledger_account on ledger(account_id, seq);
