-- 001_groups.sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, user_id)
);

-- RLS: enable on both tables (policies defined in 007_rls_policies.sql)
alter table groups enable row level security;
alter table group_members enable row level security;

-- Temporary permissive policy for development (Story 1.3 only — replaced in Story 1.4)
-- Without any policy, all queries return empty results even for authenticated users.
create policy "Authenticated users can read groups"
  on groups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read group_members"
  on group_members for select
  using (auth.role() = 'authenticated');

-- updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger groups_updated_at
  before update on groups
  for each row execute function update_updated_at();

create trigger group_members_updated_at
  before update on group_members
  for each row execute function update_updated_at();
