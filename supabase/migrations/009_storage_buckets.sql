-- 009_storage_buckets.sql
-- Public bucket for product photos (MVP: non-sensitive, avoids signed URL complexity)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-photos', 'product-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for product-photos bucket
CREATE POLICY "auth_insert_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "auth_select_photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-photos');

CREATE POLICY "auth_delete_own_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-photos');
