-- 003_products.sql
create table products (
  id uuid primary key default gen_random_uuid(),
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products enable row level security;

-- update_updated_at function already defined in 001_profiles.sql — reuse it
create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

create policy "Auth users can read products"
  on products for select
  using (auth.uid() is not null);

create policy "Auth users can insert products"
  on products for insert
  with check (auth.uid() is not null);

create policy "Creator can update products"
  on products for update
  using (created_by = auth.uid() or is_admin());

create policy "Creator can delete products"
  on products for delete
  using (created_by = auth.uid() or is_admin());
