import { describe, it, expect } from "vitest";
import { computeStatuses } from "../status";
import type { Participant } from "../types";

const NOW = 1_000_000;

function p(id: string, lat: number | null, lng: number | null, extra: Partial<Participant> = {}): Participant {
  return {
    id,
    tripId: "t",
    displayName: id,
    latitude: lat,
    longitude: lng,
    status: null,
    lastMovedAt: lat == null ? null : NOW,
    lastSeenAt: NOW,
    ...extra,
  };
}

describe("computeStatuses", () => {
  it("excludes participants without a position", () => {
    const result = computeStatuses([p("a", null, null)], null, NOW);
    expect(result.a).toBeUndefined();
  });

  it("marks a participant at the destination as arrived", () => {
    const dest = { lat: 6.0, lng: 0.0 };
    const result = computeStatuses([p("a", 6.0, 0.0)], dest, NOW);
    expect(result.a.status).toBe("arrived");
    expect(result.a.kmLeft).toBeCloseTo(0, 1);
  });

  it("classifies ahead / with / behind by distance to destination", () => {
    const dest = { lat: 6.0, lng: 0.0 };
    const members = [
      p("ahead", 5.99, 0.0), // ~1.1km to dest
      p("mid", 5.95, 0.0),   // ~5.6km
      p("behind", 5.9, 0.0), // ~11km
    ];
    const r = computeStatuses(members, dest, NOW);
    expect(r.ahead.status).toBe("ahead");
    expect(r.mid.status).toBe("with");
    expect(r.behind.status).toBe("behind");
    expect(r.ahead.kmLeft).toBeLessThan(r.behind.kmLeft);
  });

  it("marks tightly clustered members as with group", () => {
    const dest = { lat: 6.0, lng: 0.0 };
    const members = [
      p("a", 5.9, 0.0),
      p("b", 5.9005, 0.0), // ~55m from a
      p("c", 5.90025, 0.0),
    ];
    const r = computeStatuses(members, dest, NOW);
    expect(r.a.status).toBe("with");
    expect(r.b.status).toBe("with");
    expect(r.c.status).toBe("with");
  });

  it("marks a long-stationary member as stopped", () => {
    const dest = { lat: 6.0, lng: 0.0 };
    const members = [
      p("moving", 5.95, 0.0),
      p("parked", 5.9, 0.0, { lastMovedAt: NOW - 6 * 60 * 1000 }),
    ];
    const r = computeStatuses(members, dest, NOW);
    expect(r.parked.status).toBe("stopped");
    expect(r.moving.status).not.toBe("stopped");
  });

  it("never reports arrived when there is no destination", () => {
    const members = [
      p("a", 5.9, 0.0),
      p("b", 5.9003, 0.0), // clustered with a (~33m)
      p("far", 5.91, 0.0), // separated (~1.1km)
    ];
    const r = computeStatuses(members, null, NOW);
    expect(Object.values(r).every((s) => s.status !== "arrived")).toBe(true);
    expect(r.a.status).toBe("with");
    expect(r.far.status).toBe("behind");
  });
});
