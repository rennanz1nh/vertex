SET search_path TO vertex, extensions;

-- The sync routes previously hardcoded status = 'success' regardless of how many
-- products Google actually accepted, so a run where every product was rejected still
-- read as a success. Allow 'partial' so a mixed-result run (some accepted, some rejected)
-- is distinguishable from both a full success and a full failure.
ALTER TABLE vertex.google_shopping_sync_logs DROP CONSTRAINT google_shopping_sync_logs_status_check;
ALTER TABLE vertex.google_shopping_sync_logs
  ADD CONSTRAINT google_shopping_sync_logs_status_check CHECK (status IN ('success', 'partial', 'error'));

ALTER TABLE vertex.google_shopping_sync_automation DROP CONSTRAINT google_shopping_sync_settings_last_run_status_check;
ALTER TABLE vertex.google_shopping_sync_automation
  ADD CONSTRAINT google_shopping_sync_settings_last_run_status_check CHECK (last_run_status IN ('success', 'partial', 'error'));
