-- AUTO publish mode (spec section 4), decided explicitly by the user rather
-- than assumed: publications can be approved by the system itself, but only
-- through a distinct, narrowly-gated path (auto-publish-service.ts) — never
-- by relaxing the existing human-only approvePublication() function. This
-- column is the visible, auditable marker of that distinction: true means
-- approved_by is null not because data is missing, but because a human
-- deliberately never reviewed it — the system did, under conditions logged
-- in audit_logs as 'publication_auto_approved'.
ALTER TABLE public.social_publications
  ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.social_publications.auto_approved IS
  'True when approval_status became APPROVED via the AUTO-publish system path (auto_publish_enabled + account.auto_publish_authorized), not a human clicking Approve. approved_by stays null in that case by design.';
