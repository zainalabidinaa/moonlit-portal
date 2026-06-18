-- Add enabled column to collections table.
-- DEFAULT true ensures all existing rows stay visible.
ALTER TABLE collections ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
