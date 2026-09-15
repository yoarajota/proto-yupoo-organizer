-- 020_brand_product_type_catalog.sql
-- Normalize brands and product types so products and suppliers can reference
-- registered catalog entries instead of free-form text only.

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products
  add column brand_id uuid references brands(id) on delete set null,
  add column product_type_id uuid references product_types(id) on delete set null;

create table supplier_brands (
  supplier_id uuid not null references suppliers(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supplier_id, brand_id)
);

create table supplier_product_types (
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_type_id uuid not null references product_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supplier_id, product_type_id)
);

create trigger brands_updated_at
  before update on brands
  for each row execute function update_updated_at();

create trigger product_types_updated_at
  before update on product_types
  for each row execute function update_updated_at();

create index products_brand_id_idx on products(brand_id);
create index products_product_type_id_idx on products(product_type_id);
create index supplier_brands_brand_id_idx on supplier_brands(brand_id);
create index supplier_product_types_product_type_id_idx on supplier_product_types(product_type_id);

alter table brands enable row level security;
alter table product_types enable row level security;
alter table supplier_brands enable row level security;
alter table supplier_product_types enable row level security;

create policy "Auth users can read brands"
  on brands for select
  using (auth.uid() is not null);

create policy "Auth users can insert brands"
  on brands for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "Creator can update brands"
  on brands for update
  using (created_by = auth.uid() or is_admin());

create policy "Creator can delete brands"
  on brands for delete
  using (created_by = auth.uid() or is_admin());

create policy "Auth users can read product types"
  on product_types for select
  using (auth.uid() is not null);

create policy "Auth users can insert product types"
  on product_types for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "Creator can update product types"
  on product_types for update
  using (created_by = auth.uid() or is_admin());

create policy "Creator can delete product types"
  on product_types for delete
  using (created_by = auth.uid() or is_admin());

create policy "Auth users can read supplier brands"
  on supplier_brands for select
  using (auth.uid() is not null);

create policy "Auth users can manage supplier brands"
  on supplier_brands for all
  using (
    exists (
      select 1 from suppliers
      where suppliers.id = supplier_brands.supplier_id
        and (suppliers.created_by = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from suppliers
      where suppliers.id = supplier_brands.supplier_id
        and (suppliers.created_by = auth.uid() or is_admin())
    )
  );

create policy "Auth users can read supplier product types"
  on supplier_product_types for select
  using (auth.uid() is not null);

create policy "Auth users can manage supplier product types"
  on supplier_product_types for all
  using (
    exists (
      select 1 from suppliers
      where suppliers.id = supplier_product_types.supplier_id
        and (suppliers.created_by = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from suppliers
      where suppliers.id = supplier_product_types.supplier_id
        and (suppliers.created_by = auth.uid() or is_admin())
    )
  );

with supplier_brand_names as (
  select distinct on (lower(trim(brand_name)))
    trim(brand_name) as name,
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower(trim(brand_name)), '[^a-z0-9]+', '-', 'g')), ''),
      md5(lower(trim(brand_name)))
    ) as slug,
    created_by
  from suppliers
  cross join lateral unnest(suppliers.brands) as brand_name
  where trim(brand_name) <> ''
  order by lower(trim(brand_name)), created_at asc
)
insert into brands (name, slug, created_by)
select name, slug, created_by
from supplier_brand_names
on conflict (slug) do nothing;

insert into supplier_brands (supplier_id, brand_id)
select suppliers.id, brands.id
from suppliers
cross join lateral unnest(suppliers.brands) as brand_name
join brands on brands.slug = coalesce(
  nullif(trim(both '-' from regexp_replace(lower(trim(brand_name)), '[^a-z0-9]+', '-', 'g')), ''),
  md5(lower(trim(brand_name)))
)
on conflict do nothing;

alter table suppliers drop column brands;
