-- Phase 12: Add UNIQUE constraint to connection_hints table
-- Idempotent: safe to run multiple times

-- Add UNIQUE constraint on entry_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connection_hints_entry_id_unique'
    AND conrelid = 'connection_hints'::regclass
  ) THEN
    ALTER TABLE connection_hints
      ADD CONSTRAINT connection_hints_entry_id_unique UNIQUE (entry_id);
  END IF;
END $$;

-- Create index on connection_attempts.completed_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_connection_attempts_completed_at
  ON connection_attempts (completed_at);
