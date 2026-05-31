drop table if exists invoice_review_reports cascade;
drop table if exists mock_invoices cascade;
drop table if exists competitor_price_observations cascade;
drop table if exists mock_call_transcripts cascade;
drop table if exists mock_inbound_messages cascade;
drop table if exists followup_candidates cascade;
drop table if exists service_catalog cascade;
drop table if exists wait_statuses cascade;
drop table if exists appointment_slots cascade;
drop table if exists appointments cascade;
drop table if exists pets cascade;
drop table if exists clients cascade;
drop table if exists daily_ops_summaries cascade;
drop table if exists pricing_reports cascade;

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create table pets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  species text not null,
  breed text,
  weight text,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  doctor_id text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled',
  reason text,
  created_at timestamptz not null default now()
);

create table appointment_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false
);

create table wait_statuses (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null unique references pets(id) on delete cascade,
  queue_position integer not null,
  wait_minutes integer not null,
  status text not null,
  message text,
  updated_at timestamptz not null default now()
);

create table service_catalog (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  price numeric(10,2) not null,
  category text not null
);

create table followup_candidates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  follow_up_reason text not null,
  due_date date not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table mock_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  message_body text not null,
  received_at timestamptz not null default now()
);

create table mock_call_transcripts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  transcript text not null,
  received_at timestamptz not null default now()
);

create table mock_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  total_amount numeric(10,2) not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table competitor_price_observations (
  id uuid primary key default gen_random_uuid(),
  competitor_name text not null,
  service_name text not null,
  price numeric(10,2) not null,
  observed_at timestamptz not null default now()
);

create table daily_ops_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now()
);

create table pricing_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now()
);

create table invoice_review_reports (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references mock_invoices(id) on delete cascade,
  issue_details text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_pets_client_id on pets(client_id);
create index if not exists idx_appointments_client_id on appointments(client_id);
create index if not exists idx_appointments_pet_id on appointments(pet_id);
create index if not exists idx_wait_statuses_pet_id on wait_statuses(pet_id);
create index if not exists idx_followup_candidates_client_id on followup_candidates(client_id);
create index if not exists idx_mock_invoices_client_id on mock_invoices(client_id);
create index if not exists idx_invoice_review_reports_invoice_id on invoice_review_reports(invoice_id);
