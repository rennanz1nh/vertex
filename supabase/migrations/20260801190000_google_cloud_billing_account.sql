SET search_path TO vertex, extensions;

-- Billing account ID isn't derivable from the service account JSON the way project_id is
-- (a project's linked billing account is looked up via the Cloud Billing API's
-- projects.getBillingInfo, but the Billing Budgets API needs the account ID as a path
-- param up front) — cached here once looked up so it isn't re-fetched on every page load.
ALTER TABLE vertex.google_cloud_settings
  ADD COLUMN IF NOT EXISTS billing_account_id TEXT;
