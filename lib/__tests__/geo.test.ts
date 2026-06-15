import { describe, it, expect } from "vitest";
import { haversineMeters, shouldWritePosition } from "../geo";

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    expect(haversineMeters({ lat: 5.6, lng: -0.2 }, { lat: 5.6, lng: -0.2 })).toBeCloseTo(0, 5);
  });

  it("is ~111km for one degree of latitude", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("matches a known London→Paris distance (~343km)", () => {
    const d = haversineMeters({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(346_000);
  });
});

describe("shouldWritePosition", () => {
  const A = { lat: 5.6037, lng: -0.187 };

  it("always writes the first position (no previous)", () => {
    expect(shouldWritePosition({ prev: null, next: A, msSinceLastWrite: 0 })).toBe(true);
  });

  it("writes when the cadence interval has elapsed even if barely moved", () => {
    const next = { lat: A.lat + 0.00001, lng: A.lng }; // ~1m
    expect(shouldWritePosition({ prev: A, next, msSinceLastWrite: 25_000 })).toBe(true);
  });

  it("writes on significant movement before the interval", () => {
    const next = { lat: A.lat + 0.001, lng: A.lng }; // ~111m
    expect(shouldWritePosition({ prev: A, next, msSinceLastWrite: 1_000 })).toBe(true);
  });

  it("skips tiny movement within the interval", () => {
    const next = { lat: A.lat + 0.00001, lng: A.lng }; // ~1m
    expect(shouldWritePosition({ prev: A, next, msSinceLastWrite: 1_000 })).toBe(false);
  });
});
