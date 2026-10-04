-- CalendarOps pipeline schema v2 (DRAFT — not yet applied to Neon)
-- Additive: creates two new tables and one column; existing tables untouched.

create table if not exists prospect (
  id uuid primary key default gen_random_uuid(),
  type text not null,                     -- customer | investor
  email text not null,
  name text,
  company text,
  -- why we found them: the ICP / investor-profile query that surfaced this prospect
  source_query text,
  fit_score int,                          -- 0-100, heuristic from research()
  status text not null default 'NEW',     -- NEW|CONTACTED|REPLIED|MEETING_BOOKED|NURTURE|DISQUALIFIED
  posture text,                           -- accommodate | firm | neutral (reused from research)
  notes text,
  last_touch_at timestamptz,
  next_action_at timestamptz,             -- when the scheduler should next act on this prospect
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(email, type)
);

create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospect(id),
  kind text not null,                     -- initial | followup | reply
  subject text,
  sent_at timestamptz default now(),
  response_at timestamptz,
  outcome text                            -- REPLIED | IGNORED | BOUNCED | OPT_OUT
);

-- link the existing negotiation stage back to the pipeline
alter table negotiation_thread
  add column if not exists prospect_id uuid references prospect(id);

create index if not exists prospect_status_idx on prospect(status, next_action_at);
create index if not exists outreach_prospect_idx on outreach(prospect_id, sent_at);
