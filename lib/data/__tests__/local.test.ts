import { describe, it, expect, beforeEach } from "vitest";
import { createLocalData, type StorageLike } from "../local";

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

function makeData(now = 1000) {
  let codes = ["AAAAAA", "BBBBBB", "CCCCCC"];
  let ids = 0;
  return createLocalData({
    storage: memStorage(),
    genId: () => `id-${++ids}`,
    genCode: () => codes.shift() ?? "ZZZZZZ",
    now: () => now,
  });
}

describe("createLocalData", () => {
  let data: ReturnType<typeof makeData>;
  beforeEach(() => {
    data = makeData(1000);
  });

  describe("createTrip", () => {
    it("stores a trip with a share code and 8h expiry", () => {
      const trip = data.createTrip({ name: "Road Trip", destinationName: "Kumasi" }, "creator-1");
      expect(trip.shareCode).toBe("AAAAAA");
      expect(trip.name).toBe("Road Trip");
      expect(trip.destinationName).toBe("Kumasi");
      expect(trip.creatorId).toBe("creator-1");
      expect(trip.expiresAt).toBe(1000 + EIGHT_HOURS);
      expect(trip.endedAt).toBeNull();
    });

    it("defaults optional fields to null", () => {
      const trip = data.createTrip({}, "creator-1");
      expect(trip.name).toBeNull();
      expect(trip.destinationName).toBeNull();
      expect(trip.destinationLat).toBeNull();
    });
  });

  describe("getTripByCode", () => {
    it("finds a trip by its code (case-insensitive)", () => {
      const created = data.createTrip({ name: "X" }, "creator-1");
      expect(data.getTripByCode("aaaaaa")?.id).toBe(created.id);
    });

    it("returns null for an unknown code", () => {
      expect(data.getTripByCode("NOPE12")).toBeNull();
    });

    it("returns null for an expired trip", () => {
      const past = makeData(0);
      past.createTrip({}, "creator-1");
      const later = createLocalDataAt(past, EIGHT_HOURS + 1);
      expect(later.getTripByCode("AAAAAA")).toBeNull();
    });

    it("returns null for an ended trip", () => {
      const trip = data.createTrip({}, "creator-1");
      data.endTrip(trip.id);
      expect(data.getTripByCode("AAAAAA")).toBeNull();
    });
  });

  describe("joinTrip / listParticipants", () => {
    it("adds a participant", () => {
      const trip = data.createTrip({}, "creator-1");
      data.joinTrip(trip.id, "p-1", "Ama");
      const list = data.listParticipants(trip.id);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: "p-1", displayName: "Ama", tripId: trip.id });
    });

    it("is idempotent per participant id (re-join updates name, no dupes)", () => {
      const trip = data.createTrip({}, "creator-1");
      data.joinTrip(trip.id, "p-1", "Ama");
      data.joinTrip(trip.id, "p-1", "Ama K.");
      const list = data.listParticipants(trip.id);
      expect(list).toHaveLength(1);
      expect(list[0].displayName).toBe("Ama K.");
    });

    it("keeps participants separate per trip", () => {
      const t1 = data.createTrip({}, "c");
      const t2 = data.createTrip({}, "c");
      data.joinTrip(t1.id, "p-1", "Ama");
      data.joinTrip(t2.id, "p-2", "Kojo");
      expect(data.listParticipants(t1.id)).toHaveLength(1);
      expect(data.listParticipants(t2.id)).toHaveLength(1);
    });
  });

  describe("updatePosition", () => {
    it("sets coordinates and marks the first fix as moved", () => {
      const trip = data.createTrip({}, "c");
      data.joinTrip(trip.id, "p-1", "Ama");
      const p = data.updatePosition(trip.id, "p-1", { lat: 5.6, lng: -0.18 });
      expect(p.latitude).toBe(5.6);
      expect(p.longitude).toBe(-0.18);
      expect(p.lastMovedAt).toBe(1000);
      expect(p.lastSeenAt).toBe(1000);
    });

    it("keeps lastMovedAt when essentially stationary but refreshes lastSeenAt", () => {
      const trip = data.createTrip({}, "c");
      data.joinTrip(trip.id, "p-1", "Ama");
      data.updatePosition(trip.id, "p-1", { lat: 5.6, lng: -0.18 });
      const later = data.__withClock(() => 5000);
      const p = later.updatePosition(trip.id, "p-1", { lat: 5.600001, lng: -0.18 }); // ~0.1m
      expect(p.lastMovedAt).toBe(1000); // unchanged → "stopped" can be detected
      expect(p.lastSeenAt).toBe(5000); // still seen → online
    });

    it("advances lastMovedAt when the participant moves meaningfully", () => {
      const trip = data.createTrip({}, "c");
      data.joinTrip(trip.id, "p-1", "Ama");
      data.updatePosition(trip.id, "p-1", { lat: 5.6, lng: -0.18 });
      const later = data.__withClock(() => 5000);
      const p = later.updatePosition(trip.id, "p-1", { lat: 5.61, lng: -0.18 }); // ~1.1km
      expect(p.lastMovedAt).toBe(5000);
    });
  });

  describe("leaveTrip", () => {
    it("removes the participant", () => {
      const trip = data.createTrip({}, "c");
      data.joinTrip(trip.id, "p-1", "Ama");
      data.joinTrip(trip.id, "p-2", "Kojo");
      data.leaveTrip(trip.id, "p-1");
      const list = data.listParticipants(trip.id);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("p-2");
    });
  });
});

// Helper: rebuild a data API over the *same* storage but at a later clock,
// to test expiry without time travel.
function createLocalDataAt(
  source: ReturnType<typeof makeData>,
  now: number
) {
  return source.__withClock(() => now);
}
