-- iter-25 — Calendar export tokens
--
-- Add a single nullable column to the workspaces table to hold a calendar
-- subscription token. When non-null, the workspace exposes two iCal feeds:
--   /api/calendar/<workspaceId>/projects.ics?token=<token>
--   /api/calendar/<workspaceId>/checkouts.ics?token=<token>
--
-- The token is workspace-scoped (one token per workspace, not per user).
-- Whoever has the URL gets read-only access to that workspace's feeds.
-- Owners can rotate (invalidates the old token) or disable (clears it
-- entirely) via Settings → Calendar Export.
--
-- RUN THIS in your Supabase project's SQL editor BEFORE deploying iter-25.
-- It's idempotent — running it twice is harmless.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS calendar_token TEXT;

-- Optional: index for the token lookup. The iCal endpoint runs
--   SELECT * FROM workspaces WHERE id = ? AND calendar_token = ?
-- The id is already PK-indexed, so this only helps for cases where someone
-- mass-probes tokens (rare). Skip if you'd rather not add the index.
CREATE INDEX IF NOT EXISTS idx_workspaces_calendar_token
  ON workspaces (calendar_token)
  WHERE calendar_token IS NOT NULL;
