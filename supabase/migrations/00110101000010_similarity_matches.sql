-- 008_similarity_matches.sql
create table similarity_matches (
  id uuid primary key default gen_random_uuid(),
  source_photo_hash_id uuid not null references photo_hashes(id) on delete cascade,
  matched_photo_hash_id uuid not null references photo_hashes(id) on delete cascade,
  distance int not null,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table similarity_matches enable row level security;

-- Auth users can read similarity_matches
create policy "Auth users can read similarity_matches"
  on similarity_matches for select
  using (auth.uid() is not null);

-- Creator can update is_dismissed
create policy "Creator can update similarity_matches"
  on similarity_matches for update
  using (
    exists (
      select 1 from photo_hashes ph
      where ph.id = source_photo_hash_id
      and (ph.created_by = auth.uid() or is_admin())
    )
  );
