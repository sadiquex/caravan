import { describe, it, expect } from "vitest";
import { generateShareCode, SHARE_CODE_ALPHABET } from "../shareCode";

describe("generateShareCode", () => {
  it("is 6 characters long by default", () => {
    expect(generateShareCode()).toHaveLength(6);
  });

  it("respects a custom length", () => {
    expect(generateShareCode(4)).toHaveLength(4);
  });

  it("only uses the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateShareCode()) {
        expect(SHARE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("excludes ambiguous characters 0 O 1 I", () => {
    expect(SHARE_CODE_ALPHABET).not.toMatch(/[0O1I]/);
  });

  it("is reasonably non-repeating across calls", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateShareCode()));
    expect(codes.size).toBeGreaterThan(490);
  });
});
