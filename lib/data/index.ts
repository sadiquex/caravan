import { createLocalData, type StorageLike } from "./local";
import { generateShareCode } from "../shareCode";
import type { Participant, Trip, TripInput } from "../types";

// SSR-safe storage: real localStorage in the browser, a throwaway map on the server
// (route components are "use client", so server-side reads here just return empty).
function getStorage(): StorageLike {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const base = createLocalData({
  storage: getStorage(),
  genId: () => crypto.randomUUID(),
  genCode: () => generateShareCode(),
  now: () => Date.now(),
});

// ── Live updates ────────────────────────────────────────────────────────────
// Same-tab changes notify a local event target; cross-tab changes arrive via the
// browser's `storage` event. Together this gives "realtime" between two tabs/devices
// on the same machine today, and maps cleanly onto Supabase Realtime later.
const bus = typeof window !== "undefined" ? new EventTarget() : null;
const eventName = (tripId: string) => `gt:changed:${tripId}`;

function notify(tripId: string) {
  bus?.dispatchEvent(new Event(eventName(tripId)));
}

export const data = {
  createTrip: (input: TripInput, creatorId: string): Trip => base.createTrip(input, creatorId),
  getTripByCode: (code: string): Trip | null => base.getTripByCode(code),
  getTripById: (id: string): Trip | null => base.getTripById(id),
  listParticipants: (tripId: string): Participant[] => base.listParticipants(tripId),

  joinTrip(tripId: string, participantId: string, displayName: string): Participant {
    const p = base.joinTrip(tripId, participantId, displayName);
    notify(tripId);
    return p;
  },

  updatePosition(tripId: string, participantId: string, pos: { lat: number; lng: number }): Participant {
    const p = base.updatePosition(tripId, participantId, pos);
    notify(tripId);
    return p;
  },

  leaveTrip(tripId: string, participantId: string): void {
    base.leaveTrip(tripId, participantId);
    notify(tripId);
  },

  endTrip(tripId: string): void {
    base.endTrip(tripId);
    notify(tripId);
  },

  // Subscribe to participant/trip changes for one trip. Returns an unsubscribe fn.
  subscribe(tripId: string, onChange: () => void): () => void {
    if (typeof window === "undefined" || !bus) return () => {};
    const local = () => onChange();
    const cross = (e: StorageEvent) => {
      if (e.key && (e.key === `gt:participants:${tripId}` || e.key === `gt:trip:${tripId}`)) {
        onChange();
      }
    };
    bus.addEventListener(eventName(tripId), local);
    window.addEventListener("storage", cross);
    return () => {
      bus.removeEventListener(eventName(tripId), local);
      window.removeEventListener("storage", cross);
    };
  },
};
