-- 021_drop_supplier_brands_cache.sql
-- Remove the old free-form supplier brand cache for databases that already
-- applied 020 before it dropped the column.

alter table suppliers drop column if exists brands;
