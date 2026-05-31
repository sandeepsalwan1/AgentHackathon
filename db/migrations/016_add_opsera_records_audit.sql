alter table tasks
  add column if not exists opsera_audit_status text,
  add column if not exists opsera_audit_reason text,
  add column if not exists opsera_audit_id text,
  add column if not exists opsera_audit_checked_at timestamptz;

do $$
begin
  alter table tasks
    add constraint tasks_opsera_audit_status_check
    check (
      opsera_audit_status is null
      or opsera_audit_status in ('approved', 'flagged', 'blocked')
    );
exception
  when duplicate_object then null;
end $$;

update tasks
set opsera_audit_status = 'flagged',
    opsera_audit_reason = 'Legacy records request created before Opsera audit was wired; manual review required.',
    opsera_audit_id = 'legacy-' || id::text,
    opsera_audit_checked_at = coalesce(created_at, now())
where request_type = 'records_request'
  and opsera_audit_status is null;

create index if not exists idx_tasks_opsera_records_audit
  on tasks(opsera_audit_status, opsera_audit_checked_at desc)
  where request_type = 'records_request';
