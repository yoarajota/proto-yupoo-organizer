-- 00110101000011_fix_fks_to_profiles.sql

ALTER TABLE suppliers
  DROP CONSTRAINT IF EXISTS suppliers_created_by_fkey,
  ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_created_by_fkey,
  ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE photo_hashes
  DROP CONSTRAINT IF EXISTS photo_hashes_created_by_fkey,
  ADD CONSTRAINT photo_hashes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE inquiries
  DROP CONSTRAINT IF EXISTS inquiries_created_by_fkey,
  ADD CONSTRAINT inquiries_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_created_by_fkey,
  ADD CONSTRAINT sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
