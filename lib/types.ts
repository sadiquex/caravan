export type StatusKey = "ahead" | "behind" | "with" | "stopped" | "arrived";

export interface Trip {
  id: string;
  shareCode: string;
  name: string | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  creatorId: string;
  endedAt: number | null;
  expiresAt: number;
  createdAt: number;
}

export interface Participant {
  id: string;
  tripId: string;
  displayName: string;
  latitude: number | null;
  longitude: number | null;
  status: StatusKey | null;
  lastMovedAt: number | null;
  lastSeenAt: number;
}

export interface TripInput {
  name?: string;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
}
