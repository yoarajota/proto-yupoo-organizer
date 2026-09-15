-- 022_brand_aliases.sql
-- Stores alternate/obfuscated brand labels found in Yupoo shops.

create table brand_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  alias text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, alias)
);

create trigger brand_aliases_updated_at
  before update on brand_aliases
  for each row execute function update_updated_at();

create index brand_aliases_brand_id_idx on brand_aliases(brand_id);

alter table brand_aliases enable row level security;

create policy "Auth users can read brand aliases"
  on brand_aliases for select
  using (auth.uid() is not null);

create policy "Auth users can insert brand aliases"
  on brand_aliases for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "Creator can update brand aliases"
  on brand_aliases for update
  using (created_by = auth.uid() or is_admin());

create policy "Creator can delete brand aliases"
  on brand_aliases for delete
  using (created_by = auth.uid() or is_admin());

insert into brand_aliases (brand_id, alias, created_by)
select
  id,
  name,
  created_by
from brands
on conflict (brand_id, alias) do nothing;
