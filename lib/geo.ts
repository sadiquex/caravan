export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Great-circle distance between two coordinates, in metres.
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Battery/network-friendly write policy: write on a steady cadence, or sooner when
// the user has moved a meaningful distance. Mirrors the PRD's 20–30s + significant-move rule.
export function shouldWritePosition({
  prev,
  next,
  msSinceLastWrite,
  minIntervalMs = 20_000,
  minDistanceM = 30,
}: {
  prev: LatLng | null;
  next: LatLng;
  msSinceLastWrite: number;
  minIntervalMs?: number;
  minDistanceM?: number;
}): boolean {
  if (!prev) return true;
  if (haversineMeters(prev, next) >= minDistanceM) return true;
  return msSinceLastWrite >= minIntervalMs;
}
