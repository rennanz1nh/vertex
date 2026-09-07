import { supabaseAdmin } from "@/lib/supabase-admin";
import { autoApprovePublication, getPublication } from "./publication-service";
import { publishPublication } from "./publish-service";
import type { ActionActor } from "./types";

/**
 * AUTO publish mode (spec section 4) — opt-in, per-account. This is its own
 * module rather than living inside createPublication (publication-service.ts)
 * or publishPublication (publish-service.ts): publish-service.ts already
 * imports from publication-service.ts, so folding this into either of them
 * would create a circular import. Call sites — the create_publication MCP
 * tool, its REST route, and the watch-folder pipeline — call this right
 * after createPublication returns.
 *
 * Eligibility requires ALL of: the global auto_publish_enabled switch, this
 * specific account's auto_publish_authorized opt-in, and the account still
 * holding can_publish. Missing any of these leaves the publication exactly
 * where createPublication left it — PENDING_APPROVAL, untouched, waiting
 * for a human. Any lookup error here fails closed (skips auto-publish)
 * rather than risking a false positive.
 */
export async function maybeAutoApproveAndPublish(publicationId: string): Promise<void> {
  const publication = await getPublication(publicationId);
  if (!publication || publication.approval_status !== "PENDING") return;

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("social_automation_settings")
    .select("auto_publish_enabled")
    .limit(1)
    .maybeSingle();
  if (settingsError || !settings?.auto_publish_enabled) return;

  const { data: account, error: accountError } = await supabaseAdmin
    .from("social_media_accounts")
    .select("id, auto_publish_authorized, can_publish")
    .eq("id", publication.account_id)
    .maybeSingle();
  if (accountError || !account || !account.auto_publish_authorized || !account.can_publish) return;

  const approved = await autoApprovePublication(publicationId);
  if (!approved) return; // lost a race to a human (or another trigger) already deciding this one

  const actor: ActionActor = { source: "system" };
  await publishPublication(publicationId, actor).catch((err) =>
    console.error("Auto-publish failed after system auto-approval", { publication_id: publicationId, error: err })
  );
}
