-- 023_catalog_embeddings.sql
-- Stores deterministic local embeddings for existing catalog text sources.

create extension if not exists vector with schema extensions;

create table catalog_embeddings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('brand', 'brand_alias', 'product_type')),
  brand_id uuid references brands(id) on delete cascade,
  brand_alias_id uuid references brand_aliases(id) on delete cascade,
  product_type_id uuid references product_types(id) on delete cascade,
  entity_ref text generated always as (
    coalesce(brand_id::text, brand_alias_id::text, product_type_id::text)
  ) stored,
  source_text text not null,
  source_hash text not null,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_embeddings_entity_fk_check check (
    (entity_type = 'brand' and brand_id is not null and brand_alias_id is null and product_type_id is null)
    or
    (entity_type = 'brand_alias' and brand_id is null and brand_alias_id is not null and product_type_id is null)
    or
    (entity_type = 'product_type' and brand_id is null and brand_alias_id is null and product_type_id is not null)
  )
);

create trigger catalog_embeddings_updated_at
  before update on catalog_embeddings
  for each row execute function update_updated_at();

create unique index catalog_embeddings_entity_source_hash_idx
  on catalog_embeddings(entity_type, entity_ref, source_hash);

create index catalog_embeddings_entity_type_idx
  on catalog_embeddings(entity_type);

create index catalog_embeddings_brand_id_idx
  on catalog_embeddings(brand_id);

create index catalog_embeddings_brand_alias_id_idx
  on catalog_embeddings(brand_alias_id);

create index catalog_embeddings_product_type_id_idx
  on catalog_embeddings(product_type_id);

alter table catalog_embeddings enable row level security;

create or replace function match_catalog_embeddings(
  query_embedding extensions.vector(384),
  entity_types text[] default array['brand', 'brand_alias', 'product_type'],
  match_threshold real default 0.7,
  match_count int default 5
)
returns table (
  entity_type text,
  entity_id uuid,
  canonical_slug text,
  canonical_name text,
  source_text text,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    ce.entity_type,
    case
      when ce.entity_type = 'brand' then ce.brand_id
      when ce.entity_type = 'brand_alias' then ce.brand_alias_id
      else ce.product_type_id
    end as entity_id,
    case
      when ce.entity_type = 'product_type' then pt.slug
      else b.slug
    end as canonical_slug,
    case
      when ce.entity_type = 'product_type' then pt.name
      else b.name
    end as canonical_name,
    ce.source_text,
    greatest(0::real, (1 - (ce.embedding <=> query_embedding))::real) as similarity
  from catalog_embeddings ce
  left join brand_aliases ba on ba.id = ce.brand_alias_id
  left join brands b on b.id = coalesce(ce.brand_id, ba.brand_id)
  left join product_types pt on pt.id = ce.product_type_id
  where ce.entity_type = any(coalesce(entity_types, array['brand', 'brand_alias', 'product_type']::text[]))
    and (1 - (ce.embedding <=> query_embedding)) >= match_threshold
  order by ce.embedding <=> query_embedding asc
  limit greatest(match_count, 1);
$$;

grant execute on function match_catalog_embeddings(extensions.vector, text[], real, int)
  to authenticated, service_role;
