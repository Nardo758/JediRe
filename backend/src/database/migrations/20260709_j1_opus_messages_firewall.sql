-- J1 CoStar-chat firewall: flag opus_messages turns that carry restricted lineage.
-- Pattern mirrors 20260708_i2_chat_firewall.sql (skill_chat_messages).
-- The column is FALSE by default so the replay-history filter (LLM prompt) excludes
-- any flagged assistant turns; the display endpoint reads unfiltered (no change needed).

ALTER TABLE opus_messages
  ADD COLUMN IF NOT EXISTS contains_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_opus_messages_contains_restricted
  ON opus_messages (conversation_id, contains_restricted);

COMMENT ON COLUMN opus_messages.contains_restricted IS
  'TRUE if this assistant turn was generated in a deal context whose metric_time_series
   contains redistribution_restricted=TRUE rows. Set at INSERT by OpusService.saveMessage
   (role=assistant path only). Replay path (streamChat) excludes flagged turns; display
   endpoint is unfiltered.';
