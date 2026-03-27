-- 005_inquiries.sql
-- Create inquiry status enum
create type inquiry_status as enum ('sent', 'price_received', 'negotiating', 'decided', 'ghosted');

-- Create inquiries table
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  status inquiry_status not null default 'sent',
  price numeric,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table inquiries enable row level security;

-- Updated_at trigger (update_updated_at function defined in 001_profiles.sql)
create trigger inquiries_updated_at
  before update on inquiries
  for each row execute function update_updated_at();

-- RLS Policies
-- 1. Anyone authenticated can read inquiries
create policy "Auth users can read inquiries"
  on inquiries for select
  using (auth.uid() is not null);

-- 2. Anyone authenticated can create inquiries
create policy "Auth users can insert inquiries"
  on inquiries for insert
  with check (auth.uid() is not null);

-- 3. Only the creator or an admin can update an inquiry
create policy "Creator or admin can update inquiries"
  on inquiries for update
  using (created_by = auth.uid() or is_admin());

-- 4. Only the creator or an admin can delete an inquiry
create policy "Creator or admin can delete inquiries"
  on inquiries for delete
  using (created_by = auth.uid() or is_admin());
