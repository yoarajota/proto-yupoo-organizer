-- 006_sources.sql
-- Create platform type enum
CREATE TYPE platform_type AS ENUM ('reddit', 'discord', 'whatsapp', 'other');

-- Create sources table
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  platform platform_type NOT NULL,
  brands TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE TRIGGER sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
-- 1. Anyone authenticated can read sources
CREATE POLICY "Auth users can read sources"
  ON sources FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Anyone authenticated can create sources
CREATE POLICY "Auth users can insert sources"
  ON sources FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Only the creator or an admin can update a source
CREATE POLICY "Creator or admin can update sources"
  ON sources FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

-- 4. Only the creator or an admin can delete a source
CREATE POLICY "Creator or admin can delete sources"
  ON sources FOR DELETE
  USING (created_by = auth.uid() OR is_admin());
