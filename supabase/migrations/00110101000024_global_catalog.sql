-- 024_global_catalog.sql
-- Make catalog tables global and admin-curated instead of per-user owned.

drop policy if exists "Auth users can insert brands" on brands;
drop policy if exists "Creator can update brands" on brands;
drop policy if exists "Creator can delete brands" on brands;

create policy "Admins can insert brands"
  on brands for insert
  with check (is_admin());

create policy "Admins can update brands"
  on brands for update
  using (is_admin())
  with check (is_admin());

create policy "Admins can delete brands"
  on brands for delete
  using (is_admin());

drop policy if exists "Auth users can insert product types" on product_types;
drop policy if exists "Creator can update product types" on product_types;
drop policy if exists "Creator can delete product types" on product_types;

create policy "Admins can insert product types"
  on product_types for insert
  with check (is_admin());

create policy "Admins can update product types"
  on product_types for update
  using (is_admin())
  with check (is_admin());

create policy "Admins can delete product types"
  on product_types for delete
  using (is_admin());

drop policy if exists "Auth users can insert brand aliases" on brand_aliases;
drop policy if exists "Creator can update brand aliases" on brand_aliases;
drop policy if exists "Creator can delete brand aliases" on brand_aliases;

create policy "Admins can insert brand aliases"
  on brand_aliases for insert
  with check (is_admin());

create policy "Admins can update brand aliases"
  on brand_aliases for update
  using (is_admin())
  with check (is_admin());

create policy "Admins can delete brand aliases"
  on brand_aliases for delete
  using (is_admin());

alter table brand_aliases
  drop constraint if exists brand_aliases_created_by_fkey,
  drop column if exists created_by;

alter table brands
  drop constraint if exists brands_created_by_fkey,
  drop column if exists created_by;

alter table product_types
  drop constraint if exists product_types_created_by_fkey,
  drop column if exists created_by;
