import { describe, it, expect } from "vitest";
import { PUSH_CATALOG, PUSH_GROUPS } from "./push-catalog";

describe("push catalog", () => {
  it("has unique keys in known groups", () => {
    const keys = PUSH_CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const groups = new Set(PUSH_GROUPS.map((g) => g.id));
    for (const e of PUSH_CATALOG) expect(groups.has(e.group)).toBe(true);
  });

  it("every placeholder in the default text has a sample value", () => {
    for (const e of PUSH_CATALOG) {
      const used = [...`${e.title} ${e.message}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const v of used) expect(Object.keys(e.sample), `${e.key} uses {${v}}`).toContain(v);
    }
  });
});
