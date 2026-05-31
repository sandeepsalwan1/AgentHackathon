drop table if exists agent_traces cascade;
drop table if exists workflow_events cascade;
drop table if exists workflow_runs cascade;
drop table if exists approval_requests cascade;

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  agent_type text not null,
  scenario text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workflow_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references workflow_runs(id) on delete cascade,
  event_type text not null,
  tool_name text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete set null,
  request_type text not null,
  status text not null default 'pending',
  requester_role text not null,
  requested_action text not null,
  payload jsonb not null default '{}',
  decided_by_name text,
  decided_by_role text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table agent_traces (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references workflow_runs(id) on delete cascade,
  prompt text not null,
  response text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_events_run_id on workflow_events(run_id);
create index if not exists idx_approval_requests_task_id on approval_requests(task_id);
create index if not exists idx_agent_traces_run_id on agent_traces(run_id);
