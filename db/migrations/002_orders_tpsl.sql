-- Limit orders, take-profit / stop-loss, and why each position closed.
-- Additive only, so the previous release keeps working until the new one is live.
-- (positions.liq_checked_at keeps its name: it is now the checkpoint for every trigger.)

alter table positions add column entry_fee double precision;
alter table positions add column tp_px double precision;
alter table positions add column sl_px double precision;
alter table positions add column exit_reason text
  check (exit_reason in ('manual', 'take_profit', 'stop_loss', 'liquidation'));
alter table positions add column order_id uuid;

update positions set entry_fee = size_usd * 0.00045 where entry_fee is null;
update positions set exit_reason = case when liquidated then 'liquidation' else 'manual' end
  where closed_at is not null and exit_reason is null;

create table orders (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references sim_accounts(id) on delete cascade,
  coin        text not null,
  side        text not null check (side in ('long', 'short')),
  size_usd    double precision not null check (size_usd > 0),
  leverage    double precision not null check (leverage >= 1),
  limit_px    double precision not null check (limit_px > 0),
  tp_px       double precision,
  sl_px       double precision,
  strategy    text not null,
  rationale   text not null default '',
  features    jsonb, -- market context when the order was placed: the decision
  placed_at   timestamptz not null default now(),
  checked_at  timestamptz not null default now(),
  status      text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  done_at     timestamptz,
  position_id uuid references positions(id)
);
create index orders_open on orders(account_id) where status = 'open';

alter table positions add constraint positions_order_fk foreign key (order_id) references orders(id);

alter table ledger drop constraint ledger_kind_check;
alter table ledger add constraint ledger_kind_check
  check (kind in ('open', 'close', 'liquidate', 'order', 'cancel', 'tpsl'));
