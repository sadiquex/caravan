import { describe, it, expect, beforeEach, vi } from "vitest";

describe("getClientId", () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    let n = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `uuid-${++n}` });
  });

  it("creates an id on first call", async () => {
    const { getClientId } = await import("../clientId");
    expect(getClientId()).toBe("uuid-1");
  });

  it("persists the same id across calls", async () => {
    const { getClientId } = await import("../clientId");
    const first = getClientId();
    expect(getClientId()).toBe(first);
  });
});
