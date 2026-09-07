import { describe, it, expect } from "vitest";
import type { ServerContext } from "@modelcontextprotocol/server";
import { getAuth, hasWriteScope } from "../helpers";

function ctxWith(scopes: string[] | undefined, extra?: Record<string, unknown>): ServerContext {
  if (scopes === undefined) return {} as ServerContext;
  return { http: { authInfo: { scopes, extra } } } as unknown as ServerContext;
}

describe("hasWriteScope", () => {
  it("is false when there is no auth context at all", () => {
    expect(hasWriteScope(ctxWith(undefined))).toBe(false);
  });

  it("is false when scopes doesn't include mcp:write", () => {
    expect(hasWriteScope(ctxWith(["mcp:read"]))).toBe(false);
  });

  it("is true when scopes includes mcp:write", () => {
    expect(hasWriteScope(ctxWith(["mcp:read", "mcp:write"]))).toBe(true);
  });
});

describe("getAuth", () => {
  it("throws when there is no auth context", () => {
    expect(() => getAuth(ctxWith(undefined))).toThrow("Missing authentication context");
  });

  it("returns the extra auth payload when present", () => {
    const ctx = ctxWith(["mcp:read"], { userId: "user-1", role: "admin" });
    expect(getAuth(ctx)).toEqual({ userId: "user-1", role: "admin" });
  });
});
