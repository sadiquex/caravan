import type { Participant, Trip, TripInput } from "../types";
import { haversineMeters } from "../geo";

// Movement under this many metres counts as "stationary" — lastMovedAt is preserved
// so the status engine can flag a participant as stopped.
const MOVED_THRESHOLD_M = 20;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalDataDeps {
  storage: StorageLike;
  genId: () => string;
  genCode: () => string;
  now: () => number;
}

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

const tripKey = (id: string) => `gt:trip:${id}`;
const codeKey = (code: string) => `gt:code:${code.toUpperCase()}`;
const participantsKey = (tripId: string) => `gt:participants:${tripId}`;

export function createLocalData(deps: LocalDataDeps) {
  const { storage, genId, genCode, now } = deps;

  function readTrip(id: string): Trip | null {
    const raw = storage.getItem(tripKey(id));
    return raw ? (JSON.parse(raw) as Trip) : null;
  }

  function writeTrip(trip: Trip): void {
    storage.setItem(tripKey(trip.id), JSON.stringify(trip));
    storage.setItem(codeKey(trip.shareCode), trip.id);
  }

  function readParticipants(tripId: string): Participant[] {
    const raw = storage.getItem(participantsKey(tripId));
    return raw ? (JSON.parse(raw) as Participant[]) : [];
  }

  function writeParticipants(tripId: string, list: Participant[]): void {
    storage.setItem(participantsKey(tripId), JSON.stringify(list));
  }

  function isLive(trip: Trip): boolean {
    return trip.endedAt === null && trip.expiresAt > now();
  }

  const api = {
    createTrip(input: TripInput, creatorId: string): Trip {
      const ts = now();
      const trip: Trip = {
        id: genId(),
        shareCode: genCode(),
        name: input.name ?? null,
        destinationName: input.destinationName ?? null,
        destinationLat: input.destinationLat ?? null,
        destinationLng: input.destinationLng ?? null,
        creatorId,
        endedAt: null,
        expiresAt: ts + EIGHT_HOURS,
        createdAt: ts,
      };
      writeTrip(trip);
      return trip;
    },

    getTripByCode(code: string): Trip | null {
      const id = storage.getItem(codeKey(code));
      if (!id) return null;
      const trip = readTrip(id);
      if (!trip || !isLive(trip)) return null;
      return trip;
    },

    getTripById(id: string): Trip | null {
      const trip = readTrip(id);
      if (!trip || !isLive(trip)) return null;
      return trip;
    },

    joinTrip(tripId: string, participantId: string, displayName: string): Participant {
      const list = readParticipants(tripId);
      const existing = list.find((p) => p.id === participantId);
      const ts = now();
      if (existing) {
        existing.displayName = displayName;
        existing.lastSeenAt = ts;
        writeParticipants(tripId, list);
        return existing;
      }
      const participant: Participant = {
        id: participantId,
        tripId,
        displayName,
        latitude: null,
        longitude: null,
        status: null,
        lastMovedAt: null,
        lastSeenAt: ts,
      };
      list.push(participant);
      writeParticipants(tripId, list);
      return participant;
    },

    updatePosition(
      tripId: string,
      participantId: string,
      pos: { lat: number; lng: number }
    ): Participant {
      const list = readParticipants(tripId);
      const p = list.find((x) => x.id === participantId);
      if (!p) throw new Error(`No participant ${participantId} in trip ${tripId}`);
      const ts = now();
      const moved =
        p.latitude == null ||
        p.longitude == null ||
        haversineMeters({ lat: p.latitude, lng: p.longitude }, { lat: pos.lat, lng: pos.lng }) >=
          MOVED_THRESHOLD_M;
      p.latitude = pos.lat;
      p.longitude = pos.lng;
      p.lastSeenAt = ts;
      if (moved) p.lastMovedAt = ts;
      writeParticipants(tripId, list);
      return p;
    },

    listParticipants(tripId: string): Participant[] {
      return readParticipants(tripId);
    },

    leaveTrip(tripId: string, participantId: string): void {
      const list = readParticipants(tripId).filter((p) => p.id !== participantId);
      writeParticipants(tripId, list);
    },

    endTrip(tripId: string): void {
      const trip = readTrip(tripId);
      if (!trip) return;
      trip.endedAt = now();
      writeTrip(trip);
    },

    // Test seam: rebuild the same API over the same storage with a different clock.
    __withClock(nextNow: () => number) {
      return createLocalData({ ...deps, now: nextNow });
    },
  };

  return api;
}
