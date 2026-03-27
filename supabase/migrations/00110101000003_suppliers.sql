-- 002_suppliers.sql
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  yupoo_url text not null,
  whatsapp_contact text not null,
  brands text[] not null default '{}',
  trust_notes text,
  is_flagged boolean not null default false,
  red_flag_source text,
  negotiation_opening_price numeric,
  negotiation_final_price numeric,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table suppliers enable row level security;

-- update_updated_at function already defined in 001_profiles.sql — reuse it
create trigger suppliers_updated_at
  before update on suppliers
  for each row execute function update_updated_at();

-- Auth-gated SELECT and INSERT (no is_admin() needed)
create policy "Auth users can read suppliers"
  on suppliers for select
  using (auth.uid() is not null);

create policy "Auth users can insert suppliers"
  on suppliers for insert
  with check (auth.uid() is not null);
