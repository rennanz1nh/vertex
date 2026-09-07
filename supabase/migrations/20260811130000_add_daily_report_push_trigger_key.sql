-- Must be its own migration/transaction — Postgres doesn't allow a new enum value to be
-- used (e.g. in an INSERT) within the same transaction that adds it.
ALTER TYPE push_trigger_key ADD VALUE 'daily_report';
