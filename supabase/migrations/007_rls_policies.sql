-- 007_rls_policies.sql
-- Drop dev-only permissive policy from 001_profiles.sql
drop policy if exists "Authenticated users can read profiles" on profiles;

-- Helper: is current user an admin?
-- security definer: avoids RLS recursion when checking profiles inside a policy
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  )
$$ language sql security definer stable;

-- PROFILES policies
create policy "Auth users can read profiles"
  on profiles for select
  using (auth.uid() is not null);

create policy "Admin can insert profiles"
  on profiles for insert
  with check (is_admin());

create policy "Admin can update profiles"
  on profiles for update
  using (is_admin());

-- GENERIC pattern for feature tables (suppliers, products, inquiries, sources, photo_hashes)
-- Applied here for tables that exist at this point; each feature migration enables RLS,
-- but the policies are defined in this single migration for consistency.

-- Note: suppliers/products/etc tables do NOT exist yet — those policies are added
-- when each Epic's first story runs. This file sets the policy PATTERN to follow.
-- Story 4.1 (inquiries) will reference this file for the exact policy SQL to use.
