-- 008_suppliers_rls.sql
-- Runs after 007_rls_policies.sql — is_admin() is available here

create policy "Creator or admin can update suppliers"
  on suppliers for update
  using (created_by = auth.uid() or is_admin());

create policy "Creator or admin can delete suppliers"
  on suppliers for delete
  using (created_by = auth.uid() or is_admin());
