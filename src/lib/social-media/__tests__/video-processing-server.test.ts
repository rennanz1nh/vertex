import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { sha256OfBuffer } from "../video-processing-server";

describe("sha256OfBuffer", () => {
  it("matches Node's own crypto hash for the same bytes", () => {
    const bytes = Buffer.from("a fake video file's bytes");
    const expected = createHash("sha256").update(bytes).digest("hex");
    expect(sha256OfBuffer(bytes)).toBe(expected);
  });

  it("is deterministic — hashing the same bytes twice gives the same hash", () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5]);
    expect(sha256OfBuffer(bytes)).toBe(sha256OfBuffer(Buffer.from(bytes)));
  });

  it("gives different hashes for different content (the whole basis for dedup)", () => {
    const a = sha256OfBuffer(Buffer.from("video A"));
    const b = sha256OfBuffer(Buffer.from("video B"));
    expect(a).not.toBe(b);
  });
});
