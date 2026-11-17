-- Agents are named in Kinfield's own series, KIN001, KIN002 and on, in the order
-- their owners signed up. Names are assigned, never chosen: the open dataset stays
-- pseudonymous and no agent can pose as another. The ledger never stored these
-- names (every chain starts from its account id), so every chain still verifies.

create sequence agent_number_seq;
alter sequence agent_number_seq owned by users.agent_id;

-- 1 -> KIN001, 999 -> KIN999, 1000 -> KIN1000
create function kin_agent_name(n bigint) returns text language sql immutable as $$
  select 'KIN' || lpad(n::text, greatest(3, length(n::text)), '0')
$$;

-- The old id of an agent that has a folder in the dataset repository: the next
-- publish moves that folder to the new name, then clears this.
alter table users add column former_agent_id text;

with ordered as (
  select id, agent_id, row_number() over (order by created_at, id) as n from users
)
update users u
set former_agent_id = case when u.dataset_hash is not null then o.agent_id end,
    agent_id = kin_agent_name(o.n)
from ordered o
where o.id = u.id;

-- New users take the next number
select setval('agent_number_seq', greatest((select count(*) from users), 1), exists (select 1 from users));
alter table users alter column agent_id set default kin_agent_name(nextval('agent_number_seq'));
