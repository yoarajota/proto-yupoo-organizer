-- 018_mission_seed_url.sql
-- Store the mission-specific Yupoo shop URL so discovery can preserve the full hostname.

ALTER TABLE sourcing_missions
  ADD COLUMN seed_url TEXT;

UPDATE sourcing_missions
SET seed_url = 'https://www.yupoo.com'
WHERE seed_url IS NULL;

ALTER TABLE sourcing_missions
  ALTER COLUMN seed_url SET NOT NULL;
