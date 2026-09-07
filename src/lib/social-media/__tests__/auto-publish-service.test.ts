import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../publish-service", () => ({ publishPublication: vi.fn().mockResolvedValue({ outcome: "published", publication: {} }) }));

import { supabaseAdmin } from "@/lib/supabase-admin";
import { publishPublication } from "../publish-service";
import { maybeAutoApproveAndPublish } from "../auto-publish-service";
import type { PublicationRecord } from "../types";

const pendingPublication: PublicationRecord = {
  id: "pub-1",
  video_id: "video-1",
  platform: "instagram",
  account_id: "acc-1",
  platform_content_id: "content-1",
  idempotency_key: "idem-1",
  status: "PENDING_APPROVAL",
  approval_status: "PENDING",
  approved_by: null,
  approved_at: null,
  auto_approved: false,
  rejection_reason: null,
  scheduled_at: null,
  timezone: "UTC",
  published_at: null,
  platform_post_id: null,
  permalink: null,
  error_code: null,
  error_message: null,
  platform_response: null,
  retry_count: 0,
  last_attempt_at: null,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function chainResolving(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    update: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    lte: () => chain,
    maybeSingle: async () => result,
    single: async () => result,
  };
  return chain;
}

function ok(data: unknown) {
  return { data, error: null };
}

describe("maybeAutoApproveAndPublish — fails closed on every gate", () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
    vi.mocked(publishPublication).mockClear();
  });

  it("does nothing when the publication isn't PENDING anymore (already decided)", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chainResolving(ok({ ...pendingPublication, approval_status: "APPROVED" })) as never);

    await maybeAutoApproveAndPublish("pub-1");

    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
    expect(publishPublication).not.toHaveBeenCalled();
  });

  it("does nothing when the global auto_publish_enabled switch is off", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => chainResolving(ok(pendingPublication)) as never)
      .mockImplementationOnce(() => chainResolving(ok({ auto_publish_enabled: false })) as never);

    await maybeAutoApproveAndPublish("pub-1");

    expect(publishPublication).not.toHaveBeenCalled();
  });

  it("does nothing when this specific account isn't auto_publish_authorized, even with the global switch on", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => chainResolving(ok(pendingPublication)) as never)
      .mockImplementationOnce(() => chainResolving(ok({ auto_publish_enabled: true })) as never)
      .mockImplementationOnce(() => chainResolving(ok({ id: "acc-1", auto_publish_authorized: false, can_publish: true })) as never);

    await maybeAutoApproveAndPublish("pub-1");

    expect(publishPublication).not.toHaveBeenCalled();
  });

  it("does nothing when the account no longer holds can_publish, even if auto_publish_authorized is true", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => chainResolving(ok(pendingPublication)) as never)
      .mockImplementationOnce(() => chainResolving(ok({ auto_publish_enabled: true })) as never)
      .mockImplementationOnce(() => chainResolving(ok({ id: "acc-1", auto_publish_authorized: true, can_publish: false })) as never);

    await maybeAutoApproveAndPublish("pub-1");

    expect(publishPublication).not.toHaveBeenCalled();
  });

  it("fails closed (skips) rather than proceeding when the settings lookup itself errors", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => chainResolving(ok(pendingPublication)) as never)
      .mockImplementationOnce(() => chainResolving({ data: null, error: { message: "db down" } }) as never);

    await maybeAutoApproveAndPublish("pub-1");

    expect(publishPublication).not.toHaveBeenCalled();
  });

  it("auto-approves and publishes only when every gate is satisfied", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => chainResolving(ok(pendingPublication)) as never) // getPublication
      .mockImplementationOnce(() => chainResolving(ok({ auto_publish_enabled: true })) as never) // global switch
      .mockImplementationOnce(() => chainResolving(ok({ id: "acc-1", auto_publish_authorized: true, can_publish: true })) as never) // account opt-in
      .mockImplementationOnce(() => chainResolving(ok({ ...pendingPublication, approval_status: "APPROVED", status: "APPROVED", auto_approved: true })) as never); // autoApprovePublication's own UPDATE

    await maybeAutoApproveAndPublish("pub-1");

    expect(publishPublication).toHaveBeenCalledTimes(1);
    expect(publishPublication).toHaveBeenCalledWith("pub-1", { source: "system" });
  });
});
