-- CalendarOps schema — run once in Neon SQL editor
create table if not exists negotiation_thread (
  id uuid primary key default gen_random_uuid(),
  counterparty_email text not null,
  counterparty_name text,
  company text,
  constraints text,
  status text not null default 'INVITED',  -- INVITED|PROPOSED|COUNTERED|CONFIRMED|ESCALATED|EXPIRED
  round int not null default 0,
  escalated_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists proposal (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references negotiation_thread(id),
  slots jsonb not null,
  sent_at timestamptz default now(),
  response_at timestamptz,
  outcome text  -- ACCEPTED|COUNTERED|IGNORED
);

create table if not exists calendar_hold (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references negotiation_thread(id),
  slot jsonb not null,
  status text default 'tentative',  -- never 'confirmed' without a human yes
  created_at timestamptz default now()
);
