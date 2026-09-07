import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../platforms/registry", () => ({
  getPlatformAdapter: vi.fn(() => ({
    platform: "instagram",
    publishVideo: vi.fn(() => {
      throw new Error("publishVideo should not have been called in this scenario");
    }),
  })),
}));

import { supabaseAdmin } from "@/lib/supabase-admin";
import { publishPublication } from "../publish-service";
import type { PublicationRecord } from "../types";

const basePublication: PublicationRecord = {
  id: "pub-1",
  video_id: "video-1",
  platform: "instagram",
  account_id: "acc-1",
  platform_content_id: "content-1",
  idempotency_key: "idem-1",
  status: "APPROVED",
  approval_status: "APPROVED",
  approved_by: "user-1",
  approved_at: "2026-01-01T00:00:00Z",
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

const actor = { source: "mcp_tool" as const, userId: "user-1", mcpToolName: "publish_publication" };

describe("publishPublication — approval gate (spec: never bypass human approval)", () => {
  beforeEach(() => vi.mocked(supabaseAdmin.from).mockReset());

  it("throws before ever looking at the adapter when approval_status isn't APPROVED", async () => {
    const pending = { ...basePublication, approval_status: "PENDING" as const, status: "PENDING_APPROVAL" as const };
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chainResolving({ data: pending, error: null }) as never);

    await expect(publishPublication("pub-1", actor)).rejects.toThrow(/has not been approved/);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
});

describe("publishPublication — idempotency (spec: never publish the same video twice)", () => {
  beforeEach(() => vi.mocked(supabaseAdmin.from).mockReset());

  it("returns 'already_published' immediately when the publication is already PUBLISHED, without touching the adapter", async () => {
    const published = { ...basePublication, status: "PUBLISHED" as const, published_at: "2026-01-02T00:00:00Z", platform_post_id: "media-1" };
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chainResolving({ data: published, error: null }) as never);

    const result = await publishPublication("pub-1", actor);

    expect(result.outcome).toBe("already_published");
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1); // just the initial getPublication — no claim attempt at all
  });

  it("reports 'already_in_progress' (not an error, not a second publish) when the atomic claim loses a race", async () => {
    const inFlight = { ...basePublication, status: "PUBLISHING" as const };
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => chainResolving({ data: basePublication, error: null }) as never) // initial getPublication: still APPROVED
      .mockImplementationOnce(() => chainResolving({ data: null, error: null }) as never) // atomic claim: 0 rows matched — someone else already claimed it
      .mockImplementationOnce(() => chainResolving({ data: inFlight, error: null }) as never); // re-fetch to report current state

    const result = await publishPublication("pub-1", actor);

    expect(result.outcome).toBe("already_in_progress");
    expect(result.publication.status).toBe("PUBLISHING");
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(3);
    // The registry's publishVideo mock throws if called — reaching this line without a thrown
    // error is itself proof the adapter was never invoked for the losing caller.
  });
});
