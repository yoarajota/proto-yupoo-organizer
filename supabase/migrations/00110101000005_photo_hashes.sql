-- 004_photo_hashes.sql
create table photo_hashes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,
  phash text,
  alt_text text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table photo_hashes enable row level security;

create trigger photo_hashes_updated_at
  before update on photo_hashes
  for each row execute function update_updated_at();

create policy "Auth users can read photo_hashes"
  on photo_hashes for select
  using (auth.uid() is not null);

create policy "Auth users can insert photo_hashes"
  on photo_hashes for insert
  with check (auth.uid() is not null);

create policy "Creator can delete photo_hashes"
  on photo_hashes for delete
  using (created_by = auth.uid() or is_admin());
